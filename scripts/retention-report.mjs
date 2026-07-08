import { promises as fs } from "node:fs";
import path from "node:path";

const dbPath = path.join(process.cwd(), ".data", "talentrank.json");
const retentionDays = Number(process.env.TALENTRANK_RETENTION_DAYS || 365);
const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

try {
  const db = JSON.parse(await fs.readFile(dbPath, "utf8"));
  const candidates = Array.isArray(db.candidates) ? db.candidates : [];
  const due = candidates.filter((candidate) => new Date(candidate.createdAt).getTime() <= cutoff).map((candidate) => ({
    candidateId: candidate.id,
    candidateName: candidate.name,
    createdAt: candidate.createdAt,
    ageDays: Math.floor((Date.now() - new Date(candidate.createdAt).getTime()) / (24 * 60 * 60 * 1000)),
  }));
  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    retentionDays,
    dueCount: due.length,
    due,
  }, null, 2));
} catch (error) {
  if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
    console.log(JSON.stringify({ generatedAt: new Date().toISOString(), retentionDays, dueCount: 0, due: [] }, null, 2));
  } else {
    throw error;
  }
}
