import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthUser, listAuthUsers, requireRole } from "@/lib/auth";

const userSchema = z.object({
  organizationId: z.string().optional(),
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["admin", "recruiter", "reviewer"]).default("recruiter"),
  password: z.string().min(10),
});

export async function GET() {
  try {
    await requireRole("admin");
    return NextResponse.json({ users: await listAuthUsers() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not list users";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireRole("admin");
    const input = userSchema.parse(await request.json());
    const user = await createAuthUser({
      ...input,
      organizationId: input.organizationId || admin.organizationId,
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create user";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
