import { NextResponse } from "next/server";
import { z } from "zod";
import { createPasswordReset } from "@/lib/auth";

const schema = z.object({ email: z.string().email() });

export async function POST(request: Request) {
  const input = schema.parse(await request.json());
  const reset = await createPasswordReset(input.email);
  return NextResponse.json({
    ok: true,
    resetUrl: process.env.NODE_ENV === "production" ? undefined : reset?.resetUrl,
    token: process.env.NODE_ENV === "production" ? undefined : reset?.token,
  });
}
