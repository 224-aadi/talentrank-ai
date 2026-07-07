export interface OcrResult {
  text: string;
  provider: string;
  confidence?: number;
  warnings: string[];
}

export function ocrConfigured() {
  return Boolean(process.env.OCR_API_URL);
}

export async function runOcr(file: File): Promise<OcrResult> {
  const endpoint = process.env.OCR_API_URL;
  if (!endpoint) {
    return {
      text: "",
      provider: "not-configured",
      warnings: ["OCR fallback is not configured. Set OCR_API_URL to parse scanned PDFs."],
    };
  }

  const body = new FormData();
  body.append("file", file, file.name);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: process.env.OCR_API_KEY ? { authorization: `Bearer ${process.env.OCR_API_KEY}` } : undefined,
    body,
  });
  if (!response.ok) {
    return {
      text: "",
      provider: endpoint,
      warnings: [`OCR provider returned HTTP ${response.status}.`],
    };
  }

  const payload = await response.json().catch(() => ({}));
  return {
    text: typeof payload.text === "string" ? payload.text : "",
    provider: typeof payload.provider === "string" ? payload.provider : endpoint,
    confidence: typeof payload.confidence === "number" ? payload.confidence : undefined,
    warnings: Array.isArray(payload.warnings) ? payload.warnings.map(String) : [],
  };
}
