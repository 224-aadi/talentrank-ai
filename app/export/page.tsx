import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function ExportPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  return (
    <AppShell user={user}>
      <main className="workbench-shell">
        <section className="workbench-intro">
          <p className="workbench-eyebrow">Export center</p>
          <h1>Admin Exports</h1>
          <p className="workbench-lede">Download operational records, candidate CSVs with resume links, backup data, and audit evidence.</p>
        </section>
        <section className="admin-table-card">
          <div className="admin-card-head">
            <div>
              <span>Available exports</span>
              <h2>Workspace data</h2>
            </div>
          </div>
          <div className="endpoint-list">
            <a href="/api/admin/candidates/export">Candidate CSV with resume links</a>
            <a href="/api/admin/backup">Full backup JSON</a>
            <a href="/api/compliance/audit-export">Audit export JSON</a>
            <a href="/api/admin/users/export">Users CSV</a>
            <a href="/api/ops/metrics">Ops metrics JSON</a>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
