import { promises as fs } from "node:fs";
import path from "node:path";

const source = path.join(process.cwd(), ".data", "talentrank.json");
const outDir = process.env.TALENTRANK_BACKUP_DIR || path.join(process.cwd(), ".data", "backups");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = path.join(outDir, `talentrank-${timestamp}.json`);

await fs.mkdir(outDir, { recursive: true });
try {
  const payload = await fs.readFile(source);
  await fs.writeFile(target, payload, { mode: 0o600 });
  console.log(JSON.stringify({ ok: true, target, bytes: payload.length }, null, 2));
} catch (error) {
  if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
    console.log(JSON.stringify({ ok: true, skipped: true, reason: "No JSON database exists yet." }, null, 2));
  } else {
    throw error;
  }
}
