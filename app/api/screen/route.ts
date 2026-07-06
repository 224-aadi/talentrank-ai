import { NextResponse } from "next/server";
import { z } from "zod";
import { parseCandidateName, scoreCandidate } from "@/lib/matching";
import {
  createCandidateWithResume,
  createEvaluation,
  createJob,
  createMatchRun,
} from "@/lib/store";

const screenSchema = z.object({
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
    .min(1),
});

export async function POST(request: Request) {
  const parsed = screenSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const job = await createJob(parsed.data.job);
  const results = [];

  for (const resumeInput of parsed.data.resumes) {
    const candidateName = parseCandidateName(resumeInput.fileName, resumeInput.text);
    const { candidate, resume } = await createCandidateWithResume({
      name: candidateName,
      fileName: resumeInput.fileName,
      mimeType: resumeInput.mimeType,
      rawText: resumeInput.text,
      parseConfidence: Math.min(100, Math.max(45, Math.round(resumeInput.text.length / 35))),
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
    results.push({ candidate, resume, matchRun });
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
