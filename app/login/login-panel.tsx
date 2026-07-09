"use client";

import { useState } from "react";

export function LoginPanel({
  inviteToken,
  resetToken,
  hasOidc,
  error,
}: {
  inviteToken?: string;
  resetToken?: string;
  hasOidc: boolean;
  error?: string;
}) {
  const [mode, setMode] = useState<"login" | "reset-request">(inviteToken || resetToken ? "login" : "login");
  const [message, setMessage] = useState(error ? "Invalid email or password." : "");

  async function submitJson(path: string, body: Record<string, FormDataEntryValue | string | undefined>) {
    setMessage("");
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error || "Request failed.");
      return null;
    }
    return payload;
  }

  async function acceptInvite(formData: FormData) {
    const payload = await submitJson("/api/auth/invites/accept", {
      token: inviteToken,
      password: formData.get("password") || "",
    });
    if (payload) window.location.href = "/";
  }

  async function requestReset(formData: FormData) {
    const payload = await submitJson("/api/auth/password-reset", { email: formData.get("email") || "" });
    if (!payload) return;
    setMessage(payload.resetUrl ? `Reset link created: ${payload.resetUrl}` : "If the email exists, a reset link has been issued.");
  }

  async function confirmReset(formData: FormData) {
    const payload = await submitJson("/api/auth/password-reset/confirm", {
      token: resetToken,
      password: formData.get("password") || "",
    });
    if (payload) {
      setMessage("Password reset. You can sign in now.");
      window.history.replaceState(null, "", "/login");
    }
  }

  if (inviteToken) {
    return (
      <>
        <p>Accept your workspace invite and create a password for secure access.</p>
        <form action={acceptInvite} className="login-form">
          <label>
            New password
            <input name="password" type="password" autoComplete="new-password" minLength={10} required />
          </label>
          <button type="submit">Accept invite</button>
        </form>
        {message ? <div className="error-banner">{message}</div> : null}
      </>
    );
  }

  if (resetToken) {
    return (
      <>
        <p>Create a new password for your TalentRank AI account.</p>
        <form action={confirmReset} className="login-form">
          <label>
            New password
            <input name="password" type="password" autoComplete="new-password" minLength={10} required />
          </label>
          <button type="submit">Reset password</button>
        </form>
        {message ? <div className="error-banner">{message}</div> : null}
      </>
    );
  }

  return (
    <>
      <p>Welcome back.</p>
      {message ? <div className="error-banner">{message}</div> : null}
      {mode === "reset-request" ? (
        <form action={requestReset} className="login-form">
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <button type="submit">Send reset link</button>
          <button type="button" className="secondary-button" onClick={() => setMode("login")}>
            Back to sign in
          </button>
        </form>
      ) : (
        <>
          {hasOidc ? (
            <a className="oidc-button" href="/api/auth/oidc/start">
              Continue with SSO
            </a>
          ) : null}
          <form action="/api/auth/login" method="post" className="login-form">
            <label>
              Email
              <input name="email" type="email" autoComplete="email" defaultValue="admin@talentrank.local" required />
            </label>
            <label>
              Password
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
            <button type="submit">Sign in</button>
            <button type="button" className="secondary-button" onClick={() => setMode("reset-request")}>
              Reset password
            </button>
          </form>
        </>
      )}
    </>
  );
}
