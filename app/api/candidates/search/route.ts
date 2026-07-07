import { NextResponse } from "next/server";
import { retrieveCandidates } from "@/lib/retrieval";
import { listCandidatePool } from "@/lib/store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";
  const limit = Number(url.searchParams.get("limit") || 20);
  const pool = await listCandidatePool();
  const results = retrieveCandidates(pool, query, Math.min(50, Math.max(1, limit)));
  return NextResponse.json({
    query,
    poolSize: pool.length,
    results,
  });
}
