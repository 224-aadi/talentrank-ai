"use client";

import { useState } from "react";
import type { DiagnosticKey, DiagnosticResult } from "@/lib/provider-diagnostics";
import type { IntegrationStatus } from "@/lib/integrations";

const runnableKeys = new Set(["database", "storage", "malware", "ocr", "embeddings", "oidc", "observability"]);

function evidenceText(evidence?: Record<string, unknown>) {
  if (!evidence) return "";
  return Object.entries(evidence)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" | ");
}

export function IntegrationDiagnosticsPanel({ items }: { items: IntegrationStatus[] }) {
  const [results, setResults] = useState<Record<string, DiagnosticResult>>({});
  const [running, setRunning] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function run(key?: DiagnosticKey) {
    setMessage("");
    setRunning(key || "all");
    const response = await fetch("/api/admin/integrations/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(key ? { key } : {}),
    });
    const payload = await response.json();
    setRunning(null);
    if (!response.ok) {
      setMessage(payload.error || "Diagnostics failed.");
      return;
    }
    if (payload.results) {
      setResults(Object.fromEntries(payload.results.map((result: DiagnosticResult) => [result.key, result])));
      setMessage(payload.ok ? "All runnable diagnostics passed or were safely skipped." : "Some diagnostics need attention.");
      return;
    }
    setResults((current) => ({ ...current, [payload.key]: payload }));
    setMessage(`${payload.label}: ${payload.status}`);
  }

  return (
    <section className="diagnostics-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Staging verification</p>
          <h2>Provider Diagnostics</h2>
        </div>
        <button type="button" onClick={() => run()} disabled={running !== null}>
          {running === "all" ? "Running..." : "Run all"}
        </button>
      </div>
      {message ? <p className="admin-message">{message}</p> : null}
      <div className="diagnostic-list">
        {items.filter((item) => runnableKeys.has(item.key)).map((item) => {
          const result = results[item.key];
          return (
            <div key={item.key} className="diagnostic-row">
              <div>
                <strong>{item.label}</strong>
                {result ? <p>{result.detail}</p> : null}
                {result?.evidence ? <small>{evidenceText(result.evidence)}</small> : null}
              </div>
              <div className="diagnostic-actions">
                <span className={result ? `diag-${result.status}` : `status-${item.status}`}>
                  {result ? `${result.status} ${result.durationMs}ms` : item.status}
                </span>
                <button type="button" onClick={() => run(item.key as DiagnosticKey)} disabled={running !== null}>
                  {running === item.key ? "Testing..." : "Test"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
