import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export type StoredFile = {
  storageKey: string;
  encrypted: boolean;
  bytes: number;
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

export async function storeUploadedResumeFile(file: File): Promise<StoredFile> {
  const raw = Buffer.from(await file.arrayBuffer());
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
  };
}

export async function readStoredFile(storageKey: string) {
  const target = localPathFor(storageKey);
  const buffer = await fs.readFile(target);
  return decrypt(buffer);
}
