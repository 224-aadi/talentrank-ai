import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, type AuthUser } from "@/lib/auth";
import { apiError } from "@/lib/api-error";
import { parseCandidateName } from "@/lib/matching";
import { rankCandidates } from "@/lib/llm-ranking";
import { extractStructuredProfile, parseResumeFile, validateJobDescriptionContent, validateResumeContent, type ParsedResumeFile } from "@/lib/parsing";
import { inferJobTitle } from "@/lib/job-intelligence";
import { checkRateLimit } from "@/lib/rate-limit";
import { storeUploadedResumeFile } from "@/lib/secure-storage";
import { incrementMetric, logEvent } from "@/lib/observability";
import { validateBatchSize, validateResumeUpload } from "@/lib/upload-security";
import { getJob, getCandidatePoolByResumeIds } from "@/lib/store";
import { receiptId, readScreeningReceipt, persistScreening, type ScreeningResponse } from "@/lib/screening-persistence";
import type { Candidate, Job, ResumeDocument } from "@/lib/types";

export const maxDuration = 300;
const jobSchema = z.object({
  title: z.string().trim().default(""), description: z.string().default(""), location: z.string().optional(),
  roleTemplate: z.enum(["auto", "data", "software", "sales", "finance", "operations"]).default("auto"),
  hardRules: z.array(z.string()).default([]),
});
const jsonSchema = z.object({
  job: jobSchema, jobId: z.string().optional(),
  resumes: z.array(z.object({ fileName: z.string().min(1), mimeType: z.string().default("text/plain"), text: z.string().min(1) })).default([]),
  resumeIds: z.array(z.string()).default([]),
});
const inFlight = new Map<string, Promise<ScreeningResponse>>();

export async function POST(request: Request) {
  try {
    const user = await requireRole("recruiter");
    incrementMetric("screen.request");
    const key = request.headers.get("idempotency-key") || crypto.randomUUID();
    if (key.length > 200) return NextResponse.json({ error: "Upload request key is too long." }, { status: 400 });
    const id = receiptId(user.organizationId, key);
    const multipart = (request.headers.get("content-type") || "").includes("multipart/form-data");
    const form = multipart ? await request.formData() : null;
    const json = form ? null : jsonSchema.parse(await request.json());
    const files = form ? form.getAll("resumes").filter((file): file is File => file instanceof File) : [];
    validateBatchSize(files.length ? files : (json?.resumes || []).map(item => new File([], item.fileName)));
    const rawJob = form ? JSON.parse(String(form.get("job") || "{}")) : json!.job;
    const jobId = form ? String(form.get("jobId") || "") : json?.jobId;
    const savedIds: string[] = form
      ? [...form.getAll("resumeIds").map(String), ...z.array(z.string()).parse(JSON.parse(String(form.get("savedResumeIds") || "[]")))]
      : json!.resumeIds;
    if (savedIds.length > 50) return NextResponse.json({ error: "Select at most 50 saved resumes per request." }, { status: 400 });
    if (!files.length && !json?.resumes.length && !savedIds.length) return NextResponse.json({ error: "Upload resumes or select saved candidates." }, { status: 400 });
    const jobFile = form?.get("jobDescriptionFile");
    const hash = crypto.createHash("sha256").update(JSON.stringify({ rawJob, jobId, savedIds, resumes: json?.resumes }));
    for (const file of [...files, ...(jobFile instanceof File ? [jobFile] : [])]) hash.update(file.name).update(Buffer.from(await file.arrayBuffer()));
    const fingerprint = hash.digest("hex");
    const receipt = await readScreeningReceipt(id);
    if (receipt) {
      if (receipt.fingerprint !== fingerprint) return NextResponse.json({ error: "Upload request key was already used for different files." }, { status: 409 });
      return NextResponse.json(receipt.response, { status: 201 });
    }
    const rate = checkRateLimit(`screen:${user.organizationId}:${user.id}`, 120, 60_000);
    if (!rate.ok) return NextResponse.json({ error: "Screening is busy. Your upload will resume shortly." }, { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))) } });
    let task = inFlight.get(id);
    if (task) {
      const result = await task;
      const stored = await readScreeningReceipt(id);
      if (stored?.fingerprint !== fingerprint) return NextResponse.json({ error: "Upload request key was already used for different files." }, { status: 409 });
      return NextResponse.json(result, { status: 201 });
    }
    task = processBatch(user, id, fingerprint, rawJob, jobId, files, jobFile instanceof File ? jobFile : undefined, json?.resumes || [], savedIds);
    inFlight.set(id, task);
    try { return NextResponse.json(await task, { status: 201 }); }
    finally { inFlight.delete(id); }
  } catch (error) {
    incrementMetric("screen.failure");
    const failure = apiError(error);
    logEvent("screen.failure", { status: failure.status, message: failure.message });
    return NextResponse.json({ error: failure.message }, { status: failure.status, headers: failure.status === 503 ? { "Retry-After": "10" } : undefined });
  }
}

