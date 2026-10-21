import crypto from "node:crypto";
import { prisma, prismaEnabled } from "./prisma";
import { readDb, writeDb } from "./store";
import type { Candidate, Job, MatchRun, ResumeDocument, TalentRankDb } from "./types";

export type ScreeningResponse = {
  job: Job;
  results: Array<{ candidate: Candidate; resume: ResumeDocument & { parser?: string; warnings?: string[] }; matchRun: MatchRun }>;
  errors: Array<{ fileName: string; index: number; error: string }>;
};
type Receipt = { fingerprint: string; response: ScreeningResponse };
type ReceiptDb = TalentRankDb & { screeningReceipts?: Record<string, Receipt> };

export function receiptId(organizationId: string, key: string) {
  return `screen_${crypto.createHash("sha256").update(`${organizationId}:${key}`).digest("hex")}`;
}

export async function readScreeningReceipt(id: string): Promise<Receipt | null> {
  if (prismaEnabled()) {
    const record = await prisma.auditEvent.findUnique({ where: { id } });
    return record?.type === "screen.batch.completed" ? record.payload as unknown as Receipt : null;
  }
  return (await readDb() as ReceiptDb).screeningReceipts?.[id] || null;
}

let commitQueue: Promise<unknown> = Promise.resolve();

export async function persistScreening(id: string, fingerprint: string, response: ScreeningResponse, newJob: boolean, newCandidateIds: Set<string>) {
  const receipt: Receipt = JSON.parse(JSON.stringify({ fingerprint, response }));
  const evaluation = {
    id: crypto.randomUUID(), jobId: response.job.id,
    model: response.results[0]?.matchRun.modelVersion || "TalentRank hybrid-v0.7-taxonomy",
    candidateCount: response.results.length,
    shortlistCount: response.results.filter(item => item.matchRun.verdict !== "Auto-reject").length,
    strongMatchCount: response.results.filter(item => item.matchRun.score >= 80).length,
    avgScore: average(response.results.map(item => item.matchRun.score)),
    avgConfidence: average(response.results.map(item => item.matchRun.confidence)),
    parseHealth: average(response.results.map(item => item.resume.parseConfidence)),
    falseKnockoutReviewCount: response.results.filter(item => item.matchRun.verdict === "Auto-reject" && item.matchRun.breakdown.skills >= 75).length,
  };
  if (prismaEnabled()) {
    try {
      await prisma.$transaction(async tx => {
        const job = response.job;
        if (newJob) await tx.job.create({ data: { ...job, roleTemplate: job.roleTemplate.toUpperCase() as any } });
        const fresh = response.results.filter(item => newCandidateIds.has(item.candidate.id));
        if (fresh.length) {
          await tx.candidate.createMany({ data: fresh.map(({ candidate }) => ({ ...candidate, status: "SCREENED" })) });
          await tx.resumeDocument.createMany({ data: fresh.map(({ resume }) => ({
            id: resume.id, candidateId: resume.candidateId, fileName: resume.fileName, mimeType: resume.mimeType,
            storageKey: resume.storageKey, rawText: resume.rawText,
            parsedJson: { ...resume.parsedJson, ingestion: { parser: resume.parser, warnings: resume.warnings || [] } } as any,
            parseStatus: "PARSED", parseConfidence: resume.parseConfidence, createdAt: resume.createdAt,
          })) });
        }
        if (response.results.length) {
          await tx.matchRun.createMany({ data: response.results.map(({ matchRun }) => ({ ...matchRun, breakdown: matchRun.breakdown as any, evidence: matchRun.evidence as any, hardRuleOutcomes: matchRun.hardRuleOutcomes as any })) });
          await tx.evaluationSnapshot.create({ data: evaluation });
        }
        // The unique receipt and all results commit together, so retries after
        // a lost response or process restart cannot create duplicate candidates.
        await tx.auditEvent.create({ data: { id, organizationId: job.organizationId, jobId: job.id, type: "screen.batch.completed", payload: receipt as any } });
      }, { maxWait: 15_000, timeout: 30_000 });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") {
        const existing = await readScreeningReceipt(id);
        if (existing?.fingerprint === fingerprint) return existing.response;
      }
      throw error;
    }
    return response;
  }
  const task = commitQueue.then(async () => {
    const db = await readDb() as ReceiptDb;
    db.screeningReceipts ||= {};
    const previous = db.screeningReceipts[id];
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new Error("Upload request key was already used for different files.");
      return previous.response;
    }
    if (newJob) db.jobs.unshift(response.job);
    for (const { candidate, resume, matchRun } of response.results) {
      if (newCandidateIds.has(candidate.id)) { db.candidates.unshift(candidate); db.resumes.unshift(resume); }
      db.matchRuns.unshift(matchRun);
    }
    if (response.results.length) db.evaluations.unshift({ ...evaluation, at: new Date().toISOString() });
    db.auditEvents.unshift({ id, type: "screen.batch.completed", at: new Date().toISOString(), organizationId: response.job.organizationId, jobId: response.job.id, metadata: { candidateCount: response.results.length, failedCount: response.errors.length } });
    db.screeningReceipts[id] = receipt;
    await writeDb(db);
    return response;
  });
  commitQueue = task.catch(() => {});
  return await task;
}

function average(values: number[]) { return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0; }
