import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { prismaEnabled } from "./prisma";
import * as prismaStore from "./prisma-store";
import { explainabilitySummary, guardrailReport } from "./compliance";
import { compareBenchmarkRuns, computeCalibrationMetrics } from "./benchmarking";
import type {
  AuditEvent,
  BenchmarkCase,
  BenchmarkComparison,
  BenchmarkLabel,
  BenchmarkLabelValue,
  BenchmarkRun,
  Candidate,
  CandidatePoolItem,
  CalibrationMetrics,
  DeletionResult,
  EvaluationSnapshot,
  ExplainabilityReport,
  Job,
  MatchRun,
  RecruiterDecision,
  RecruiterDecisionRecord,
  RetentionReport,
  ResumeDocument,
  TalentRankDb,
  VectorRecord,
} from "./types";

const dataDir = path.join(process.cwd(), ".data");
const dbPath = path.join(dataDir, "talentrank.json");

export function createId(prefix: string) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function now() {
  return new Date().toISOString();
}

function statusForDecision(decision: RecruiterDecision): Candidate["status"] {
  if (decision === "shortlist") return "shortlisted";
  if (decision === "hold") return "held";
  if (decision === "reject") return "rejected";
  return "interview";
}

function emptyDb(): TalentRankDb {
  return {
    schemaVersion: 2,
    createdAt: now(),
    organizations: [
      {
        id: "org_demo",
        name: "Demo Organization",
        createdAt: now(),
      },
    ],
    jobs: [],
    candidates: [],
    resumes: [],
    matchRuns: [],
    decisions: [],
    benchmarkLabels: [],
    benchmarkCases: [],
    benchmarkRuns: [],
    auditEvents: [],
    evaluations: [],
    vectorRecords: [],
  };
}

async function ensureDb() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dbPath);
  } catch {
    await writeDb(emptyDb());
  }
}

export async function readDb(): Promise<TalentRankDb> {
  await ensureDb();
  return JSON.parse(await fs.readFile(dbPath, "utf8")) as TalentRankDb;
}

export async function writeDb(db: TalentRankDb) {
  await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
}

function vectors(db: TalentRankDb) {
  db.vectorRecords ||= [];
  return db.vectorRecords;
}

function decisions(db: TalentRankDb) {
  db.decisions ||= [];
  return db.decisions;
}

function benchmarkLabels(db: TalentRankDb) {
  db.benchmarkLabels ||= [];
  return db.benchmarkLabels;
}

function benchmarkCases(db: TalentRankDb) {
  db.benchmarkCases ||= [];
  return db.benchmarkCases;
}

function benchmarkRuns(db: TalentRankDb) {
  db.benchmarkRuns ||= [];
  return db.benchmarkRuns;
}

export async function listJobs() {
  if (prismaEnabled()) return await prismaStore.listJobs();
  const db = await readDb();
  return db.jobs;
}

export async function getJob(jobId: string) {
  if (prismaEnabled()) return await prismaStore.getJob(jobId);
  const db = await readDb();
  return db.jobs.find((job) => job.id === jobId) || null;
}

