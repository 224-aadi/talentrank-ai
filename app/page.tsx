import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

const primaryPaths = [
  {
    href: "/screen",
    label: "Match workbench",
    text: "Rank resumes",
  },
  {
    href: "/calibration",
    label: "Calibration",
    text: "Measure quality",
  },
  {
    href: "/compliance",
    label: "Trust center",
    text: "Review controls",
  },
];

export default async function HomePage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const metrics = [
    ["Today", "Ready to screen"],
    ["Quality", "Calibration active"],
    ["Trust", "Audit trail on"],
    ["Team", `${user.role} workspace`],
  ];

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Talent workspace</p>
          <h1>TalentRank AI</h1>
          <p className="lede">Screen resumes with evidence.</p>
          <p className="auth-pill">{user.name} · {user.role} · {user.organizationId}</p>
          <div className="actions">
            <a href="/screen">Start screening</a>
            <a href="/admin">Admin</a>
          </div>
          <form action="/api/auth/logout" method="post" className="logout-form">
            <button type="submit">Sign out</button>
          </form>
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
        {primaryPaths.map((path) => (
          <article key={path.href} className="path-card">
            <h2>{path.label}</h2>
            <p>{path.text}</p>
            <a href={path.href}>Open</a>
          </article>
        ))}
        <article className="path-card subtle-card">
          <h2>System health</h2>
          <p>Setup and diagnostics</p>
          <a href="/admin">Review setup</a>
        </article>
      </section>
    </main>
  );
}
