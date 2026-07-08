import { NextResponse } from "next/server";
import { z } from "zod";
import { resetPassword } from "@/lib/auth";

const schema = z.object({
  token: z.string().min(16),
  password: z.string().min(10),
});

export async function POST(request: Request) {
  const input = schema.parse(await request.json());
  const ok = await resetPassword(input.token, input.password);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Reset token is invalid or expired." }, { status: 400 });
}
