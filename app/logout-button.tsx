"use client";

export function LogoutButton() {
  async function signOut() {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    window.location.href = "/login";
  }

  return (
    <button type="button" onClick={signOut}>
      Sign out
    </button>
  );
}
