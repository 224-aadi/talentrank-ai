import { currentUser } from "@/lib/auth";

const metrics = [
  ["Hybrid search", "BM25 + Boolean + semantic"],
  ["Workflow", "Jobs, candidates, decisions, audit"],
  ["Quality", "Precision@10 + nDCG + overrides"],
  ["Trust", "Guardrails + retention + audit"],
];

const milestones = [
  "Swap JSON repository to Prisma with a live DATABASE_URL",
  "Connect a production OCR provider through OCR_API_URL",
  "Move vectors to Postgres/vector database infrastructure",
  "Harden saved-pool retrieval with filters and benchmark tests",
  "Add real SSO, org invites, and secure file storage",
  "Import a larger labeled benchmark set",
];

export default async function HomePage() {
  const user = await currentUser();

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Launch-track ATS intelligence</p>
          <h1>TalentRank AI</h1>
          <p className="lede">
            Explainable candidate matching with hard-rule screening, hybrid search,
            recruiter decisions, audit events, and a production database model ready for the next build phase.
          </p>
          <p className="auth-pill">{user.name} · {user.role} · {user.organizationId}</p>
          <div className="actions">
            <a href="/screen">Open match workbench</a>
            <a href="/calibration">Open calibration dashboard</a>
            <a href="/compliance">Open trust center</a>
            <a href="/scanner/index.html">Open scanner MVP</a>
            <a href="/api/health">Check API</a>
          </div>
        </div>
      </section>

      <section className="metrics">
        {metrics.map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="panel-grid">
        <article>
          <h2>What is now real</h2>
          <p>
            The repo now has a full-stack spine: Next.js app shell, typed API routes,
            JSON persistence boundary, Prisma schema, audit/evaluation endpoints, saved-pool retrieval, managed embedding support, calibration metrics, and the original scanner preserved.
          </p>
        </article>
        <article>
          <h2>Next engineering milestones</h2>
          <ul>
            {milestones.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}
