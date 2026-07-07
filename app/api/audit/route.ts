import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createAuditEvent, listAuditEvents } from "@/lib/store";

const auditSchema = z.object({
  type: z.string().min(1).default("candidate.decision"),
  actorId: z.string().optional(),
  organizationId: z.string().optional(),
  jobId: z.string().optional(),
  candidateId: z.string().optional(),
  candidateName: z.string().optional(),
  decision: z.string().optional(),
  score: z.number().nullable().optional(),
  verdict: z.string().optional(),
  model: z.string().optional(),
  roleFamily: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function GET() {
  return NextResponse.json({ auditEvents: await listAuditEvents() });
}

export async function POST(request: Request) {
  const user = await requireRole("admin");
  const parsed = auditSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const event = await createAuditEvent({ ...parsed.data, actorId: user.id, organizationId: parsed.data.organizationId || user.organizationId });
  return NextResponse.json({ event }, { status: 201 });
}
