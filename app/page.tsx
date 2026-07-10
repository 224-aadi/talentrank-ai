import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LogoutButton } from "./logout-button";

export default async function HomePage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <main className="shell">
      <section className="hero launch-hero">
        <div className="hero-copy">
          <p className="eyebrow">Talent workspace</p>
          <h1>TalentRank AI</h1>
          <p className="lede">Upload the JD. Add resumes. Get the shortlist.</p>
          <p className="auth-pill">{user.name} · {user.role} · {user.organizationId}</p>
          <div className="actions">
            <a href="/screen">Start screening</a>
            {user.role === "admin" ? <a href="/admin">Admin</a> : null}
          </div>
          <form action="/api/auth/logout" method="post" className="logout-form">
            <LogoutButton />
          </form>
        </div>
      </section>
    </main>
  );
}
