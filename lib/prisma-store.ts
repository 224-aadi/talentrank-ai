import { prisma } from "./prisma";
import { explainabilitySummary, guardrailReport } from "./compliance";
import { compareBenchmarkRuns, computeCalibrationMetrics } from "./benchmarking";
import type {
  AuditEvent,
  BenchmarkCase,
  BenchmarkComparison,
  BenchmarkLabel,
  BenchmarkLabelValue,
  BenchmarkRun,
  CalibrationMetrics,
  Candidate,
  EvaluationSnapshot,
  Job,
  MatchRun,
  RecruiterDecision,
  RecruiterDecisionRecord,
  ResumeDocument,
  RetentionReport,
  VectorRecord,
} from "./types";

const client = prisma as any;

function iso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}

function roleTemplate(value: string) {
  return value.toLowerCase();
}

function candidateStatus(value: string) {
  return value.toLowerCase();
}

function upper(value: string) {
  return value.toUpperCase();
}

function statusForDecision(decision: RecruiterDecision) {
  if (decision === "shortlist") return "SHORTLISTED";
  if (decision === "hold") return "HELD";
  if (decision === "reject") return "REJECTED";
  return "INTERVIEW";
}

function mapJob(job: any): Job {
  return {
    id: job.id,
    organizationId: job.organizationId,
    title: job.title,
    description: job.description,
    location: job.location || undefined,
    roleTemplate: roleTemplate(job.roleTemplate) as Job["roleTemplate"],
    hardRules: job.hardRules || [],
    createdAt: iso(job.createdAt),
    updatedAt: iso(job.updatedAt),
  };
}

function mapCandidate(candidate: any): Candidate {
  return {
    id: candidate.id,
    organizationId: candidate.organizationId,
    name: candidate.name,
    email: candidate.email || undefined,
    phone: candidate.phone || undefined,
    status: candidateStatus(candidate.status) as Candidate["status"],
    createdAt: iso(candidate.createdAt),
    updatedAt: iso(candidate.updatedAt),
  };
}

function mapResume(resume: any): ResumeDocument {
  return {
    id: resume.id,
    candidateId: resume.candidateId,
    fileName: resume.fileName,
    mimeType: resume.mimeType,
    storageKey: resume.storageKey,
    rawText: resume.rawText || undefined,
    parsedJson: resume.parsedJson || undefined,
    parseStatus: resume.parseStatus.toLowerCase(),
    parseConfidence: resume.parseConfidence,
    createdAt: iso(resume.createdAt),
  };
}

function mapMatchRun(run: any): MatchRun {
  return {
    id: run.id,
    jobId: run.jobId,
    candidateId: run.candidateId,
    modelVersion: run.modelVersion,
    score: run.score,
    confidence: run.confidence,
    verdict: run.verdict,
    roleFamily: run.roleFamily,
    breakdown: run.breakdown,
    matchedSignals: run.matchedSignals || [],
    missingSignals: run.missingSignals || [],
    hardRuleOutcomes: run.hardRuleOutcomes || [],
    evidence: run.evidence || [],
    riskFlags: run.riskFlags || [],
    createdAt: iso(run.createdAt),
  };
}

function mapDecision(decision: any): RecruiterDecisionRecord {
  return {
    id: decision.id,
    jobId: decision.jobId,
    candidateId: decision.candidateId,
    userId: decision.userId,
    decision: decision.decision.toLowerCase(),
    notes: decision.notes || undefined,
    createdAt: iso(decision.createdAt),
  };
}

function mapBenchmark(label: any): BenchmarkLabel {
  return {
    id: label.id,
    jobId: label.jobId,
    candidateId: label.candidateId,
    label: label.label.toLowerCase(),
    notes: label.notes || undefined,
    createdAt: iso(label.createdAt),
  };
}

