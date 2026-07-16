import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { listAuditEvents, listCandidatePool, listJobs, listMatchRuns, listRecruiterDecisions } from "@/lib/store";

export async function GET() {
  try {
    const user = await requireRole("admin");
    const [jobs, candidates, matches, decisions, auditEvents] = await Promise.all([
      listJobs(user.organizationId),
      listCandidatePool(user.organizationId),
      listMatchRuns(undefined, user.organizationId),
      listRecruiterDecisions(undefined, user.organizationId),
      listAuditEvents(user.organizationId),
    ]);
    return NextResponse.json({ jobs, candidates, matches, decisions, auditEvents });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Workspace history unavailable";
    return NextResponse.json({ error: message }, { status: message === "Authentication required." ? 401 : 400 });
  }
}
