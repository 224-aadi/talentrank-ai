import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { listJobs } from "@/lib/store";
import { AppShell } from "@/components/app-shell";
import ScreeningWorkbench from "./screening-workbench";

export default async function ScreenPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const jobs = await listJobs(user.organizationId);
  return (
    <AppShell user={user} wide>
      <ScreeningWorkbench initialJobs={jobs} initialMatches={[]} />
    </AppShell>
  );
}
