import { NextResponse } from "next/server";
import { runtimeMode } from "@/lib/env";
import { prisma, prismaEnabled } from "@/lib/prisma";

async function databaseProbe() {
  if (!prismaEnabled()) return { ok: true, status: "skipped", detail: "Prisma/Postgres is not enabled." };
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Database probe timed out after 2500ms.")), 2500)),
    ]);
    return { ok: true, status: "pass", detail: "Database accepted SELECT 1." };
  } catch (error) {
    return {
      ok: false,
      status: "fail",
      detail: error instanceof Error ? error.message : "Database probe failed.",
    };
  }
}

export async function GET() {
  const runtime = runtimeMode();
  const database = await databaseProbe();
  const ok = runtime.ready && database.ok;
  return NextResponse.json({
    ok,
    service: "TalentRank AI",
    version: "0.5.0",
    model: "hybrid-v0.7-taxonomy",
    runtime,
    checks: {
      database,
    },
    now: new Date().toISOString(),
  }, { status: ok ? 200 : 503 });
}
