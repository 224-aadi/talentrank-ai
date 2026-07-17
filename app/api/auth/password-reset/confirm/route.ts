import { NextResponse } from "next/server";
import { z } from "zod";
import { resetPassword } from "@/lib/auth";

const schema = z.object({
  token: z.string().min(16),
  password: z.string().min(10),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Password must be at least 10 characters." }, { status: 400 });
  }
  const input = parsed.data;
  const ok = await resetPassword(input.token, input.password);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Reset token is invalid or expired." }, { status: 400 });
}