function mapBenchmarkCase(item: any): BenchmarkCase {
  return {
    id: item.id,
    jobId: item.jobId,
    candidateId: item.candidateId,
    expectedLabel: item.expectedLabel.toLowerCase(),
    roleFamily: item.roleFamily || undefined,
    seniority: item.seniority || undefined,
    location: item.location || undefined,
    source: item.source || undefined,
    notes: item.notes || undefined,
    createdAt: iso(item.createdAt),
  };
}

function mapBenchmarkRun(item: any): BenchmarkRun {
  return {
    id: item.id,
    at: iso(item.createdAt),
    organizationId: item.organizationId,
    jobId: item.jobId || undefined,
    modelVersion: item.modelVersion,
    metrics: item.metrics,
    caseCount: item.caseCount,
    notes: item.notes || undefined,
  };
}

function mapAudit(event: any): AuditEvent {
  const payload = event.payload || {};
  return {
    id: event.id,
    type: event.type,
    at: iso(event.createdAt),
    actorId: event.actorId || undefined,
    organizationId: event.organizationId,
    jobId: event.jobId || undefined,
    candidateId: event.candidateId || undefined,
    candidateName: payload.candidateName,
    decision: payload.decision,
    score: payload.score,
    verdict: payload.verdict,
    model: payload.model,
    roleFamily: payload.roleFamily,
    metadata: payload.metadata || payload,
  };
}

function mapEvaluation(evaluation: any): EvaluationSnapshot {
  return {
    id: evaluation.id,
    at: iso(evaluation.createdAt),
    jobId: evaluation.jobId || undefined,
    model: evaluation.model,
    candidateCount: evaluation.candidateCount,
    shortlistCount: evaluation.shortlistCount,
    strongMatchCount: evaluation.strongMatchCount,
    avgScore: evaluation.avgScore,
    avgConfidence: evaluation.avgConfidence,
    parseHealth: evaluation.parseHealth,
    falseKnockoutReviewCount: evaluation.falseKnockoutReviewCount,
    notes: evaluation.notes || undefined,
  };
}

function mapVector(record: any): VectorRecord {
  return {
    id: record.id,
    resumeId: record.resumeId,
    candidateId: record.candidateId,
    section: record.section,
    text: record.text,
    embedding: record.embedding || [],
    provider: record.provider,
    model: record.model,
    dimensions: record.dimensions,
    createdAt: iso(record.createdAt),
    updatedAt: iso(record.updatedAt),
  };
}

async function ensureOrg(organizationId = "org_demo") {
  return await client.organization.upsert({
    where: { id: organizationId },
    update: {},
    create: { id: organizationId, name: organizationId === "org_demo" ? "Demo Organization" : organizationId },
  });
}

async function ensureUser(userId = "user_demo", organizationId = "org_demo") {
  await ensureOrg(organizationId);
  return await client.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      organizationId,
      email: `${userId}@talentrank.local`,
      name: userId === "user_demo" ? "Demo Recruiter" : userId,
      role: "RECRUITER",
    },
  });
}

export async function listJobs(organizationId?: string) {
  return (await client.job.findMany({ where: organizationId ? { organizationId } : undefined, orderBy: { createdAt: "desc" } })).map(mapJob);
}

export async function getJob(jobId: string, organizationId?: string) {
  const job = await client.job.findFirst({ where: { id: jobId, ...(organizationId ? { organizationId } : {}) } });
  return job ? mapJob(job) : null;
}

export async function createJob(input: Pick<Job, "title" | "description" | "roleTemplate" | "hardRules"> & Partial<Job>) {
  const organizationId = input.organizationId || "org_demo";
  await ensureOrg(organizationId);
  const job = await client.job.create({
    data: {
      organizationId,
      title: input.title,
      description: input.description,
      location: input.location,
      roleTemplate: upper(input.roleTemplate || "auto"),
      hardRules: input.hardRules,
    },
  });
  await client.auditEvent.create({
    data: {
      organizationId,
      jobId: job.id,
      type: "job.created",
      payload: { roleTemplate: input.roleTemplate, hardRuleCount: input.hardRules.length },
    },
  });
  return mapJob(job);
}

