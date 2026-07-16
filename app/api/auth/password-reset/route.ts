import { NextResponse } from "next/server";
import { z } from "zod";
import { createPasswordReset } from "@/lib/auth";
import { absoluteAppUrl, emailConfig, sendPasswordResetEmail } from "@/lib/email";

const schema = z.object({ email: z.string().email() });

export async function POST(request: Request) {
  const input = schema.parse(await request.json());
  const reset = await createPasswordReset(input.email);
  const origin = new URL(request.url).origin;
  let email = null;
  if (reset) {
    email = await sendPasswordResetEmail({
      to: reset.email,
      resetUrl: reset.resetUrl,
      origin,
    });
    if (!email.delivered && process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: email.detail }, { status: 502 });
    }
  }
  return NextResponse.json({
    ok: true,
    resetUrl: process.env.NODE_ENV === "production" || !reset ? undefined : absoluteAppUrl(reset.resetUrl, origin),
    token: process.env.NODE_ENV === "production" ? undefined : reset?.token,
    email,
    emailConfigured: emailConfig().ready,
  });
}
