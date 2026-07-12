import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { integrationStatus } from "@/lib/integrations";
import { listAuditEvents, listCandidatePool, listJobs, listMatchRuns, listRecruiterDecisions } from "@/lib/store";
import type { AuditEvent, Candidate, CandidatePoolItem, Job, MatchRun, RecruiterDecisionRecord } from "@/lib/types";
import { AppShell } from "@/components/app-shell";
import { IntegrationDiagnosticsPanel } from "./integration-diagnostics-panel";

export const dynamic = "force-dynamic";

type AdminMatch = MatchRun & {
  job: Job | null;
  candidate: Candidate | null;
  latestDecision?: RecruiterDecisionRecord | null;
};

function shortDate(value?: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function truncate(value: string, length = 160) {
  return value.length > length ? `${value.slice(0, length).trim()}...` : value;
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ jobId?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/screen");
  const selectedJobId = (await searchParams).jobId;
  const [status, jobs, candidates, matches, decisions, auditEvents] = await Promise.all([
    Promise.resolve(integrationStatus()),
    listJobs(user.organizationId),
    listCandidatePool(user.organizationId),
    listMatchRuns(undefined, user.organizationId),
    listRecruiterDecisions(undefined, user.organizationId),
    listAuditEvents(user.organizationId),
  ]);
  const matchRows = matches as AdminMatch[];
  const candidateRows = candidates as CandidatePoolItem[];
  const jobRows = jobs as Job[];
  const decisionRows = decisions as RecruiterDecisionRecord[];
  const auditRows = auditEvents as AuditEvent[];
  const selectedJob = selectedJobId ? jobRows.find((job) => job.id === selectedJobId) || null : null;
  const selectedMatchRows = selectedJobId ? matchRows.filter((match) => match.jobId === selectedJobId) : matchRows;
  const selectedCandidateIds = new Set(selectedMatchRows.map((match) => match.candidateId));
  const visibleCandidateRows = selectedJobId
    ? candidateRows.filter(({ candidate }) => selectedCandidateIds.has(candidate.id))
    : candidateRows;
  const latestCandidates = visibleCandidateRows.slice(0, 25);
  const latestJobs = jobRows.slice(0, 6);
  const latestAudits = auditRows.slice(0, 8);
  const shortlisted = decisionRows.filter((decision) => decision.decision === "shortlist" || decision.decision === "interview").length;
  const avgScore = selectedMatchRows.length ? Math.round(selectedMatchRows.reduce((sum, match) => sum + match.score, 0) / selectedMatchRows.length) : 0;
  const latestMatchByCandidate = new Map<string, AdminMatch>();
  for (const match of selectedMatchRows) {
    if (!latestMatchByCandidate.has(match.candidateId)) latestMatchByCandidate.set(match.candidateId, match);
  }

  return (
    <AppShell user={user}>
      <main className="workbench-shell">
        <section className="workbench-intro">
          <p className="workbench-eyebrow">Operator console</p>
          <h1>Admin</h1>
          <p className="workbench-lede">Screening history, candidate records, resume downloads, JDs, exports, integrations, and workspace controls.</p>
        </section>

        <section className="metrics">
          <article>
            <span>Readiness</span>
            <strong>{status.ready ? "ready" : "needs work"}</strong>
          </article>
          <article>
            <span>{selectedJob ? "JD candidates" : "Candidates"}</span>
            <strong>{visibleCandidateRows.length}</strong>
          </article>
          <article>
            <span>Avg score</span>
            <strong>{selectedMatchRows.length ? `${avgScore}%` : "none"}</strong>
          </article>
          <article>
            <span>Advanced</span>
            <strong>{shortlisted}</strong>
          </article>
        </section>

        <section className="admin-action-bar">
          <a href="/api/admin/candidates/export">Export candidates CSV</a>
          <a href="/api/admin/backup">Backup JSON</a>
          <a href="/api/compliance/audit-export">Audit export</a>
          <a href="/api/health">Health</a>
        </section>
        {selectedJob ? (
          <section className="selected-jd-banner">
            <div>
              <span>Selected JD</span>
              <strong>{selectedJob.title}</strong>
            </div>
            <a href="/admin">View all candidates</a>
          </section>
        ) : null}

        <section className="admin-overview-grid">
          <article className="admin-table-card">
            <div className="admin-card-head">
              <div>
                <span>Job descriptions</span>
                <h2>Uploaded JDs</h2>
              </div>
            </div>
            <div className="admin-list">
              {latestJobs.length ? latestJobs.map((job) => (
                <details key={job.id} open={job.id === selectedJobId}>
                  <summary>
                    <strong>{job.title}</strong>
                    <small>{shortDate(job.createdAt)} · {job.hardRules.length} hard rules</small>
                  </summary>
                  <p>{truncate(job.description, 420)}</p>
                  <a className="jd-select-link" href={`/admin?jobId=${job.id}`}>View candidates for this JD</a>
                </details>
              )) : <p>No job descriptions uploaded yet.</p>}
            </div>
          </article>
        </section>

        <section className="admin-table-card">
          <div className="admin-card-head">
            <div>
              <span>Candidate archive</span>
              <h2>{selectedJob ? "Candidates for selected JD" : "Every candidate and resume"}</h2>
            </div>
            <a href="/api/admin/candidates/export">Export CSV</a>
          </div>
          <div className="candidate-ledger">
            {latestCandidates.length ? latestCandidates.map(({ candidate, resume }) => {
              const match = latestMatchByCandidate.get(candidate.id);
              return (
                <div key={resume.id} className="candidate-ledger-row">
                  <div>
                    <strong>{candidate.name}</strong>
                    <small>{candidate.email || resume.parsedJson?.contact?.email || "No email"} · {candidate.status}</small>
                  </div>
                  <div>
                    <span>{resume.fileName}</span>
                    <small>{resume.parseConfidence}% parse · {resume.parsedJson?.skills?.slice(0, 5).join(", ") || "No skills extracted"}</small>
                  </div>
                  <div>
                    <span>{match ? `${match.score}%` : "Not ranked"}</span>
                    <small>{match?.verdict || "No match run"}</small>
                  </div>
                  <a href={`/api/resumes/${resume.id}/download`}>Download</a>
                </div>
              );
            }) : <p>No candidates uploaded yet.</p>}
          </div>
        </section>

        <section className="admin-overview-grid">
          <article className="admin-table-card">
            <div className="admin-card-head">
              <div>
                <span>Audit trail</span>
                <h2>Recent activity</h2>
              </div>
              <a href="/api/audit">Open</a>
            </div>
            <div className="admin-list compact">
              {latestAudits.length ? latestAudits.map((event) => (
                <div key={event.id}>
                  <strong>{event.type}</strong>
                  <small>{shortDate(event.at)} {event.candidateName ? `· ${event.candidateName}` : ""}</small>
                </div>
              )) : <p>No audit events yet.</p>}
            </div>
          </article>
          <article className="admin-table-card">
            <div className="admin-card-head">
              <div>
                <span>Runtime</span>
                <h2>Provider status</h2>
              </div>
            </div>
            <div className="admin-runtime-grid">
              <span>DB <b>{status.runtime.persistence}</b></span>
              <span>Storage <b>{status.runtime.storage}</b></span>
              <span>Auth <b>{status.runtime.auth}</b></span>
              <span>Email <b>{status.runtime.email}</b></span>
              <span>OCR <b>{status.runtime.ocr}</b></span>
              <span>Embeddings <b>{status.runtime.embeddings}</b></span>
            </div>
          </article>
        </section>

        <section className="panel-grid trust-grid">
          <article>
            <h2>Integrations</h2>
            <div className="control-list">
              {status.items.map((item) => (
                <div key={item.key} className="control-row">
                  <div>
                    <strong>{item.label}</strong>
                  </div>
                  <span className={`status-${item.status}`}>{item.status}</span>
                </div>
              ))}
            </div>
          </article>
          <article>
            <h2>Operator Exports</h2>
            <div className="endpoint-list">
              <a href="/api/admin/candidates/export">Candidate CSV with resume links</a>
              <a href="/api/admin/integrations">Integration status JSON</a>
              <a href="/api/admin/backup">Backup export</a>
              <a href="/api/admin/users/export">Users CSV export</a>
              <a href="/api/ops/metrics">Ops metrics</a>
              <a href="/api/health">Health check</a>
            </div>
          </article>
        </section>
        <IntegrationDiagnosticsPanel items={status.items} />
      </main>
    </AppShell>
  );
}
