"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { Job } from "@/lib/types";

type DecisionValue = "shortlist" | "hold" | "reject" | "interview";
type BenchmarkValue = "good_match" | "bad_match" | "interviewed" | "offer" | "hired";
type ReviewBucket = "recommended" | "review" | "rejected";

type MatchRow = {
  id: string;
  score: number;
  confidence: number;
  verdict: string;
  roleFamily: string;
  breakdown: {
    match: number;
    skills: number;
    experience: number;
    education: number;
  };
  matchedSignals: string[];
  missingSignals: string[];
  hardRuleOutcomes?: Array<{
    rule: string;
    passed: boolean;
    evidence?: string;
  }>;
  evidence?: Array<{
    label: string;
    text: string;
    source?: string;
    strength?: "exact" | "alias" | "transferable";
    requirement?: string;
  }>;
  riskFlags: string[];
  resume?: {
    fileName: string;
    parser?: string;
    warnings?: string[];
    parseConfidence?: number;
    parsedJson?: {
      contact?: {
        email?: string;
        phone?: string;
        links?: string[];
      };
      skills?: string[];
      education?: string[];
      experience?: string[];
      projects?: string[];
      certifications?: string[];
      quantifiedEvidence?: string[];
      senioritySignals?: string[];
    };
  };
  candidate: {
    id: string;
    name: string;
    email?: string;
    status?: string;
  } | null;
  latestDecision?: {
    id: string;
    decision: DecisionValue;
    notes?: string;
    createdAt: string;
  } | null;
  job: Job | null;
};

type RetrievalRow = {
  retrievalScore: number;
  bm25Score: number;
  semanticScore: number;
  topSemanticSection?: string;
  semanticProvider: string;
  embeddingModel: string;
  booleanMatched: boolean;
  matchedTerms: string[];
  snippets: Array<{
    label: string;
    text: string;
  }>;
  candidate: {
    id: string;
    name: string;
    email?: string;
  };
  resume: {
    id: string;
    fileName: string;
    parseConfidence: number;
    parsedJson?: {
      skills?: string[];
      quantifiedEvidence?: string[];
    };
  };
};

