import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { LoginFooter, LoginPanel } from "./login-panel";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; invite?: string; reset?: string }> }) {
  const user = await currentUser();
  if (user) redirect("/screen");
  const params = await searchParams;
  const hasOidc = Boolean(process.env.OIDC_ISSUER_URL && process.env.OIDC_CLIENT_ID);
  const isSpecialFlow = Boolean(params.invite || params.reset);

  return (
    <AuthShell
      title={isSpecialFlow ? "TalentRankAI" : "Welcome back"}
      subtitle={isSpecialFlow ? "Complete your account setup." : "Sign in to your screening workspace."}
      footer={isSpecialFlow ? undefined : <LoginFooter />}
    >
      <LoginPanel inviteToken={params.invite} resetToken={params.reset} hasOidc={hasOidc} error={params.error} />
    </AuthShell>
  );
}
