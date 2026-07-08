import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { importBenchmarkCases, listBenchmarkCases } from "@/lib/store";

const caseSchema = z.object({
  jobId: z.string().min(1),
  candidateId: z.string().min(1),
  expectedLabel: z.enum(["good_match", "bad_match", "interviewed", "offer", "hired"]),
  roleFamily: z.string().optional(),
  seniority: z.string().optional(),
  location: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
});

const importSchema = z.object({
  cases: z.array(caseSchema).default([]),
});

export async function GET(request: Request) {
  await requireRole("recruiter");
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId") || undefined;
  return NextResponse.json({ cases: await listBenchmarkCases(jobId) });
}

export async function POST(request: Request) {
  await requireRole("recruiter");
  const parsed = importSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const cases = await importBenchmarkCases(parsed.data.cases);
  return NextResponse.json({ imported: cases.length, cases }, { status: 201 });
}