export async function listAuditEvents(organizationId?: string) {
  return (await client.auditEvent.findMany({ where: organizationId ? { organizationId } : undefined, orderBy: { createdAt: "desc" } })).map(mapAudit);
}

export async function createAuditEvent(input: Omit<AuditEvent, "id" | "at">) {
  const organizationId = input.organizationId || "org_demo";
  await ensureOrg(organizationId);
  const event = await client.auditEvent.create({
    data: {
      organizationId,
      jobId: input.jobId,
      candidateId: input.candidateId,
      actorId: input.actorId,
      type: input.type,
      payload: input,
    },
  });
  return mapAudit(event);
}

export async function createEvaluation(input: Omit<EvaluationSnapshot, "id" | "at">) {
  const evaluation = await client.evaluationSnapshot.create({
    data: {
      jobId: input.jobId,
      model: input.model,
      candidateCount: input.candidateCount,
      shortlistCount: input.shortlistCount,
      strongMatchCount: input.strongMatchCount,
      avgScore: input.avgScore,
      avgConfidence: input.avgConfidence,
      parseHealth: input.parseHealth,
      falseKnockoutReviewCount: input.falseKnockoutReviewCount,
      notes: input.notes,
    },
  });
  return mapEvaluation(evaluation);
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
  const organizationId = input.organizationId || "org_demo";
  await ensureOrg(organizationId);
  const candidate = await client.candidate.create({
    data: {
      organizationId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      status: "SCREENED",
    },
  });
  const resume = await client.resumeDocument.create({
    data: {
      candidateId: candidate.id,
      fileName: input.fileName,
      mimeType: input.mimeType,
      storageKey: input.storageKey || `local/${candidate.id}/${input.fileName}`,
      rawText: input.rawText,
      parsedJson: input.parsedJson,
      parseStatus: "PARSED",
      parseConfidence: input.parseConfidence,
    },
  });
  await client.auditEvent.create({
    data: {
      organizationId,
      candidateId: candidate.id,
      type: "candidate.created",
      payload: { candidateName: candidate.name, fileName: resume.fileName, parseConfidence: resume.parseConfidence },
    },
  });
  return { candidate: mapCandidate(candidate), resume: mapResume(resume) };
}

export async function createMatchRun(input: Omit<MatchRun, "id" | "createdAt">) {
  const job = await client.job.findUnique({ where: { id: input.jobId } });
  const candidate = await client.candidate.findUnique({ where: { id: input.candidateId } });
  if (!job || !candidate || job.organizationId !== candidate.organizationId) {
    throw new Error("Candidate or job not found.");
  }
  const matchRun = await client.matchRun.create({
    data: {
      jobId: input.jobId,
      candidateId: input.candidateId,
      modelVersion: input.modelVersion,
      score: input.score,
      confidence: input.confidence,
      verdict: input.verdict,
      roleFamily: input.roleFamily,
      breakdown: input.breakdown,
      matchedSignals: input.matchedSignals,
      missingSignals: input.missingSignals,
      hardRuleOutcomes: input.hardRuleOutcomes,
      evidence: input.evidence,
      riskFlags: input.riskFlags,
    },
  });
  await client.auditEvent.create({
    data: {
      organizationId: job?.organizationId || "org_demo",
      jobId: input.jobId,
      candidateId: input.candidateId,
      type: "match.created",
      payload: {
        score: input.score,
        verdict: input.verdict,
        model: input.modelVersion,
        roleFamily: input.roleFamily,
      },
    },
  });
  return mapMatchRun(matchRun);
}

