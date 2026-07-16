import { redirect } from "next/navigation";
import { canAccessInternalTools, currentUser } from "@/lib/auth";
import { runtimeMode } from "@/lib/env";
import { listAuditEvents, retentionReport } from "@/lib/store";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

const controls = [
  ["Protected-class inference", "Disabled"],
  ["Guardrail scan", "Available"],
  ["Adverse-impact monitor", "Available"],
  ["Retention controls", "Available"],
  ["Explainability reports", "Available"],
];

export default async function CompliancePage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!canAccessInternalTools(user)) redirect("/screen");
  const [runtime, retention, auditEvents] = await Promise.all([
    Promise.resolve(runtimeMode()),
    retentionReport(365, user.organizationId),
    listAuditEvents(user.organizationId),
  ]);

  return (
    <AppShell user={user}>
      <main className="workbench-shell">
        <section className="workbench-intro">
          <p className="workbench-eyebrow">Compliance + trust</p>
          <h1>Trust Center</h1>
          <p className="workbench-lede">Guardrails, retention reporting, audit exports, and explainability for defensible hiring.</p>
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
              {controls.map(([label, status]) => (
                <div key={label} className="control-row">
                  <div>
                    <strong>{label}</strong>
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
              <a href="/api/ops/metrics">Ops metrics</a>
              <a href="/api/health">Runtime health</a>
            </div>
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
              <p>Nothing due.</p>
            )}
          </article>
          <article>
            <h2>OCR Readiness</h2>
            <p>{runtime.ocr}</p>
          </article>
        </section>
      </main>
    </AppShell>
  );
}
