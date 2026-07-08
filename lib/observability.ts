type MetricName =
  | "auth.login.success"
  | "auth.login.failure"
  | "rate_limit.blocked"
  | "resume.download"
  | "screen.request"
  | "screen.success"
  | "screen.failure"
  | "storage.write"
  | "upload.rejected"
  | "upload.scanned";

type MetricRecord = {
  count: number;
  lastAt: string;
};

const metrics = new Map<MetricName, MetricRecord>();

function redact(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redact);
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => {
    if (/password|token|secret|cookie|authorization/i.test(key)) return [key, "[redacted]"];
    return [key, redact(item)];
  }));
}

export function incrementMetric(name: MetricName, value = 1) {
  const current = metrics.get(name);
  metrics.set(name, {
    count: (current?.count || 0) + value,
    lastAt: new Date().toISOString(),
  });
}

export function logEvent(name: string, metadata: Record<string, unknown> = {}) {
  const payload = {
    at: new Date().toISOString(),
    service: "talentrank-ai",
    event: name,
    metadata: redact(metadata),
  };
  console.log(JSON.stringify(payload));
}

export function metricsSnapshot() {
  return {
    generatedAt: new Date().toISOString(),
    metrics: Object.fromEntries(metrics.entries()),
  };
}