export async function createRecruiterDecision(input: {
  jobId: string;
  candidateId: string;
  decision: RecruiterDecision;
  notes?: string;
  userId?: string;
  organizationId?: string;
}) {
  const user = await ensureUser(input.userId || "user_demo");
  const [job, existingCandidate] = await Promise.all([
    client.job.findFirst({ where: { id: input.jobId, ...(input.organizationId ? { organizationId: input.organizationId } : {}) } }),
    client.candidate.findFirst({ where: { id: input.candidateId, ...(input.organizationId ? { organizationId: input.organizationId } : {}) } }),
  ]);
  if (!job || !existingCandidate || job.organizationId !== existingCandidate.organizationId || user.organizationId !== existingCandidate.organizationId) {
    throw new Error("Candidate or job not found.");
  }
  const decision = await client.recruiterDecision.create({
    data: {
      jobId: input.jobId,
      candidateId: input.candidateId,
      userId: user.id,
      decision: upper(input.decision),
      notes: input.notes,
    },
  });
  const candidate = await client.candidate.update({
    where: { id: input.candidateId },
    data: { status: statusForDecision(input.decision) },
  });
  await client.auditEvent.create({
    data: {
      organizationId: candidate.organizationId,
      jobId: input.jobId,
      candidateId: input.candidateId,
      actorId: user.id,
      type: "decision.created",
      payload: { candidateName: candidate.name, decision: input.decision, metadata: { notes: input.notes } },
    },
  });
  return { decision: mapDecision(decision), candidate: mapCandidate(candidate) };
}

export async function listRecruiterDecisions(jobId?: string, organizationId?: string) {
  return (await client.recruiterDecision.findMany({
    where: {
      ...(jobId ? { jobId } : {}),
      ...(organizationId ? { candidate: { organizationId }, job: { organizationId } } : {}),
    },
    orderBy: { createdAt: "desc" },
  })).map(mapDecision);
}

export async function createBenchmarkLabel(input: {
  jobId: string;
  candidateId: string;
  label: BenchmarkLabelValue;
  notes?: string;
  organizationId?: string;
}) {
  const [job, candidate] = await Promise.all([
    client.job.findFirst({ where: { id: input.jobId, ...(input.organizationId ? { organizationId: input.organizationId } : {}) } }),
    client.candidate.findFirst({ where: { id: input.candidateId, ...(input.organizationId ? { organizationId: input.organizationId } : {}) } }),
  ]);
  if (!job || !candidate || job.organizationId !== candidate.organizationId) {
    throw new Error("Candidate or job not found.");
  }
  const label = await client.benchmarkLabel.create({
    data: {
      jobId: input.jobId,
      candidateId: input.candidateId,
      label: upper(input.label),
      notes: input.notes,
    },
  });
  await client.auditEvent.create({
    data: {
      organizationId: job.organizationId,
      jobId: input.jobId,
      candidateId: input.candidateId,
      type: "benchmark.label.created",
      payload: { label: input.label, notes: input.notes },
    },
  });
  return mapBenchmark(label);
}

export async function listBenchmarkLabels(jobId?: string, organizationId?: string) {
  return (await client.benchmarkLabel.findMany({
    where: {
      ...(jobId ? { jobId } : {}),
      ...(organizationId ? { candidate: { organizationId } } : {}),
    },
    orderBy: { createdAt: "desc" },
  })).map(mapBenchmark);
}

