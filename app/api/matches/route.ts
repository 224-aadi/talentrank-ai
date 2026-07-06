import { NextResponse } from "next/server";
import { listMatchRuns } from "@/lib/store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId") || undefined;
  return NextResponse.json({ matchRuns: await listMatchRuns(jobId) });
}
