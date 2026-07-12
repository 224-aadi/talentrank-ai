import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { auditExport, listBenchmarkCases, listBenchmarkRuns, listJobs, listMatchRuns } from "@/lib/store";

export async function GET() {
  try {
    const user = await requireRole("admin");
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      jobs: await listJobs(user.organizationId),
      matches: await listMatchRuns(undefined, user.organizationId),
      benchmarkCases: await listBenchmarkCases(undefined, user.organizationId),
      benchmarkRuns: await listBenchmarkRuns(undefined, user.organizationId),
      audit: await auditExport(user.organizationId),
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
