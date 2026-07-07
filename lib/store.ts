import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type {
  AuditEvent,
  Candidate,
  EvaluationSnapshot,
  Job,
  MatchRun,
  ResumeDocument,
  TalentRankDb,
} from "./types";

const dataDir = path.join(process.cwd(), ".data");
const dbPath = path.join(dataDir, "talentrank.json");

export function createId(prefix: string) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function now() {
  return new Date().toISOString();
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
    auditEvents: [],
    evaluations: [],
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

export async function listJobs() {
  const db = await readDb();
  return db.jobs;
}

export async function getJob(jobId: string) {
  const db = await readDb();
  return db.jobs.find((job) => job.id === jobId) || null;
}

export async function createJob(input: Pick<Job, "title" | "description" | "roleTemplate" | "hardRules"> & Partial<Job>) {
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
  const db = await readDb();
  return db.auditEvents;
}

export async function createAuditEvent(input: Omit<AuditEvent, "id" | "at">) {
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
}) {
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
    storageKey: `local/${candidate.id}/${input.fileName}`,
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

export async function listMatchRuns(jobId?: string) {
  const db = await readDb();
  const runs = jobId ? db.matchRuns.filter((run) => run.jobId === jobId) : db.matchRuns;
  return runs.map((run) => ({
    ...run,
    job: db.jobs.find((job) => job.id === run.jobId) || null,
    candidate: db.candidates.find((candidate) => candidate.id === run.candidateId) || null,
  }));
}
