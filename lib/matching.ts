import { adjacentFor, aliasesFor, roleSkills, seniorityTerms, skillIds, skillWeight, termsFor } from "./skill-taxonomy";
import type { EvidenceSnippet, HardRuleOutcome, MatchRun, MatchVerdict, RoleTemplate } from "./types";

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

function evidenceLine(text: string, terms: string[]) {
  const chunks = text
    .split(/\n+|(?:\s•\s)|(?<=[.!?])\s+/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 24);
  return chunks.find((chunk) => terms.some((term) => includesPhrase(chunk, term)))?.slice(0, 260);
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
  for (const signal of skillIds) {
    if (termsFor(signal).some((term) => includesPhrase(text, term))) {
      allSignals.add(signal);
    }
  }
  return [...allSignals];
}

function transferableSignals(jdSignals: string[], resumeSignals: string[]) {
  return jdSignals.filter((signal) =>
    !resumeSignals.includes(signal)
    && adjacentFor(signal).some((adjacent) => resumeSignals.includes(adjacent) || includesPhrase(resumeSignals.join(" "), adjacent)),
  );
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

function hardRuleOutcomes(resumeText: string, hardRules: string[]): HardRuleOutcome[] {
  return hardRules.map((rule) => {
    const evidence = evidenceLine(resumeText, [rule]);
    return {
      rule,
      passed: Boolean(evidence) || includesPhrase(resumeText, rule),
      evidence,
    };
  });
}

function signalEvidence(resumeText: string, signals: string[], jdSignals: string[]): EvidenceSnippet[] {
  return signals
    .flatMap((signal) => {
      const terms = termsFor(signal);
      const exact = evidenceLine(resumeText, [signal]);
      const alias = exact ? undefined : evidenceLine(resumeText, aliasesFor(signal));
      const text = exact || alias;
      return text
        ? [
            {
              label: signal,
              requirement: jdSignals.includes(signal) ? "JD signal" : "Resume signal",
              source: "resume evidence",
              strength: exact ? ("exact" as const) : ("alias" as const),
              text,
            },
          ]
        : [];
    })
    .slice(0, 8);
}

function transferableEvidence(resumeText: string, jobText: string, existingLabels: string[]): EvidenceSnippet[] {
  const terms = [...new Set([...importantTerms(jobText, 18), ...seniorityTerms().filter((term) => includesPhrase(jobText, term))])];
  return terms
    .filter((term) => !existingLabels.includes(term))
    .flatMap((term) => {
      const text = evidenceLine(resumeText, [term]);
      return text
        ? [
            {
              label: term,
              requirement: "JD keyword",
              source: "resume evidence",
              strength: "transferable" as const,
              text,
            },
          ]
        : [];
    })
    .slice(0, 4);
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
  const family = roleFamily(input.jobText, input.roleTemplate);
  const transferable = transferableSignals(jdSignals, resumeSignals);
  const matchedSignals = [...new Set([...resumeSignals, ...jdSignals.filter((signal) => termsFor(signal).some((term) => includesPhrase(input.resumeText, term))), ...transferable])];
  const requiredWeight = jdSignals.reduce((sum, signal) => sum + skillWeight(signal, family), 0);
  const matchedWeight = jdSignals.reduce((sum, signal) => {
    if (resumeSignals.includes(signal)) return sum + skillWeight(signal, family);
    if (transferable.includes(signal)) return sum + skillWeight(signal, family) * 0.58;
    return sum;
  }, 0);
  const skillScore = jdSignals.length ? Math.round((matchedWeight / Math.max(0.1, requiredWeight)) * 100) : Math.min(100, matchedSignals.length * 15);
  const roleBoost = roleSkills(family).filter((skill) => resumeSignals.includes(skill.id)).length * 2;
  const ruleOutcomes = hardRuleOutcomes(input.resumeText, input.hardRules);
  const missingRules = ruleOutcomes.filter((outcome) => !outcome.passed).map((outcome) => outcome.rule);
  const rejected = missingRules.length > 0;
  const match = Math.max(lexical, Math.round(skillScore * 0.75));
  const experience = experienceScore(input.jobText, input.resumeText);
  const education = educationScore(input.resumeText);
  const score = rejected ? 0 : Math.min(100, Math.round(match * 0.42 + skillScore * 0.3 + experience * 0.18 + education * 0.1 + roleBoost));
  const signalSnippets = signalEvidence(input.resumeText, matchedSignals, jdSignals);
  const evidenceSnippets = [
    ...ruleOutcomes
      .filter((outcome) => outcome.passed && outcome.evidence)
      .map((outcome) => ({
        label: outcome.rule,
        requirement: "Hard rule",
        source: "knockout proof",
        strength: "exact" as const,
        text: outcome.evidence || "",
      })),
    ...signalSnippets,
    ...transferableEvidence(input.resumeText, input.jobText, signalSnippets.map((snippet) => snippet.label)),
  ].slice(0, 10);
  return {
    jobId: input.jobId,
    candidateId: input.candidateId,
    modelVersion: "TalentRank hybrid-v0.7-taxonomy",
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
    hardRuleOutcomes: ruleOutcomes,
    evidence: evidenceSnippets,
    riskFlags: [
      ...(rejected ? ["Failed knockout rule"] : []),
      ...(evidenceSnippets.length ? [] : ["No grounded evidence"]),
      ...(skillScore < 55 ? ["Weak skill evidence"] : []),
      ...(transferable.length ? ["Transferable skill evidence"] : []),
    ],
  };
}
