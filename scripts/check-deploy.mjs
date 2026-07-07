const requiredForPrisma = ["DATABASE_URL"];

const mode = {
  nodeEnv: process.env.NODE_ENV || "development",
  persistence: process.env.TALENTRANK_USE_PRISMA === "true" ? "prisma" : "json",
  embeddings: process.env.OPENAI_API_KEY ? "openai" : "local",
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

console.log(JSON.stringify({ ok: failures.length === 0, mode, warnings, failures }, null, 2));

if (failures.length) process.exit(1);
