import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, type AuthUser } from "@/lib/auth";
import { parseCandidateName, scoreCandidate } from "@/lib/matching";
import { extractStructuredProfile, parseResumeFile, type ParsedResumeFile } from "@/lib/parsing";
import {
  createCandidateWithResume,
  createEvaluation,
  createJob,
  createMatchRun,
  getCandidatePoolByResumeIds,
} from "@/lib/store";
import type { Candidate, ResumeDocument } from "@/lib/types";

const baseScreenSchema = z.object({
  job: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    location: z.string().optional(),
    roleTemplate: z.enum(["auto", "data", "software", "sales", "finance", "operations"]).default("auto"),
    hardRules: z.array(z.string()).default([]),
  }),
  resumes: z
    .array(
      z.object({
        fileName: z.string().min(1),
        mimeType: z.string().default("text/plain"),
        text: z.string().min(1),
      }),
    )
    .default([]),
  resumeIds: z.array(z.string()).default([]),
});

const screenSchema = baseScreenSchema.refine((input) => input.resumes.length > 0 || input.resumeIds.length > 0, {
  message: "Upload resumes or select saved candidates.",
});

const jobSchema = baseScreenSchema.shape.job;

type StoredResumeInput = {
  candidate: Candidate;
  resume: ResumeDocument;
};

export async function POST(request: Request) {
  try {
    const user = await requireRole("recruiter");
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const jobPayload = JSON.parse(String(formData.get("job") || "{}"));
      const job = jobSchema.parse(jobPayload);
      const files = formData.getAll("resumes").filter((item): item is File => item instanceof File);
      const resumeIds = [
        ...formData.getAll("resumeIds").map(String),
        ...JSON.parse(String(formData.get("savedResumeIds") || "[]")),
      ].filter(Boolean);
      if (!files.length && !resumeIds.length) {
        return NextResponse.json({ error: "Upload resumes or select saved candidates." }, { status: 400 });
      }
      const resumes = await Promise.all(files.map((file) => parseResumeFile(file)));
      const storedResumes = resumeIds.length ? await getCandidatePoolByResumeIds(resumeIds) : [];
      return await screen(job, resumes, storedResumes, user);
    }

    const parsed = screenSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    return await screen(
      parsed.data.job,
      parsed.data.resumes.map((resume) => ({
        ...resume,
        parser: "json",
        warnings: [],
        parsedJson: extractStructuredProfile(resume.text),
        parseConfidence: Math.min(100, Math.max(45, Math.round(resume.text.length / 35))),
      })),
      parsed.data.resumeIds.length ? await getCandidatePoolByResumeIds(parsed.data.resumeIds) : [],
      user,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Screening failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

async function screen(jobInput: z.infer<typeof jobSchema>, resumes: ParsedResumeFile[], storedResumes: StoredResumeInput[] = [], user?: AuthUser) {
  const job = await createJob({ ...jobInput, organizationId: user?.organizationId });
  const results = [];

  for (const resumeInput of resumes) {
    const candidateName = parseCandidateName(resumeInput.fileName, resumeInput.text);
    const { candidate, resume } = await createCandidateWithResume({
      organizationId: user?.organizationId,
      name: candidateName,
      email: resumeInput.parsedJson.contact.email,
      phone: resumeInput.parsedJson.contact.phone,
      fileName: resumeInput.fileName,
      mimeType: resumeInput.mimeType,
      rawText: resumeInput.text,
      parsedJson: resumeInput.parsedJson,
      parseConfidence: resumeInput.parseConfidence,
    });
    const scored = scoreCandidate({
      jobId: job.id,
      candidateId: candidate.id,
      jobText: job.description,
      resumeText: resume.rawText || "",
      hardRules: job.hardRules,
      roleTemplate: job.roleTemplate,
    });
    const matchRun = await createMatchRun(scored);
    results.push({
      candidate,
      resume: {
        ...resume,
        parser: resumeInput.parser,
        warnings: resumeInput.warnings,
      },
      matchRun,
    });
  }

  for (const item of storedResumes) {
    const scored = scoreCandidate({
      jobId: job.id,
      candidateId: item.candidate.id,
      jobText: job.description,
      resumeText: item.resume.rawText || "",
      hardRules: job.hardRules,
      roleTemplate: job.roleTemplate,
    });
    const matchRun = await createMatchRun(scored);
    results.push({
      candidate: item.candidate,
      resume: {
        ...item.resume,
        parser: "saved-pool",
        warnings: [],
      },
      matchRun,
    });
  }

  results.sort((a, b) => b.matchRun.score - a.matchRun.score);
  const passed = results.filter((item) => item.matchRun.verdict !== "Auto-reject");
  const strong = passed.filter((item) => item.matchRun.score >= 80);

  await createEvaluation({
    jobId: job.id,
    model: "TalentRank hybrid-v0.6",
    candidateCount: results.length,
    shortlistCount: passed.length,
    strongMatchCount: strong.length,
    avgScore: passed.length ? Math.round(passed.reduce((sum, item) => sum + item.matchRun.score, 0) / passed.length) : 0,
    avgConfidence: Math.round(results.reduce((sum, item) => sum + item.matchRun.confidence, 0) / results.length),
    parseHealth: Math.round(results.reduce((sum, item) => sum + item.resume.parseConfidence, 0) / results.length),
    falseKnockoutReviewCount: results.filter((item) => item.matchRun.verdict === "Auto-reject" && item.matchRun.breakdown.skills >= 75).length,
  });

  return NextResponse.json({ job, results }, { status: 201 });
}
