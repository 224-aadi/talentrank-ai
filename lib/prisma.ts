import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { talentRankPrisma?: PrismaClient };

export const prisma = globalForPrisma.talentRankPrisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.talentRankPrisma = prisma;

export function prismaEnabled() {
  return Boolean(process.env.DATABASE_URL && process.env.TALENTRANK_USE_PRISMA === "true");
}
