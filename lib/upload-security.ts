import { incrementMetric, logEvent } from "./observability";

const maxBatchFiles = Number(process.env.TALENTRANK_MAX_BATCH_FILES || 50);
const allowedExtensions = new Set(["pdf", "docx", "txt", "md", "csv"]);
const allowedMimeHints = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/",
  "application/octet-stream",
  "",
];

function extension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

function looksLikeZip(buffer: Buffer) {
  return buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
}

function looksLikePdf(buffer: Buffer) {
  return buffer.subarray(0, 5).toString("utf8") === "%PDF-";
}

function mimeAllowed(mimeType: string) {
  return allowedMimeHints.some((hint) => hint.endsWith("/") ? mimeType.startsWith(hint) : mimeType === hint);
}

async function malwareScan(file: File) {
  const endpoint = process.env.TALENTRANK_MALWARE_SCAN_URL;
  if (!endpoint) return { status: "not-configured" as const };
  const formData = new FormData();
  formData.append("file", file, file.name);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: process.env.TALENTRANK_MALWARE_SCAN_KEY ? { authorization: `Bearer ${process.env.TALENTRANK_MALWARE_SCAN_KEY}` } : undefined,
    body: formData,
  });
  if (!response.ok) throw new Error(`Malware scanner returned HTTP ${response.status}.`);
  const payload = await response.json().catch(() => ({}));
  incrementMetric("upload.scanned");
  if (payload.status === "clean" || payload.clean === true) return { status: "clean" as const };
  throw new Error("Upload rejected by malware scanner.");
}

export async function validateResumeUpload(file: File) {
  const ext = extension(file.name);
  const mimeType = file.type || "";
  const sample = Buffer.from(await file.slice(0, 16).arrayBuffer());
  const issues: string[] = [];

  if (!allowedExtensions.has(ext)) issues.push("Unsupported file extension.");
  if (!mimeAllowed(mimeType)) issues.push("Unsupported MIME type.");
  if (ext === "pdf" && !looksLikePdf(sample)) issues.push("PDF magic bytes were not detected.");
  if (ext === "docx" && !looksLikeZip(sample)) issues.push("DOCX zip signature was not detected.");
  if (issues.length) {
    incrementMetric("upload.rejected");
    logEvent("upload.rejected", { fileName: file.name, mimeType, issues });
    throw new Error(`${file.name} failed upload security checks: ${issues.join(" ")}`);
  }

  const scan = await malwareScan(file);
  return {
    fileName: file.name,
    mimeType: mimeType || "application/octet-stream",
    scanner: scan.status,
  };
}

export function validateBatchSize(files: File[]) {
  if (files.length > maxBatchFiles) {
    throw new Error(`Batch contains ${files.length} files. Maximum allowed is ${maxBatchFiles}.`);
  }
}
