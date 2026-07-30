export interface OcrResult {
  text: string;
  provider: string;
  confidence?: number;
  warnings: string[];
}

export function ocrConfigured() {
  return Boolean(process.env.OCR_API_URL || process.env.OCR_SPACE_API_KEY);
}

function isOcrSpaceEndpoint(value?: string) {
  if (!value) return false;
  try {
    return new URL(value).hostname.toLowerCase().endsWith("ocr.space");
  } catch {
    return value.toLowerCase().includes("ocr.space");
  }
}

function ocrProvider() {
  const configured = process.env.OCR_PROVIDER?.toLowerCase();
  if (configured && configured !== "generic") return configured;
  if (process.env.OCR_SPACE_API_KEY) return "ocrspace";
  if (isOcrSpaceEndpoint(process.env.OCR_API_URL)) return "ocrspace";
  if (configured) return configured;
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
  const legacyOcrSpaceConfig = isOcrSpaceEndpoint(process.env.OCR_API_URL);
  const apiKey = process.env.OCR_SPACE_API_KEY || (legacyOcrSpaceConfig ? process.env.OCR_API_KEY : undefined);
  if (!apiKey) {
    return {
      text: "",
      provider: "ocrspace",
      warnings: ["OCR_SPACE_API_KEY is required for OCR.space. OCR_API_KEY is also accepted when OCR_API_URL points to ocr.space."],
    };
  }

  const endpoint = process.env.OCR_SPACE_API_URL
    || (legacyOcrSpaceConfig ? process.env.OCR_API_URL : undefined)
    || "https://api.ocr.space/parse/image";

  const request = async (engine: string): Promise<OcrResult> => {
    const body = new FormData();
    body.append("file", file, file.name);
    body.append("language", process.env.OCR_SPACE_LANGUAGE || "eng");
    body.append("isOverlayRequired", "false");
    body.append("detectOrientation", "true");
    body.append("scale", "true");
    body.append("OCREngine", engine);

    const response = await fetch(endpoint, {
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
  };

  const preferredEngine = process.env.OCR_SPACE_ENGINE || "2";
  const firstPass = await request(preferredEngine);
  if (firstPass.text.length >= 80) return firstPass;

  const alternateEngine = preferredEngine === "1" ? "2" : "1";
  const secondPass = await request(alternateEngine);
  if (secondPass.text.length > firstPass.text.length) {
    return {
      ...secondPass,
      warnings: [`OCR.space retried with engine ${alternateEngine} after engine ${preferredEngine} returned little text.`, ...secondPass.warnings],
    };
  }
  return firstPass;
}

export async function runOcr(file: File): Promise<OcrResult> {
  const provider = ocrProvider();
  if (provider === "ocrspace") return await runOcrSpace(file);
  return await runGenericOcr(file);
}
