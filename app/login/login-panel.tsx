"use client";

import Link from "next/link";
import { useState } from "react";
import { PasswordInput } from "@/components/password-input";

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
  const [mode, setMode] = useState<"login" | "reset-request">("login");
  const [message, setMessage] = useState(error ? "Invalid email or password." : "");
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);

  const inputClass =
    "rounded-md border border-border bg-background px-3 py-2.5 outline-none ring-primary focus:ring-2";
  const primaryButtonClass =
    "rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60";
  const secondaryButtonClass =
    "rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted";

  async function submitJson(path: string, body: Record<string, FormDataEntryValue | string | undefined>) {
    setMessage("");
    setLoading(true);
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setMessage(payload.error || "Request failed.");
      return null;
    }
    return payload;
  }

  async function acceptInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = await submitJson("/api/auth/invites/accept", {
      token: inviteToken,
      password: form.get("password") || "",
    });
    if (payload) window.location.href = "/dashboard";
  }

  async function requestReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = await submitJson("/api/auth/password-reset", { email: form.get("email") || "" });
    if (!payload) return;
    setMessage(
      payload.email?.delivered
        ? "Password reset email sent."
        : payload.resetUrl
          ? `Reset link created: ${payload.resetUrl}`
          : "If the email exists, a reset link has been issued.",
    );
  }

  async function confirmReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = await submitJson("/api/auth/password-reset/confirm", {
      token: resetToken,
      password: form.get("password") || "",
    });
    if (payload) {
      setMessage("Password reset. You can sign in now.");
      window.history.replaceState(null, "", "/login");
    }
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
        remember,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setMessage(payload.error || "Invalid email or password.");
      return;
    }
    window.location.href = "/dashboard";
  }

  if (inviteToken) {
    return (
      <>
        <p className="text-sm text-muted-foreground">Accept your workspace invite and create a password for secure access.</p>
        {message ? <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{message}</div> : null}
        <form onSubmit={acceptInvite} className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm">
            <span className="font-medium">New password</span>
            <PasswordInput name="password" aria-label="New password" autoComplete="new-password" minLength={10} required inputClassName={inputClass} />
          </label>
          <button type="submit" disabled={loading} className={primaryButtonClass}>
            Accept invite
          </button>
        </form>
      </>
    );
  }

  if (resetToken) {
    return (
      <>
        <p className="text-sm text-muted-foreground">Create a new password for your TalentRankAI account.</p>
        {message ? <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{message}</div> : null}
        <form onSubmit={confirmReset} className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm">
            <span className="font-medium">New password</span>
            <PasswordInput name="password" aria-label="New password" autoComplete="new-password" minLength={10} required inputClassName={inputClass} />
          </label>
          <button type="submit" disabled={loading} className={primaryButtonClass}>
            Reset password
          </button>
        </form>
      </>
    );
  }

  return (
    <>
      {message ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{message}</div> : null}
      {mode === "reset-request" ? (
        <form onSubmit={requestReset} className="grid gap-4">
          <label className="grid gap-2 text-sm">
            <span className="font-medium">Email</span>
            <input name="email" type="email" autoComplete="email" required className={inputClass} />
          </label>
          <button type="submit" disabled={loading} className={primaryButtonClass}>
            Send reset link
          </button>
          <button type="button" className={secondaryButtonClass} onClick={() => setMode("login")}>
            Back to sign in
          </button>
        </form>
      ) : (
        <>
          {hasOidc ? (
            <a
              href="/api/auth/oidc/start"
              className="mb-4 flex items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Continue with SSO
            </a>
          ) : null}
          <form onSubmit={handleLogin} className="grid gap-4">
            <label className="grid gap-2 text-sm">
              <span className="font-medium">Email</span>
              <input name="email" type="email" autoComplete="email" required className={inputClass} />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="font-medium">Password</span>
              <PasswordInput name="password" aria-label="Password" autoComplete="current-password" required inputClassName={inputClass} />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2.5 text-sm">
              <span>
                <span className="block font-medium">Remember me</span>
                <span className="text-xs text-muted-foreground">Stay signed in on this device.</span>
              </span>
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
            </label>
            <button type="submit" disabled={loading} className={primaryButtonClass}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
            <button type="button" className={secondaryButtonClass} onClick={() => setMode("reset-request")}>
              Reset password
            </button>
          </form>
        </>
      )}
    </>
  );
}

export function LoginFooter() {
  return (
    <>
      Don&apos;t have an account?{" "}
      <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
        Sign up
      </Link>
    </>
  );
}
