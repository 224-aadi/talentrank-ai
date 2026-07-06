import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "TalentRank AI",
    version: "0.5.0",
    model: "hybrid-v0.5",
    now: new Date().toISOString(),
  });
}