export async function importBenchmarkCases(input: Array<Omit<BenchmarkCase, "id" | "createdAt">>, organizationId?: string) {
  if (organizationId && input.length) {
    const [jobs, candidates] = await Promise.all([
      client.job.findMany({ where: { id: { in: input.map((item) => item.jobId) }, organizationId }, select: { id: true } }),
      client.candidate.findMany({ where: { id: { in: input.map((item) => item.candidateId) }, organizationId }, select: { id: true } }),
    ]);
    const jobIds = new Set(jobs.map((job: { id: string }) => job.id));
    const candidateIds = new Set(candidates.map((candidate: { id: string }) => candidate.id));
    if (input.some((item) => !jobIds.has(item.jobId) || !candidateIds.has(item.candidateId))) {
      throw new Error("Benchmark case references a candidate or job outside this organization.");
    }
  }
  await Promise.all(input.map((item) =>
    client.benchmarkCase.upsert({
      where: {
        jobId_candidateId: {
          jobId: item.jobId,
          candidateId: item.candidateId,
        },
      },
      update: {
        expectedLabel: upper(item.expectedLabel),
        roleFamily: item.roleFamily,
        seniority: item.seniority,
        location: item.location,
        source: item.source,
        notes: item.notes,
      },
      create: {
        jobId: item.jobId,
        candidateId: item.candidateId,
        expectedLabel: upper(item.expectedLabel),
        roleFamily: item.roleFamily,
        seniority: item.seniority,
        location: item.location,
        source: item.source,
        notes: item.notes,
      },
    }),
  ));
  return await listBenchmarkCases();
}

export async function listBenchmarkCases(jobId?: string, organizationId?: string) {
  return (await client.benchmarkCase.findMany({
    where: {
      ...(jobId ? { jobId } : {}),
      ...(organizationId ? { candidate: { organizationId } } : {}),
    },
    orderBy: { createdAt: "desc" },
  })).map(mapBenchmarkCase);
}

export async function createBenchmarkRun(input: { jobId?: string; modelVersion?: string; notes?: string; organizationId?: string }) {
  const organizationId = input.organizationId || "org_demo";
  await ensureOrg(organizationId);
  const metrics = await calibrationMetrics(input.jobId, organizationId);
  const latestRun = await client.matchRun.findFirst({
    where: {
      ...(input.jobId ? { jobId: input.jobId } : {}),
      candidate: { organizationId },
      job: { organizationId },
    },
    orderBy: { createdAt: "desc" },
  });
  const caseCount = await client.benchmarkCase.count({
    where: { ...(input.jobId ? { jobId: input.jobId } : {}), candidate: { organizationId } },
  });
  const run = await client.benchmarkRun.create({
    data: {
      organizationId,
      jobId: input.jobId,
      modelVersion: input.modelVersion || latestRun?.modelVersion || "unknown",
      metrics,
      caseCount,
      notes: input.notes,
    },
  });
  return mapBenchmarkRun(run);
}

export async function listBenchmarkRuns(jobId?: string, organizationId?: string) {
  return (await client.benchmarkRun.findMany({
    where: { ...(jobId ? { jobId } : {}), ...(organizationId ? { organizationId } : {}) },
    orderBy: { createdAt: "desc" },
  })).map(mapBenchmarkRun);
}

export async function compareBenchmarkRunIds(baselineId?: string, challengerId?: string, organizationId?: string): Promise<BenchmarkComparison> {
  const runs = await listBenchmarkRuns(undefined, organizationId);
  const baseline = baselineId ? runs.find((run: BenchmarkRun) => run.id === baselineId) || null : runs[1] || null;
  const challenger = challengerId ? runs.find((run: BenchmarkRun) => run.id === challengerId) || null : runs[0] || null;
  return compareBenchmarkRuns(baseline, challenger);
}

function relevance(label?: BenchmarkLabelValue) {
  if (label === "hired") return 4;
  if (label === "offer") return 3;
  if (label === "interviewed") return 2;
  if (label === "good_match") return 1;
  return 0;
}

function correlation(pairs: Array<{ score: number; interviewed: number }>) {
  if (pairs.length < 2) return 0;
  const avgScore = pairs.reduce((sum, item) => sum + item.score, 0) / pairs.length;
  const avgInterview = pairs.reduce((sum, item) => sum + item.interviewed, 0) / pairs.length;
  const numerator = pairs.reduce((sum, item) => sum + (item.score - avgScore) * (item.interviewed - avgInterview), 0);
  const scoreVariance = pairs.reduce((sum, item) => sum + (item.score - avgScore) ** 2, 0);
  const interviewVariance = pairs.reduce((sum, item) => sum + (item.interviewed - avgInterview) ** 2, 0);
  const denominator = Math.sqrt(scoreVariance * interviewVariance);
  return denominator ? numerator / denominator : 0;
}

