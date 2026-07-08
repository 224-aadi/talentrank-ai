export interface OcrResult {
  text: string;
  provider: string;
  confidence?: number;
  warnings: string[];
}

export function ocrConfigured() {
  return Boolean(process.env.OCR_API_URL || process.env.OCR_SPACE_API_KEY);
}

function ocrProvider() {
  if (process.env.OCR_PROVIDER) return process.env.OCR_PROVIDER.toLowerCase();
  if (process.env.OCR_SPACE_API_KEY) return "ocrspace";
  return "generic";
}

function warningsFromPayload(value: unknown) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  return [String(value)];
}

async function runGenericOcr(file: File): Promise<OcrResult> {
  const endpoint = process.env.OCR_API_URL;
  if (!endpoint) {
    return {
      text: "",
      provider: "not-configured",
      warnings: ["OCR fallback is not configured. Set OCR_API_URL or OCR_SPACE_API_KEY to parse scanned PDFs."],
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

async function runOcrSpace(file: File): Promise<OcrResult> {
  const apiKey = process.env.OCR_SPACE_API_KEY;
  if (!apiKey) {
    return {
      text: "",
      provider: "ocrspace",
      warnings: ["OCR_SPACE_API_KEY is required when OCR_PROVIDER=ocrspace."],
    };
  }

  const body = new FormData();
  body.append("file", file, file.name);
  body.append("language", process.env.OCR_SPACE_LANGUAGE || "eng");
  body.append("isOverlayRequired", "false");
  body.append("detectOrientation", "true");
  body.append("scale", "true");
  body.append("OCREngine", process.env.OCR_SPACE_ENGINE || "2");

  const response = await fetch(process.env.OCR_SPACE_API_URL || "https://api.ocr.space/parse/image", {
    method: "POST",
    headers: { apikey: apiKey },
    body,
  });
  if (!response.ok) {
    return {
      text: "",
      provider: "ocrspace",
      warnings: [`OCR.space returned HTTP ${response.status}.`],
    };
  }

  const payload = await response.json().catch(() => ({}));
  const parsedResults = Array.isArray(payload.ParsedResults) ? payload.ParsedResults : [];
  const text = parsedResults.map((result: any) => result?.ParsedText).filter(Boolean).join("\n\n").trim();
  const warnings = [
    ...warningsFromPayload(payload.ErrorMessage),
    ...warningsFromPayload(payload.ErrorDetails),
    ...parsedResults.flatMap((result: any) => warningsFromPayload(result?.ErrorMessage)),
  ];

  return {
    text,
    provider: "ocrspace",
    warnings: payload.IsErroredOnProcessing ? warnings.length ? warnings : ["OCR.space reported processing errors."] : warnings,
  };
}

export async function runOcr(file: File): Promise<OcrResult> {
  const provider = ocrProvider();
  if (provider === "ocrspace") return await runOcrSpace(file);
  return await runGenericOcr(file);
}
