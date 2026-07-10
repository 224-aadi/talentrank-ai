"use client";

import { useMemo, useState } from "react";
import type { AuthUser } from "@/lib/auth";

const roles: AuthUser["role"][] = ["admin", "recruiter", "reviewer"];

export function AdminUsersPanel({ initialUsers, currentUserId }: { initialUsers: AuthUser[]; currentUserId: string }) {
  const [users, setUsers] = useState(initialUsers);
  const [inviteLink, setInviteLink] = useState("");
  const [message, setMessage] = useState("");
  const sortedUsers = useMemo(() => [...users].sort((a, b) => a.email.localeCompare(b.email)), [users]);

  async function inviteUser(formData: FormData) {
    setMessage("");
    setInviteLink("");
    const response = await fetch("/api/auth/invites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        name: formData.get("name"),
        role: formData.get("role"),
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error || "Could not create invite.");
      return;
    }
    setInviteLink(payload.inviteUrl);
    setUsers((current) => {
      const withoutExisting = current.filter((user) => user.id !== payload.user.id);
      return [payload.user, ...withoutExisting];
    });
    setMessage(payload.email?.delivered ? `Invite emailed to ${payload.user.email}.` : `Invite created for ${payload.user.email}.`);
  }

  async function updateRole(userId: string, role: AuthUser["role"]) {
    setMessage("");
    const response = await fetch(`/api/auth/users/${userId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error || "Could not update role.");
      return;
    }
    setUsers((current) => current.map((user) => (user.id === payload.user.id ? payload.user : user)));
    setMessage(`Updated ${payload.user.email} to ${payload.user.role}.`);
  }

  return (
    <section className="panel-grid admin-user-grid">
      <article>
        <h2>Invite Teammate</h2>
        <form action={inviteUser} className="admin-form">
          <label>
            Name
            <input name="name" autoComplete="name" required />
          </label>
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Role
            <select name="role" defaultValue="recruiter">
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Create invite</button>
        </form>
        {inviteLink ? (
          <p className="copy-field">
            Invite link: <code>{inviteLink}</code>
          </p>
        ) : null}
        {message ? <p className="admin-message">{message}</p> : null}
      </article>

      <article>
        <div className="section-heading">
          <h2>Roles</h2>
          <a href="/api/admin/users/export" className="export-link">
            Export CSV
          </a>
        </div>
        <div className="user-role-list">
          {sortedUsers.map((user) => (
            <div key={user.id} className="user-role-row">
              <div>
                <strong>{user.name}</strong>
                <p>{user.email}</p>
              </div>
              <select
                value={user.role}
                disabled={user.id === currentUserId}
                onChange={(event) => updateRole(user.id, event.target.value as AuthUser["role"])}
                aria-label={`Role for ${user.email}`}
              >
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
