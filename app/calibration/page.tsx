import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { calibrationMetrics, listBenchmarkCases, listBenchmarkLabels, listBenchmarkRuns, listMatchRuns } from "@/lib/store";
import type { BenchmarkCase, BenchmarkLabel, BenchmarkRun, Candidate, Job, MatchRun, RecruiterDecisionRecord } from "@/lib/types";

type MatchListRow = MatchRun & {
  job: Job | null;
  candidate: Candidate | null;
  latestDecision?: RecruiterDecisionRecord | null;
};

export default async function CalibrationPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const [metrics, labels, matches, cases, runs] = await Promise.all([
    calibrationMetrics(),
    listBenchmarkLabels(),
    listMatchRuns(),
    listBenchmarkCases(),
    listBenchmarkRuns(),
  ]);
  const typedLabels = labels as BenchmarkLabel[];
  const typedMatches = matches as MatchListRow[];
  const typedCases = cases as BenchmarkCase[];
  const typedRuns = runs as BenchmarkRun[];

  const cards = [
    ["Precision@5", `${metrics.precisionAt5 || 0}%`],
    ["Precision@10", `${metrics.precisionAt10}%`],
    ["Recall@50", `${metrics.recallAt50 || 0}%`],
    ["nDCG@10", `${metrics.ndcgAt10}%`],
    ["False Knockout", `${metrics.falseKnockoutRate}%`],
    ["Override Rate", `${metrics.overrideRate}%`],
    ["Score -> Interview", metrics.scoreToInterviewCorrelation.toFixed(2)],
    ["Labeled", String(metrics.labeledCount)],
  ];

  return (
    <main className="workbench-shell">
      <section className="workbench-header">
        <div>
          <p className="eyebrow">Quality measurement</p>
          <h1>Calibration dashboard</h1>
        </div>
        <a href="/screen">Workbench</a>
      </section>

      <section className="calibration-grid">
        {cards.map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="calibration-panels">
        <article>
          <h2>Recent Labels</h2>
          <div className="calibration-table">
            {typedLabels.slice(0, 12).map((label) => (
              <div key={label.id}>
                <span>{label.label}</span>
                <strong>{label.candidateId}</strong>
                <small>{label.notes || "No notes"} · {new Date(label.createdAt).toLocaleDateString()}</small>
              </div>
            ))}
            {!typedLabels.length ? <p>No labels yet.</p> : null}
          </div>
        </article>

        <article>
          <h2>Benchmark Runs</h2>
          <div className="calibration-table">
            {typedRuns.slice(0, 12).map((run) => (
              <div key={run.id}>
                <span>{run.metrics.precisionAt10}%</span>
                <strong>{run.modelVersion}</strong>
                <small>{run.caseCount} cases · {new Date(run.at).toLocaleDateString()} · nDCG {run.metrics.ndcgAt10}%</small>
              </div>
            ))}
            {!typedRuns.length ? <p>No snapshots yet.</p> : null}
          </div>
        </article>

        <article>
          <h2>Ranked Sample</h2>
          <div className="calibration-table">
            {typedMatches.slice(0, 12).map((match) => (
              <div key={match.id}>
                <span>{match.score}</span>
                <strong>{match.candidate?.name || match.candidateId}</strong>
                <small>{match.verdict} · {match.latestDecision?.decision || "no decision"}</small>
              </div>
            ))}
            {!typedMatches.length ? <p>No matches yet.</p> : null}
          </div>
        </article>

        <article>
          <h2>Segment Quality</h2>
          <div className="calibration-table">
            {(metrics.segmentMetrics || []).slice(0, 12).map((item) => (
              <div key={`${item.segment}:${item.value}`}>
                <span>{item.precisionAt10}%</span>
                <strong>{item.segment}: {item.value}</strong>
                <small>{item.labeledCount} labeled · avg score {item.avgScore} · interview {item.interviewRate}%</small>
              </div>
            ))}
            {!metrics.segmentMetrics?.length ? <p>No segments yet.</p> : null}
          </div>
        </article>

        <article>
          <h2>Benchmark Cases</h2>
          <div className="calibration-table">
            {typedCases.slice(0, 12).map((item) => (
              <div key={item.id}>
                <span>{item.expectedLabel}</span>
                <strong>{item.candidateId}</strong>
                <small>{item.roleFamily || "any role"} · {item.seniority || "any seniority"} · {item.source || "no source"}</small>
              </div>
            ))}
            {!typedCases.length ? <p>No imported benchmark cases yet.</p> : null}
          </div>
        </article>
      </section>
    </main>
  );
}
