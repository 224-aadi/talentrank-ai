const metrics = [
  ["Hybrid search", "BM25 + Boolean + semantic-ready"],
  ["Workflow", "Jobs, candidates, decisions, audit"],
  ["Governance", "Blind review + evidence + compliance"],
  ["Backend", "Next API + Prisma schema"],
];

const milestones = [
  "Connect Postgres and Prisma migrations",
  "Move PDF/DOCX parsing server-side with OCR fallback",
  "Add vector embeddings and skill taxonomy search",
  "Add auth, orgs, RBAC, secure file storage",
  "Run labeled benchmark set and calibration dashboard",
];

export default function HomePage() {
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
          <div className="actions">
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
            JSON persistence boundary, Prisma schema, audit/evaluation endpoints, and the original scanner preserved.
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