async function processBatch(user: AuthUser, id: string, fingerprint: string, rawJob: unknown, jobId: string | undefined, files: File[], jobFile: File | undefined, textResumes: Array<{ fileName: string; mimeType: string; text: string }>, savedIds: string[]) {
  const timestamp = new Date().toISOString();
  const existingJob = jobId ? await getJob(jobId, user.organizationId) : null;
  if (jobId && !existingJob) throw new Error("Saved job was not found for this workspace.");
  const input = jobSchema.parse(rawJob);
  if (!existingJob && jobFile?.size) {
    await validateResumeUpload(jobFile);
    const parsed = await parseResumeFile(jobFile);
    validateJobDescriptionContent(jobFile.name, parsed.text);
    input.description = [input.description, parsed.text].filter(Boolean).join("\n\n");
  }
  if (!existingJob) validateJobDescriptionContent("Job description", input.description);
  const job: Job = existingJob || { ...input, id: crypto.randomUUID(), organizationId: user.organizationId, title: input.title || inferJobTitle(input.description), createdAt: timestamp, updatedAt: timestamp };
  const errors: ScreeningResponse["errors"] = [];
  const parsedResumes: ParsedResumeFile[] = [];
  // Bound parser/OCR memory even when callers bypass browser chunking.
  const all = files.length ? files : textResumes;
  for (let offset = 0; offset < all.length; offset += 2) {
    const items = await Promise.all(all.slice(offset, offset + 2).map(async (item, relativeIndex) => {
      const index = offset + relativeIndex;
      const fileName = item instanceof File ? item.name : item.fileName;
      try {
        if (item instanceof File) {
          const validated = await validateResumeUpload(item);
          const parsed = await parseResumeFile(item);
          validateResumeContent(parsed.fileName, parsed.text, parsed.parsedJson);
          const stored = await storeUploadedResumeFile(item);
          incrementMetric("storage.write");
          return { ...parsed, storageKey: stored.storageKey, warnings: [...parsed.warnings, `Upload scanner: ${validated.scanner}`, `Storage provider: ${stored.provider}`] };
        }
        const parsedJson = extractStructuredProfile(item.text);
        validateResumeContent(fileName, item.text, parsedJson);
        return { ...item, parsedJson, parser: "json", warnings: [], parseConfidence: Math.min(100, Math.max(45, Math.round(item.text.length / 35))) };
      } catch (error) {
        const failure = apiError(error);
        if (failure.status === 503) throw error;
        errors.push({ fileName, index, error: failure.message });
        return null;
      }
    }));
    parsedResumes.push(...items.filter((item): item is NonNullable<typeof item> => Boolean(item)));
  }
  const pending: Array<{ candidate: Candidate; resume: ResumeDocument & { parser?: string; warnings?: string[] } }> = parsedResumes.map(parsed => {
    const candidate: Candidate = { id: crypto.randomUUID(), organizationId: user.organizationId, name: parseCandidateName(parsed.fileName, parsed.text), email: parsed.parsedJson.contact.email, phone: parsed.parsedJson.contact.phone, status: "screened", createdAt: timestamp, updatedAt: timestamp };
    return { candidate, resume: { id: crypto.randomUUID(), candidateId: candidate.id, fileName: parsed.fileName, mimeType: parsed.mimeType, storageKey: parsed.storageKey || "", rawText: parsed.text, parsedJson: parsed.parsedJson, parseStatus: "parsed", parseConfidence: parsed.parseConfidence, createdAt: timestamp, parser: parsed.parser, warnings: parsed.warnings } };
  });
  const newCandidateIds = new Set(pending.map(item => item.candidate.id));
  const saved = await getCandidatePoolByResumeIds(savedIds, user.organizationId);
  if (saved.length !== new Set(savedIds).size) throw new Error("Some selected resumes were not found in this workspace.");
  pending.push(...saved.map(item => ({ ...item, resume: { ...item.resume, parser: "saved-pool", warnings: [] } })));
  const scores = await rankCandidates(pending.map(item => ({ jobId: job.id, candidateId: item.candidate.id, jobTitle: job.title, jobText: job.description, resumeText: item.resume.rawText || "", hardRules: job.hardRules, roleTemplate: job.roleTemplate })));
  const results = pending.map((item, index) => ({ ...item, matchRun: { ...scores[index], id: crypto.randomUUID(), createdAt: timestamp } })).sort((a, b) => b.matchRun.score - a.matchRun.score);
  const response = await persistScreening(id, fingerprint, { job, results, errors }, !existingJob, newCandidateIds);
  incrementMetric("screen.success");
  return response;
}