export async function calibrationMetrics(jobId?: string, organizationId?: string): Promise<CalibrationMetrics> {
  const [runs, labelsResult, decisionsResult, casesResult, jobsResult] = await Promise.all([
    client.matchRun.findMany({
      where: { ...(jobId ? { jobId } : {}), ...(organizationId ? { candidate: { organizationId }, job: { organizationId } } : {}) },
      orderBy: { score: "desc" },
    }),
    listBenchmarkLabels(jobId, organizationId),
    listRecruiterDecisions(jobId, organizationId),
    listBenchmarkCases(jobId, organizationId),
    listJobs(organizationId),
  ]);
  return computeCalibrationMetrics({
    runs: runs.map(mapMatchRun),
    labels: labelsResult,
    decisions: decisionsResult,
    cases: casesResult,
    jobs: jobsResult,
    jobId,
  });
}

export async function listCandidatePool(organizationId?: string) {
  const resumes = await client.resumeDocument.findMany({
    where: organizationId ? { candidate: { organizationId } } : undefined,
    include: { candidate: true },
    orderBy: { createdAt: "desc" },
  });
  return resumes.map((item: any) => ({ resume: mapResume(item), candidate: mapCandidate(item.candidate) }));
}

export async function getResumeDocument(resumeId: string, organizationId?: string) {
  const resume = await client.resumeDocument.findFirst({
    where: { id: resumeId, ...(organizationId ? { candidate: { organizationId } } : {}) },
  });
  return resume ? mapResume(resume) : null;
}

export async function getCandidatePoolByResumeIds(resumeIds: string[], organizationId?: string) {
  const resumes = await client.resumeDocument.findMany({
    where: { id: { in: resumeIds }, ...(organizationId ? { candidate: { organizationId } } : {}) },
    include: { candidate: true },
  });
  return resumes.map((item: any) => ({ resume: mapResume(item), candidate: mapCandidate(item.candidate) }));
}

export async function listVectorRecords() {
  return (await client.vectorRecord.findMany()).map(mapVector);
}

export async function upsertVectorRecords(records: VectorRecord[]) {
  await Promise.all(records.map((record) =>
    client.vectorRecord.upsert({
      where: {
        resumeId_section_provider_model_dimensions: {
          resumeId: record.resumeId,
          section: record.section,
          provider: record.provider,
          model: record.model,
          dimensions: record.dimensions,
        },
      },
      update: {
        text: record.text,
        embedding: record.embedding,
        updatedAt: new Date(),
      },
      create: {
        resumeId: record.resumeId,
        candidateId: record.candidateId,
        section: record.section,
        text: record.text,
        embedding: record.embedding,
        provider: record.provider,
        model: record.model,
        dimensions: record.dimensions,
      },
    }),
  ));
  return records;
}

export async function listMatchRuns(jobId?: string, organizationId?: string) {
  const [runs, decisions] = await Promise.all([
    client.matchRun.findMany({
      where: {
        ...(jobId ? { jobId } : {}),
        ...(organizationId ? { job: { organizationId }, candidate: { organizationId } } : {}),
      },
      include: { job: true, candidate: true },
      orderBy: { createdAt: "desc" },
    }),
    client.recruiterDecision.findMany({ orderBy: { createdAt: "desc" } }),
  ]);
  const mappedDecisions: RecruiterDecisionRecord[] = decisions.map(mapDecision);
  return runs.map((run: any) => ({
    ...mapMatchRun(run),
    job: run.job ? mapJob(run.job) : null,
    candidate: run.candidate ? mapCandidate(run.candidate) : null,
    latestDecision: mappedDecisions.find((decision) => decision.jobId === run.jobId && decision.candidateId === run.candidateId) || null,
  }));
}

