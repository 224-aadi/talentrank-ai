"use client";

import Link from "next/link";
import { useState } from "react";
import { PasswordInput } from "@/components/password-input";

export function SignupPanel({ error }: { error?: string }) {
  const [message, setMessage] = useState(error ? "Could not create your account." : "");
  const [loading, setLoading] = useState(false);
  const inputClass = "rounded-md border border-border bg-background px-3 py-2.5 outline-none ring-primary focus:ring-2";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
        organizationName: form.get("organizationName") || undefined,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setMessage(payload.error || "Could not create your account.");
      return;
    }
    window.location.href = "/dashboard";
  }

  return (
    <>
      {message ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{message}</div>
      ) : null}
      <form onSubmit={handleSubmit} className="grid gap-4">
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
