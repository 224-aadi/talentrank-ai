import { NextResponse } from "next/server";
import { runtimeMode } from "@/lib/env";

export async function GET() {
  const runtime = runtimeMode();
  return NextResponse.json({
    ok: runtime.ready,
    service: "TalentRank AI",
    version: "0.5.0",
    model: "hybrid-v0.7-taxonomy",
    runtime,
    now: new Date().toISOString(),
  }, { status: runtime.ready ? 200 : 503 });
}
