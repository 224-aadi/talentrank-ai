import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { listBenchmarkCases, listBenchmarkLabels, listBenchmarkRuns } from "@/lib/store";

export async function GET(request: Request) {
  const user = await requireRole("recruiter");
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId") || undefined;
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    jobId,
    cases: await listBenchmarkCases(jobId, user.organizationId),
    labels: await listBenchmarkLabels(jobId, user.organizationId),
    runs: await listBenchmarkRuns(jobId, user.organizationId),
  }, {
    headers: {
      "content-disposition": `attachment; filename="talentrank-benchmark-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
