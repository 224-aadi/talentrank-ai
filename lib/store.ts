import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { AuditEvent, EvaluationSnapshot, Job, TalentRankDb } from "./types";

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
