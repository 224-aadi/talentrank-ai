import { redirect } from "next/navigation";
import { currentUser, listAuthUsers } from "@/lib/auth";
import { integrationStatus } from "@/lib/integrations";
import { AdminUsersPanel } from "./admin-users-panel";
import { IntegrationDiagnosticsPanel } from "./integration-diagnostics-panel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");
  const status = integrationStatus();
  const users = await listAuthUsers();

  return (
    <main className="workbench-shell">
      <section className="workbench-header">
        <div>
          <p className="eyebrow">Operator console</p>
          <h1>Admin Operations</h1>
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
        </article>
      </section>
      <IntegrationDiagnosticsPanel items={status.items} />
      <AdminUsersPanel initialUsers={users} currentUserId={user.id} />
    </main>
  );
}
