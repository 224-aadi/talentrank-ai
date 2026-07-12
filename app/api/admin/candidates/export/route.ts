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

export async function GET(request: Request) {
  try {
    const user = await requireRole("admin");
    const origin = new URL(request.url).origin;
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
        "Candidate",
        "Email",
        "Status",
        "Resume file",
        "Open resume",
        "Resume URL",
        "Parse confidence",
        "Extracted skills",
        "Latest job",
        "JD created",
        "Score",
        "Verdict",
        "Decision",
        "Matched signals",
        "Missing signals",
        "Created",
      ],
      ...candidateRows.map(({ candidate, resume }) => {
        const match = latestMatchByCandidate.get(candidate.id);
        const decision = latestDecisionByCandidate.get(candidate.id);
        const job = match ? jobById.get(match.jobId) : undefined;
        const resumeUrl = `${origin}/api/resumes/${resume.id}/download`;
        return [
          csvCell(candidate.name),
          csvCell(candidate.email || resume.parsedJson?.contact?.email || ""),
          csvCell(candidate.status),
          csvCell(resume.fileName),
          csvFormula(`=HYPERLINK("${resumeUrl}", "Open resume")`),
          csvCell(resumeUrl),
          csvCell(resume.parseConfidence),
          csvCell(csvList(resume.parsedJson?.skills)),
          csvCell(job?.title || ""),
          csvCell(job?.createdAt || ""),
          csvCell(match?.score || ""),
          csvCell(match?.verdict || ""),
          csvCell(decision?.decision || ""),
          csvCell(csvList(match?.matchedSignals)),
          csvCell(csvList(match?.missingSignals)),
          csvCell(candidate.createdAt),
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
