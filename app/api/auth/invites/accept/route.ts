import { NextResponse } from "next/server";
import { z } from "zod";
import { acceptInvite, authCookie } from "@/lib/auth";

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
  const result = await acceptInvite(input.token, input.password);
  if (!result) return NextResponse.json({ error: "Invite is invalid or expired." }, { status: 400 });
  const response = NextResponse.json({ user: result.user });
  const cookie = authCookie(result.token, result.maxAge);
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
