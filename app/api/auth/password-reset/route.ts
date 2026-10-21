import { NextResponse } from "next/server";
import { z } from "zod";
import { createPasswordReset } from "@/lib/auth";
import { absoluteAppUrl, emailConfig, sendPasswordResetEmail } from "@/lib/email";
import { clientKey, checkRateLimit } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-error";

const schema = z.object({ email: z.string().email() });

export async function POST(request: Request) {
  try {
  const rate = checkRateLimit(await clientKey("password-reset"), 6, 60_000);
  if (!rate.ok) return NextResponse.json({ error: "Too many reset requests. Please try again shortly." }, { status: 429 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  const input = parsed.data;
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
  } catch (error) {
    const failure = apiError(error);
    return NextResponse.json({ error: failure.status === 503 ? failure.message : "The reset email could not be sent. Please try again shortly." }, { status: failure.status === 503 ? 503 : 502 });
  }
}