export async function retentionReport(retentionDays = 365, organizationId?: string): Promise<RetentionReport> {
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const candidates = await client.candidate.findMany({
    where: { createdAt: { lte: cutoffDate }, ...(organizationId ? { organizationId } : {}) },
    include: { resumes: true },
    orderBy: { createdAt: "asc" },
  });
  const dueCandidates = candidates.map((candidate: any) => {
    const resume = candidate.resumes?.[0];
    return {
      candidateId: candidate.id,
      candidateName: candidate.name,
      resumeId: resume?.id,
      fileName: resume?.fileName,
      createdAt: iso(candidate.createdAt),
      ageDays: Math.floor((Date.now() - new Date(candidate.createdAt).getTime()) / (24 * 60 * 60 * 1000)),
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    retentionDays,
    cutoff: cutoffDate.toISOString(),
    dueCount: dueCandidates.length,
    dueCandidates,
  };
}

export async function auditExport(organizationId?: string) {
  return {
    generatedAt: new Date().toISOString(),
    events: await listAuditEvents(organizationId),
  };
}

export async function explainabilityReport(matchRunId: string, organizationId?: string) {
  const run = await client.matchRun.findFirst({
    where: { id: matchRunId, ...(organizationId ? { job: { organizationId }, candidate: { organizationId } } : {}) },
    include: { job: true, candidate: true },
  });
  if (!run) return null;
  const [resume, decision] = await Promise.all([
    client.resumeDocument.findFirst({ where: { candidateId: run.candidateId }, orderBy: { createdAt: "desc" } }),
    client.recruiterDecision.findFirst({
      where: { jobId: run.jobId, candidateId: run.candidateId },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const matchRun = mapMatchRun(run);
  const job = run.job ? mapJob(run.job) : null;
  const mappedResume = resume ? mapResume(resume) : null;
  return {
    generatedAt: new Date().toISOString(),
    matchRun,
    job,
    candidate: run.candidate ? mapCandidate(run.candidate) : null,
    resume: mappedResume,
    latestDecision: decision ? mapDecision(decision) : null,
    guardrails: guardrailReport({ jobText: job?.description, resumeText: mappedResume?.rawText }),
    summary: explainabilitySummary(matchRun),
  };
}

export async function deleteCandidate(candidateId: string, actorId = "user_demo", organizationId?: string) {
  const candidate = await client.candidate.findFirst({
    where: { id: candidateId, ...(organizationId ? { organizationId } : {}) },
    include: { resumes: true },
  });
  if (!candidate) {
    return {
      candidateId,
      deleted: false,
      removed: { candidates: 0, resumes: 0, matchRuns: 0, decisions: 0, benchmarkLabels: 0, vectors: 0 },
    };
  }
  const resumeIds = candidate.resumes.map((resume: any) => resume.id);
  const [matchRuns, decisions, labels, vectors] = await Promise.all([
    client.matchRun.count({ where: { candidateId } }),
    client.recruiterDecision.count({ where: { candidateId } }),
    client.benchmarkLabel.count({ where: { candidateId } }),
    client.vectorRecord.count({ where: { OR: [{ candidateId }, { resumeId: { in: resumeIds } }] } }),
  ]);
  await client.auditEvent.create({
    data: {
      organizationId: candidate.organizationId,
      candidateId,
      actorId,
      type: "candidate.deleted",
      payload: {
        candidateName: candidate.name,
        metadata: { retentionControl: true, removedResumeCount: candidate.resumes.length },
      },
    },
  });
  await client.candidate.delete({ where: { id: candidateId } });
  return {
    candidateId,
    deleted: true,
    removed: {
      candidates: 1,
      resumes: candidate.resumes.length,
      matchRuns,
      decisions,
      benchmarkLabels: labels,
      vectors,
    },
  };
}
