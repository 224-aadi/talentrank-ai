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
  error?: string;
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
  const [jobs, candidates, matches, decisions, auditEvents] = await Promise.allSettled([
    backendJson<{ jobs: Job[] }>("/api/jobs"),
    backendJson<{ results: CandidatePoolItem[] }>("/api/candidates/search?limit=50"),
    backendJson<{ matchRuns: MatchRun[] }>("/api/matches"),
    backendJson<{ decisions: RecruiterDecisionRecord[] }>("/api/decisions"),
    backendJson<{ auditEvents: AuditEvent[] }>("/api/audit"),
  ]);
  const failures = [jobs, candidates, matches, decisions, auditEvents]
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => result.reason instanceof Error ? result.reason.message : "Backend request failed.");
  return {
    jobs: jobs.status === "fulfilled" ? jobs.value.jobs : [],
    candidates: candidates.status === "fulfilled" ? candidates.value.results : [],
    matches: matches.status === "fulfilled" ? matches.value.matchRuns : [],
    decisions: decisions.status === "fulfilled" ? decisions.value.decisions : [],
    auditEvents: auditEvents.status === "fulfilled" ? auditEvents.value.auditEvents : [],
    error: failures[0],
  };
}
