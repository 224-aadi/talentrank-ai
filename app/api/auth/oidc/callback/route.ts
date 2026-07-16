import { NextResponse } from "next/server";
import { authCookie, loginWithTrustedIdentity } from "@/lib/auth";
import type { AuthUser } from "@/lib/auth";

const roles: AuthUser["role"][] = ["admin", "recruiter", "reviewer"];

function required(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is required for OIDC login.`);
  return value;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const expected = request.headers.get("cookie")?.match(/(?:^|;\s*)tr_oidc_state=([^;]+)/)?.[1];
    if (!code || !state || !expected || state !== expected) throw new Error("OIDC state validation failed.");

    const issuer = required("OIDC_ISSUER_URL").replace(/\/$/, "");
    const redirectUri = process.env.OIDC_REDIRECT_URI || new URL("/api/auth/oidc/callback", request.url).toString();
    const tokenResponse = await fetch(process.env.OIDC_TOKEN_URL || `${issuer}/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: required("OIDC_CLIENT_ID"),
        client_secret: required("OIDC_CLIENT_SECRET"),
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenResponse.ok) throw new Error(`OIDC token exchange failed with HTTP ${tokenResponse.status}.`);
    const tokens = await tokenResponse.json();
    const userInfoResponse = await fetch(process.env.OIDC_USERINFO_URL || `${issuer}/userinfo`, {
      headers: { authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userInfoResponse.ok) throw new Error(`OIDC userinfo failed with HTTP ${userInfoResponse.status}.`);
    const profile = await userInfoResponse.json();
    const email = String(profile.email || "");
    if (!email) throw new Error("OIDC profile did not include an email.");
    const configuredRole = process.env.OIDC_DEFAULT_ROLE as AuthUser["role"] | undefined;
    const role = configuredRole && roles.includes(configuredRole) ? configuredRole : "recruiter";
    const result = await loginWithTrustedIdentity({
      email,
      name: String(profile.name || profile.preferred_username || email),
      organizationId: process.env.OIDC_DEFAULT_ORG_ID || "org_demo",
      role,
    });
    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    const cookie = authCookie(result.token, result.maxAge);
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    response.cookies.set("tr_oidc_state", "", { path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "OIDC callback failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
