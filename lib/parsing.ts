import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export interface ParsedResumeFile {
  fileName: string;
  mimeType: string;
  text: string;
  parseConfidence: number;
  parser: string;
  warnings: string[];
}

const maxFileBytes = 8 * 1024 * 1024;

function extension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

function confidenceFor(text: string, parser: string, warnings: string[]) {
  const lengthScore = Math.min(35, Math.round(text.length / 120));
  const sectionScore = ["education", "experience", "skills", "projects"].filter((section) =>
    text.toLowerCase().includes(section),
  ).length * 10;
  const parserScore = parser === "pdf" || parser === "docx" ? 25 : 18;
  return Math.max(30, Math.min(98, parserScore + lengthScore + sectionScore - warnings.length * 8));
}

function cleanText(text: string) {
  return text
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function parsePdf(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const parser = new PDFParse({ data: buffer });
  try {
    const parsed = await parser.getText();
    return cleanText(parsed.text || "");
  } finally {
    await parser.destroy();
  }
}

async function parseDocx(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await mammoth.extractRawText({ buffer });
  return cleanText(parsed.value || "");
}

export async function parseResumeFile(file: File): Promise<ParsedResumeFile> {
  const ext = extension(file.name);
  const mimeType = file.type || "application/octet-stream";
  const warnings: string[] = [];
  if (file.size > maxFileBytes) {
    throw new Error(`${file.name} is too large. Maximum supported size is 8MB.`);
  }

  let parser = "text";
  let text = "";

  if (ext === "pdf" || mimeType === "application/pdf") {
    parser = "pdf";
    text = await parsePdf(file);
  } else if (ext === "docx" || mimeType.includes("wordprocessingml")) {
    parser = "docx";
    text = await parseDocx(file);
  } else if (["txt", "md", "csv"].includes(ext) || mimeType.startsWith("text/") || !ext) {
    parser = "text";
    text = cleanText(await file.text());
  } else {
    throw new Error(`${file.name} is not supported yet. Upload PDF, DOCX, TXT, MD, or CSV.`);
  }

  if (!text) {
    throw new Error(`${file.name} did not yield readable text.`);
  }
  if (text.length < 250) warnings.push("Very little text extracted");
  if (!/education|experience|skills|project/i.test(text)) warnings.push("Common resume sections not detected");

  return {
    fileName: file.name,
    mimeType,
    text,
    parser,
    warnings,
    parseConfidence: confidenceFor(text, parser, warnings),
  };
}
