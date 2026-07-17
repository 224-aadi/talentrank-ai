import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { listCandidatePool, listJobs, listMatchRuns, listRecruiterDecisions } from "@/lib/store";
import type { Candidate, CandidatePoolItem, Job, MatchRun, RecruiterDecisionRecord } from "@/lib/types";

type ExportMatch = MatchRun & {
  job?: Job | null;
  candidate?: Candidate | null;
  latestDecision?: RecruiterDecisionRecord | null;
};

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function csvFormula(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function csvList(values?: string[]) {
  return values?.filter(Boolean).join("; ") || "";
}

function exportOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) return origin;
  const referer = request.headers.get("referer");
  if (referer) return new URL(referer).origin;
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
    return `${forwardedProto}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

export async function GET(request: Request) {
  try {
    const user = await requireRole("admin");
    const origin = exportOrigin(request);
    const [pool, matches, jobs, decisions] = await Promise.all([
      listCandidatePool(user.organizationId),
      listMatchRuns(undefined, user.organizationId),
      listJobs(user.organizationId),
      listRecruiterDecisions(undefined, user.organizationId),
    ]);
    const matchRows = matches as ExportMatch[];
    const candidateRows = pool as CandidatePoolItem[];
    const jobRows = jobs as Job[];
    const decisionRows = decisions as RecruiterDecisionRecord[];
    const latestMatchByCandidate = new Map<string, ExportMatch>();
    for (const match of matchRows) {
      if (!latestMatchByCandidate.has(match.candidateId)) latestMatchByCandidate.set(match.candidateId, match);
    }
    const latestDecisionByCandidate = new Map<string, RecruiterDecisionRecord>();
    for (const decision of decisionRows) {
      if (!latestDecisionByCandidate.has(decision.candidateId)) latestDecisionByCandidate.set(decision.candidateId, decision);
    }
    const jobById = new Map(jobRows.map((job) => [job.id, job]));
    const rows = [
      [
        "Rank",
        "Candidate",
        "Score",
        "Confidence",
        "Verdict",
        "Decision",
        "Required keywords",
        "Skills extracted",
        "LLM rationale",
        "Matched signals",
        "Missing signals",
        "Parser warnings",
        "Email",
        "Resume file",
        "Open resume",
        "Resume URL",
        "Job",
      ],
      ...candidateRows.map(({ candidate, resume }, index) => {
        const match = latestMatchByCandidate.get(candidate.id);
        const decision = latestDecisionByCandidate.get(candidate.id);
        const job = match ? jobById.get(match.jobId) : undefined;
        const resumeUrl = new URL(`/api/resumes/${resume.id}/download`, origin).toString();
        const rationale = match?.riskFlags
          ?.find((risk) => risk.toLowerCase().startsWith("llm rationale:"))
          ?.replace(/^LLM rationale:\s*/i, "");
        return [
          csvCell(index + 1),
          csvCell(candidate.name),
          csvCell(match?.score || ""),
          csvCell(match?.confidence || ""),
          csvCell(match?.verdict || ""),
          csvCell(decision?.decision || ""),
          csvCell(match?.hardRuleOutcomes?.map((outcome) => `${outcome.passed ? "pass" : "fail"}: ${outcome.rule}`).join("; ") || ""),
          csvCell(csvList(resume.parsedJson?.skills)),
          csvCell(rationale || ""),
          csvCell(csvList(match?.matchedSignals)),
          csvCell(csvList(match?.missingSignals)),
          csvCell(""),
          csvCell(candidate.email || resume.parsedJson?.contact?.email || ""),
          csvCell(resume.fileName),
          csvFormula(`=HYPERLINK("${resumeUrl}", "Open resume")`),
          csvCell(resumeUrl),
          csvCell(job?.title || ""),
        ];
      }),
    ];
    const csv = rows.map((row, index) => index === 0 ? row.map(csvCell).join(",") : row.join(",")).join("\n");
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="talentrank-candidates-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Candidate export failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
