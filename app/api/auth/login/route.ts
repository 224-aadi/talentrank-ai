import { NextResponse } from "next/server";
import { loginWithPassword, authCookie } from "@/lib/auth";
import { clientKey, checkRateLimit } from "@/lib/rate-limit";
import { incrementMetric, logEvent } from "@/lib/observability";

function redirectTo(request: Request, path: string) {
  return new URL(path, request.url);
}

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(await clientKey("auth-login"), 8, 60_000);
  if (!rateLimit.ok) {
    return NextResponse.json({ error: "Too many login attempts. Try again shortly." }, { status: 429 });
  }
  const contentType = request.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await request.json()
    : Object.fromEntries((await request.formData()).entries());
  const email = String(payload.email || "");
  const password = String(payload.password || "");
  const remember = payload.remember === true || payload.remember === "true" || payload.remember === "on";
  const result = await loginWithPassword(email, password, remember);

  if (!result) {
    incrementMetric("auth.login.failure");
    logEvent("auth.login.failure", { email });
    if (contentType.includes("application/json")) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }
    return NextResponse.redirect(redirectTo(request, "/login?error=invalid"), { status: 303 });
  }

  incrementMetric("auth.login.success");
  logEvent("auth.login.success", { userId: result.user.id, organizationId: result.user.organizationId });
  const response = contentType.includes("application/json")
    ? NextResponse.json({ user: result.user })
    : NextResponse.redirect(redirectTo(request, "/dashboard"), { status: 303 });
  const cookie = authCookie(result.token, result.maxAge);
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
