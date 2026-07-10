import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/auth";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  const response = contentType.includes("application/json")
    ? NextResponse.json({ ok: true })
    : NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  const cookie = clearAuthCookie();
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
