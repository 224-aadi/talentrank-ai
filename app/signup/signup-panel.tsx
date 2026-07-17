"use client";

import Link from "next/link";
import { useState } from "react";
import { PasswordInput } from "@/components/password-input";
import { normalizeEmail, validateSignupEmail } from "@/lib/email-validation";

export function SignupPanel({ error }: { error?: string }) {
  const [message, setMessage] = useState(error ? "Could not create your account." : "");
  const [loading, setLoading] = useState(false);
  const inputClass = "rounded-md border border-border bg-background px-3 py-2.5 outline-none ring-primary focus:ring-2";
  const minPasswordLength = 10;

  function displayError(errorValue: unknown, fallback: string) {
    return typeof errorValue === "string" && errorValue.trim() ? errorValue : fallback;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const email = normalizeEmail(String(form.get("email") || ""));
    const password = String(form.get("password") || "");
    const emailError = validateSignupEmail(email);
    if (!name) {
      setMessage("Enter your full name.");
      return;
    }
    if (emailError) {
      setMessage(emailError);
      return;
    }
    if (!password) {
      setMessage("Create a password.");
      return;
    }
    if (password.length < minPasswordLength) {
      setMessage("Password must be at least 10 characters.");
      return;
    }
    setLoading(true);
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        organizationName: form.get("organizationName") || undefined,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setMessage(displayError(payload.error, "Could not create your account."));
      return;
    }
    window.location.href = "/dashboard";
  }

  return (
    <>
      {message ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{message}</div>
      ) : null}
      <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Full name</span>
          <input
            name="name"
            type="text"
            autoComplete="name"
            required
            className={inputClass}
          />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Work email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className={inputClass}
          />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Company or team name</span>
          <input
            name="organizationName"
            type="text"
            placeholder="Optional"
            className={inputClass}
          />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Password</span>
          <PasswordInput
            name="password"
            aria-label="Password"
            autoComplete="new-password"
            minLength={10}
            required
            inputClassName={inputClass}
          />
          <span className="text-xs text-muted-foreground">At least 10 characters</span>
        </label>
        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
    </>
  );
}

export function SignupFooter() {
  return (
    <>
      Already have an account?{" "}
      <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
        Sign in
      </Link>
    </>
  );
}
