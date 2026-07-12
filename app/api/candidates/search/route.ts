import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { retrieveCandidates } from "@/lib/retrieval";
import { listCandidatePool } from "@/lib/store";

export async function GET(request: Request) {
  try {
    const user = await requireRole("recruiter");
    const url = new URL(request.url);
    const query = url.searchParams.get("q") || "";
    const modeParam = url.searchParams.get("mode");
    const mode = modeParam === "lexical" || modeParam === "semantic" || modeParam === "hybrid" ? modeParam : "hybrid";
    const limit = Number(url.searchParams.get("limit") || 20);
    const pool = await listCandidatePool(user.organizationId);
    const results = await retrieveCandidates(pool, query, Math.min(50, Math.max(1, limit)), mode);
    return NextResponse.json({
      query,
      mode,
      embeddingProvider: results[0]?.semanticProvider || "none",
      embeddingModel: results[0]?.embeddingModel || "none",
      poolSize: pool.length,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Candidate search failed";
    return NextResponse.json({ error: message }, { status: message === "Authentication required." ? 401 : 500 });
  }
}
