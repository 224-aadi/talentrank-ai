import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export type StoredFile = {
  storageKey: string;
  encrypted: boolean;
  bytes: number;
  provider: "local" | "external";
};

const storageRoot = path.join(process.cwd(), ".data", "secure-files");

function safeName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "resume";
}

function encryptionKey() {
  const secret = process.env.TALENTRANK_STORAGE_KEY;
  if (!secret) return null;
  return crypto.createHash("sha256").update(secret).digest();
}

function localPathFor(storageKey: string) {
  const normalized = storageKey.replace(/^secure\//, "");
  const target = path.join(storageRoot, normalized);
  if (!target.startsWith(storageRoot)) throw new Error("Invalid storage key.");
  return target;
}

function encrypt(buffer: Buffer) {
  const key = encryptionKey();
  if (!key) return { buffer, encrypted: false };
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    buffer: Buffer.concat([Buffer.from("TRGCM1"), iv, tag, encrypted]),
    encrypted: true,
  };
}

function decrypt(buffer: Buffer) {
  if (!buffer.subarray(0, 6).equals(Buffer.from("TRGCM1"))) return buffer;
  const key = encryptionKey();
  if (!key) throw new Error("TALENTRANK_STORAGE_KEY is required to decrypt this file.");
  const iv = buffer.subarray(6, 18);
  const tag = buffer.subarray(18, 34);
  const payload = buffer.subarray(34);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(payload), decipher.final()]);
}

export function storageConfiguredForProduction() {
  return Boolean(process.env.TALENTRANK_STORAGE_KEY || process.env.TALENTRANK_STORAGE_PROVIDER);
}

async function storeExternally(file: File, raw: Buffer): Promise<StoredFile | null> {
  const endpoint = process.env.TALENTRANK_STORAGE_UPLOAD_URL;
  if (!process.env.TALENTRANK_STORAGE_PROVIDER || !endpoint) return null;
  const id = crypto.randomBytes(12).toString("hex");
  const storageKey = `external/resumes/${new Date().toISOString().slice(0, 10)}/${id}-${safeName(file.name)}`;
  const formData = new FormData();
  formData.append("key", storageKey);
  formData.append("file", new Blob([new Uint8Array(raw)], { type: file.type || "application/octet-stream" }), file.name);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: process.env.TALENTRANK_STORAGE_TOKEN ? { authorization: `Bearer ${process.env.TALENTRANK_STORAGE_TOKEN}` } : undefined,
    body: formData,
  });
  if (!response.ok) throw new Error(`External storage provider returned HTTP ${response.status}.`);
  const payload = await response.json().catch(() => ({}));
  return {
    storageKey: typeof payload.storageKey === "string" ? payload.storageKey : storageKey,
    encrypted: Boolean(payload.encrypted),
    bytes: raw.length,
    provider: "external",
  };
}

export async function storeUploadedResumeFile(file: File): Promise<StoredFile> {
  const raw = Buffer.from(await file.arrayBuffer());
  const external = await storeExternally(file, raw);
  if (external) return external;
  const timestamp = new Date().toISOString().slice(0, 10);
  const id = crypto.randomBytes(12).toString("hex");
  const storageKey = `secure/resumes/${timestamp}/${id}-${safeName(file.name)}`;
  const target = localPathFor(storageKey);
  const payload = encrypt(raw);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, payload.buffer, { mode: 0o600 });
  await fs.writeFile(`${target}.meta.json`, JSON.stringify({
    originalName: file.name,
    mimeType: file.type || "application/octet-stream",
    encrypted: payload.encrypted,
    bytes: raw.length,
    storedAt: new Date().toISOString(),
  }, null, 2), { mode: 0o600 });
  return {
    storageKey,
    encrypted: payload.encrypted,
    bytes: raw.length,
    provider: "local",
  };
}

export async function readStoredFile(storageKey: string) {
  if (storageKey.startsWith("external/")) {
    throw new Error("External storage downloads must be served by the configured object-storage gateway.");
  }
  const target = localPathFor(storageKey);
  const buffer = await fs.readFile(target);
  return decrypt(buffer);
}

export async function externalDownloadUrl(storageKey: string, fileName: string) {
  const endpoint = process.env.TALENTRANK_STORAGE_DOWNLOAD_URL;
  if (!endpoint || !storageKey.startsWith("external/")) return null;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(process.env.TALENTRANK_STORAGE_TOKEN ? { authorization: `Bearer ${process.env.TALENTRANK_STORAGE_TOKEN}` } : {}),
    },
    body: JSON.stringify({ storageKey, fileName }),
  });
  if (!response.ok) throw new Error(`External storage download gateway returned HTTP ${response.status}.`);
  const payload = await response.json().catch(() => ({}));
  return typeof payload.url === "string" ? payload.url : null;
}
