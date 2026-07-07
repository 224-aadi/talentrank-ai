import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { guardrailReport } from "@/lib/compliance";

const schema = z.object({
  jobText: z.string().optional().default(""),
  resumeText: z.string().optional().default(""),
});

export async function POST(request: Request) {
  try {
    await requireRole("recruiter");
    const input = schema.parse(await request.json());
    return NextResponse.json(guardrailReport(input));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Compliance scan failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
