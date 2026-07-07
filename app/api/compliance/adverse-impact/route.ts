import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { adverseImpactReport } from "@/lib/compliance";

const schema = z.object({
  groups: z.array(z.object({
    group: z.string(),
    selected: z.number(),
    total: z.number(),
  })).default([]),
});

export async function POST(request: Request) {
  try {
    await requireRole("recruiter");
    const input = schema.parse(await request.json());
    return NextResponse.json(adverseImpactReport(input.groups));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Adverse-impact report failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
