import { NextResponse } from "next/server";
import { z } from "zod";
import { inviteAuthUser, requireRole } from "@/lib/auth";

const inviteSchema = z.object({
  organizationId: z.string().optional(),
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["admin", "recruiter", "reviewer"]).default("recruiter"),
});

export async function POST(request: Request) {
  try {
    const admin = await requireRole("admin");
    const input = inviteSchema.parse(await request.json());
    const invite = await inviteAuthUser({ ...input, organizationId: input.organizationId || admin.organizationId });
    return NextResponse.json(invite, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create invite";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
