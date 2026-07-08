import crypto from "node:crypto";
import { NextResponse } from "next/server";

function required(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is required for OIDC login.`);
  return value;
}

export async function GET(request: Request) {
  try {
    const issuer = required("OIDC_ISSUER_URL").replace(/\/$/, "");
    const clientId = required("OIDC_CLIENT_ID");
    const redirectUri = process.env.OIDC_REDIRECT_URI || new URL("/api/auth/oidc/callback", request.url).toString();
    const state = crypto.randomBytes(16).toString("base64url");
    const nonce = crypto.randomBytes(16).toString("base64url");
    const authorization = new URL(process.env.OIDC_AUTHORIZATION_URL || `${issuer}/authorize`);
    authorization.searchParams.set("client_id", clientId);
    authorization.searchParams.set("redirect_uri", redirectUri);
    authorization.searchParams.set("response_type", "code");
    authorization.searchParams.set("scope", process.env.OIDC_SCOPE || "openid email profile");
    authorization.searchParams.set("state", state);
    authorization.searchParams.set("nonce", nonce);
    const response = NextResponse.redirect(authorization);
    response.cookies.set("tr_oidc_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "OIDC start failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
