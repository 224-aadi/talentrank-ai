import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { integrationStatus } from "@/lib/integrations";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");
  const status = integrationStatus();

  return (
    <main className="workbench-shell">
      <section className="workbench-header">
        <div>
          <p className="eyebrow">Operator console</p>
          <h1>Admin Operations</h1>
          <p>
            Deployment readiness, provider integrations, backup exports, and production operating controls.
          </p>
        </div>
        <a href="/">Home</a>
      </section>

      <section className="metrics">
        <article>
          <span>Readiness</span>
          <strong>{status.ready ? "ready" : "needs work"}</strong>
        </article>
        <article>
          <span>Persistence</span>
          <strong>{status.runtime.persistence}</strong>
        </article>
        <article>
          <span>Storage</span>
          <strong>{status.runtime.storage}</strong>
        </article>
        <article>
          <span>Auth</span>
          <strong>{status.runtime.auth}</strong>
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
                  <p>{item.detail}</p>
                </div>
                <span className={`status-${item.status}`}>{item.status}</span>
              </div>
            ))}
          </div>
        </article>
        <article>
          <h2>Operator Exports</h2>
          <div className="endpoint-list">
            <a href="/api/admin/integrations">Integration status JSON</a>
            <a href="/api/admin/backup">Backup export</a>
            <a href="/api/ops/metrics">Ops metrics</a>
            <a href="/api/health">Health check</a>
          </div>
          <p>
            Use the backup export for JSON-mode snapshots and audit package review. In Prisma production,
            pair this with database-native backups from your Postgres provider.
          </p>
        </article>
      </section>
    </main>
  );
}
