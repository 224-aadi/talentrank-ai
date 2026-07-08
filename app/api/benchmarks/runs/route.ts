import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createBenchmarkRun, listBenchmarkRuns } from "@/lib/store";

const runSchema = z.object({
  jobId: z.string().optional(),
  modelVersion: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(request: Request) {
  await requireRole("recruiter");
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId") || undefined;
  return NextResponse.json({ runs: await listBenchmarkRuns(jobId) });
}

export async function POST(request: Request) {
  await requireRole("recruiter");
  const parsed = runSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  return NextResponse.json({ run: await createBenchmarkRun(parsed.data) }, { status: 201 });
}
