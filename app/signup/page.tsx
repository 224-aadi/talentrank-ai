import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { SignupFooter, SignupPanel } from "./signup-panel";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await currentUser();
  if (user) redirect("/dashboard");
  const params = await searchParams;

  return (
    <AuthShell title="Create your account" subtitle="Start screening candidates with explainable AI ranking." footer={<SignupFooter />}>
      <SignupPanel error={params.error} />
    </AuthShell>
  );
}
