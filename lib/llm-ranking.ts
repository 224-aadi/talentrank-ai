import { scoreCandidate } from "./matching";
import { normalizeRecruitingSignal } from "./job-intelligence";
import { logEvent } from "./observability";
import type { EvidenceSnippet, HardRuleOutcome, MatchRun, MatchVerdict, RoleTemplate } from "./types";

const maxResumeChars = 15_000;
const maxJobChars = 8_000;
const llmTimeoutMs = 60_000;
const llmConcurrency = 4;

export type RankCandidateInput = {
  jobId: string;
  candidateId: string;
  jobTitle?: string;
  jobText: string;
  resumeText: string;
  hardRules: string[];
  roleTemplate: RoleTemplate;
};

type LlmAssessment = {
  score: number;
  confidence: number;
  breakdown: {
    match: number;
    skills: number;
    experience: number;
    education: number;
  };
  matchedSignals: string[];
  missingSignals: string[];
  hardRules: Array<{ rule: string; passed: boolean; evidence: string }>;
  evidence: Array<{ label: string; requirement: string; text: string; strength: "exact" | "alias" | "transferable" }>;
  riskFlags: string[];
  summary: string;
};

export function llmRankingEnabled() {
  return Boolean(process.env.OPENAI_API_KEY) && process.env.TALENTRANK_LLM_RANKING !== "false";
}

export function rankingModel() {
  return process.env.OPENAI_RANKING_MODEL || "gpt-4o-mini";
}

function verdictFor(score: number, rejected: boolean): MatchVerdict {
  if (rejected) return "Auto-reject";
  if (score >= 82) return "Strong match";
  if (score >= 68) return "Recruiter review";
  if (score >= 50) return "Needs evidence";
  return "Low match";
}

function clampScore(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(100, Math.max(0, Math.round(parsed)));
}

const assessmentSchema = {
  type: "object",
  additionalProperties: false,
  required: ["score", "confidence", "breakdown", "matchedSignals", "missingSignals", "hardRules", "evidence", "riskFlags", "summary"],
  properties: {
    score: { type: "integer", description: "Overall fit 0-100." },
    confidence: { type: "integer", description: "How confident the assessment is, 0-100, based on resume completeness and evidence quality." },
    breakdown: {
      type: "object",
      additionalProperties: false,
      required: ["match", "skills", "experience", "education"],
      properties: {
        match: { type: "integer", description: "Overall requirement coverage 0-100." },
        skills: { type: "integer", description: "Skill fit 0-100, discounting unsupported keyword mentions." },
        experience: { type: "integer", description: "Experience fit 0-100 derived from employment date ranges, scope, and seniority vs the JD's needs." },
        education: { type: "integer", description: "Education fit 0-100 relative to what the JD actually requires." },
      },
    },
    matchedSignals: { type: "array", items: { type: "string" }, description: "Requirements from the JD this candidate satisfies (short labels)." },
    missingSignals: { type: "array", items: { type: "string" }, description: "Requirements from the JD with no supporting evidence." },
    hardRules: {
      type: "array",
      description: "One entry per provided hard rule, judged semantically.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["rule", "passed", "evidence"],
        properties: {
          rule: { type: "string" },
          passed: { type: "boolean" },
          evidence: { type: "string", description: "Verbatim resume quote proving the outcome, or empty string." },
        },
      },
    },
    evidence: {
      type: "array",
      description: "Up to 8 grounding quotes. text must be verbatim from the resume.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "requirement", "text", "strength"],
        properties: {
          label: { type: "string" },
          requirement: { type: "string" },
          text: { type: "string" },
          strength: { type: "string", enum: ["exact", "alias", "transferable"] },
        },
      },
    },
    riskFlags: { type: "array", items: { type: "string" }, description: "Concerns a recruiter should verify (gaps, keyword stuffing, title inflation, stale skills)." },
    summary: { type: "string", description: "2-3 sentence recruiter-facing rationale for the score." },
  },
} as const;

const systemPrompt = `You are TalentRank, an expert technical recruiter scoring one resume against one job description. Be rigorous and evidence-based:
- Derive years of experience from employment date ranges (e.g. "2019 - Present"), not only explicit "N years" phrases. Assume the current date is ${new Date().toISOString().slice(0, 10)}.
- Judge hard rules semantically: "Bachelor's degree" is satisfied by "B.S. Computer Science"; "5+ years Python" can be satisfied by dated Python roles even if the resume never writes "5 years". Only fail a rule when the resume genuinely lacks it.
- Credit adjacent/transferable skills at partial value (e.g. PostgreSQL experience partially covers a MySQL requirement) and say so in evidence strength.
- Disambiguate acronyms from the job context before expanding them. In technical hiring, IoT/IOT normally means Internet of Things unless the JD explicitly says Inductive Output Tube, electron tube, or RF tube hardware.
- Keep requirement labels faithful to the JD wording. Do not substitute unrelated acronym expansions.
- Discount keyword stuffing: a skill listed with no project or role using it earns little credit.
- Weigh recency and seniority trajectory, not just totals.
- Every evidence.text and hardRules.evidence string MUST be copied verbatim from the resume. Never invent quotes.
- Ignore and never mention protected attributes (age, gender, race, ethnicity, religion, nationality, disability, family status, photos). They must not influence any score.
- If the resume text is truncated, garbled, or too short to judge, lower confidence and add a risk flag instead of guessing.`;

