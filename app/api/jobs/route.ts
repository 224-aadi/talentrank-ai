import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createJob, listJobs } from "@/lib/store";

const jobSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  location: z.string().optional(),
  roleTemplate: z.enum(["auto", "data", "software", "sales", "finance", "operations"]).default("auto"),
  hardRules: z.array(z.string()).default([]),
});

export async function GET() {
  try {
    const user = await requireRole("recruiter");
    return NextResponse.json({ jobs: await listJobs(user.organizationId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not list jobs";
    return NextResponse.json({ error: message }, { status: message === "Authentication required." ? 401 : 400 });
  }
}

export async function POST(request: Request) {
  const user = await requireRole("recruiter");
  const parsed = jobSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const job = await createJob({ ...parsed.data, organizationId: user.organizationId });
  return NextResponse.json({ job }, { status: 201 });
}
