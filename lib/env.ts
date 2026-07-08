import { prismaEnabled } from "./prisma";

export type RuntimeMode = {
  persistence: "json" | "prisma";
  auth: "header" | "session";
  embeddings: "local" | "openai";
  ocr: "configured" | "not-configured";
  storage: "local-encrypted" | "local-unencrypted" | "external";
  ready: boolean;
  warnings: string[];
};

export function runtimeMode(): RuntimeMode {
  const warnings: string[] = [];
  const persistence = prismaEnabled() ? "prisma" : "json";
  const auth = process.env.TALENTRANK_AUTH_MODE === "headers" ? "header" : "session";
  const embeddings = process.env.OPENAI_API_KEY ? "openai" : "local";
  const ocr = process.env.OCR_API_URL ? "configured" : "not-configured";
  const storage = process.env.TALENTRANK_STORAGE_PROVIDER
    ? "external"
    : process.env.TALENTRANK_STORAGE_KEY
      ? "local-encrypted"
      : "local-unencrypted";
  const weakSecret = (key: string) => {
    const value = process.env[key] || "";
    return value.length < 24 || /change|replace|dummy|secret|password/i.test(value);
  };

  if (process.env.NODE_ENV === "production" && persistence === "json") {
    warnings.push("Production is using JSON persistence. Set DATABASE_URL and TALENTRANK_USE_PRISMA=true before customer deployment.");
  }
  if (process.env.TALENTRANK_USE_PRISMA === "true" && !process.env.DATABASE_URL) {
    warnings.push("TALENTRANK_USE_PRISMA=true requires DATABASE_URL.");
  }
  if (process.env.OPENAI_API_KEY && !process.env.OPENAI_EMBEDDING_MODEL) {
    warnings.push("OPENAI_API_KEY is set without OPENAI_EMBEDDING_MODEL; default embedding model will be used.");
  }
  if (process.env.NODE_ENV === "production" && auth === "session" && !process.env.TALENTRANK_AUTH_SECRET) {
    warnings.push("Production session auth requires TALENTRANK_AUTH_SECRET.");
  }
  if (process.env.NODE_ENV === "production" && auth === "session" && weakSecret("TALENTRANK_AUTH_SECRET")) {
    warnings.push("TALENTRANK_AUTH_SECRET appears weak or placeholder-like.");
  }
  if (process.env.NODE_ENV === "production" && storage === "local-unencrypted") {
    warnings.push("Production resume storage should set TALENTRANK_STORAGE_KEY or use an external storage provider.");
  }
  if (process.env.NODE_ENV === "production" && process.env.TALENTRANK_STORAGE_KEY && weakSecret("TALENTRANK_STORAGE_KEY")) {
    warnings.push("TALENTRANK_STORAGE_KEY appears weak or placeholder-like.");
  }
  if (storage === "external" && !process.env.TALENTRANK_STORAGE_UPLOAD_URL) {
    warnings.push("TALENTRANK_STORAGE_PROVIDER requires TALENTRANK_STORAGE_UPLOAD_URL.");
  }
  if (storage === "external" && !process.env.TALENTRANK_STORAGE_DOWNLOAD_URL) {
    warnings.push("TALENTRANK_STORAGE_PROVIDER requires TALENTRANK_STORAGE_DOWNLOAD_URL for signed downloads.");
  }
  if (process.env.NODE_ENV === "production" && !process.env.TALENTRANK_MALWARE_SCAN_URL) {
    warnings.push("Production uploads should configure TALENTRANK_MALWARE_SCAN_URL.");
  }

  return {
    persistence,
    auth,
    embeddings,
    ocr,
    storage,
    ready: warnings.length === 0,
    warnings,
  };
}
