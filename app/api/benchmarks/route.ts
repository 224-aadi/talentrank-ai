import { NextResponse } from "next/server";
import { z } from "zod";
import { calibrationMetrics, createBenchmarkLabel, listBenchmarkLabels } from "@/lib/store";

const benchmarkSchema = z.object({
  jobId: z.string().min(1),
  candidateId: z.string().min(1),
  label: z.enum(["good_match", "bad_match", "interviewed", "offer", "hired"]),
  notes: z.string().optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId") || undefined;
  return NextResponse.json({
    labels: await listBenchmarkLabels(jobId),
    metrics: await calibrationMetrics(jobId),
  });
}

export async function POST(request: Request) {
  const parsed = benchmarkSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const label = await createBenchmarkLabel(parsed.data);
  return NextResponse.json({ label, metrics: await calibrationMetrics(parsed.data.jobId) }, { status: 201 });
}
