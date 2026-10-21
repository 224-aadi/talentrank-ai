import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { talentRankPrisma?: PrismaClient };

function databaseUrl() {
  if (!process.env.DATABASE_URL) return undefined;
  const url = new URL(process.env.DATABASE_URL);
  // Render can report dozens of CPUs even on its smallest instance. Prisma's
  // CPU-based default then exhausts the Supabase pool during a bulk upload.
  for (const [key, value] of Object.entries({ connection_limit: "5", connect_timeout: "10", pool_timeout: "15" })) {
    if (!url.searchParams.has(key)) url.searchParams.set(key, value);
  }
  return url.toString();
}

const url = databaseUrl();
export const prisma = globalForPrisma.talentRankPrisma || new PrismaClient(url ? { datasourceUrl: url } : undefined);

globalForPrisma.talentRankPrisma = prisma;

export function prismaEnabled() {
  return Boolean(process.env.DATABASE_URL && process.env.TALENTRANK_USE_PRISMA === "true");
}
