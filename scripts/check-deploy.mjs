const requiredForPrisma = ["DATABASE_URL"];

const mode = {
  nodeEnv: process.env.NODE_ENV || "development",
  persistence: process.env.TALENTRANK_USE_PRISMA === "true" ? "prisma" : "json",
  auth: process.env.TALENTRANK_AUTH_MODE === "headers" ? "headers" : "session",
  embeddings: process.env.OPENAI_API_KEY ? "openai" : "local",
  storage: process.env.TALENTRANK_STORAGE_PROVIDER === "s3"
    ? "s3"
    : process.env.TALENTRANK_STORAGE_PROVIDER
      ? "external"
    : process.env.TALENTRANK_STORAGE_KEY
      ? "local-encrypted"
      : "local-unencrypted",
  ocr: process.env.OCR_SPACE_API_KEY || process.env.OCR_PROVIDER === "ocrspace"
    ? "ocrspace"
    : process.env.OCR_API_URL
      ? "generic"
      : "not-configured",
};

const warnings = [];
const failures = [];

function weakSecret(name) {
  const value = process.env[name] || "";
  return value.length < 24 || /change|replace|dummy|secret|password/i.test(value);
}

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

if (mode.nodeEnv === "production" && mode.auth === "session" && weakSecret("TALENTRANK_AUTH_SECRET")) {
  failures.push("TALENTRANK_AUTH_SECRET must be a strong random value, not a placeholder.");
}

if (mode.nodeEnv === "production" && mode.auth === "session" && !process.env.TALENTRANK_BOOTSTRAP_PASSWORD) {
  warnings.push("Set TALENTRANK_BOOTSTRAP_PASSWORD only for first deploy, then rotate/remove it after creating real admins.");
}

if (mode.nodeEnv === "production" && mode.storage === "local-unencrypted") {
  failures.push("TALENTRANK_STORAGE_KEY or TALENTRANK_STORAGE_PROVIDER is required for production resume storage.");
}

if (mode.nodeEnv === "production" && process.env.TALENTRANK_STORAGE_KEY && weakSecret("TALENTRANK_STORAGE_KEY")) {
  failures.push("TALENTRANK_STORAGE_KEY must be a strong random value, not a placeholder.");
}

if (mode.storage === "external" && !process.env.TALENTRANK_STORAGE_UPLOAD_URL) {
  failures.push("TALENTRANK_STORAGE_UPLOAD_URL is required when TALENTRANK_STORAGE_PROVIDER is set.");
}

if (mode.storage === "external" && !process.env.TALENTRANK_STORAGE_DOWNLOAD_URL) {
  failures.push("TALENTRANK_STORAGE_DOWNLOAD_URL is required when TALENTRANK_STORAGE_PROVIDER is set.");
}

if (process.env.TALENTRANK_STORAGE_PROVIDER === "s3" && !(process.env.S3_ENDPOINT && (process.env.S3_BUCKET || process.env.TALENTRANK_STORAGE_BUCKET) && (process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID) && (process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY))) {
  failures.push("TALENTRANK_STORAGE_PROVIDER=s3 requires endpoint, bucket, access key, and secret key.");
}

if (mode.nodeEnv === "production" && process.env.TALENTRANK_MALWARE_PROVIDER !== "virustotal" && !process.env.TALENTRANK_MALWARE_SCAN_URL) {
  failures.push("TALENTRANK_MALWARE_SCAN_URL is required for production resume uploads.");
}

if (process.env.OCR_PROVIDER === "ocrspace" && !process.env.OCR_SPACE_API_KEY) {
  failures.push("OCR_SPACE_API_KEY is required when OCR_PROVIDER=ocrspace.");
}

if (process.env.TALENTRANK_MALWARE_PROVIDER === "virustotal" && !process.env.VIRUSTOTAL_API_KEY) {
  failures.push("VIRUSTOTAL_API_KEY is required when TALENTRANK_MALWARE_PROVIDER=virustotal.");
}

console.log(JSON.stringify({ ok: failures.length === 0, mode, warnings, failures }, null, 2));

if (failures.length) process.exit(1);
