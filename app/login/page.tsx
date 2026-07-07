import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await currentUser();
  if (user) redirect("/");
  const params = await searchParams;

  return (
    <main className="login-shell">
      <section className="login-panel">
        <p className="eyebrow">Secure workspace</p>
        <h1>TalentRank AI</h1>
        <p>Sign in to screen candidates, review audit logs, and manage protected resume data.</p>
        {params.error ? <div className="error-banner">Invalid email or password.</div> : null}
        <form action="/api/auth/login" method="post" className="login-form">
          <label>
            Email
            <input name="email" type="email" autoComplete="email" defaultValue="admin@talentrank.local" required />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button type="submit">Sign in</button>
        </form>
      </section>
    </main>
  );
}
