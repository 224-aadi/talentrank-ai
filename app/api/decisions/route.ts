import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createRecruiterDecision, listRecruiterDecisions } from "@/lib/store";

const decisionSchema = z.object({
  jobId: z.string().min(1),
  candidateId: z.string().min(1),
  decision: z.enum(["shortlist", "hold", "reject", "interview"]),
  notes: z.string().optional(),
});

export async function GET(request: Request) {
  const user = await requireRole("recruiter");
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId") || undefined;
  return NextResponse.json({ decisions: await listRecruiterDecisions(jobId, user.organizationId) });
}

export async function POST(request: Request) {
  const user = await requireRole("recruiter");
  const parsed = decisionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const result = await createRecruiterDecision({ ...parsed.data, userId: user.id, organizationId: user.organizationId });
  return NextResponse.json(result, { status: 201 });
}
