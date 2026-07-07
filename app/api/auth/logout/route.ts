import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/auth";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  const cookie = clearAuthCookie();
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
