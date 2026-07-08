const requiredForPrisma = ["DATABASE_URL"];

const mode = {
  nodeEnv: process.env.NODE_ENV || "development",
  persistence: process.env.TALENTRANK_USE_PRISMA === "true" ? "prisma" : "json",
  auth: process.env.TALENTRANK_AUTH_MODE === "headers" ? "headers" : "session",
  embeddings: process.env.OPENAI_API_KEY ? "openai" : "local",
  storage: process.env.TALENTRANK_STORAGE_PROVIDER
    ? "external"
    : process.env.TALENTRANK_STORAGE_KEY
      ? "local-encrypted"
      : "local-unencrypted",
};

const warnings = [];
const failures = [];

if (mode.nodeEnv === "production" && mode.persistence === "json") {
  warnings.push("Production is configured for JSON persistence. Use TALENTRANK_USE_PRISMA=true for customer deployment.");
}

if (process.env.TALENTRANK_USE_PRISMA === "true") {
  for (const key of requiredForPrisma) {
    if (!process.env[key]) failures.push(`${key} is required when TALENTRANK_USE_PRISMA=true.`);
  }
}

if (process.env.OPENAI_API_KEY && !process.env.OPENAI_EMBEDDING_MODEL) {
  warnings.push("OPENAI_API_KEY is set without OPENAI_EMBEDDING_MODEL; app will use its default.");
}

if (mode.nodeEnv === "production" && mode.auth === "session" && !process.env.TALENTRANK_AUTH_SECRET) {
  failures.push("TALENTRANK_AUTH_SECRET is required for production session auth.");
}

if (mode.nodeEnv === "production" && mode.auth === "session" && !process.env.TALENTRANK_BOOTSTRAP_PASSWORD) {
  warnings.push("Set TALENTRANK_BOOTSTRAP_PASSWORD only for first deploy, then rotate/remove it after creating real admins.");
}

if (mode.nodeEnv === "production" && mode.storage === "local-unencrypted") {
  failures.push("TALENTRANK_STORAGE_KEY or TALENTRANK_STORAGE_PROVIDER is required for production resume storage.");
}

if (mode.storage === "external" && !process.env.TALENTRANK_STORAGE_UPLOAD_URL) {
  failures.push("TALENTRANK_STORAGE_UPLOAD_URL is required when TALENTRANK_STORAGE_PROVIDER is set.");
}

if (mode.nodeEnv === "production" && !process.env.TALENTRANK_MALWARE_SCAN_URL) {
  failures.push("TALENTRANK_MALWARE_SCAN_URL is required for production resume uploads.");
}

console.log(JSON.stringify({ ok: failures.length === 0, mode, warnings, failures }, null, 2));

if (failures.length) process.exit(1);
