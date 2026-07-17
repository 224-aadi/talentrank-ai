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
  const minPasswordLength = 10;

  function passwordError(password: string) {
    if (!password) return "Enter a password.";
    if (password.length < minPasswordLength) return "Password must be at least 10 characters.";
    return "";
  }

  function displayError(errorValue: unknown, fallback: string) {
    return typeof errorValue === "string" && errorValue.trim() ? errorValue : fallback;
  }

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
      setMessage(displayError(payload.error, "Request failed."));
      return null;
    }
    return payload;
  }

  async function acceptInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const validationError = passwordError(password);
    if (validationError) {
      setMessage(validationError);
      return;
    }
    const payload = await submitJson("/api/auth/invites/accept", {
      token: inviteToken,
      password,
    });
    if (payload) window.location.href = "/dashboard";
  }

  async function requestReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    if (!email) {
      setMessage("Enter the email address on your TalentRank account.");
      return;
    }
    const payload = await submitJson("/api/auth/password-reset", { email });
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
    const password = String(form.get("password") || "");
    const validationError = passwordError(password);
    if (validationError) {
      setMessage(validationError);
      return;
    }
    const payload = await submitJson("/api/auth/password-reset/confirm", {
      token: resetToken,
      password,
    });
    if (payload) {
      setMessage("Password reset. You can sign in now.");
      window.history.replaceState(null, "", "/login");
    }
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    if (!email) {
      setMessage("Enter your email address.");
      return;
    }
    if (!password) {
      setMessage("Enter your password.");
      return;
    }
    setLoading(true);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        remember,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setMessage(response.status === 401 ? "Incorrect email or password. Check your password and try again." : displayError(payload.error, "Sign in failed."));
      return;
    }
    window.location.href = "/dashboard";
  }

  if (inviteToken) {
    return (
      <>
        <p className="text-sm text-muted-foreground">Accept your workspace invite and create a password for secure access.</p>
        {message ? <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{message}</div> : null}
        <form onSubmit={acceptInvite} className="mt-6 grid gap-4" noValidate>
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
        <form onSubmit={confirmReset} className="mt-6 grid gap-4" noValidate>
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
        <form onSubmit={requestReset} className="grid gap-4" noValidate>
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
          <form onSubmit={handleLogin} className="grid gap-4" noValidate>
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
