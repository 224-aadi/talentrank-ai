import { NextResponse } from "next/server";
import { z } from "zod";
import { inviteAuthUser, requireRole } from "@/lib/auth";
import { emailConfig, sendInviteEmail } from "@/lib/email";

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
    const origin = new URL(request.url).origin;
    const email = await sendInviteEmail({
      to: invite.user.email,
      name: invite.user.name,
      organizationId: invite.user.organizationId,
      inviteUrl: invite.inviteUrl,
      origin,
    });
    if (!email.delivered && process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: email.detail }, { status: 502 });
    }
    return NextResponse.json(
      {
        user: invite.user,
        inviteUrl: process.env.NODE_ENV === "production" ? undefined : invite.inviteUrl,
        token: process.env.NODE_ENV === "production" ? undefined : invite.token,
        email,
        emailConfigured: emailConfig().ready,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create invite";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
