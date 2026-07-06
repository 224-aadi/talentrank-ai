"use client";

import { useMemo, useState } from "react";
import type { Job } from "@/lib/types";

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
  riskFlags: string[];
  candidate: {
    id: string;
    name: string;
    email?: string;
  } | null;
  job: Job | null;
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
  const [resumes, setResumes] = useState<Array<{ fileName: string; mimeType: string; text: string }>>([]);
  const [matches, setMatches] = useState<MatchRow[]>(initialMatches);
  const [jobs, setJobs] = useState(initialJobs);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");

  const metrics = useMemo(() => {
    const strong = matches.filter((match) => match.score >= 80).length;
    const avg = matches.length ? Math.round(matches.reduce((sum, match) => sum + match.score, 0) / matches.length) : 0;
    const confidence = matches.length
      ? Math.round(matches.reduce((sum, match) => sum + match.confidence, 0) / matches.length)
      : 0;
    return { strong, avg, confidence };
  }, [matches]);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const parsed = await Promise.all(
      [...files].map(async (file) => ({
        fileName: file.name,
        mimeType: file.type || "text/plain",
        text: await file.text(),
      })),
    );
    setResumes(parsed);
  }

  async function runScreen() {
    setIsRunning(true);
    setError("");
    try {
      const response = await fetch("/api/screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job: {
            title,
            description,
            roleTemplate,
            hardRules: hardRules
              .split(",")
              .map((rule) => rule.trim())
              .filter(Boolean),
          },
          resumes,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ? JSON.stringify(payload.error) : "Screening failed");
      setJobs([payload.job, ...jobs]);
      setMatches(payload.results.map((item: { matchRun: MatchRow; candidate: MatchRow["candidate"] }) => ({
        ...item.matchRun,
        candidate: item.candidate,
        job: payload.job,
      })));
    } catch (screenError) {
      setError(screenError instanceof Error ? screenError.message : "Screening failed");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <main className="workbench-shell">
      <section className="workbench-header">
        <div>
          <p className="eyebrow">Server-side screening</p>
          <h1>Match workbench</h1>
          <p>
            Persist jobs, candidates, resume documents, match runs, evaluations, and audit events through
            the Next backend.
          </p>
        </div>
        <a href="/">Dashboard</a>
      </section>

      <section className="workbench-grid">
        <form className="screen-form" onSubmit={(event) => event.preventDefault()}>
          <label>
            <span>Job title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
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
          <label>
            <span>Hard rules</span>
            <input value={hardRules} onChange={(event) => setHardRules(event.target.value)} placeholder="SQL, Python, CPA" />
          </label>
          <label>
            <span>Job description</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <label className="file-drop">
            <span>Resume batch</span>
            <input multiple type="file" accept=".txt,.md,.csv" onChange={(event) => handleFiles(event.target.files)} />
            <strong>{resumes.length ? `${resumes.length} files ready` : "Upload TXT/MD resumes"}</strong>
          </label>
          <button disabled={isRunning || !description || !resumes.length} onClick={runScreen}>
            {isRunning ? "Screening..." : "Run server-side screen"}
          </button>
          {error ? <p className="form-error">{error}</p> : null}
        </form>

        <section className="results-column">
          <div className="metric-row">
            <article><span>Jobs</span><b>{jobs.length}</b></article>
            <article><span>Matches</span><b>{matches.length}</b></article>
            <article><span>Strong</span><b>{metrics.strong}</b></article>
            <article><span>Avg</span><b>{metrics.avg}</b></article>
            <article><span>Confidence</span><b>{metrics.confidence}%</b></article>
          </div>

          <div className="match-list">
            {matches.map((match, index) => (
              <article key={match.id} className="match-card">
                <div className="score">{match.score}</div>
                <div>
                  <div className="match-head">
                    <h2>{match.candidate?.name || `Candidate ${index + 1}`}</h2>
                    <span>{match.verdict}</span>
                  </div>
                  <p>{match.job?.title || title} · {match.roleFamily} · {match.confidence}% confidence</p>
                  <div className="breakdown">
                    <span>JD {match.breakdown.match}</span>
                    <span>Skills {match.breakdown.skills}</span>
                    <span>Exp {match.breakdown.experience}</span>
                    <span>Edu {match.breakdown.education}</span>
                  </div>
                  <p><strong>Matched:</strong> {match.matchedSignals.slice(0, 8).join(", ") || "Limited evidence"}</p>
                  {match.missingSignals.length ? <p><strong>Gaps:</strong> {match.missingSignals.slice(0, 6).join(", ")}</p> : null}
                  {match.riskFlags.length ? <div className="risk-row">{match.riskFlags.map((risk) => <span key={risk}>{risk}</span>)}</div> : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
