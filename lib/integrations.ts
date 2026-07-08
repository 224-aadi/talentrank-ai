import { runtimeMode } from "./env";

export type IntegrationStatus = {
  key: string;
  label: string;
  status: "ready" | "missing" | "optional" | "warning";
  detail: string;
};

function has(key: string) {
  return Boolean(process.env[key]);
}

function ready(status: IntegrationStatus["status"]) {
  return status === "ready" || status === "optional";
}

export function integrationStatus() {
  const runtime = runtimeMode();
  const items: IntegrationStatus[] = [
    {
      key: "database",
      label: "Postgres",
      status: runtime.persistence === "prisma" ? "ready" : "missing",
      detail: runtime.persistence === "prisma" ? "Prisma/Postgres adapter enabled." : "Set DATABASE_URL and TALENTRANK_USE_PRISMA=true.",
    },
    {
      key: "auth",
      label: "Auth",
      status: runtime.auth === "session" && has("TALENTRANK_AUTH_SECRET") ? "ready" : runtime.auth === "header" ? "warning" : "missing",
      detail: runtime.auth === "header" ? "Trusted-header mode requires an upstream SSO gateway." : "Session auth requires TALENTRANK_AUTH_SECRET.",
    },
    {
      key: "storage",
      label: "Resume Storage",
      status: runtime.storage === "external" && has("TALENTRANK_STORAGE_UPLOAD_URL") && has("TALENTRANK_STORAGE_DOWNLOAD_URL")
        ? "ready"
        : runtime.storage === "local-encrypted"
          ? "warning"
          : "missing",
      detail: runtime.storage === "external" ? "External upload/download gateway configured." : "Use encrypted local storage for beta; external storage is needed for multi-instance production.",
    },
    {
      key: "malware",
      label: "Malware Scanning",
      status: has("TALENTRANK_MALWARE_SCAN_URL") ? "ready" : "missing",
      detail: "Resume uploads should be scanned before parsing and storage.",
    },
    {
      key: "ocr",
      label: "OCR",
      status: has("OCR_API_URL") ? "ready" : "optional",
      detail: "OCR is needed for scanned PDFs; text PDFs and DOCX can parse without it.",
    },
    {
      key: "embeddings",
      label: "Managed Embeddings",
      status: has("OPENAI_API_KEY") ? "ready" : "optional",
      detail: "Local deterministic embeddings work for dev; managed embeddings improve retrieval quality.",
    },
    {
      key: "observability",
      label: "Observability",
      status: has("TALENTRANK_LOG_DRAIN_URL") || has("SENTRY_DSN") ? "ready" : "warning",
      detail: "Structured logs exist; connect a log drain or error monitor before public launch.",
    },
    {
      key: "backups",
      label: "Backups",
      status: has("TALENTRANK_BACKUP_URL") ? "ready" : "warning",
      detail: "Use scripts/backup.mjs locally or configure TALENTRANK_BACKUP_URL for backup uploads.",
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    runtime,
    ready: items.every((item) => ready(item.status)),
    items,
  };
}