export async function createJob(input: Pick<Job, "title" | "description" | "roleTemplate" | "hardRules"> & Partial<Job>) {
  if (prismaEnabled()) return await prismaStore.createJob(input);
  const db = await readDb();
  const timestamp = now();
  const job: Job = {
    id: createId("job"),
    organizationId: input.organizationId || "org_demo",
    title: input.title,
    description: input.description,
    location: input.location,
    roleTemplate: input.roleTemplate,
    hardRules: input.hardRules,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  db.jobs.unshift(job);
  db.auditEvents.unshift({
    id: createId("audit"),
    type: "job.created",
    at: timestamp,
    organizationId: job.organizationId,
    jobId: job.id,
    metadata: {
      roleTemplate: job.roleTemplate,
      hardRuleCount: job.hardRules.length,
    },
  });
  await writeDb(db);
  return job;
}

export async function listAuditEvents() {
  if (prismaEnabled()) return await prismaStore.listAuditEvents();
  const db = await readDb();
  return db.auditEvents;
}

export async function createAuditEvent(input: Omit<AuditEvent, "id" | "at">) {
  if (prismaEnabled()) return await prismaStore.createAuditEvent(input);
  const db = await readDb();
  const event: AuditEvent = {
    id: createId("audit"),
    at: now(),
    ...input,
  };
  db.auditEvents.unshift(event);
  await writeDb(db);
  return event;
}

export async function createEvaluation(input: Omit<EvaluationSnapshot, "id" | "at">) {
  if (prismaEnabled()) return await prismaStore.createEvaluation(input);
  const db = await readDb();
  const evaluation: EvaluationSnapshot = {
    id: createId("eval"),
    at: now(),
    ...input,
  };
  db.evaluations.unshift(evaluation);
  await writeDb(db);
  return evaluation;
}

export async function createCandidateWithResume(input: {
  organizationId?: string;
  name: string;
  email?: string;
  phone?: string;
  fileName: string;
  mimeType: string;
  rawText: string;
  parsedJson?: ResumeDocument["parsedJson"];
  parseConfidence: number;
  storageKey?: string;
}) {
  if (prismaEnabled()) return await prismaStore.createCandidateWithResume(input);
  const db = await readDb();
  const timestamp = now();
  const candidate: Candidate = {
    id: createId("cand"),
    organizationId: input.organizationId || "org_demo",
    name: input.name,
    email: input.email,
    phone: input.phone,
    status: "screened",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const resume: ResumeDocument = {
    id: createId("resume"),
    candidateId: candidate.id,
    fileName: input.fileName,
    mimeType: input.mimeType,
    storageKey: input.storageKey || `local/${candidate.id}/${input.fileName}`,
    rawText: input.rawText,
    parsedJson: input.parsedJson,
    parseStatus: "parsed",
    parseConfidence: input.parseConfidence,
    createdAt: timestamp,
  };
  db.candidates.unshift(candidate);
  db.resumes.unshift(resume);
  db.auditEvents.unshift({
    id: createId("audit"),
    type: "candidate.created",
    at: timestamp,
    organizationId: candidate.organizationId,
    candidateId: candidate.id,
    candidateName: candidate.name,
    metadata: {
      fileName: resume.fileName,
      parseConfidence: resume.parseConfidence,
    },
  });
  await writeDb(db);
  return { candidate, resume };
}

export async function createMatchRun(input: Omit<MatchRun, "id" | "createdAt">) {
  if (prismaEnabled()) return await prismaStore.createMatchRun(input);
  const db = await readDb();
  const matchRun: MatchRun = {
    id: createId("match"),
    createdAt: now(),
    ...input,
  };
  db.matchRuns.unshift(matchRun);
  db.auditEvents.unshift({
    id: createId("audit"),
    type: "match.created",
    at: matchRun.createdAt,
    jobId: matchRun.jobId,
    candidateId: matchRun.candidateId,
    score: matchRun.score,
    verdict: matchRun.verdict,
    model: matchRun.modelVersion,
    roleFamily: matchRun.roleFamily,
  });
  await writeDb(db);
  return matchRun;
}

export async function createRecruiterDecision(input: {
  jobId: string;
  candidateId: string;
  decision: RecruiterDecision;
  notes?: string;
  userId?: string;
}) {
  if (prismaEnabled()) return await prismaStore.createRecruiterDecision(input);
  const db = await readDb();
  const timestamp = now();
  const decision: RecruiterDecisionRecord = {
    id: createId("decision"),
    jobId: input.jobId,
    candidateId: input.candidateId,
    userId: input.userId || "user_demo",
    decision: input.decision,
    notes: input.notes,
    createdAt: timestamp,
  };
  decisions(db).unshift(decision);

  const candidate = db.candidates.find((item) => item.id === input.candidateId);
  if (candidate) {
    candidate.status = statusForDecision(input.decision);
    candidate.updatedAt = timestamp;
  }

  db.auditEvents.unshift({
    id: createId("audit"),
    type: "decision.created",
    at: timestamp,
    organizationId: candidate?.organizationId || "org_demo",
    jobId: input.jobId,
    candidateId: input.candidateId,
    candidateName: candidate?.name,
    decision: input.decision,
    metadata: {
      notes: input.notes,
    },
  });
  await writeDb(db);
  return {
    decision,
    candidate: candidate || null,
  };
}

export async function listRecruiterDecisions(jobId?: string) {
  if (prismaEnabled()) return await prismaStore.listRecruiterDecisions(jobId);
  const db = await readDb();
  const all = decisions(db);
  return jobId ? all.filter((item) => item.jobId === jobId) : all;
}

export async function createBenchmarkLabel(input: {
  jobId: string;
  candidateId: string;
  label: BenchmarkLabelValue;
  notes?: string;
}) {
  if (prismaEnabled()) return await prismaStore.createBenchmarkLabel(input);
  const db = await readDb();
  const timestamp = now();
  const label: BenchmarkLabel = {
    id: createId("label"),
    jobId: input.jobId,
    candidateId: input.candidateId,
    label: input.label,
    notes: input.notes,
    createdAt: timestamp,
  };
  benchmarkLabels(db).unshift(label);
  db.auditEvents.unshift({
    id: createId("audit"),
    type: "benchmark.label.created",
    at: timestamp,
    organizationId: "org_demo",
    jobId: input.jobId,
    candidateId: input.candidateId,
    metadata: {
      label: input.label,
      notes: input.notes,
    },
  });
  await writeDb(db);
  return label;
}

export async function listBenchmarkLabels(jobId?: string) {
  if (prismaEnabled()) return await prismaStore.listBenchmarkLabels(jobId);
  const db = await readDb();
  const labels = benchmarkLabels(db);
  return jobId ? labels.filter((label) => label.jobId === jobId) : labels;
}

export async function calibrationMetrics(jobId?: string): Promise<CalibrationMetrics> {
  if (prismaEnabled()) return await prismaStore.calibrationMetrics(jobId);
  const db = await readDb();
  return computeCalibrationMetrics({
    runs: jobId ? db.matchRuns.filter((run) => run.jobId === jobId) : db.matchRuns,
    labels: benchmarkLabels(db),
    decisions: decisions(db),
    cases: benchmarkCases(db),
    jobs: db.jobs,
    jobId,
  });
}

export async function importBenchmarkCases(input: Array<Omit<BenchmarkCase, "id" | "createdAt">>) {
  if (prismaEnabled()) return await prismaStore.importBenchmarkCases(input);
  const db = await readDb();
  const timestamp = now();
  const rows: BenchmarkCase[] = input.map((item) => ({
    id: createId("benchcase"),
    createdAt: timestamp,
    ...item,
  }));
  const keys = new Set(rows.map((item) => `${item.jobId}:${item.candidateId}`));
  db.benchmarkCases = [
    ...rows,
    ...benchmarkCases(db).filter((item) => !keys.has(`${item.jobId}:${item.candidateId}`)),
  ];
  await writeDb(db);
  return rows;
}

export async function listBenchmarkCases(jobId?: string): Promise<BenchmarkCase[]> {
  if (prismaEnabled()) return await prismaStore.listBenchmarkCases(jobId);
  const db = await readDb();
  const rows = benchmarkCases(db);
  return jobId ? rows.filter((item) => item.jobId === jobId) : rows;
}

export async function createBenchmarkRun(input: { jobId?: string; modelVersion?: string; notes?: string }): Promise<BenchmarkRun> {
  if (prismaEnabled()) return await prismaStore.createBenchmarkRun(input);
  const db = await readDb();
  const metrics = await calibrationMetrics(input.jobId);
  const modelVersion = input.modelVersion || db.matchRuns.find((run) => !input.jobId || run.jobId === input.jobId)?.modelVersion || "unknown";
  const run: BenchmarkRun = {
    id: createId("benchrun"),
    at: now(),
    jobId: input.jobId,
    modelVersion,
    metrics,
    caseCount: benchmarkCases(db).filter((item) => !input.jobId || item.jobId === input.jobId).length,
    notes: input.notes,
  };
  benchmarkRuns(db).unshift(run);
  await writeDb(db);
  return run;
}

export async function listBenchmarkRuns(jobId?: string): Promise<BenchmarkRun[]> {
  if (prismaEnabled()) return await prismaStore.listBenchmarkRuns(jobId);
  const db = await readDb();
  const rows = benchmarkRuns(db);
  return jobId ? rows.filter((item) => item.jobId === jobId) : rows;
}

export async function compareBenchmarkRunIds(baselineId?: string, challengerId?: string): Promise<BenchmarkComparison> {
  if (prismaEnabled()) return await prismaStore.compareBenchmarkRunIds(baselineId, challengerId);
  const runs = await listBenchmarkRuns();
  const baseline = baselineId ? runs.find((run) => run.id === baselineId) || null : runs[1] || null;
  const challenger = challengerId ? runs.find((run) => run.id === challengerId) || null : runs[0] || null;
  return compareBenchmarkRuns(baseline, challenger);
}

export async function listCandidatePool(): Promise<CandidatePoolItem[]> {
  if (prismaEnabled()) return await prismaStore.listCandidatePool();
  const db = await readDb();
  return db.resumes
    .map((resume) => ({
      resume,
      candidate: db.candidates.find((candidate) => candidate.id === resume.candidateId),
    }))
    .filter((item): item is { resume: ResumeDocument; candidate: Candidate } => Boolean(item.candidate));
}

export async function getResumeDocument(resumeId: string) {
  if (prismaEnabled()) return await prismaStore.getResumeDocument(resumeId);
  const db = await readDb();
  return db.resumes.find((resume) => resume.id === resumeId) || null;
}

export async function getCandidatePoolByResumeIds(resumeIds: string[]): Promise<CandidatePoolItem[]> {
  if (prismaEnabled()) return await prismaStore.getCandidatePoolByResumeIds(resumeIds);
  const wanted = new Set(resumeIds);
  const pool = await listCandidatePool();
  return pool.filter((item) => wanted.has(item.resume.id));
}

export async function listVectorRecords(): Promise<VectorRecord[]> {
  if (prismaEnabled()) return await prismaStore.listVectorRecords();
  const db = await readDb();
  return vectors(db);
}

export async function upsertVectorRecords(records: VectorRecord[]) {
  if (prismaEnabled()) return await prismaStore.upsertVectorRecords(records);
  if (!records.length) return [];
  const db = await readDb();
  const existing = vectors(db);
  const keys = new Set(records.map((record) => `${record.resumeId}:${record.section}:${record.provider}:${record.model}:${record.dimensions}`));
  db.vectorRecords = [
    ...records,
    ...existing.filter((record) => !keys.has(`${record.resumeId}:${record.section}:${record.provider}:${record.model}:${record.dimensions}`)),
  ];
  await writeDb(db);
  return records;
}

export async function listMatchRuns(jobId?: string) {
  if (prismaEnabled()) return await prismaStore.listMatchRuns(jobId);
  const db = await readDb();
  const runs = jobId ? db.matchRuns.filter((run) => run.jobId === jobId) : db.matchRuns;
  const allDecisions = decisions(db);
  return runs.map((run) => ({
    ...run,
    hardRuleOutcomes: run.hardRuleOutcomes || [],
    job: db.jobs.find((job) => job.id === run.jobId) || null,
    candidate: db.candidates.find((candidate) => candidate.id === run.candidateId) || null,
    latestDecision: allDecisions.find((decision) => decision.jobId === run.jobId && decision.candidateId === run.candidateId) || null,
  }));
}

export async function retentionReport(retentionDays = 365): Promise<RetentionReport> {
  if (prismaEnabled()) return await prismaStore.retentionReport(retentionDays);
  const db = await readDb();
  const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const cutoff = new Date(cutoffTime).toISOString();
  const dueCandidates = db.candidates
    .filter((candidate) => new Date(candidate.createdAt).getTime() <= cutoffTime)
    .map((candidate) => {
      const resume = db.resumes.find((item) => item.candidateId === candidate.id);
      return {
        candidateId: candidate.id,
        candidateName: candidate.name,
        resumeId: resume?.id,
        fileName: resume?.fileName,
        createdAt: candidate.createdAt,
        ageDays: Math.floor((Date.now() - new Date(candidate.createdAt).getTime()) / (24 * 60 * 60 * 1000)),
      };
    });
  return {
    generatedAt: now(),
    retentionDays,
    cutoff,
    dueCount: dueCandidates.length,
    dueCandidates,
  };
}

export async function auditExport() {
  if (prismaEnabled()) return await prismaStore.auditExport();
  return {
    generatedAt: now(),
    events: await listAuditEvents(),
  };
}

export async function explainabilityReport(matchRunId: string): Promise<ExplainabilityReport | null> {
  if (prismaEnabled()) return await prismaStore.explainabilityReport(matchRunId);
  const db = await readDb();
  const matchRun = db.matchRuns.find((run) => run.id === matchRunId);
  if (!matchRun) return null;
  const job = db.jobs.find((item) => item.id === matchRun.jobId) || null;
  const candidate = db.candidates.find((item) => item.id === matchRun.candidateId) || null;
  const resume = db.resumes.find((item) => item.candidateId === matchRun.candidateId) || null;
  const latestDecision = decisions(db).find((item) => item.jobId === matchRun.jobId && item.candidateId === matchRun.candidateId) || null;
  return {
    generatedAt: now(),
    matchRun,
    job,
    candidate,
    resume,
    latestDecision,
    guardrails: guardrailReport({ jobText: job?.description, resumeText: resume?.rawText }),
    summary: explainabilitySummary(matchRun),
  };
}

export async function deleteCandidate(candidateId: string, actorId = "user_demo"): Promise<DeletionResult> {
  if (prismaEnabled()) return await prismaStore.deleteCandidate(candidateId, actorId);
  const db = await readDb();
  const candidate = db.candidates.find((item) => item.id === candidateId);
  const resumeIds = new Set(db.resumes.filter((resume) => resume.candidateId === candidateId).map((resume) => resume.id));
  const before = {
    candidates: db.candidates.length,
    resumes: db.resumes.length,
    matchRuns: db.matchRuns.length,
    decisions: decisions(db).length,
    benchmarkLabels: benchmarkLabels(db).length,
    vectors: vectors(db).length,
  };

  db.candidates = db.candidates.filter((item) => item.id !== candidateId);
  db.resumes = db.resumes.filter((item) => item.candidateId !== candidateId);
  db.matchRuns = db.matchRuns.filter((item) => item.candidateId !== candidateId);
  db.decisions = decisions(db).filter((item) => item.candidateId !== candidateId);
  db.benchmarkLabels = benchmarkLabels(db).filter((item) => item.candidateId !== candidateId);
  db.vectorRecords = vectors(db).filter((item) => item.candidateId !== candidateId && !resumeIds.has(item.resumeId));
  db.auditEvents.unshift({
    id: createId("audit"),
    type: "candidate.deleted",
    at: now(),
    actorId,
    organizationId: candidate?.organizationId || "org_demo",
    candidateId,
    candidateName: candidate?.name,
    metadata: {
      retentionControl: true,
      removedResumeCount: before.resumes - db.resumes.length,
    },
  });
  await writeDb(db);

  return {
    candidateId,
    deleted: Boolean(candidate),
    removed: {
      candidates: before.candidates - db.candidates.length,
      resumes: before.resumes - db.resumes.length,
      matchRuns: before.matchRuns - db.matchRuns.length,
      decisions: before.decisions - decisions(db).length,
      benchmarkLabels: before.benchmarkLabels - benchmarkLabels(db).length,
      vectors: before.vectors - vectors(db).length,
    },
  };
}
