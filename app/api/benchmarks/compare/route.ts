import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { compareBenchmarkRunIds } from "@/lib/store";

export async function GET(request: Request) {
  const user = await requireRole("recruiter");
  const url = new URL(request.url);
  return NextResponse.json(await compareBenchmarkRunIds(
    url.searchParams.get("baselineId") || undefined,
    url.searchParams.get("challengerId") || undefined,
    user.organizationId,
  ));
}
