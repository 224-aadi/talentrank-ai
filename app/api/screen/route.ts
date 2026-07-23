import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, type AuthUser } from "@/lib/auth";
import { parseCandidateName } from "@/lib/matching";
import { rankCandidates, rankingModel, llmRankingEnabled } from "@/lib/llm-ranking";
import {
  extractStructuredProfile,
  parseResumeFile,
  validateJobDescriptionContent,
  validateResumeContent,
  type ParsedResumeFile,
} from "@/lib/parsing";
import { clientKey, checkRateLimit } from "@/lib/rate-limit";
import { storeUploadedResumeFile } from "@/lib/secure-storage";
import { incrementMetric, logEvent } from "@/lib/observability";
import { validateBatchSize, validateResumeUpload } from "@/lib/upload-security";
import {
  createCandidateWithResume,
  createEvaluation,
  createJob,
  createMatchRun,
  getJob,
  getCandidatePoolByResumeIds,
} from "@/lib/store";
import type { Candidate, Job, ResumeDocument } from "@/lib/types";

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
    incrementMetric("screen.request");
    const rateLimit = checkRateLimit(await clientKey("screen"), 20, 60_000);
    if (!rateLimit.ok) {
      return NextResponse.json({ error: "Too many screening requests. Try again shortly." }, { status: 429 });
    }
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const jobPayload = JSON.parse(String(formData.get("job") || "{}"));
      const existingJobId = String(formData.get("jobId") || "").trim();
      let existingJob: Job | undefined;
      let job: z.infer<typeof jobSchema>;
      if (existingJobId) {
        const foundJob = await getJob(existingJobId, user.organizationId);
        if (!foundJob) return NextResponse.json({ error: "Saved job was not found for this workspace." }, { status: 404 });
        existingJob = foundJob;
        job = {
          title: foundJob.title,
          description: foundJob.description,
          location: foundJob.location,
          roleTemplate: foundJob.roleTemplate,
          hardRules: foundJob.hardRules,
        };
      } else {
        const jobDescriptionFile = formData.get("jobDescriptionFile");
        let uploadedJobDescription = "";
        if (jobDescriptionFile instanceof File && jobDescriptionFile.size > 0) {
          await validateResumeUpload(jobDescriptionFile);
          const parsedJobFile = await parseResumeFile(jobDescriptionFile);
          validateJobDescriptionContent(parsedJobFile.fileName, parsedJobFile.text);
          uploadedJobDescription = parsedJobFile.text;
        }
        job = jobSchema.parse({
          ...jobPayload,
          description: [jobPayload.description, uploadedJobDescription]
            .map((value) => String(value || "").trim())
            .filter(Boolean)
            .join("\n\n"),
        });
        validateJobDescriptionContent("Job description", job.description);
      }
      const files = formData.getAll("resumes").filter((item): item is File => item instanceof File);
      validateBatchSize(files);
      const resumeIds = [
        ...formData.getAll("resumeIds").map(String),
        ...JSON.parse(String(formData.get("savedResumeIds") || "[]")),
      ].filter(Boolean);
      if (!files.length && !resumeIds.length) {
        return NextResponse.json({ error: "Upload resumes or select saved candidates." }, { status: 400 });
      }
      const resumes = await Promise.all(files.map(async (file) => {
        const validated = await validateResumeUpload(file);
        const [parsedFile, storedFile] = await Promise.all([parseResumeFile(file), storeUploadedResumeFile(file)]);
        validateResumeContent(parsedFile.fileName, parsedFile.text, parsedFile.parsedJson);
        incrementMetric("storage.write");
        return {
          ...parsedFile,
          storageKey: storedFile.storageKey,
          warnings: [
            ...parsedFile.warnings,
            storedFile.encrypted ? "Original resume file stored encrypted" : "Original resume file stored without encryption key configured",
            `Upload scanner: ${validated.scanner}`,
            `Storage provider: ${storedFile.provider}`,
          ],
        };
      }));
      const storedResumes = resumeIds.length ? await getCandidatePoolByResumeIds(resumeIds, user.organizationId) : [];
      const response = await screen(job, resumes, storedResumes, user, existingJob);
      incrementMetric("screen.success");
      return response;
    }

    const parsed = screenSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    validateJobDescriptionContent("Job description", parsed.data.job.description);
    const response = await screen(
      parsed.data.job,
      parsed.data.resumes.map((resume) => ({
        ...resume,
        parser: "json",
        warnings: [],
        parsedJson: extractStructuredProfile(resume.text),
        parseConfidence: Math.min(100, Math.max(45, Math.round(resume.text.length / 35))),
      })).map((resume) => {
        validateResumeContent(resume.fileName, resume.text, resume.parsedJson);
        return resume;
      }),
      parsed.data.resumeIds.length ? await getCandidatePoolByResumeIds(parsed.data.resumeIds, user.organizationId) : [],
      user,
    );
    incrementMetric("screen.success");
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Screening failed";
    incrementMetric("screen.failure");
    logEvent("screen.failure", { message });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

async function screen(jobInput: z.infer<typeof jobSchema>, resumes: ParsedResumeFile[], storedResumes: StoredResumeInput[] = [], user?: AuthUser, existingJob?: Job) {
  const job = existingJob || await createJob({ ...jobInput, organizationId: user?.organizationId });

  const pending = [];
  for (const resumeInput of resumes) {
    const candidateName = parseCandidateName(resumeInput.fileName, resumeInput.text);
    const { candidate, resume } = await createCandidateWithResume({
      organizationId: user?.organizationId,
      name: candidateName,
      email: resumeInput.parsedJson.contact.email,
      phone: resumeInput.parsedJson.contact.phone,
      fileName: resumeInput.fileName,
      mimeType: resumeInput.mimeType,
      storageKey: resumeInput.storageKey,
      rawText: resumeInput.text,
      parsedJson: resumeInput.parsedJson,
      parseConfidence: resumeInput.parseConfidence,
    });
    pending.push({
      candidate,
      resume: { ...resume, parser: resumeInput.parser, warnings: resumeInput.warnings },
    });
  }
  for (const item of storedResumes) {
    pending.push({
      candidate: item.candidate,
      resume: { ...item.resume, parser: "saved-pool", warnings: [] as string[] },
    });
  }

  const scoredRuns = await rankCandidates(pending.map((item) => ({
    jobId: job.id,
    candidateId: item.candidate.id,
    jobTitle: job.title,
    jobText: job.description,
    resumeText: item.resume.rawText || "",
    hardRules: job.hardRules,
    roleTemplate: job.roleTemplate,
  })));

  const results = [];
  for (const [index, item] of pending.entries()) {
    const matchRun = await createMatchRun(scoredRuns[index]);
    results.push({ ...item, matchRun });
  }

  results.sort((a, b) => b.matchRun.score - a.matchRun.score);
  const passed = results.filter((item) => item.matchRun.verdict !== "Auto-reject");
  const strong = passed.filter((item) => item.matchRun.score >= 80);

  await createEvaluation({
    jobId: job.id,
    model: llmRankingEnabled() ? `TalentRank llm-v1 (${rankingModel()})` : "TalentRank hybrid-v0.7-taxonomy",
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
