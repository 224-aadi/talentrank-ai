import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import type { UserRole } from "@prisma/client";
import { prismaEnabled } from "./prisma";
import { prisma } from "./prisma";
import { createId, readDb, writeDb } from "./store";
import type { AuthUserRecord } from "./types";

export type AuthUser = {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: Lowercase<UserRole>;
};

const sessionCookieName = "tr_session";
const sessionTtlSeconds = 60 * 60 * 12;
const hashIterations = 120000;
const roleRank: Record<AuthUser["role"], number> = {
  reviewer: 1,
  recruiter: 2,
  admin: 3,
};

function now() {
  return new Date().toISOString();
}

function normalizeRole(value?: string | null): AuthUser["role"] {
  const role = value?.toLowerCase();
  if (role === "admin" || role === "reviewer" || role === "recruiter") return role;
  return "recruiter";
}

function authMode() {
  return process.env.TALENTRANK_AUTH_MODE === "headers" ? "headers" : "session";
}

function frontendOnlyMode() {
  return Boolean(process.env.TALENTRANK_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL) && process.env.TALENTRANK_FRONTEND_ONLY !== "false";
}

function sessionSecret() {
  return process.env.TALENTRANK_AUTH_SECRET || "dev-only-talentrank-session-secret-change-before-deploy";
}

function timingSafeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function tokenHash(token: string) {
  return crypto.createHash("sha256").update(token).digest("base64url");
}

function randomToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function sign(value: string) {
  return crypto.createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function sessionUserFromHeaders(headerStore: Headers): AuthUser {
  return {
    id: headerStore.get("x-talentrank-user-id") || "user_demo",
    organizationId: headerStore.get("x-talentrank-org-id") || "org_demo",
    email: headerStore.get("x-talentrank-email") || "demo.recruiter@talentrank.local",
    name: headerStore.get("x-talentrank-name") || "Demo Recruiter",
    role: normalizeRole(headerStore.get("x-talentrank-role")),
  };
}

function toAuthUser(user: AuthUserRecord): AuthUser {
  return {
    id: user.id,
    organizationId: user.organizationId,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

function toAuthUserFromPrisma(user: any): AuthUser {
  return {
    id: user.id,
    organizationId: user.organizationId,
    email: user.email,
    name: user.name,
    role: normalizeRole(user.role),
  };
}

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = await new Promise<Buffer>((resolve, reject) => {
    crypto.pbkdf2(password, salt, hashIterations, 32, "sha256", (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
  return `pbkdf2$${hashIterations}$${salt}$${hash.toString("base64url")}`;
}

async function verifyPassword(password: string, encoded?: string | null) {
  if (!encoded) return false;
  const [scheme, iterationText, salt, expected] = encoded.split("$");
  if (scheme !== "pbkdf2" || !iterationText || !salt || !expected) return false;
  const iterations = Number(iterationText);
  const hash = await new Promise<Buffer>((resolve, reject) => {
    crypto.pbkdf2(password, salt, iterations, 32, "sha256", (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
  return timingSafeEqual(hash.toString("base64url"), expected);
}

async function ensureBootstrapUser() {
  const email = process.env.TALENTRANK_BOOTSTRAP_EMAIL || "admin@talentrank.local";
  const password = process.env.TALENTRANK_BOOTSTRAP_PASSWORD || (process.env.NODE_ENV === "production" ? "" : "talentrank-admin");
  const isDefaultBootstrap = email.toLowerCase() === "admin@talentrank.local" || password === "talentrank-admin";
  if (process.env.NODE_ENV === "production" && isDefaultBootstrap) return null;
  if (!password) return null;

  if (prismaEnabled()) {
    const client = prisma as any;
    await client.organization.upsert({
      where: { id: "org_demo" },
      update: {},
      create: { id: "org_demo", name: "Demo Organization" },
    });
    const existing = await client.user.findUnique({ where: { email } });
    if (existing) return existing;
    return await client.user.create({
      data: {
        organizationId: "org_demo",
        email,
        name: process.env.TALENTRANK_BOOTSTRAP_NAME || "TalentRank Admin",
        role: "ADMIN",
        passwordHash: await hashPassword(password),
      },
    });
  }

  const db = await readDb();
  db.users ||= [];
  const existing = db.users.find((user) => user.email.toLowerCase() === email.toLowerCase());
  if (existing) return existing;
  const timestamp = now();
  const user: AuthUserRecord = {
    id: createId("user"),
    organizationId: "org_demo",
    email,
    name: process.env.TALENTRANK_BOOTSTRAP_NAME || "TalentRank Admin",
    role: "admin",
    passwordHash: await hashPassword(password),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  db.users.unshift(user);
  await writeDb(db);
  return user;
}

async function findUserByEmail(email: string) {
  await ensureBootstrapUser();
  if (prismaEnabled()) {
    return await (prisma as any).user.findUnique({ where: { email } });
  }
  const db = await readDb();
  return (db.users || []).find((user) => user.email.toLowerCase() === email.toLowerCase()) || null;
}

async function findUserById(userId: string) {
  if (prismaEnabled()) {
    return await (prisma as any).user.findUnique({ where: { id: userId } });
  }
  const db = await readDb();
  return (db.users || []).find((user) => user.id === userId) || null;
}

async function touchLastLogin(userId: string) {
  if (prismaEnabled()) {
    await (prisma as any).user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
    return;
  }
  const db = await readDb();
  db.users ||= [];
  const user = db.users.find((item) => item.id === userId);
  if (user) {
    user.lastLoginAt = now();
    user.updatedAt = now();
    await writeDb(db);
  }
}

function createSessionToken(user: AuthUser) {
  const payload = base64Url(JSON.stringify({
    sub: user.id,
    org: user.organizationId,
    email: user.email,
    name: user.name,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + sessionTtlSeconds,
  }));
  return `${payload}.${sign(payload)}`;
}

function parseSessionToken(token?: string) {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !timingSafeEqual(sign(payload), signature)) return null;
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) return null;
  return {
    id: String(parsed.sub),
    organizationId: String(parsed.org),
    email: String(parsed.email),
    name: String(parsed.name),
    role: normalizeRole(parsed.role),
  } satisfies AuthUser;
}

export async function signupUser(input: {
  email: string;
  name: string;
  password: string;
  organizationName?: string;
}) {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!name) throw new Error("Name is required.");
  const existing = await findUserByEmail(email);
  if (existing) throw new Error("A user with this email already exists.");

  const organizationId = createId("org");
  const organizationName = input.organizationName?.trim() || `${name}'s workspace`;

  if (prismaEnabled()) {
    const client = prisma as any;
    await client.organization.create({
      data: { id: organizationId, name: organizationName },
    });
    const user = await client.user.create({
      data: {
        organizationId,
        email,
        name,
        role: "ADMIN",
        passwordHash: await hashPassword(input.password),
      },
    });
    const authUser = toAuthUserFromPrisma(user);
    await touchLastLogin(authUser.id);
    return { user: authUser, token: createSessionToken(authUser), maxAge: sessionTtlSeconds };
  }

  const db = await readDb();
  db.organizations ||= [];
  db.users ||= [];
  const timestamp = now();
  db.organizations.unshift({
    id: organizationId,
    name: organizationName,
    createdAt: timestamp,
  });
  const user: AuthUserRecord = {
    id: createId("user"),
    organizationId,
    email,
    name,
    role: "admin",
    passwordHash: await hashPassword(input.password),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  db.users.unshift(user);
  await writeDb(db);
  const authUser = toAuthUser(user);
  return { user: authUser, token: createSessionToken(authUser), maxAge: sessionTtlSeconds };
}

export async function loginWithPassword(email: string, password: string) {
  if (process.env.NODE_ENV === "production" && email.trim().toLowerCase() === "admin@talentrank.local") return null;
  if (process.env.NODE_ENV === "production" && password === "talentrank-admin") return null;
  const user = await findUserByEmail(email.trim().toLowerCase());
  const passwordOk = await verifyPassword(password, user?.passwordHash);
  if (!user || !passwordOk) return null;
  const authUser = prismaEnabled() ? toAuthUserFromPrisma(user) : toAuthUser(user);
  await touchLastLogin(authUser.id);
  return {
    user: authUser,
    token: createSessionToken(authUser),
    maxAge: sessionTtlSeconds,
  };
}

export async function listAuthUsers(organizationId?: string) {
  await ensureBootstrapUser();
  if (prismaEnabled()) {
    const users = await (prisma as any).user.findMany({ where: organizationId ? { organizationId } : undefined, orderBy: { createdAt: "desc" } });
    return users.map(toAuthUserFromPrisma);
  }
  const db = await readDb();
  return (db.users || []).filter((user) => !organizationId || user.organizationId === organizationId).map(toAuthUser);
}

export async function createAuthUser(input: {
  organizationId?: string;
  email: string;
  name: string;
  role: AuthUser["role"];
  password: string;
}) {
  if (prismaEnabled()) {
    const client = prisma as any;
    const organizationId = input.organizationId || "org_demo";
    await client.organization.upsert({
      where: { id: organizationId },
      update: {},
      create: { id: organizationId, name: organizationId },
    });
    const user = await client.user.create({
      data: {
        organizationId,
        email: input.email.trim().toLowerCase(),
        name: input.name.trim(),
        role: input.role.toUpperCase(),
        passwordHash: await hashPassword(input.password),
      },
    });
    return toAuthUserFromPrisma(user);
  }

  const db = await readDb();
  db.users ||= [];
  const email = input.email.trim().toLowerCase();
  if (db.users.some((user) => user.email.toLowerCase() === email)) {
    throw new Error("A user with this email already exists.");
  }
  const timestamp = now();
  const user: AuthUserRecord = {
    id: createId("user"),
    organizationId: input.organizationId || "org_demo",
    email,
    name: input.name.trim(),
    role: input.role,
    passwordHash: await hashPassword(input.password),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  db.users.unshift(user);
  await writeDb(db);
  return toAuthUser(user);
}

export async function inviteAuthUser(input: {
  organizationId?: string;
  email: string;
  name: string;
  role: AuthUser["role"];
}) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  if (prismaEnabled()) {
    const client = prisma as any;
    const organizationId = input.organizationId || "org_demo";
    await client.organization.upsert({
      where: { id: organizationId },
      update: {},
      create: { id: organizationId, name: organizationId },
    });
    const user = await client.user.upsert({
      where: { email: input.email.trim().toLowerCase() },
      update: {
        name: input.name.trim(),
        role: input.role.toUpperCase(),
        inviteTokenHash: tokenHash(token),
        inviteExpiresAt: expiresAt,
      },
      create: {
        organizationId,
        email: input.email.trim().toLowerCase(),
        name: input.name.trim(),
        role: input.role.toUpperCase(),
        inviteTokenHash: tokenHash(token),
        inviteExpiresAt: expiresAt,
      },
    });
    return { user: toAuthUserFromPrisma(user), token, inviteUrl: `/login?invite=${token}` };
  }
  const db = await readDb();
  db.users ||= [];
  const email = input.email.trim().toLowerCase();
  let user = db.users.find((item) => item.email.toLowerCase() === email);
  if (!user) {
    const timestamp = now();
    user = {
      id: createId("user"),
      organizationId: input.organizationId || "org_demo",
      email,
      name: input.name.trim(),
      role: input.role,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    db.users.unshift(user);
  }
  user.name = input.name.trim();
  user.role = input.role;
  user.inviteTokenHash = tokenHash(token);
  user.inviteExpiresAt = expiresAt.toISOString();
  user.updatedAt = now();
  await writeDb(db);
  return { user: toAuthUser(user), token, inviteUrl: `/login?invite=${token}` };
}

export async function acceptInvite(token: string, password: string) {
  const hash = tokenHash(token);
  if (prismaEnabled()) {
    const client = prisma as any;
    const user = await client.user.findFirst({ where: { inviteTokenHash: hash } });
    if (!user || (user.inviteExpiresAt && new Date(user.inviteExpiresAt).getTime() < Date.now())) return null;
    const updated = await client.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(password),
        inviteTokenHash: null,
        inviteExpiresAt: null,
      },
    });
    const authUser = toAuthUserFromPrisma(updated);
    return { user: authUser, token: createSessionToken(authUser), maxAge: sessionTtlSeconds };
  }
  const db = await readDb();
  const user = (db.users || []).find((item) => item.inviteTokenHash === hash);
  if (!user || (user.inviteExpiresAt && new Date(user.inviteExpiresAt).getTime() < Date.now())) return null;
  user.passwordHash = await hashPassword(password);
  user.inviteTokenHash = undefined;
  user.inviteExpiresAt = undefined;
  user.updatedAt = now();
  await writeDb(db);
  const authUser = toAuthUser(user);
  return { user: authUser, token: createSessionToken(authUser), maxAge: sessionTtlSeconds };
}

export async function createPasswordReset(email: string) {
  const token = randomToken();
  const hash = tokenHash(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  if (prismaEnabled()) {
    const client = prisma as any;
    const user = await client.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user) return null;
    await client.user.update({ where: { id: user.id }, data: { resetTokenHash: hash, resetExpiresAt: expiresAt } });
    return { email: user.email, token, resetUrl: `/login?reset=${token}` };
  }
  const db = await readDb();
  const user = (db.users || []).find((item) => item.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) return null;
  user.resetTokenHash = hash;
  user.resetExpiresAt = expiresAt.toISOString();
  user.updatedAt = now();
  await writeDb(db);
  return { email: user.email, token, resetUrl: `/login?reset=${token}` };
}

export async function resetPassword(token: string, password: string) {
  const hash = tokenHash(token);
  if (prismaEnabled()) {
    const client = prisma as any;
    const user = await client.user.findFirst({ where: { resetTokenHash: hash } });
    if (!user || (user.resetExpiresAt && new Date(user.resetExpiresAt).getTime() < Date.now())) return false;
    await client.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(password), resetTokenHash: null, resetExpiresAt: null },
    });
    return true;
  }
  const db = await readDb();
  const user = (db.users || []).find((item) => item.resetTokenHash === hash);
  if (!user || (user.resetExpiresAt && new Date(user.resetExpiresAt).getTime() < Date.now())) return false;
  user.passwordHash = await hashPassword(password);
  user.resetTokenHash = undefined;
  user.resetExpiresAt = undefined;
  user.updatedAt = now();
  await writeDb(db);
  return true;
}

export async function updateAuthUserRole(userId: string, role: AuthUser["role"], organizationId?: string) {
  if (prismaEnabled()) {
    const existing = await (prisma as any).user.findFirst({ where: { id: userId, ...(organizationId ? { organizationId } : {}) } });
    if (!existing) throw new Error("User not found.");
    const user = await (prisma as any).user.update({ where: { id: userId }, data: { role: role.toUpperCase() } });
    return toAuthUserFromPrisma(user);
  }
  const db = await readDb();
  const user = (db.users || []).find((item) => item.id === userId && (!organizationId || item.organizationId === organizationId));
  if (!user) throw new Error("User not found.");
  user.role = role;
  user.updatedAt = now();
  await writeDb(db);
  return toAuthUser(user);
}

export async function loginWithTrustedIdentity(input: {
  email: string;
  name: string;
  organizationId?: string;
  role?: AuthUser["role"];
}) {
  const email = input.email.trim().toLowerCase();
  if (prismaEnabled()) {
    const client = prisma as any;
    const organizationId = input.organizationId || "org_demo";
    await client.organization.upsert({ where: { id: organizationId }, update: {}, create: { id: organizationId, name: organizationId } });
    const user = await client.user.upsert({
      where: { email },
      update: { name: input.name, organizationId },
      create: { email, name: input.name, organizationId, role: (input.role || "recruiter").toUpperCase() },
    });
    const authUser = toAuthUserFromPrisma(user);
    return { user: authUser, token: createSessionToken(authUser), maxAge: sessionTtlSeconds };
  }
  const db = await readDb();
  db.users ||= [];
  let user = db.users.find((item) => item.email.toLowerCase() === email);
  if (!user) {
    const timestamp = now();
    user = { id: createId("user"), organizationId: input.organizationId || "org_demo", email, name: input.name, role: input.role || "recruiter", createdAt: timestamp, updatedAt: timestamp };
    db.users.unshift(user);
  }
  user.name = input.name;
  user.updatedAt = now();
  await writeDb(db);
  const authUser = toAuthUser(user);
  return { user: authUser, token: createSessionToken(authUser), maxAge: sessionTtlSeconds };
}

export async function currentUser(): Promise<AuthUser | null> {
  if (authMode() === "headers") {
    return sessionUserFromHeaders(await headers());
  }

  const cookieStore = await cookies();
  const session = parseSessionToken(cookieStore.get(sessionCookieName)?.value);
  if (!session) return null;
  if (frontendOnlyMode()) return session;
  const user = await findUserById(session.id);
  if (!user) return null;
  return prismaEnabled() ? toAuthUserFromPrisma(user) : toAuthUser(user);
}

export async function requireRole(required: AuthUser["role"]) {
  const user = await currentUser();
  if (!user) throw new Error("Authentication required.");
  if (roleRank[user.role] < roleRank[required]) {
    throw new Error(`Requires ${required} role.`);
  }
  return user;
}

export function authCookie(token: string, maxAge = sessionTtlSeconds) {
  return {
    name: sessionCookieName,
    value: token,
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge,
    },
  };
}

export function clearAuthCookie() {
  return {
    name: sessionCookieName,
    value: "",
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    },
  };
}
