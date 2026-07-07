export type RoleTemplate = "auto" | "data" | "software" | "sales" | "finance" | "operations";

export type CandidateStatus = "new" | "screened" | "shortlisted" | "held" | "rejected" | "interview";

export type RecruiterDecision = "shortlist" | "hold" | "reject" | "interview";

export type MatchVerdict = "Strong match" | "Recruiter review" | "Needs evidence" | "Low match" | "Auto-reject";

export interface Organization {
  id: string;
  name: string;
  createdAt: string;
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
