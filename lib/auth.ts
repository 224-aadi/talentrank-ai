import { headers } from "next/headers";
import type { UserRole } from "@prisma/client";

export type AuthUser = {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: Lowercase<UserRole>;
};

const roleRank: Record<AuthUser["role"], number> = {
  reviewer: 1,
  recruiter: 2,
  admin: 3,
};

function normalizeRole(value?: string | null): AuthUser["role"] {
  const role = value?.toLowerCase();
  if (role === "admin" || role === "reviewer" || role === "recruiter") return role;
  return "recruiter";
}

export async function currentUser(): Promise<AuthUser> {
  const headerStore = await headers();
  return {
    id: headerStore.get("x-talentrank-user-id") || "user_demo",
    organizationId: headerStore.get("x-talentrank-org-id") || "org_demo",
    email: headerStore.get("x-talentrank-email") || "demo.recruiter@talentrank.local",
    name: headerStore.get("x-talentrank-name") || "Demo Recruiter",
    role: normalizeRole(headerStore.get("x-talentrank-role")),
  };
}

export async function requireRole(required: AuthUser["role"]) {
  const user = await currentUser();
  if (roleRank[user.role] < roleRank[required]) {
    throw new Error(`Requires ${required} role.`);
  }
  return user;
}
