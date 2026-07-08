import { prisma } from "./prisma";
import { prismaEnabled } from "./prisma";
import { integrationStatus } from "./integrations";
import { runOcr } from "./ocr";
import { storeUploadedResumeFile } from "./secure-storage";
import { embeddingConfig } from "./semantic";

export type DiagnosticKey = "database" | "storage" | "malware" | "ocr" | "embeddings" | "oidc" | "observability";

export type DiagnosticResult = {
  key: DiagnosticKey;
  status: "pass" | "warning" | "fail" | "skipped";
  label: string;
  detail: string;
  durationMs: number;
  evidence?: Record<string, unknown>;
};

const tinyPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

function redact(value?: string) {
  if (!value) return undefined;
  if (value.length <= 10) return "***";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

async function timed(key: DiagnosticKey, label: string, fn: () => Promise<Omit<DiagnosticResult, "key" | "label" | "durationMs">>): Promise<DiagnosticResult> {
  const started = Date.now();
  try {
    const result = await fn();
    return { key, label, durationMs: Date.now() - started, ...result };
  } catch (error) {
    return {
      key,
      label,
      status: "fail",
      detail: error instanceof Error ? error.message : "Provider test failed.",
      durationMs: Date.now() - started,
    };
  }
}

async function testDatabase() {
  return timed("database", "Postgres", async () => {
    if (!prismaEnabled()) {
      return { status: "skipped", detail: "Prisma/Postgres is not enabled; JSON persistence is active." };
    }
    await prisma.$queryRaw`SELECT 1`;
    return { status: "pass", detail: "Database connection accepted a lightweight SELECT 1 probe." };
  });
}

async function testStorage() {
  return timed("storage", "Resume Storage", async () => {
    const status = integrationStatus();
    if (status.runtime.storage === "local-unencrypted") {
      return { status: "warning", detail: "Local unencrypted storage works for development but is not production-ready." };
    }
    const file = new File(["talentrank provider diagnostics"], `talentrank-storage-probe-${Date.now()}.txt`, { type: "text/plain" });
    const stored = await storeUploadedResumeFile(file);
    return {
      status: stored.provider === "external" || stored.encrypted ? "pass" : "warning",
      detail: stored.provider === "external" ? "Provider accepted a small write probe." : "Local encrypted write probe succeeded.",
      evidence: { provider: stored.provider, encrypted: stored.encrypted, bytes: stored.bytes, storageKey: stored.storageKey },
    };
  });
}

async function testMalware() {
  return timed("malware", "Malware Scanning", async () => {
    if (process.env.TALENTRANK_MALWARE_PROVIDER === "virustotal") {
      if (!process.env.VIRUSTOTAL_API_KEY) {
        return { status: "fail", detail: "VirusTotal mode is selected but VIRUSTOTAL_API_KEY is missing." };
      }
      const response = await fetch("https://www.virustotal.com/api/v3/users/current", {
        headers: { "x-apikey": process.env.VIRUSTOTAL_API_KEY },
      });
      if (!response.ok) throw new Error(`VirusTotal credential probe returned HTTP ${response.status}.`);
      return { status: "pass", detail: "VirusTotal accepted the API key without submitting a resume file." };
    }
    if (!process.env.TALENTRANK_MALWARE_SCAN_URL) {
      return { status: "skipped", detail: "No malware scanner is configured." };
    }
    const body = new FormData();
    body.append("file", new File(["talentrank clean probe"], "talentrank-clean-probe.txt", { type: "text/plain" }));
    const response = await fetch(process.env.TALENTRANK_MALWARE_SCAN_URL, {
      method: "POST",
      headers: process.env.TALENTRANK_MALWARE_SCAN_KEY ? { authorization: `Bearer ${process.env.TALENTRANK_MALWARE_SCAN_KEY}` } : undefined,
      body,
    });
    if (!response.ok) throw new Error(`Malware scanner returned HTTP ${response.status}.`);
    return { status: "pass", detail: "Scanner accepted a harmless text-file probe." };
  });
}

async function testOcr() {
  return timed("ocr", "OCR", async () => {
    if (!process.env.OCR_API_URL && !process.env.OCR_SPACE_API_KEY) {
      return { status: "skipped", detail: "No OCR provider is configured." };
    }
    const buffer = Buffer.from(tinyPng, "base64");
    const result = await runOcr(new File([new Uint8Array(buffer)], "talentrank-ocr-probe.png", { type: "image/png" }));
    const warnings = result.warnings || [];
    return {
      status: warnings.length ? "warning" : "pass",
      detail: warnings.length ? warnings.join(" ") : "OCR provider accepted a tiny image probe.",
      evidence: { provider: result.provider, textLength: result.text.length, confidence: result.confidence },
    };
  });
}

async function testEmbeddings() {
  return timed("embeddings", "Managed Embeddings", async () => {
    const config = embeddingConfig();
    if (config.provider !== "openai") {
      return { status: "skipped", detail: "OpenAI embeddings are not configured; local deterministic embeddings are active." };
    }
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        input: "TalentRank provider diagnostics",
        model: config.model,
        dimensions: config.dimensions,
        encoding_format: "float",
      }),
    });
    if (!response.ok) throw new Error(`OpenAI embeddings returned HTTP ${response.status}.`);
    const payload = await response.json().catch(() => ({}));
    const vectorLength = payload?.data?.[0]?.embedding?.length;
    return { status: "pass", detail: "OpenAI embeddings probe returned a vector.", evidence: { model: config.model, dimensions: vectorLength } };
  });
}

