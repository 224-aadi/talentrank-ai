import { NextResponse } from "next/server";
import { z } from "zod";
import { createEvaluation } from "@/lib/store";

const evaluationSchema = z.object({
  jobId: z.string().optional(),
  model: z.string().default("TalentRank hybrid-v0.5"),
  candidateCount: z.number().int().nonnegative(),
  shortlistCount: z.number().int().nonnegative(),
  strongMatchCount: z.number().int().nonnegative(),
  avgScore: z.number().min(0).max(100),
  avgConfidence: z.number().min(0).max(100),
  parseHealth: z.number().min(0).max(100),
  falseKnockoutReviewCount: z.number().int().nonnegative().default(0),
  notes: z.string().optional(),
});

export async function POST(request: Request) {
  const parsed = evaluationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const evaluation = await createEvaluation(parsed.data);
  return NextResponse.json({ evaluation }, { status: 201 });
}
