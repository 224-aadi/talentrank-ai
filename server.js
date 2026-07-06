import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");
const dbPath = path.join(dataDir, "talentrank.json");
const port = Number(process.env.PORT || 4173);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

async function ensureDb() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dbPath);
  } catch {
    await writeDb({
      jobs: [],
      candidates: [],
      auditEvents: [],
      evaluations: [],
      createdAt: new Date().toISOString(),
      schemaVersion: 1,
    });
  }
}

async function readDb() {
  await ensureDb();
  return JSON.parse(await fs.readFile(dbPath, "utf8"));
}

async function writeDb(db) {
  await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(res, status, body, headers = {}) {
  const payload = typeof body === "string" ? body : JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "Content-Type": typeof body === "string" ? "text/plain; charset=utf-8" : "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(payload);
}

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

async function routeApi(req, res, url) {
  const db = await readDb();

  if (req.method === "GET" && url.pathname === "/api/health") {
    return send(res, 200, {
      ok: true,
      service: "TalentRank",
      version: "0.4.0",
      model: "hybrid-v0.4",
      now: new Date().toISOString(),
    });
  }

  if (req.method === "GET" && url.pathname === "/api/jobs") {
    return send(res, 200, { jobs: db.jobs });
  }

  if (req.method === "POST" && url.pathname === "/api/jobs") {
    const body = await readJson(req);
    const job = {
      id: id("job"),
      title: body.title || "Untitled role",
      description: body.description || "",
      hardRules: body.hardRules || [],
      roleTemplate: body.roleTemplate || "auto",
      createdAt: new Date().toISOString(),
    };
    db.jobs.unshift(job);
    db.auditEvents.unshift({
      id: id("audit"),
      type: "job.created",
      at: new Date().toISOString(),
      jobId: job.id,
      metadata: { roleTemplate: job.roleTemplate, hardRuleCount: job.hardRules.length },
    });
    await writeDb(db);
    return send(res, 201, { job });
  }

  if (req.method === "GET" && url.pathname === "/api/audit") {
    return send(res, 200, { auditEvents: db.auditEvents });
  }

  if (req.method === "POST" && url.pathname === "/api/audit") {
    const body = await readJson(req);
    const event = {
      id: id("audit"),
      at: new Date().toISOString(),
      type: body.type || "candidate.decision",
      candidateId: body.candidateId || "",
      candidateName: body.candidateName || "",
      jobId: body.jobId || "",
      decision: body.decision || "",
      score: body.score ?? null,
      verdict: body.verdict || "",
      model: body.model || "TalentRank hybrid-v0.4",
      roleFamily: body.roleFamily || "",
      metadata: body.metadata || {},
    };
    db.auditEvents.unshift(event);
    await writeDb(db);
    return send(res, 201, { event });
  }

  if (req.method === "POST" && url.pathname === "/api/evaluations") {
    const body = await readJson(req);
    const evaluation = {
      id: id("eval"),
      at: new Date().toISOString(),
      jobId: body.jobId || "",
      model: body.model || "TalentRank hybrid-v0.4",
      candidateCount: Number(body.candidateCount || 0),
      shortlistCount: Number(body.shortlistCount || 0),
      strongMatchCount: Number(body.strongMatchCount || 0),
      avgScore: Number(body.avgScore || 0),
      avgConfidence: Number(body.avgConfidence || 0),
      parseHealth: Number(body.parseHealth || 0),
      falseKnockoutReviewCount: Number(body.falseKnockoutReviewCount || 0),
      notes: body.notes || "",
    };
    db.evaluations.unshift(evaluation);
    await writeDb(db);
    return send(res, 201, { evaluation });
  }

  return send(res, 404, { error: "Unknown API route" });
}

async function serveStatic(req, res, url) {
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(__dirname, requested));
  if (!filePath.startsWith(__dirname)) return send(res, 403, "Forbidden");
  try {
    const body = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, {
      "Content-Type": contentTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(body);
  } catch {
    send(res, 404, "Not found");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) return await routeApi(req, res, url);
    return await serveStatic(req, res, url);
  } catch (error) {
    send(res, 500, { error: error.message });
  }
});

await ensureDb();
server.listen(port, "127.0.0.1", () => {
  console.log(`TalentRank running on http://127.0.0.1:${port}`);
});
