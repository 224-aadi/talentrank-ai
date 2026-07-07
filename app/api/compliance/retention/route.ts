import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { retentionReport } from "@/lib/store";

export async function GET(request: Request) {
  try {
    await requireRole("admin");
    const url = new URL(request.url);
    const days = Number(url.searchParams.get("days") || 365);
    return NextResponse.json(await retentionReport(Number.isFinite(days) ? days : 365));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Retention report failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
