import "server-only";
import { cookies } from "next/headers";
import { frontendOnlyMode } from "./deployment";
import type { AuditEvent, CandidatePoolItem, Job, MatchRun, RecruiterDecisionRecord } from "./types";

type BackendPayload = {
  jobs: Job[];
  candidates: CandidatePoolItem[];
  matches: MatchRun[];
  decisions: RecruiterDecisionRecord[];
  auditEvents: AuditEvent[];
};

function backendBaseUrl() {
  return process.env.TALENTRANK_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "";
}

async function backendJson<T>(path: string): Promise<T> {
  const base = backendBaseUrl();
  if (!base) throw new Error("Backend URL is not configured.");
  const cookieHeader = (await cookies()).toString();
  const response = await fetch(new URL(path, base).toString(), {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Backend request failed: ${path}`);
  }
  return await response.json() as T;
}

export async function frontendOnlyAdminData(): Promise<BackendPayload | null> {
  if (!frontendOnlyMode()) return null;
  const [jobs, candidates, matches, decisions, auditEvents] = await Promise.all([
    backendJson<{ jobs: Job[] }>("/api/jobs"),
    backendJson<{ results: CandidatePoolItem[] }>("/api/candidates/search?limit=50"),
    backendJson<{ matchRuns: MatchRun[] }>("/api/matches"),
    backendJson<{ decisions: RecruiterDecisionRecord[] }>("/api/decisions"),
    backendJson<{ auditEvents: AuditEvent[] }>("/api/audit"),
  ]);
  return {
    jobs: jobs.jobs,
    candidates: candidates.results,
    matches: matches.matchRuns,
    decisions: decisions.decisions,
    auditEvents: auditEvents.auditEvents,
  };
}
