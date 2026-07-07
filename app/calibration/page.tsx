import { calibrationMetrics, listBenchmarkLabels, listMatchRuns } from "@/lib/store";

const metricHelp: Record<string, string> = {
  precisionAt10: "Relevant labeled candidates in the top 10 ranked results.",
  ndcgAt10: "Ranking quality with stronger labels weighted higher.",
  falseKnockoutRate: "Auto-rejected candidates later labeled relevant.",
  overrideRate: "Recruiter decisions that disagree with the score/verdict.",
  scoreToInterviewCorrelation: "Correlation between score and interview outcome.",
};

export default async function CalibrationPage() {
  const [metrics, labels, matches] = await Promise.all([
    calibrationMetrics(),
    listBenchmarkLabels(),
    listMatchRuns(),
  ]);

  const cards = [
    ["Precision@10", `${metrics.precisionAt10}%`, metricHelp.precisionAt10],
    ["nDCG@10", `${metrics.ndcgAt10}%`, metricHelp.ndcgAt10],
    ["False Knockout", `${metrics.falseKnockoutRate}%`, metricHelp.falseKnockoutRate],
    ["Override Rate", `${metrics.overrideRate}%`, metricHelp.overrideRate],
    ["Score -> Interview", metrics.scoreToInterviewCorrelation.toFixed(2), metricHelp.scoreToInterviewCorrelation],
    ["Labeled", String(metrics.labeledCount), "Candidates with benchmark labels or derived recruiter outcomes."],
  ];

  return (
    <main className="workbench-shell">
      <section className="workbench-header">
        <div>
          <p className="eyebrow">Quality measurement</p>
          <h1>Calibration dashboard</h1>
          <p>
            Track whether TalentRank ranking quality improves with labels, recruiter decisions, and benchmark outcomes.
          </p>
        </div>
        <a href="/screen">Workbench</a>
      </section>

      <section className="calibration-grid">
        {cards.map(([label, value, help]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <p>{help}</p>
          </article>
        ))}
      </section>

      <section className="calibration-panels">
        <article>
          <h2>Recent Labels</h2>
          <div className="calibration-table">
            {labels.slice(0, 12).map((label) => (
              <div key={label.id}>
                <span>{label.label}</span>
                <strong>{label.candidateId}</strong>
                <small>{label.notes || "No notes"} · {new Date(label.createdAt).toLocaleDateString()}</small>
              </div>
            ))}
            {!labels.length ? <p>No benchmark labels yet. Recruiter decisions still derive early calibration signals.</p> : null}
          </div>
        </article>

        <article>
          <h2>Ranked Sample</h2>
          <div className="calibration-table">
            {matches.slice(0, 12).map((match) => (
              <div key={match.id}>
                <span>{match.score}</span>
                <strong>{match.candidate?.name || match.candidateId}</strong>
                <small>{match.verdict} · {match.latestDecision?.decision || "no decision"}</small>
              </div>
            ))}
            {!matches.length ? <p>No match runs yet. Run a screen to generate calibration inputs.</p> : null}
          </div>
        </article>
      </section>
    </main>
  );
}
