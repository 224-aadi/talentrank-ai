import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { deleteCandidate } from "@/lib/store";

export async function DELETE(_: Request, context: { params: Promise<{ candidateId: string }> }) {
  try {
    const user = await requireRole("admin");
    const { candidateId } = await context.params;
    return NextResponse.json(await deleteCandidate(candidateId, user.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Candidate deletion failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
