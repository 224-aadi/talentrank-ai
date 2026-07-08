import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { listBenchmarkCases, listBenchmarkLabels, listBenchmarkRuns } from "@/lib/store";

export async function GET(request: Request) {
  await requireRole("recruiter");
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId") || undefined;
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    jobId,
    cases: await listBenchmarkCases(jobId),
    labels: await listBenchmarkLabels(jobId),
    runs: await listBenchmarkRuns(jobId),
  }, {
    headers: {
      "content-disposition": `attachment; filename="talentrank-benchmark-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