async function testOidc() {
  return timed("oidc", "Enterprise SSO", async () => {
    if (!process.env.OIDC_ISSUER_URL || !process.env.OIDC_CLIENT_ID) {
      return { status: "skipped", detail: "OIDC issuer/client configuration is not set." };
    }
    const issuer = process.env.OIDC_ISSUER_URL.replace(/\/$/, "");
    const response = await fetch(`${issuer}/.well-known/openid-configuration`);
    if (!response.ok) throw new Error(`OIDC discovery returned HTTP ${response.status}.`);
    const payload = await response.json().catch(() => ({}));
    if (!payload.authorization_endpoint || !payload.token_endpoint) {
      return { status: "warning", detail: "OIDC discovery responded but did not include expected auth/token endpoints." };
    }
    return {
      status: "pass",
      detail: "OIDC discovery document is reachable.",
      evidence: { issuer, clientId: redact(process.env.OIDC_CLIENT_ID), authorizationEndpoint: payload.authorization_endpoint },
    };
  });
}

async function testObservability() {
  return timed("observability", "Observability", async () => {
    if (!process.env.TALENTRANK_LOG_DRAIN_URL) {
      return { status: "warning", detail: "No log drain URL is configured; console structured logs are the only sink." };
    }
    const response = await fetch(process.env.TALENTRANK_LOG_DRAIN_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.TALENTRANK_LOG_DRAIN_TOKEN ? { authorization: `Bearer ${process.env.TALENTRANK_LOG_DRAIN_TOKEN}` } : {}),
      },
      body: JSON.stringify({ event: "ops.integration.test", timestamp: new Date().toISOString() }),
    });
    if (!response.ok) throw new Error(`Log drain returned HTTP ${response.status}.`);
    return { status: "pass", detail: "Log drain accepted a structured test event." };
  });
}

export async function runProviderDiagnostic(key: DiagnosticKey) {
  const tests: Record<DiagnosticKey, () => Promise<DiagnosticResult>> = {
    database: testDatabase,
    storage: testStorage,
    malware: testMalware,
    ocr: testOcr,
    embeddings: testEmbeddings,
    oidc: testOidc,
    observability: testObservability,
  };
  return tests[key]();
}

export async function runProviderDiagnostics(keys: DiagnosticKey[] = ["database", "storage", "malware", "ocr", "embeddings", "oidc", "observability"]) {
  const results: DiagnosticResult[] = [];
  for (const key of keys) results.push(await runProviderDiagnostic(key));
  return {
    generatedAt: new Date().toISOString(),
    results,
    ok: results.every((result) => result.status === "pass" || result.status === "skipped"),
  };
}
