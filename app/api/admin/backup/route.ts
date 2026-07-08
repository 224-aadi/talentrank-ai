import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { auditExport, listBenchmarkCases, listBenchmarkRuns, listJobs, listMatchRuns } from "@/lib/store";

export async function GET() {
  try {
    await requireRole("admin");
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      jobs: await listJobs(),
      matches: await listMatchRuns(),
      benchmarkCases: await listBenchmarkCases(),
      benchmarkRuns: await listBenchmarkRuns(),
      audit: await auditExport(),
    }, {
      headers: {
        "content-disposition": `attachment; filename="talentrank-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backup export failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
