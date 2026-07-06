import { NextResponse } from "next/server";
import { z } from "zod";
import { createJob, listJobs } from "@/lib/store";

const jobSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  location: z.string().optional(),
  roleTemplate: z.enum(["auto", "data", "software", "sales", "finance", "operations"]).default("auto"),
  hardRules: z.array(z.string()).default([]),
});

export async function GET() {
  return NextResponse.json({ jobs: await listJobs() });
}

export async function POST(request: Request) {
  const parsed = jobSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const job = await createJob(parsed.data);
  return NextResponse.json({ job }, { status: 201 });
}
