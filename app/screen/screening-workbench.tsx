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
  const [error, setError] = useState("");

  const metrics = useMemo(() => {
    const strong = matches.filter((match) => match.score >= 80).length;
    const avg = matches.length ? Math.round(matches.reduce((sum, match) => sum + match.score, 0) / matches.length) : 0;
    const confidence = matches.length
      ? Math.round(matches.reduce((sum, match) => sum + match.confidence, 0) / matches.length)
      : 0;
    return { strong, avg, confidence };
  }, [matches]);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    setResumeFiles([...files]);
  }

  function toggleResume(resumeId: string) {
    setSelectedResumeIds((current) =>
      current.includes(resumeId) ? current.filter((id) => id !== resumeId) : [...current, resumeId],
    );
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
            <input multiple type="file" accept=".pdf,.docx,.txt,.md,.csv" onChange={(event) => handleFiles(event.target.files)} />
            <strong>{resumeFiles.length ? `${resumeFiles.length} files ready` : "Upload PDF/DOCX/TXT/MD resumes"}</strong>
          </label>
          <div className="pool-search">
            <label>
              <span>Saved candidate retrieval</span>
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
            <p>
              {poolSize ? `${poolSize} saved resumes indexed` : "Search saved resumes already parsed by TalentRank."}
              {retrievalMode === "semantic" ? " Semantic mode uses the JD text when present." : ""}
            </p>
          </div>
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
                  {match.resume ? (
                    <p>
                      Parsed from {match.resume.fileName}
                      {match.resume.parser ? ` via ${match.resume.parser}` : ""} · {match.resume.parseConfidence ?? "?"}% parse
                    </p>
                  ) : null}
                  {match.resume?.parsedJson ? (
                    <div className="profile-strip">
                      <span>{match.resume.parsedJson.skills?.length || 0} skills</span>
                      <span>{match.resume.parsedJson.experience?.length || 0} experience lines</span>
                      <span>{match.resume.parsedJson.quantifiedEvidence?.length || 0} quantified proofs</span>
                      {match.candidate?.email || match.resume.parsedJson.contact?.email ? (
                        <span>{match.candidate?.email || match.resume.parsedJson.contact?.email}</span>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="breakdown">
                    <span>JD {match.breakdown.match}</span>
                    <span>Skills {match.breakdown.skills}</span>
                    <span>Exp {match.breakdown.experience}</span>
                    <span>Edu {match.breakdown.education}</span>
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
                  <p><strong>Matched:</strong> {match.matchedSignals.slice(0, 8).join(", ") || "Limited evidence"}</p>
                  {match.missingSignals.length ? <p><strong>Gaps:</strong> {match.missingSignals.slice(0, 6).join(", ")}</p> : null}
                  {match.evidence?.length ? (
                    <div className="evidence-panel">
                      <strong>Evidence</strong>
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
                  {match.resume?.warnings?.length ? <p><strong>Parser warnings:</strong> {match.resume.warnings.join(", ")}</p> : null}
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
