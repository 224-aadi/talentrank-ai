import "./screen.css";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { listJobs, listMatchRuns } from "@/lib/store";
import ScreeningWorkbench from "./screening-workbench";

export default async function ScreenPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const jobs = await listJobs();
  const matches = await listMatchRuns();
  return <ScreeningWorkbench initialJobs={jobs} initialMatches={matches.slice(0, 20)} />;
}
