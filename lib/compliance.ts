import type {
  AdverseImpactGroupInput,
  AdverseImpactReport,
  ComplianceGuardrailReport,
  MatchRun,
  ProtectedClassCategory,
  ProtectedClassSignal,
} from "./types";

const protectedTerms: Record<ProtectedClassCategory, string[]> = {
  age: ["age", "date of birth", "birth date", "young", "recent graduate", "digital native", "native digital"],
  disability_or_health: ["disabled", "disability", "medical condition", "mental health", "pregnant", "accommodation"],
  family_or_marital_status: ["married", "single", "spouse", "children", "childcare", "family status"],
  gender_or_sex: ["gender", "male", "female", "woman", "man", "pregnancy", "maternity", "paternity"],
  national_origin_or_citizenship: ["citizen", "citizenship", "national origin", "native english", "visa", "green card"],
  photo_or_appearance: ["photo", "headshot", "attractive", "appearance", "height", "weight"],
  race_or_ethnicity: ["race", "ethnicity", "black", "white", "asian", "latino", "hispanic", "caucasian"],
  religion: ["religion", "christian", "muslim", "jewish", "hindu", "church", "mosque", "temple"],
  veteran_status: ["veteran", "military service", "armed forces"],
};

const highRiskJobTerms = new Set([
  "age",
  "date of birth",
  "birth date",
  "young",
  "digital native",
  "native digital",
  "male",
  "female",
  "photo",
  "headshot",
  "attractive",
  "native english",
]);

function escapeRegex(term: string) {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsTerm(text: string, term: string) {
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(term)}([^a-z0-9]|$)`, "i").test(text);
}

function recommendation(source: "job" | "resume", category: ProtectedClassCategory) {
  if (source === "job") {
    return `Review and remove ${category.replaceAll("_", " ")} language unless counsel confirms it is job-related and lawful.`;
  }
  return `Do not use ${category.replaceAll("_", " ")} content for scoring; keep it available only for lawful compliance review.`;
}

export function scanProtectedClassSignals(text: string, source: "job" | "resume"): ProtectedClassSignal[] {
  const signals: ProtectedClassSignal[] = [];
  const lower = text.toLowerCase();
  for (const [category, terms] of Object.entries(protectedTerms) as Array<[ProtectedClassCategory, string[]]>) {
    for (const term of terms) {
      if (!containsTerm(lower, term)) continue;
      signals.push({
        category,
        term,
        source,
        severity: source === "job" && highRiskJobTerms.has(term) ? "high" : "review",
        recommendation: recommendation(source, category),
      });
    }
  }
  return signals;
}

export function guardrailReport(input: { jobText?: string; resumeText?: string }): ComplianceGuardrailReport {
  const signals = [
    ...scanProtectedClassSignals(input.jobText || "", "job"),
    ...scanProtectedClassSignals(input.resumeText || "", "resume"),
  ];
  const highRisk = signals.some((signal) => signal.severity === "high");
  const recommendations = [
    "Protected-class inference is disabled. Do not infer demographics from name, school, address, photo, or resume wording.",
    "Keep scoring grounded in job-related skills, evidence, hard rules, experience, and recruiter-reviewed outcomes.",
    "Use adverse-impact monitoring only with demographic data that the employer lawfully collected for audit purposes.",
  ];
  if (signals.length) {
    recommendations.unshift("Review flagged protected-class terms before using this run for employment decisions.");
  }

  return {
    generatedAt: new Date().toISOString(),
    protectedClassInference: "disabled",
    signals,
    riskLevel: highRisk ? "high" : signals.length ? "review" : "clear",
    recommendations,
  };
}

export function adverseImpactReport(groups: AdverseImpactGroupInput[]): AdverseImpactReport {
  const normalized = groups
    .filter((group) => group.group.trim() && Number.isFinite(group.selected) && Number.isFinite(group.total))
    .map((group) => ({
      group: group.group.trim(),
      selected: Math.max(0, Math.round(group.selected)),
      total: Math.max(0, Math.round(group.total)),
    }))
    .filter((group) => group.total > 0 && group.selected <= group.total);
  const bestRate = Math.max(0, ...normalized.map((group) => group.selected / group.total));
  const metrics = normalized.map((group) => {
    const selectionRate = group.selected / group.total;
    const impactRatio = bestRate ? selectionRate / bestRate : 0;
    return {
      ...group,
      selectionRate: Math.round(selectionRate * 1000) / 10,
      impactRatio: Math.round(impactRatio * 100) / 100,
      flagged: bestRate > 0 && impactRatio < 0.8,
    };
  });
  const warnings = [
    "This calculation uses the four-fifths rule as a monitoring heuristic, not a legal conclusion.",
    "TalentRank does not infer protected classes; groups must come from lawful employer audit data.",
  ];
  if (metrics.some((metric) => metric.flagged)) {
    warnings.unshift("One or more groups are below the 0.80 impact-ratio threshold and need review.");
  }
  if (!metrics.length) {
    warnings.unshift("No valid group rows were provided.");
  }

  return {
    generatedAt: new Date().toISOString(),
    methodology: "Selection rate by group compared with the highest observed group selection rate; flags impact ratios below 0.80.",
    metrics,
    warnings,
  };
}

export function explainabilitySummary(match: MatchRun) {
  const passedHardRules = match.hardRuleOutcomes.filter((rule) => rule.passed).length;
  const failedHardRules = match.hardRuleOutcomes.filter((rule) => !rule.passed).length;
  return [
    `${match.verdict} at ${match.score}% with ${match.confidence}% confidence.`,
    `${passedHardRules} hard rules passed and ${failedHardRules} failed.`,
    `Strongest scoring areas: match ${match.breakdown.match}, skills ${match.breakdown.skills}, experience ${match.breakdown.experience}, education ${match.breakdown.education}.`,
    `${match.evidence.length} evidence snippets support the score; ${match.missingSignals.length} material gaps remain.`,
  ];
}
