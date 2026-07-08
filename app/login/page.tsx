import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { LoginPanel } from "./login-panel";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; invite?: string; reset?: string }> }) {
  const user = await currentUser();
  if (user) redirect("/");
  const params = await searchParams;
  const hasOidc = Boolean(process.env.OIDC_ISSUER_URL && process.env.OIDC_CLIENT_ID);

  return (
    <main className="login-shell">
      <section className="login-panel">
        <p className="eyebrow">Secure workspace</p>
        <h1>TalentRank AI</h1>
        <LoginPanel inviteToken={params.invite} resetToken={params.reset} hasOidc={hasOidc} error={params.error} />
      </section>
    </main>
  );
}
