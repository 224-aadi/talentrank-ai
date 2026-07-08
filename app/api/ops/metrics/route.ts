import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { metricsSnapshot } from "@/lib/observability";
import { runtimeMode } from "@/lib/env";

export async function GET() {
  try {
    await requireRole("admin");
    return NextResponse.json({
      runtime: runtimeMode(),
      ...metricsSnapshot(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Metrics unavailable";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
