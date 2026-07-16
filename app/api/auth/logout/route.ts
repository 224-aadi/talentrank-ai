import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/auth";
import { absoluteAppUrl } from "@/lib/email";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  const origin = new URL(request.url).origin;
  const response = contentType.includes("application/json")
    ? NextResponse.json({ ok: true })
    : NextResponse.redirect(absoluteAppUrl("/login", origin), { status: 303 });
  const cookie = clearAuthCookie();
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