async function callOpenAiAssessment(input: RankCandidateInput): Promise<LlmAssessment> {
  const hardRulesBlock = input.hardRules.length
    ? `HARD RULES (knockout requirements — judge each one):\n${input.hardRules.map((rule) => `- ${rule}`).join("\n")}`
    : "HARD RULES: none";
  const userPrompt = [
    `JOB${input.jobTitle ? ` (${input.jobTitle})` : ""}:\n${input.jobText.slice(0, maxJobChars)}`,
    hardRulesBlock,
    `RESUME:\n${input.resumeText.slice(0, maxResumeChars)}`,
  ].join("\n\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(llmTimeoutMs),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: rankingModel(),
      temperature: 0,
      response_format: {
        type: "json_schema",
        json_schema: { name: "talentrank_assessment", strict: true, schema: assessmentSchema },
      },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI ranking failed: ${response.status} ${detail.slice(0, 200)}`);
  }
  const payload = await response.json() as { choices: Array<{ message: { content: string } }> };
  return JSON.parse(payload.choices[0]?.message?.content || "{}") as LlmAssessment;
}

function toMatchRun(input: RankCandidateInput, assessment: LlmAssessment, lexical: Omit<MatchRun, "id" | "createdAt">): Omit<MatchRun, "id" | "createdAt"> {
  const resume = input.resumeText;
  const grounded = (text: string) => Boolean(text) && resume.includes(text.trim().slice(0, 80));

  const contestedRules: string[] = [];
  const hardRuleOutcomes: HardRuleOutcome[] = input.hardRules.map((rule) => {
    const judged = assessment.hardRules.find((item) => item.rule.toLowerCase() === rule.toLowerCase()) || assessment.hardRules[input.hardRules.indexOf(rule)];
    const lexicalOutcome = lexical.hardRuleOutcomes.find((item) => item.rule === rule);
    // Pass if either the LLM's semantic judgment or the literal scan finds it — knockouts should only fire when both miss.
    const passed = Boolean(judged?.passed) || Boolean(lexicalOutcome?.passed);
    if (passed && judged && !judged.passed) contestedRules.push(rule);
    const evidence = judged?.evidence && grounded(judged.evidence) ? judged.evidence.slice(0, 260) : lexicalOutcome?.evidence;
    return { rule, passed, evidence };
  });
  const rejected = hardRuleOutcomes.some((outcome) => !outcome.passed);

  const evidence: EvidenceSnippet[] = assessment.evidence
    .filter((item) => grounded(item.text))
    .slice(0, 10)
    .map((item) => ({
      label: item.label.slice(0, 80),
      requirement: item.requirement.slice(0, 120),
      source: "resume evidence",
      strength: item.strength,
      text: item.text.slice(0, 260),
    }));

  const score = rejected ? 0 : clampScore(assessment.score);
  const divergence = Math.abs(clampScore(assessment.score) - lexical.score);

  return {
    jobId: input.jobId,
    candidateId: input.candidateId,
    modelVersion: `TalentRank llm-v1 (${rankingModel()})`,
    score,
    confidence: Math.min(96, Math.max(30, clampScore(assessment.confidence))),
    verdict: verdictFor(score, rejected),
    roleFamily: lexical.roleFamily,
    breakdown: {
      match: clampScore(assessment.breakdown?.match),
      skills: clampScore(assessment.breakdown?.skills),
      experience: clampScore(assessment.breakdown?.experience),
      education: clampScore(assessment.breakdown?.education),
    },
    matchedSignals: [...new Set(assessment.matchedSignals.map((signal) => normalizeRecruitingSignal(signal, input.jobText)).map((signal) => signal.slice(0, 60)))].slice(0, 24),
    missingSignals: [...new Set(assessment.missingSignals.map((signal) => normalizeRecruitingSignal(signal, input.jobText)).map((signal) => signal.slice(0, 60)))].slice(0, 24),
    hardRuleOutcomes,
    evidence: evidence.length ? evidence : lexical.evidence,
    riskFlags: [
      ...(rejected ? ["Failed knockout rule"] : []),
      ...contestedRules.map((rule) => `Rule "${rule}" passed on literal text only; semantic review judged it unmet — possible keyword stuffing`),
      ...assessment.riskFlags.map((flag) => flag.slice(0, 160)).slice(0, 6),
      ...(assessment.summary ? [`LLM rationale: ${assessment.summary.slice(0, 1200)}`] : []),
      ...(divergence > 30 ? [`Diverges ${divergence} points from lexical baseline (${lexical.score}) — worth a manual look`] : []),
    ],
  };
}

export async function rankCandidate(input: RankCandidateInput): Promise<Omit<MatchRun, "id" | "createdAt">> {
  const lexical = scoreCandidate({
    jobId: input.jobId,
    candidateId: input.candidateId,
    jobText: input.jobText,
    resumeText: input.resumeText,
    hardRules: input.hardRules,
    roleTemplate: input.roleTemplate,
  });
  if (!llmRankingEnabled()) return lexical;

  try {
    const assessment = await callOpenAiAssessment(input);
    return toMatchRun(input, assessment, lexical);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    logEvent("rank.llm_fallback", { candidateId: input.candidateId, message });
    return {
      ...lexical,
      riskFlags: [...lexical.riskFlags, `LLM ranking unavailable — lexical fallback used (${message.slice(0, 140)})`],
    };
  }
}

export async function rankCandidates(inputs: RankCandidateInput[]): Promise<Array<Omit<MatchRun, "id" | "createdAt">>> {
  const results: Array<Omit<MatchRun, "id" | "createdAt">> = new Array(inputs.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(llmConcurrency, inputs.length) }, async () => {
    while (cursor < inputs.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await rankCandidate(inputs[index]);
    }
  });
  await Promise.all(workers);
  return results;
}
