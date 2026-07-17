import { NextResponse } from "next/server";
import { z } from "zod";
import { authCookie, signupUser } from "@/lib/auth";
import { clientKey, checkRateLimit } from "@/lib/rate-limit";
import { incrementMetric, logEvent } from "@/lib/observability";

const signupSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(10),
  organizationName: z.string().optional(),
});

function redirectTo(request: Request, path: string) {
  return new URL(path, request.url);
}

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(await clientKey("auth-signup"), 6, 60_000);
  if (!rateLimit.ok) {
    return NextResponse.json({ error: "Too many signup attempts. Try again shortly." }, { status: 429 });
  }

  const contentType = request.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await request.json()
    : Object.fromEntries((await request.formData()).entries());

  try {
    const parsed = signupSchema.safeParse(payload);
    if (!parsed.success) {
      const passwordIssue = parsed.error.issues.find((issue) => issue.path[0] === "password");
      const emailIssue = parsed.error.issues.find((issue) => issue.path[0] === "email");
      const nameIssue = parsed.error.issues.find((issue) => issue.path[0] === "name");
      const message = passwordIssue
        ? "Password must be at least 10 characters."
        : emailIssue
          ? "Enter a valid work email."
          : nameIssue
            ? "Enter your full name."
            : "Could not create account.";
      if (contentType.includes("application/json")) {
        return NextResponse.json({ error: message }, { status: 400 });
      }
      return NextResponse.redirect(redirectTo(request, `/signup?error=${encodeURIComponent(message)}`), { status: 303 });
    }
    const input = parsed.data;
    const result = await signupUser(input);

    incrementMetric("auth.login.success");
    logEvent("auth.login.success", { userId: result.user.id, organizationId: result.user.organizationId });

    const response = contentType.includes("application/json")
      ? NextResponse.json({ user: result.user })
      : NextResponse.redirect(redirectTo(request, "/dashboard"), { status: 303 });
    const cookie = authCookie(result.token, result.maxAge);
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create account.";
    if (contentType.includes("application/json")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.redirect(redirectTo(request, `/signup?error=${encodeURIComponent(message)}`), { status: 303 });
  }
}
