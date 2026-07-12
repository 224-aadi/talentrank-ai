import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { listMatchRuns } from "@/lib/store";

export async function GET(request: Request) {
  try {
    const user = await requireRole("recruiter");
    const url = new URL(request.url);
    const jobId = url.searchParams.get("jobId") || undefined;
    return NextResponse.json({ matchRuns: await listMatchRuns(jobId, user.organizationId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not list matches";
    return NextResponse.json({ error: message }, { status: message === "Authentication required." ? 401 : 400 });
  }
}
