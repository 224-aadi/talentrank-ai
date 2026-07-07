import { prisma } from "./prisma";
import { explainabilitySummary, guardrailReport } from "./compliance";
import type {
  AuditEvent,
  BenchmarkLabel,
  BenchmarkLabelValue,
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

export async function listJobs() {
  return (await client.job.findMany({ orderBy: { createdAt: "desc" } })).map(mapJob);
}

export async function getJob(jobId: string) {
  const job = await client.job.findUnique({ where: { id: jobId } });
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

export async function listAuditEvents() {
  return (await client.auditEvent.findMany({ orderBy: { createdAt: "desc" } })).map(mapAudit);
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
      storageKey: `local/${candidate.id}/${input.fileName}`,
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
}) {
  const user = await ensureUser(input.userId || "user_demo");
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

export async function listRecruiterDecisions(jobId?: string) {
  return (await client.recruiterDecision.findMany({
    where: jobId ? { jobId } : undefined,
    orderBy: { createdAt: "desc" },
  })).map(mapDecision);
}

export async function createBenchmarkLabel(input: {
  jobId: string;
  candidateId: string;
  label: BenchmarkLabelValue;
  notes?: string;
}) {
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
      organizationId: "org_demo",
      jobId: input.jobId,
      candidateId: input.candidateId,
      type: "benchmark.label.created",
      payload: { label: input.label, notes: input.notes },
    },
  });
  return mapBenchmark(label);
}

export async function listBenchmarkLabels(jobId?: string) {
  return (await client.benchmarkLabel.findMany({
    where: jobId ? { jobId } : undefined,
    orderBy: { createdAt: "desc" },
  })).map(mapBenchmark);
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

export async function calibrationMetrics(jobId?: string): Promise<CalibrationMetrics> {
  const [runs, labelsResult, decisionsResult] = await Promise.all([
    client.matchRun.findMany({ where: jobId ? { jobId } : undefined, orderBy: { score: "desc" } }),
    listBenchmarkLabels(jobId),
    listRecruiterDecisions(jobId),
  ]);
  const mappedRuns: MatchRun[] = runs.map(mapMatchRun);
  const labels: BenchmarkLabel[] = labelsResult;
  const decisions: RecruiterDecisionRecord[] = decisionsResult;
  const labelMap = new Map<string, BenchmarkLabelValue>();
  for (const label of labels) labelMap.set(`${label.jobId}:${label.candidateId}`, label.label);
  for (const decision of decisions) {
    const derived = decision.decision === "interview" ? "interviewed" : decision.decision === "shortlist" ? "good_match" : decision.decision === "reject" ? "bad_match" : undefined;
    if (derived) labelMap.set(`${decision.jobId}:${decision.candidateId}`, derived);
  }
  const labeledRuns = mappedRuns.filter((run) => labelMap.has(`${run.jobId}:${run.candidateId}`));
  const top10 = mappedRuns.slice(0, 10);
  const labeledTop10 = top10.filter((run) => labelMap.has(`${run.jobId}:${run.candidateId}`));
  const relevantTop10 = labeledTop10.filter((run) => relevance(labelMap.get(`${run.jobId}:${run.candidateId}`)) > 0);
  const dcg = top10.reduce((sum, run, index) => {
    const rel = relevance(labelMap.get(`${run.jobId}:${run.candidateId}`));
    return sum + (2 ** rel - 1) / Math.log2(index + 2);
  }, 0);
  const ideal = [...labeledRuns]
    .sort((a, b) => relevance(labelMap.get(`${b.jobId}:${b.candidateId}`)) - relevance(labelMap.get(`${a.jobId}:${a.candidateId}`)))
    .slice(0, 10)
    .reduce((sum, run, index) => sum + (2 ** relevance(labelMap.get(`${run.jobId}:${run.candidateId}`)) - 1) / Math.log2(index + 2), 0);
  const autoRejects = labeledRuns.filter((run) => run.verdict === "Auto-reject");
  const falseRejects = autoRejects.filter((run) => relevance(labelMap.get(`${run.jobId}:${run.candidateId}`)) > 0);
  const overrides = decisions.filter((decision) => {
    const run = mappedRuns.find((item) => item.jobId === decision.jobId && item.candidateId === decision.candidateId);
    if (!run) return false;
    return (decision.decision === "reject" && run.score >= 82) || (["shortlist", "interview"].includes(decision.decision) && run.score < 50);
  });
  const interviewPairs = labeledRuns.map((run) => {
    const label = labelMap.get(`${run.jobId}:${run.candidateId}`);
    return {
      score: run.score,
      interviewed: label === "interviewed" || label === "offer" || label === "hired" ? 1 : 0,
    };
  });
  return {
    evaluatedAt: new Date().toISOString(),
    labeledCount: labeledRuns.length,
    precisionAt10: labeledTop10.length ? Math.round((relevantTop10.length / labeledTop10.length) * 100) : 0,
    ndcgAt10: ideal ? Math.round((dcg / ideal) * 100) : 0,
    falseKnockoutRate: autoRejects.length ? Math.round((falseRejects.length / autoRejects.length) * 100) : 0,
    overrideRate: decisions.length ? Math.round((overrides.length / decisions.length) * 100) : 0,
    scoreToInterviewCorrelation: Math.round(correlation(interviewPairs) * 100) / 100,
    avgScore: labeledRuns.length ? Math.round(labeledRuns.reduce((sum, run) => sum + run.score, 0) / labeledRuns.length) : 0,
    interviewRate: interviewPairs.length ? Math.round((interviewPairs.filter((item) => item.interviewed).length / interviewPairs.length) * 100) : 0,
  };
}

export async function listCandidatePool() {
  const resumes = await client.resumeDocument.findMany({
    include: { candidate: true },
    orderBy: { createdAt: "desc" },
  });
  return resumes.map((item: any) => ({ resume: mapResume(item), candidate: mapCandidate(item.candidate) }));
}

export async function getCandidatePoolByResumeIds(resumeIds: string[]) {
  const resumes = await client.resumeDocument.findMany({
    where: { id: { in: resumeIds } },
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

export async function listMatchRuns(jobId?: string) {
  const [runs, decisions] = await Promise.all([
    client.matchRun.findMany({
      where: jobId ? { jobId } : undefined,
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

export async function retentionReport(retentionDays = 365): Promise<RetentionReport> {
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const candidates = await client.candidate.findMany({
    where: { createdAt: { lte: cutoffDate } },
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

export async function auditExport() {
  return {
    generatedAt: new Date().toISOString(),
    events: await listAuditEvents(),
  };
}

export async function explainabilityReport(matchRunId: string) {
  const run = await client.matchRun.findUnique({
    where: { id: matchRunId },
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

export async function deleteCandidate(candidateId: string, actorId = "user_demo") {
  const candidate = await client.candidate.findUnique({
    where: { id: candidateId },
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
