import { prismaEnabled } from "./prisma";

export type RuntimeMode = {
  persistence: "json" | "prisma";
  auth: "header";
  embeddings: "local" | "openai";
  ready: boolean;
  warnings: string[];
};

export function runtimeMode(): RuntimeMode {
  const warnings: string[] = [];
  const persistence = prismaEnabled() ? "prisma" : "json";
  const embeddings = process.env.OPENAI_API_KEY ? "openai" : "local";

  if (process.env.NODE_ENV === "production" && persistence === "json") {
    warnings.push("Production is using JSON persistence. Set DATABASE_URL and TALENTRANK_USE_PRISMA=true before customer deployment.");
  }
  if (process.env.TALENTRANK_USE_PRISMA === "true" && !process.env.DATABASE_URL) {
    warnings.push("TALENTRANK_USE_PRISMA=true requires DATABASE_URL.");
  }
  if (process.env.OPENAI_API_KEY && !process.env.OPENAI_EMBEDDING_MODEL) {
    warnings.push("OPENAI_API_KEY is set without OPENAI_EMBEDDING_MODEL; default embedding model will be used.");
  }

  return {
    persistence,
    auth: "header",
    embeddings,
    ready: warnings.length === 0,
    warnings,
  };
}