export default function ScreeningWorkbench({
  initialJobs,
  initialMatches,
}: {
  initialJobs: Job[];
  initialMatches: MatchRow[];
}) {
  const [title, setTitle] = useState("Data Science / Analyst");
  const [description, setDescription] = useState("");
  const [hardRules, setHardRules] = useState("");
  const [roleTemplate, setRoleTemplate] = useState("auto");
  const [resumeFiles, setResumeFiles] = useState<File[]>([]);
  const [poolQuery, setPoolQuery] = useState("python AND sql");
  const [retrievalMode, setRetrievalMode] = useState<"hybrid" | "lexical" | "semantic">("hybrid");
  const [poolResults, setPoolResults] = useState<RetrievalRow[]>([]);
  const [selectedResumeIds, setSelectedResumeIds] = useState<string[]>([]);
  const [poolSize, setPoolSize] = useState(0);
  const [matches, setMatches] = useState<MatchRow[]>(initialMatches);
  const [jobs, setJobs] = useState(initialJobs);
  const [isRunning, setIsRunning] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [savingDecisionId, setSavingDecisionId] = useState("");
  const [savingLabelId, setSavingLabelId] = useState("");
  const [error, setError] = useState("");
  const [activeBucket, setActiveBucket] = useState<ReviewBucket>("recommended");
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const metrics = useMemo(() => {
    const strong = matches.filter((match) => match.score >= 80).length;
    const avg = matches.length ? Math.round(matches.reduce((sum, match) => sum + match.score, 0) / matches.length) : 0;
    const confidence = matches.length
      ? Math.round(matches.reduce((sum, match) => sum + match.confidence, 0) / matches.length)
      : 0;
    return { strong, avg, confidence };
  }, [matches]);

  function bucketFor(match: MatchRow): ReviewBucket {
    if (match.latestDecision?.decision === "reject") return "rejected";
    if (match.latestDecision?.decision === "shortlist" || match.latestDecision?.decision === "interview") return "recommended";
    if (match.hardRuleOutcomes?.some((outcome) => !outcome.passed)) return "rejected";
    if (match.score >= 78 && match.confidence >= 60) return "recommended";
    if (match.score < 45) return "rejected";
    return "review";
  }

  const buckets = useMemo(() => {
    const grouped: Record<ReviewBucket, MatchRow[]> = {
      recommended: [],
      review: [],
      rejected: [],
    };
    for (const match of matches) grouped[bucketFor(match)].push(match);
    return grouped;
  }, [matches]);

  const visibleMatches = buckets[activeBucket];
  const comparedMatches = useMemo(
    () => compareIds.map((id) => matches.find((match) => match.id === id)).filter((match): match is MatchRow => Boolean(match)),
    [compareIds, matches],
  );
  const bucketLabels: Record<ReviewBucket, string> = {
    recommended: "Recommended",
    review: "Review",
    rejected: "Rejected",
  };

  function ringClass(score: number) {
    if (score >= 78) return "ring-strong";
    if (score >= 45) return "ring-mid";
    return "ring-low";
  }

  function verdictClass(verdict: string) {
    if (verdict === "Strong match") return "verdict-strong";
    if (verdict === "Recruiter review") return "verdict-review";
    if (verdict === "Needs evidence") return "verdict-needs";
    if (verdict === "Auto-reject") return "verdict-reject";
    return "verdict-low";
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    setResumeFiles([...files]);
  }

  function toggleResume(resumeId: string) {
    setSelectedResumeIds((current) =>
      current.includes(resumeId) ? current.filter((id) => id !== resumeId) : [...current, resumeId],
    );
  }

  function toggleCompare(matchId: string) {
    setCompareIds((current) => {
      if (current.includes(matchId)) return current.filter((id) => id !== matchId);
      return [...current.slice(-2), matchId];
    });
  }

  async function searchPool() {
    setIsSearching(true);
    setError("");
    try {
      const queryText = retrievalMode === "semantic" && description ? description : poolQuery;
      const response = await fetch(`/api/candidates/search?q=${encodeURIComponent(queryText)}&mode=${retrievalMode}&limit=12`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Candidate search failed");
      setPoolResults(payload.results);
      setPoolSize(payload.poolSize);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Candidate search failed");
    } finally {
      setIsSearching(false);
    }
  }

  async function runScreen() {
    setIsRunning(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append(
        "job",
        JSON.stringify({
          title,
          description,
          roleTemplate,
          hardRules: hardRules
            .split(",")
            .map((rule) => rule.trim())
            .filter(Boolean),
        }),
      );
      for (const file of resumeFiles) formData.append("resumes", file);
      formData.append("savedResumeIds", JSON.stringify(selectedResumeIds));
      const response = await fetch("/api/screen", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ? JSON.stringify(payload.error) : "Screening failed");
      setJobs([payload.job, ...jobs]);
      setMatches(payload.results.map((item: { matchRun: MatchRow; candidate: MatchRow["candidate"]; resume: MatchRow["resume"] }) => ({
        ...item.matchRun,
        candidate: item.candidate,
        resume: item.resume,
        job: payload.job,
      })));
    } catch (screenError) {
      setError(screenError instanceof Error ? screenError.message : "Screening failed");
    } finally {
      setIsRunning(false);
    }
  }

  async function decide(match: MatchRow, decision: DecisionValue) {
    if (!match.candidate || !match.job) return;
    setSavingDecisionId(`${match.id}:${decision}`);
    setError("");
    try {
      const response = await fetch("/api/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: match.job.id,
          candidateId: match.candidate.id,
          decision,
          notes: decisionNotes[match.id]?.trim() || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ? JSON.stringify(payload.error) : "Decision failed");
      setMatches((current) =>
        current.map((item) =>
          item.id === match.id
            ? {
                ...item,
                candidate: payload.candidate || item.candidate,
                latestDecision: payload.decision,
              }
            : item,
        ),
      );
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : "Decision failed");
    } finally {
      setSavingDecisionId("");
    }
  }

  async function labelBenchmark(match: MatchRow, label: BenchmarkValue) {
    if (!match.candidate || !match.job) return;
    setSavingLabelId(`${match.id}:${label}`);
    setError("");
    try {
      const response = await fetch("/api/benchmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: match.job.id,
          candidateId: match.candidate.id,
          label,
          notes: decisionNotes[match.id]?.trim() || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ? JSON.stringify(payload.error) : "Label failed");
    } catch (labelError) {
      setError(labelError instanceof Error ? labelError.message : "Label failed");
    } finally {
      setSavingLabelId("");
    }
  }

  return (
    <main className="workbench-shell">
      <section className="workbench-header">
        <div className="workbench-brand">
          <span className="brand-mark">TR</span>
          <div>
            <p className="eyebrow">Candidate screening</p>
            <h1>Match workbench</h1>
          </div>
        </div>
        <a href="/">Dashboard</a>
      </section>

      <section className="workbench-grid">
        <form className="screen-form" onSubmit={(event) => event.preventDefault()}>
          <label>
            <span>Job description</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <label className={`file-drop${resumeFiles.length ? " has-files" : ""}`}>
            <span>Resume batch</span>
            <input multiple type="file" accept=".pdf,.docx,.txt,.md,.csv" onChange={(event) => handleFiles(event.target.files)} />
            <strong>{resumeFiles.length ? `${resumeFiles.length} file${resumeFiles.length === 1 ? "" : "s"} ready` : "Drop resumes here or click to browse"}</strong>
          </label>

          <details className="advanced-panel">
            <summary>Advanced</summary>
            <label>
              <span>Job title</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label>
              <span>Required keywords</span>
              <input value={hardRules} onChange={(event) => setHardRules(event.target.value)} placeholder="SQL, Python, CPA" />
            </label>
            <label>
              <span>Role template</span>
              <select value={roleTemplate} onChange={(event) => setRoleTemplate(event.target.value)}>
                <option value="auto">Auto-detect</option>
                <option value="data">Data / Analytics</option>
                <option value="software">Software Engineering</option>
                <option value="sales">Sales / GTM</option>
                <option value="finance">Finance / Accounting</option>
                <option value="operations">Operations</option>
              </select>
            </label>
            <div className="pool-search">
              <label>
                <span>Search saved resumes</span>
                <input value={poolQuery} onChange={(event) => setPoolQuery(event.target.value)} placeholder={'python AND sql -"sales"'} />
              </label>
              <div className="mode-toggle">
                {(["hybrid", "lexical", "semantic"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={retrievalMode === mode ? "active" : ""}
                    onClick={() => setRetrievalMode(mode)}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <button type="button" disabled={isSearching} onClick={searchPool}>
                {isSearching ? "Searching..." : "Search pool"}
              </button>
              {poolSize ? <p>{poolSize} saved resumes</p> : null}
            </div>
          </details>

          {poolResults.length ? (
            <div className="pool-results">
              {poolResults.map((item) => (
                <label key={item.resume.id} className={selectedResumeIds.includes(item.resume.id) ? "selected" : ""}>
                  <input
                    type="checkbox"
                    checked={selectedResumeIds.includes(item.resume.id)}
                    onChange={() => toggleResume(item.resume.id)}
                  />
                  <span>
                    <strong>{item.candidate.name}</strong>
                    <small>
                      Retrieval {item.retrievalScore} · BM25 {item.bm25Score} · Semantic {item.semanticScore}
                      {item.topSemanticSection ? ` · ${item.topSemanticSection}` : ""} · {item.semanticProvider}/{item.embeddingModel} · {item.matchedTerms.slice(0, 5).join(", ") || "broad match"}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          ) : null}
          <button disabled={isRunning || !description || (!resumeFiles.length && !selectedResumeIds.length)} onClick={runScreen}>
            {isRunning ? "Screening..." : "Rank candidates"}
          </button>
          {error ? <p className="form-error">{error}</p> : null}
        </form>

        <section className="results-column">
          <div className="review-summary">
            <div>
              <span>{matches.length ? `${matches.length} candidates` : "No candidates yet"}</span>
              <strong>{matches.length ? `${metrics.avg} avg score` : "Upload resumes to begin"}</strong>
            </div>
            {matches.length ? <small>{metrics.confidence}% confidence</small> : null}
          </div>

          <div className="review-tabs">
            {(["recommended", "review", "rejected"] as const).map((bucket) => (
              <button
                key={bucket}
                type="button"
                className={activeBucket === bucket ? "active" : ""}
                onClick={() => setActiveBucket(bucket)}
              >
                <span>{bucketLabels[bucket]}</span>
                <b>{buckets[bucket].length}</b>
              </button>
            ))}
          </div>

          {matches.length ? (
            <section className="compare-tray" aria-label="Candidate comparison">
              <div>
                <span>{compareIds.length ? `${compareIds.length}/3 selected` : "Compare candidates"}</span>
                <strong>{compareIds.length >= 2 ? "Side-by-side review ready" : "Pick two or three results"}</strong>
              </div>
              {compareIds.length ? (
                <button type="button" onClick={() => setCompareIds([])}>
                  Clear
                </button>
              ) : null}
            </section>
          ) : null}

          {comparedMatches.length >= 2 ? (
            <section className="comparison-board">
              {comparedMatches.map((match) => (
                <article key={match.id}>
                  <div className="comparison-head">
                    <div>
                      <span>{match.verdict}</span>
                      <h3>{match.candidate?.name || match.resume?.fileName || "Candidate"}</h3>
                    </div>
                    <strong>{match.score}%</strong>
                  </div>
                  <div className="comparison-stats">
                    <span>JD {match.breakdown.match}</span>
                    <span>Skills {match.breakdown.skills}</span>
                    <span>Exp {match.breakdown.experience}</span>
                    <span>Conf {match.confidence}</span>
                  </div>
                  <p>{match.matchedSignals.slice(0, 3).join(", ") || "No strong matched signals yet."}</p>
                  {match.missingSignals.length ? <p><b>Gaps:</b> {match.missingSignals.slice(0, 3).join(", ")}</p> : null}
                  {match.hardRuleOutcomes?.length ? (
                    <div className="comparison-rules">
                      {match.hardRuleOutcomes.slice(0, 4).map((outcome) => (
                        <span key={outcome.rule} className={outcome.passed ? "pass" : "fail"}>
                          {outcome.passed ? "Pass" : "Fail"} · {outcome.rule}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {match.evidence?.[0] ? (
                    <blockquote>
                      <span>{match.evidence[0].requirement || match.evidence[0].label}</span>
                      {match.evidence[0].text}
                    </blockquote>
                  ) : null}
                </article>
              ))}
            </section>
          ) : null}

          <div className="match-list">
            {!matches.length ? (
              <article className="empty-review">
                <strong>Ready when you are.</strong>
                <span>Add a JD and resumes, then rank candidates.</span>
              </article>
            ) : null}
            {matches.length && !visibleMatches.length ? (
              <article className="empty-review">
                <strong>No candidates here.</strong>
                <span>Try another review tab.</span>
              </article>
            ) : null}
            {visibleMatches.map((match, index) => (
              <article key={match.id} className={`match-card candidate-card ${bucketFor(match)}`}>
                <div>
                  <div className="match-head">
                    <div className="match-identity">
                      <div className={`score-ring ${ringClass(match.score)}`} style={{ "--val": match.score } as CSSProperties}>
                        <b>{match.score}</b>
                      </div>
                      <div>
                        <h2>{match.candidate?.name || `Candidate ${index + 1}`}</h2>
                        <p className="match-meta">
                          {match.candidate?.email || match.resume?.fileName || "Resume uploaded"} · {match.confidence}% confidence
                        </p>
                      </div>
                    </div>
                    <div className="match-actions">
                      <span className={`verdict-badge ${verdictClass(match.verdict)}`}>{match.verdict}</span>
                      <button
                        type="button"
                        className={compareIds.includes(match.id) ? "active" : ""}
                        onClick={() => toggleCompare(match.id)}
                      >
                        {compareIds.includes(match.id) ? "Selected" : "Compare"}
                      </button>
                    </div>
                  </div>
                  {match.latestDecision ? (
                    <div className="decision-status">
                      <span>{match.latestDecision.decision}</span>
                      {match.latestDecision.notes ? <small>{match.latestDecision.notes}</small> : null}
                    </div>
                  ) : null}

                  <div className="signal-strip">
                    {match.matchedSignals.slice(0, 6).map((signal) => (
                      <span key={signal} className="signal-hit">{signal}</span>
                    ))}
                    {activeBucket !== "recommended"
                      ? match.missingSignals.slice(0, 3).map((signal) => (
                          <span key={signal} className="signal-gap">Missing: {signal}</span>
                        ))
                      : null}
                    {!match.matchedSignals.length ? <span>Limited evidence</span> : null}
                  </div>

                  <details className="candidate-evidence">
                    <summary>Evidence &amp; breakdown</summary>
                    <div className="breakdown-bars">
                      {([
                        ["JD fit", match.breakdown.match],
                        ["Skills", match.breakdown.skills],
                        ["Experience", match.breakdown.experience],
                        ["Education", match.breakdown.education],
                      ] as const).map(([label, value]) => (
                        <div key={label} className="bar-row">
                          <span>{label}</span>
                          <div className="bar"><i style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>
                          <b>{value}</b>
                        </div>
                      ))}
                    </div>
                    {match.hardRuleOutcomes?.length ? (
                      <div className="rule-grid">
                        {match.hardRuleOutcomes.map((outcome) => (
                          <span key={outcome.rule} className={outcome.passed ? "pass" : "fail"}>
                            {outcome.passed ? "Pass" : "Fail"} · {outcome.rule}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {match.evidence?.length ? (
                      <div className="evidence-panel">
                        <strong>Why this match</strong>
                        {match.evidence.slice(0, 5).map((item) => (
                          <blockquote key={`${item.label}-${item.text}`}>
                            <span>{item.requirement || item.label} · {item.strength || "exact"}</span>
                            {item.text}
                          </blockquote>
                        ))}
                      </div>
                    ) : null}
                    {match.resume?.parsedJson?.skills?.length ? (
                      <p><strong>Extracted skills:</strong> {match.resume.parsedJson.skills.slice(0, 14).join(", ")}</p>
                    ) : null}
                    {match.resume?.warnings?.length ? <p><strong>Parser:</strong> {match.resume.warnings.join(", ")}</p> : null}
                    {match.riskFlags.length ? <div className="risk-row">{match.riskFlags.map((risk) => <span key={risk}>{risk}</span>)}</div> : null}
                  </details>

                  <div className="decision-panel">
                    <input
                      value={decisionNotes[match.id] || ""}
                      onChange={(event) => setDecisionNotes((current) => ({ ...current, [match.id]: event.target.value }))}
                      placeholder="Reviewer note"
                    />
                    <div>
                      {(["shortlist", "hold", "reject", "interview"] as const).map((decision) => (
                        <button
                          key={decision}
                          type="button"
                          disabled={!match.candidate || !match.job || savingDecisionId === `${match.id}:${decision}`}
                          onClick={() => decide(match, decision)}
                        >
                          {savingDecisionId === `${match.id}:${decision}` ? "Saving..." : decision}
                        </button>
                      ))}
                    </div>
                  </div>
                  <details className="benchmark-panel">
                    <summary>Benchmark label</summary>
                    <div>
                      {(["good_match", "bad_match", "interviewed", "offer", "hired"] as const).map((label) => (
                        <button
                          key={label}
                          type="button"
                          disabled={!match.candidate || !match.job || savingLabelId === `${match.id}:${label}`}
                          onClick={() => labelBenchmark(match, label)}
                        >
                          {savingLabelId === `${match.id}:${label}` ? "Saving..." : label.replace("_", " ")}
                        </button>
                      ))}
                    </div>
                  </details>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
