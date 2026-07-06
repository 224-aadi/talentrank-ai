import { listJobs, listMatchRuns } from "@/lib/store";
import ScreeningWorkbench from "./screening-workbench";

export default async function ScreenPage() {
  const jobs = await listJobs();
  const matches = await listMatchRuns();
  return <ScreeningWorkbench initialJobs={jobs} initialMatches={matches.slice(0, 20)} />;
}
