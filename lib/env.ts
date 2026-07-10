import { prismaEnabled } from "./prisma";

export type RuntimeMode = {
  persistence: "json" | "prisma";
  auth: "header" | "session";
  embeddings: "local" | "openai";
  ocr: "generic" | "ocrspace" | "not-configured";
  storage: "local-encrypted" | "local-unencrypted" | "external" | "s3";
  email: "resend" | "postmark" | "sendgrid" | "webhook" | "not-configured";
  ready: boolean;
  warnings: string[];
};

export function runtimeMode(): RuntimeMode {
  const warnings: string[] = [];
  const persistence = prismaEnabled() ? "prisma" : "json";
  const auth = process.env.TALENTRANK_AUTH_MODE === "headers" ? "header" : "session";
  const embeddings = process.env.OPENAI_API_KEY ? "openai" : "local";
  const ocr = process.env.OCR_SPACE_API_KEY || process.env.OCR_PROVIDER === "ocrspace"
    ? "ocrspace"
    : process.env.OCR_API_URL
      ? "generic"
      : "not-configured";
  const storage = process.env.TALENTRANK_STORAGE_PROVIDER === "s3"
    ? "s3"
    : process.env.TALENTRANK_STORAGE_PROVIDER
      ? "external"
      : process.env.TALENTRANK_STORAGE_KEY
      ? "local-encrypted"
      : "local-unencrypted";
  const email = process.env.TALENTRANK_EMAIL_PROVIDER === "resend" || process.env.RESEND_API_KEY
    ? "resend"
    : process.env.TALENTRANK_EMAIL_PROVIDER === "postmark" || process.env.POSTMARK_SERVER_TOKEN
      ? "postmark"
      : process.env.TALENTRANK_EMAIL_PROVIDER === "sendgrid" || process.env.SENDGRID_API_KEY
        ? "sendgrid"
        : process.env.TALENTRANK_EMAIL_PROVIDER === "webhook" || process.env.TALENTRANK_EMAIL_WEBHOOK_URL
          ? "webhook"
          : "not-configured";
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
  if (process.env.TALENTRANK_STORAGE_PROVIDER === "s3" && !(process.env.S3_ENDPOINT && (process.env.S3_BUCKET || process.env.TALENTRANK_STORAGE_BUCKET))) {
    warnings.push("TALENTRANK_STORAGE_PROVIDER=s3 requires S3_ENDPOINT and S3_BUCKET or TALENTRANK_STORAGE_BUCKET.");
  }
  if (process.env.NODE_ENV === "production" && process.env.TALENTRANK_MALWARE_PROVIDER !== "virustotal" && !process.env.TALENTRANK_MALWARE_SCAN_URL) {
    warnings.push("Production uploads should configure TALENTRANK_MALWARE_SCAN_URL.");
  }
  if (process.env.OCR_PROVIDER === "ocrspace" && !process.env.OCR_SPACE_API_KEY) {
    warnings.push("OCR_PROVIDER=ocrspace requires OCR_SPACE_API_KEY.");
  }
  if (process.env.TALENTRANK_MALWARE_PROVIDER === "virustotal" && !process.env.VIRUSTOTAL_API_KEY) {
    warnings.push("TALENTRANK_MALWARE_PROVIDER=virustotal requires VIRUSTOTAL_API_KEY.");
  }
  if (process.env.NODE_ENV === "production" && !process.env.TALENTRANK_APP_URL) {
    warnings.push("Production invite and password reset links require TALENTRANK_APP_URL.");
  }
  if (process.env.NODE_ENV === "production" && email === "not-configured") {
    warnings.push("Production invites and password resets require transactional email.");
  }
  if (email !== "not-configured" && !process.env.TALENTRANK_EMAIL_FROM) {
    warnings.push("Transactional email requires TALENTRANK_EMAIL_FROM.");
  }
  if (process.env.TALENTRANK_EMAIL_PROVIDER === "resend" && !process.env.RESEND_API_KEY) {
    warnings.push("TALENTRANK_EMAIL_PROVIDER=resend requires RESEND_API_KEY.");
  }
  if (process.env.TALENTRANK_EMAIL_PROVIDER === "postmark" && !process.env.POSTMARK_SERVER_TOKEN) {
    warnings.push("TALENTRANK_EMAIL_PROVIDER=postmark requires POSTMARK_SERVER_TOKEN.");
  }
  if (process.env.TALENTRANK_EMAIL_PROVIDER === "sendgrid" && !process.env.SENDGRID_API_KEY) {
    warnings.push("TALENTRANK_EMAIL_PROVIDER=sendgrid requires SENDGRID_API_KEY.");
  }
  if (process.env.TALENTRANK_EMAIL_PROVIDER === "webhook" && !process.env.TALENTRANK_EMAIL_WEBHOOK_URL) {
    warnings.push("TALENTRANK_EMAIL_PROVIDER=webhook requires TALENTRANK_EMAIL_WEBHOOK_URL.");
  }

  return {
    persistence,
    auth,
    embeddings,
    ocr,
    storage,
    email,
    ready: warnings.length === 0,
    warnings,
  };
}
