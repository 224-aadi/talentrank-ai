import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { explainabilityReport } from "@/lib/store";

export async function GET(request: Request) {
  try {
    const user = await requireRole("recruiter");
    const url = new URL(request.url);
    const matchRunId = url.searchParams.get("matchRunId");
    if (!matchRunId) return NextResponse.json({ error: "matchRunId is required" }, { status: 400 });
    const report = await explainabilityReport(matchRunId, user.organizationId);
    if (!report) return NextResponse.json({ error: "Match run not found" }, { status: 404 });
    return NextResponse.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Explainability report failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
