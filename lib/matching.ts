import type { EvidenceSnippet, MatchRun, MatchVerdict, RoleTemplate } from "./types";

const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "with",
  "you",
]);

const skillAliases: Record<string, string[]> = {
  analytics: ["analysis", "insights", "eda", "analytical"],
  "machine learning": ["ml", "model", "models", "regression", "classification", "prediction"],
  python: ["pandas", "numpy", "pytorch", "tensorflow", "scikit-learn", "sklearn"],
  sql: ["postgresql", "mysql", "query", "database"],
  statistics: ["statistical", "probability", "calibration"],
  "generative ai": ["llm", "prompt", "agent", "chatbot", "rag"],
  "data visualization": ["tableau", "power bi", "plotly", "dashboard"],
};

const roleBoosts: Record<Exclude<RoleTemplate, "auto">, string[]> = {
  data: ["python", "sql", "statistics", "machine learning", "analytics", "data visualization"],
  software: ["javascript", "typescript", "react", "node", "aws", "docker"],
  sales: ["crm", "salesforce", "pipeline", "quota", "customer"],
  finance: ["accounting", "finance", "forecasting", "risk", "excel"],
  operations: ["vendor", "process", "supply", "logistics", "operations"],
};

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+#.\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(text: string) {
  return normalize(text).replace(/[\s.-]+/g, "");
}

function includesPhrase(text: string, phrase: string) {
  return normalize(text).includes(normalize(phrase)) || compact(text).includes(compact(phrase));
}

function tokens(text: string) {
  return normalize(text)
    .split(" ")
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

function importantTerms(text: string, limit = 50) {
  const counts = new Map<string, number>();
  for (const token of tokens(text)) counts.set(token, (counts.get(token) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term]) => term);
}

function detectSignals(text: string) {
  const allSignals = new Set<string>();
  for (const [signal, aliases] of Object.entries(skillAliases)) {
    if (includesPhrase(text, signal) || aliases.some((alias) => includesPhrase(text, alias))) {
      allSignals.add(signal);
    }
  }
  return [...allSignals];
}

function educationScore(text: string) {
  const hits = ["bachelor", "master", "phd", "degree", "university", "college", "computer science"].filter((term) =>
    includesPhrase(text, term),
  ).length;
  const abbrev = /\bb\.?\s?s\.?\b|\bm\.?\s?s\.?\b/i.test(text) || compact(text).includes("bscomputer");
  return Math.min(100, Math.round(((hits + (abbrev ? 2 : 0)) / 5) * 100));
}

function experienceScore(jobText: string, resumeText: string) {
  const entryLevel = /0\s*-\s*2\s*(years|yrs|year)|entry.level|new grad|early career/i.test(jobText);
  if (entryLevel) return 100;
  const years = [...resumeText.matchAll(/(\d{1,2})\+?\s*(years|yrs|year)/gi)].map((match) => Number(match[1]));
  if (years.length) return Math.min(100, Math.max(...years) * 12);
  return /intern|research assistant|project|coursework|hackathon/i.test(resumeText) ? 70 : 0;
}

function roleFamily(jobText: string, selected: RoleTemplate) {
  if (selected !== "auto") return selected;
  const normalized = normalize(jobText);
  if (/data|analytics|machine learning|sql|python|statistics/.test(normalized)) return "data";
  if (/software|frontend|backend|api|react|typescript/.test(normalized)) return "software";
  if (/sales|account|pipeline|quota|crm/.test(normalized)) return "sales";
  if (/finance|accounting|forecast|risk|budget/.test(normalized)) return "finance";
  return "operations";
}

function evidence(resumeText: string, signals: string[]): EvidenceSnippet[] {
  const chunks = resumeText
    .replace(/\s+/g, " ")
    .split(/(?:\s•\s|(?<=[.!?])\s+)/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 35);
  return signals
    .map((signal) => {
      const terms = [signal, ...(skillAliases[signal] || [])];
      const text = chunks.find((chunk) => terms.some((term) => includesPhrase(chunk, term)));
      return text ? { label: signal, text: text.slice(0, 220) } : null;
    })
    .filter((item): item is EvidenceSnippet => Boolean(item))
    .slice(0, 5);
}

function verdict(score: number, rejected: boolean): MatchVerdict {
  if (rejected) return "Auto-reject";
  if (score >= 82) return "Strong match";
  if (score >= 68) return "Recruiter review";
  if (score >= 50) return "Needs evidence";
  return "Low match";
}

export function parseCandidateName(fileName: string, text: string) {
  const line = text
    .split(/\n+/)
    .map((item) => item.trim())
    .find((item) => item.split(/\s+/).length >= 2 && item.split(/\s+/).length <= 4 && !/@|resume|phone/i.test(item));
  return line || fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
}

export function scoreCandidate(input: {
  jobId: string;
  candidateId: string;
  jobText: string;
  resumeText: string;
  hardRules: string[];
  roleTemplate: RoleTemplate;
}): Omit<MatchRun, "id" | "createdAt"> {
  const terms = importantTerms(input.jobText);
  const resumeTokens = new Set(tokens(input.resumeText));
  const matchedTerms = terms.filter((term) => resumeTokens.has(term) || includesPhrase(input.resumeText, term));
  const lexical = terms.length ? Math.round((matchedTerms.length / terms.length) * 100) : 0;
  const jdSignals = detectSignals(input.jobText);
  const resumeSignals = detectSignals(input.resumeText);
  const matchedSignals = [...new Set([...resumeSignals, ...jdSignals.filter((signal) => includesPhrase(input.resumeText, signal))])];
  const skillScore = jdSignals.length ? Math.round((jdSignals.filter((signal) => matchedSignals.includes(signal)).length / jdSignals.length) * 100) : Math.min(100, matchedSignals.length * 15);
  const family = roleFamily(input.jobText, input.roleTemplate);
  const roleBoost = roleBoosts[family].filter((signal) => matchedSignals.includes(signal)).length * 2;
  const missingRules = input.hardRules.filter((rule) => !includesPhrase(input.resumeText, rule));
  const rejected = missingRules.length > 0;
  const match = Math.max(lexical, Math.round(skillScore * 0.75));
  const experience = experienceScore(input.jobText, input.resumeText);
  const education = educationScore(input.resumeText);
  const score = rejected ? 0 : Math.min(100, Math.round(match * 0.42 + skillScore * 0.3 + experience * 0.18 + education * 0.1 + roleBoost));
  const evidenceSnippets = evidence(input.resumeText, matchedSignals);
  return {
    jobId: input.jobId,
    candidateId: input.candidateId,
    modelVersion: "TalentRank hybrid-v0.6",
    score,
    confidence: Math.min(96, Math.max(45, 55 + evidenceSnippets.length * 8 + matchedSignals.length * 2)),
    verdict: verdict(score, rejected),
    roleFamily: family,
    breakdown: {
      match,
      skills: skillScore,
      experience,
      education,
    },
    matchedSignals,
    missingSignals: jdSignals.filter((signal) => !matchedSignals.includes(signal)),
    evidence: evidenceSnippets,
    riskFlags: [
      ...(rejected ? ["Failed knockout rule"] : []),
      ...(evidenceSnippets.length ? [] : ["No grounded evidence"]),
      ...(skillScore < 55 ? ["Weak skill evidence"] : []),
    ],
  };
}
