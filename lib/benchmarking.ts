import type {
  BenchmarkCase,
  BenchmarkComparison,
  BenchmarkLabel,
  BenchmarkLabelValue,
  BenchmarkRun,
  CalibrationMetrics,
  Job,
  MatchRun,
  RecruiterDecisionRecord,
} from "./types";

export function relevance(label?: BenchmarkLabelValue) {
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

function pct(numerator: number, denominator: number) {
  return denominator ? Math.round((numerator / denominator) * 100) : 0;
}

function precisionAt(runs: MatchRun[], labelMap: Map<string, BenchmarkLabelValue>, k: number) {
  const top = runs.slice(0, k).filter((run) => labelMap.has(`${run.jobId}:${run.candidateId}`));
  const relevant = top.filter((run) => relevance(labelMap.get(`${run.jobId}:${run.candidateId}`)) > 0);
  return pct(relevant.length, top.length);
}

function segmentMetrics(
  labeledRuns: MatchRun[],
  labelMap: Map<string, BenchmarkLabelValue>,
  jobs: Job[] = [],
  cases: BenchmarkCase[] = [],
) {
  const caseMap = new Map(cases.map((item) => [`${item.jobId}:${item.candidateId}`, item]));
  const jobMap = new Map(jobs.map((job) => [job.id, job]));
  const groups = new Map<string, MatchRun[]>();
  for (const run of labeledRuns) {
    const item = caseMap.get(`${run.jobId}:${run.candidateId}`);
    const fields = {
      roleFamily: item?.roleFamily || jobMap.get(run.jobId)?.roleTemplate || run.roleFamily,
      seniority: item?.seniority,
      location: item?.location || jobMap.get(run.jobId)?.location,
      source: item?.source,
    };
    for (const [segment, value] of Object.entries(fields)) {
      if (!value) continue;
      const key = `${segment}:${value}`;
      groups.set(key, [...(groups.get(key) || []), run]);
    }
  }
  return [...groups.entries()].map(([key, rows]) => {
    const [segment, ...rest] = key.split(":");
    const interviewCount = rows.filter((run) => {
      const label = labelMap.get(`${run.jobId}:${run.candidateId}`);
      return label === "interviewed" || label === "offer" || label === "hired";
    }).length;
    return {
      segment,
      value: rest.join(":"),
      labeledCount: rows.length,
      precisionAt10: precisionAt([...rows].sort((a, b) => b.score - a.score), labelMap, 10),
      avgScore: Math.round(rows.reduce((sum, run) => sum + run.score, 0) / rows.length),
      interviewRate: pct(interviewCount, rows.length),
    };
  }).sort((a, b) => b.labeledCount - a.labeledCount).slice(0, 24);
}

export function computeCalibrationMetrics(input: {
  runs: MatchRun[];
  labels: BenchmarkLabel[];
  decisions: RecruiterDecisionRecord[];
  cases?: BenchmarkCase[];
  jobs?: Job[];
  jobId?: string;
}): CalibrationMetrics {
  const runs = [...input.runs].sort((a, b) => b.score - a.score);
  const labelMap = new Map<string, BenchmarkLabelValue>();
  for (const item of input.cases || []) {
    if (!input.jobId || item.jobId === input.jobId) labelMap.set(`${item.jobId}:${item.candidateId}`, item.expectedLabel);
  }
  for (const label of input.labels) {
    if (!input.jobId || label.jobId === input.jobId) labelMap.set(`${label.jobId}:${label.candidateId}`, label.label);
  }
  for (const decision of input.decisions) {
    if (input.jobId && decision.jobId !== input.jobId) continue;
    const derived = decision.decision === "interview" ? "interviewed" : decision.decision === "shortlist" ? "good_match" : decision.decision === "reject" ? "bad_match" : undefined;
    if (derived) labelMap.set(`${decision.jobId}:${decision.candidateId}`, derived);
  }

  const labeledRuns = runs.filter((run) => labelMap.has(`${run.jobId}:${run.candidateId}`));
  const top10 = runs.slice(0, 10);
  const dcg = top10.reduce((sum, run, index) => {
    const rel = relevance(labelMap.get(`${run.jobId}:${run.candidateId}`));
    return sum + (2 ** rel - 1) / Math.log2(index + 2);
  }, 0);
  const ideal = [...labeledRuns]
    .sort((a, b) => relevance(labelMap.get(`${b.jobId}:${b.candidateId}`)) - relevance(labelMap.get(`${a.jobId}:${a.candidateId}`)))
    .slice(0, 10)
    .reduce((sum, run, index) => sum + (2 ** relevance(labelMap.get(`${run.jobId}:${run.candidateId}`)) - 1) / Math.log2(index + 2), 0);
  const relevantTotal = labeledRuns.filter((run) => relevance(labelMap.get(`${run.jobId}:${run.candidateId}`)) > 0).length;
  const relevantTop50 = runs.slice(0, 50).filter((run) => relevance(labelMap.get(`${run.jobId}:${run.candidateId}`)) > 0).length;
  const autoRejects = labeledRuns.filter((run) => run.verdict === "Auto-reject");
  const falseRejects = autoRejects.filter((run) => relevance(labelMap.get(`${run.jobId}:${run.candidateId}`)) > 0);
  const hardRuleRows = new Map<string, { falseKnockouts: number; autoRejects: number }>();
  for (const run of autoRejects) {
    for (const outcome of run.hardRuleOutcomes.filter((rule) => !rule.passed)) {
      const current = hardRuleRows.get(outcome.rule) || { falseKnockouts: 0, autoRejects: 0 };
      current.autoRejects += 1;
      if (relevance(labelMap.get(`${run.jobId}:${run.candidateId}`)) > 0) current.falseKnockouts += 1;
      hardRuleRows.set(outcome.rule, current);
    }
  }
  const overrides = input.decisions.filter((decision) => {
    if (input.jobId && decision.jobId !== input.jobId) return false;
    const run = runs.find((item) => item.jobId === decision.jobId && item.candidateId === decision.candidateId);
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
    precisionAt5: precisionAt(runs, labelMap, 5),
    precisionAt10: precisionAt(runs, labelMap, 10),
    recallAt50: pct(relevantTop50, relevantTotal),
    ndcgAt10: ideal ? Math.round((dcg / ideal) * 100) : 0,
    falseKnockoutRate: pct(falseRejects.length, autoRejects.length),
    falseKnockoutByHardRule: [...hardRuleRows.entries()].map(([rule, row]) => ({
      rule,
      ...row,
      rate: pct(row.falseKnockouts, row.autoRejects),
    })).sort((a, b) => b.falseKnockouts - a.falseKnockouts),
    overrideRate: pct(overrides.length, input.decisions.length),
    scoreToInterviewCorrelation: Math.round(correlation(interviewPairs) * 100) / 100,
    avgScore: labeledRuns.length ? Math.round(labeledRuns.reduce((sum, run) => sum + run.score, 0) / labeledRuns.length) : 0,
    interviewRate: pct(interviewPairs.filter((item) => item.interviewed).length, interviewPairs.length),
    segmentMetrics: segmentMetrics(labeledRuns, labelMap, input.jobs, input.cases),
  };
}

export function compareBenchmarkRuns(baseline: BenchmarkRun | null, challenger: BenchmarkRun | null): BenchmarkComparison {
  const deltas: Record<string, number> = {};
  const fields: Array<keyof CalibrationMetrics> = ["precisionAt5", "precisionAt10", "recallAt50", "ndcgAt10", "falseKnockoutRate", "overrideRate", "scoreToInterviewCorrelation"];
  for (const field of fields) {
    const base = Number(baseline?.metrics[field] || 0);
    const next = Number(challenger?.metrics[field] || 0);
    deltas[field] = Math.round((next - base) * 100) / 100;
  }
  const summary = Object.entries(deltas)
    .filter(([, delta]) => delta !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 5)
    .map(([field, delta]) => `${field} ${delta > 0 ? "improved" : "declined"} by ${Math.abs(delta)}.`);
  if (!summary.length) summary.push("No measurable metric movement between the selected benchmark runs.");
  return {
    generatedAt: new Date().toISOString(),
    baseline,
    challenger,
    deltas,
    summary,
  };
}
