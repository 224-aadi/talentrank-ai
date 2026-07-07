export type RoleTemplate = "auto" | "data" | "software" | "sales" | "finance" | "operations";

export type CandidateStatus = "new" | "screened" | "shortlisted" | "held" | "rejected" | "interview";

export type RecruiterDecision = "shortlist" | "hold" | "reject" | "interview";

export type MatchVerdict = "Strong match" | "Recruiter review" | "Needs evidence" | "Low match" | "Auto-reject";

export interface Organization {
  id: string;
  name: string;
  createdAt: string;
}

export interface AuthUserRecord {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: "admin" | "recruiter" | "reviewer";
  passwordHash?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface Job {
  id: string;
  organizationId: string;
  title: string;
  description: string;
  location?: string;
  roleTemplate: RoleTemplate;
  hardRules: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Candidate {
  id: string;
  organizationId: string;
  name: string;
  email?: string;
  phone?: string;
  status: CandidateStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeDocument {
  id: string;
  candidateId: string;
  fileName: string;
  mimeType: string;
  storageKey: string;
  rawText?: string;
  parsedJson?: StructuredResumeProfile;
  parseStatus: "pending" | "parsed" | "failed";
  parseConfidence: number;
  createdAt: string;
}

export interface MatchRun {
  id: string;
  jobId: string;
  candidateId: string;
  modelVersion: string;
  score: number;
  confidence: number;
  verdict: MatchVerdict;
  roleFamily: string;
  breakdown: {
    match: number;
    skills: number;
    experience: number;
    education: number;
  };
  matchedSignals: string[];
  missingSignals: string[];
  hardRuleOutcomes: HardRuleOutcome[];
  evidence: EvidenceSnippet[];
  riskFlags: string[];
  createdAt: string;
}

export interface EvidenceSnippet {
  label: string;
  text: string;
  source?: string;
  strength?: "exact" | "alias" | "transferable";
  requirement?: string;
}

export interface HardRuleOutcome {
  rule: string;
  passed: boolean;
  evidence?: string;
}

export interface StructuredResumeProfile {
  contact: {
    email?: string;
    phone?: string;
    links: string[];
  };
  sections: Record<string, string[]>;
  skills: string[];
  education: string[];
  experience: string[];
  projects: string[];
  certifications: string[];
  quantifiedEvidence: string[];
  senioritySignals: string[];
  bullets?: string[];
  dates?: string[];
  tables?: ParsedResumeTable[];
  workTimeline?: WorkTimelineItem[];
  layoutWarnings?: string[];
}

export interface ParsedResumeTable {
  title?: string;
  headers: string[];
  rows: string[][];
}

export interface WorkTimelineItem {
  title?: string;
  organization?: string;
  start?: string;
  end?: string;
  raw: string;
}

export type ProtectedClassCategory =
  | "age"
  | "disability_or_health"
  | "family_or_marital_status"
  | "gender_or_sex"
  | "national_origin_or_citizenship"
  | "photo_or_appearance"
  | "race_or_ethnicity"
  | "religion"
  | "veteran_status";

export interface ProtectedClassSignal {
  category: ProtectedClassCategory;
  term: string;
  source: "job" | "resume";
  severity: "review" | "high";
  recommendation: string;
}

export interface ComplianceGuardrailReport {
  generatedAt: string;
  protectedClassInference: "disabled";
  signals: ProtectedClassSignal[];
  riskLevel: "clear" | "review" | "high";
  recommendations: string[];
}

export interface AdverseImpactGroupInput {
  group: string;
  selected: number;
  total: number;
}

export interface AdverseImpactMetric {
  group: string;
  selected: number;
  total: number;
  selectionRate: number;
  impactRatio: number;
  flagged: boolean;
}

export interface AdverseImpactReport {
  generatedAt: string;
  methodology: string;
  metrics: AdverseImpactMetric[];
  warnings: string[];
}

export interface RetentionReport {
  generatedAt: string;
  retentionDays: number;
  cutoff: string;
  dueCount: number;
  dueCandidates: Array<{
    candidateId: string;
    candidateName: string;
    resumeId?: string;
    fileName?: string;
    createdAt: string;
    ageDays: number;
  }>;
}

export interface ExplainabilityReport {
  generatedAt: string;
  matchRun: MatchRun;
  job: Job | null;
  candidate: Candidate | null;
  resume: ResumeDocument | null;
  latestDecision?: RecruiterDecisionRecord | null;
  guardrails: ComplianceGuardrailReport;
  summary: string[];
}

export interface DeletionResult {
  candidateId: string;
  deleted: boolean;
  removed: {
    candidates: number;
    resumes: number;
    matchRuns: number;
    decisions: number;
    benchmarkLabels: number;
    vectors: number;
  };
}

export interface AuditEvent {
  id: string;
  type: string;
  at: string;
  actorId?: string;
  organizationId?: string;
  jobId?: string;
  candidateId?: string;
  candidateName?: string;
  decision?: RecruiterDecision | string;
  score?: number | null;
  verdict?: string;
  model?: string;
  roleFamily?: string;
  metadata?: Record<string, unknown>;
}

export interface EvaluationSnapshot {
  id: string;
  at: string;
  jobId?: string;
  model: string;
  candidateCount: number;
  shortlistCount: number;
  strongMatchCount: number;
  avgScore: number;
  avgConfidence: number;
  parseHealth: number;
  falseKnockoutReviewCount: number;
  notes?: string;
}

export interface RecruiterDecisionRecord {
  id: string;
  jobId: string;
  candidateId: string;
  userId: string;
  decision: RecruiterDecision;
  notes?: string;
  createdAt: string;
}

export type BenchmarkLabelValue = "good_match" | "bad_match" | "interviewed" | "offer" | "hired";

export interface BenchmarkLabel {
  id: string;
  jobId: string;
  candidateId: string;
  label: BenchmarkLabelValue;
  notes?: string;
  createdAt: string;
}

export interface CalibrationMetrics {
  evaluatedAt: string;
  labeledCount: number;
  precisionAt10: number;
  ndcgAt10: number;
  falseKnockoutRate: number;
  overrideRate: number;
  scoreToInterviewCorrelation: number;
  avgScore: number;
  interviewRate: number;
}

export interface TalentRankDb {
  schemaVersion: number;
  createdAt: string;
  organizations: Organization[];
  users?: AuthUserRecord[];
  jobs: Job[];
  candidates: Candidate[];
  resumes: ResumeDocument[];
  matchRuns: MatchRun[];
  decisions?: RecruiterDecisionRecord[];
  benchmarkLabels?: BenchmarkLabel[];
  auditEvents: AuditEvent[];
  evaluations: EvaluationSnapshot[];
  vectorRecords?: VectorRecord[];
}

export interface CandidatePoolItem {
  candidate: Candidate;
  resume: ResumeDocument;
}

export interface RetrievalResult extends CandidatePoolItem {
  retrievalScore: number;
  bm25Score: number;
  semanticScore: number;
  topSemanticSection?: string;
  semanticProvider: string;
  embeddingModel: string;
  booleanMatched: boolean;
  matchedTerms: string[];
  rejectedTerms: string[];
  snippets: EvidenceSnippet[];
}

export interface VectorRecord {
  id: string;
  resumeId: string;
  candidateId: string;
  section: string;
  text: string;
  embedding: number[];
  provider: "local" | "openai";
  model: string;
  dimensions: number;
  createdAt: string;
  updatedAt: string;
}
