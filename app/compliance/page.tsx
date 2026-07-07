import { runtimeMode } from "@/lib/env";
import { listAuditEvents, retentionReport } from "@/lib/store";

export const dynamic = "force-dynamic";

const controls = [
  ["Protected-class inference", "Disabled", "The scorer does not infer demographics from names, schools, addresses, photos, or resume wording."],
  ["Guardrail scan", "Available", "Jobs and resumes can be scanned for protected-class and appearance-related language before review."],
  ["Adverse-impact monitor", "Available", "Four-fifths-rule monitoring is exposed for lawfully collected audit groups."],
  ["Retention controls", "Available", "Admins can inspect stale records and delete candidates with related artifacts removed."],
  ["Explainability reports", "Available", "Every match can be exported with score breakdown, hard rules, evidence, gaps, and compliance signals."],
];

export default async function CompliancePage() {
  const [runtime, retention, auditEvents] = await Promise.all([
    Promise.resolve(runtimeMode()),
    retentionReport(365),
    listAuditEvents(),
  ]);

  return (
    <main className="workbench-shell">
      <section className="workbench-header">
        <div>
          <p className="eyebrow">Compliance + trust</p>
          <h1>Trust Center</h1>
          <p>
            Operational controls for AI-assisted hiring: guardrails, explainability,
            retention, audit exports, OCR readiness, and adverse-impact monitoring.
          </p>
        </div>
        <a href="/">Home</a>
      </section>

      <section className="metrics">
        <article>
          <span>OCR</span>
          <strong>{runtime.ocr}</strong>
        </article>
        <article>
          <span>Retention due</span>
          <strong>{retention.dueCount}</strong>
        </article>
        <article>
          <span>Audit events</span>
          <strong>{auditEvents.length}</strong>
        </article>
        <article>
          <span>Persistence</span>
          <strong>{runtime.persistence}</strong>
        </article>
      </section>

      <section className="panel-grid trust-grid">
        <article>
          <h2>Controls</h2>
          <div className="control-list">
            {controls.map(([label, status, detail]) => (
              <div key={label} className="control-row">
                <div>
                  <strong>{label}</strong>
                  <p>{detail}</p>
                </div>
                <span>{status}</span>
              </div>
            ))}
          </div>
        </article>
        <article>
          <h2>Report Endpoints</h2>
          <div className="endpoint-list">
            <a href="/api/compliance/retention">Retention report</a>
            <a href="/api/compliance/audit-export">Audit export</a>
            <a href="/api/health">Runtime health</a>
          </div>
          <p>
            Explainability reports are available at <code>/api/compliance/explainability?matchRunId=...</code>.
            Guardrail and adverse-impact reports are POST endpoints for product workflows and customer audit jobs.
          </p>
        </article>
      </section>

      <section className="panel-grid trust-grid">
        <article>
          <h2>Retention Queue</h2>
          {retention.dueCandidates.length ? (
            <div className="compact-table">
              {retention.dueCandidates.slice(0, 12).map((candidate) => (
                <div key={candidate.candidateId}>
                  <span>{candidate.candidateName}</span>
                  <strong>{candidate.ageDays} days</strong>
                </div>
              ))}
            </div>
          ) : (
            <p>No candidate records are past the 365-day retention threshold.</p>
          )}
        </article>
        <article>
          <h2>OCR Readiness</h2>
          <p>
            Scanned PDFs are detected when embedded PDF text is sparse. Configure <code>OCR_API_URL</code>
            and optional <code>OCR_API_KEY</code> to route those files through a production OCR service.
          </p>
          <p>
            The parser now extracts bullets, dates, table-like layouts, work history timelines, parse confidence,
            and layout warnings for downstream explainability.
          </p>
        </article>
      </section>
    </main>
  );
}
