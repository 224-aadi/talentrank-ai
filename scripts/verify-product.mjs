import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import http from "node:http";
import JSZip from "jszip";
import { createUploadRun, executeUploadRun } from "../lib/upload-queue.ts";
import { ApiRequestError, requestJson } from "../lib/client-request.ts";

const count = Number(process.env.QA_RESUME_COUNT || 550);
const base = process.env.QA_BASE_URL || "http://127.0.0.1:3199";
const directory = await mkdtemp(path.join(tmpdir(), "talentrank-qa-"));
let password = crypto.randomBytes(20).toString("base64url");
const email = `talentrank-qa-${crypto.randomUUID()}@example.invalid`;
let cookie = "";
let server;
let emailServer;
const emailMessages = [];
let serverOutput = "";
const checks = [];
function pass(name, details = {}) { checks.push({ name, ...details }); console.log(JSON.stringify({ pass: name, ...details })); }
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function api(route, init = {}, expected = 200) {
  const response = await fetch(`${base}${route}`, { ...init, signal: AbortSignal.timeout(240_000), headers: { ...(cookie ? { cookie } : {}), ...init.headers } });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  assert.equal(response.status, expected, `${route} returned ${response.status}: ${String(typeof body === "string" ? body.slice(0, 180) : body.error || "unexpected response")}`);
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  return { response, body };
}
const post = (body, extra = {}) => ({ method: "POST", headers: { "content-type": "application/json", ...extra }, body: JSON.stringify(body) });
const jd = "Mechanical Design Engineer\nAbout the role: Join our manufacturing team to build reliable industrial products.\nResponsibilities: Design production-ready CAD assemblies and manufacturing drawings using SolidWorks and AutoCAD.\nRequirements: Three years of industry experience, GD&T, tolerance analysis, BOM management, and collaboration with manufacturing teams.\nQualifications: Bachelor's degree in mechanical engineering. Required skills include SolidWorks and AutoCAD.";
const resume = i => `QA Candidate ${String(i).padStart(4, "0")}\nqa${i}@example.invalid\nPROFESSIONAL SUMMARY\nMechanical design engineer with six years of experience in CAD modeling and manufacturing documentation.\nSKILLS\nSolidWorks AutoCAD GD&T tolerance analysis BOM management FEA\nEXPERIENCE\nMechanical Design Engineer - Example Manufacturing 2020 - 2026\nCreated production drawings and assemblies, reduced scrap by 18 percent, and improved design release time by 22 percent.\nEDUCATION\nBachelor of Mechanical Engineering, Example Institute 2020`;

function pdfBytes(text) {
  const escaped = text.split("\n").map(line => `(${line.replace(/[\\()]/g, "\\$&")}) Tj T*`).join("\n");
  const stream = `BT /F1 10 Tf 50 740 Td 14 TL\n${escaped}\nET`;
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  let output = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(output)); output += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(output);
  output += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output);
}

try {
  if (!process.env.QA_BASE_URL) {
    emailServer = http.createServer(async (request, response) => {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      emailMessages.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      response.writeHead(200, { "content-type": "application/json" }); response.end('{"id":"qa-email"}');
    });
    await new Promise(resolve => emailServer.listen(0, "127.0.0.1", resolve));
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", "3199"], {
      cwd: process.cwd(), windowsHide: true,
      env: { ...process.env, NODE_ENV: "production", TALENTRANK_DATA_DIR: directory, TALENTRANK_FRONTEND_ONLY: "false", TALENTRANK_BACKEND_URL: "", NEXT_PUBLIC_BACKEND_URL: "", TALENTRANK_APP_URL: base, TALENTRANK_AUTH_MODE: "session", TALENTRANK_AUTH_SECRET: "qa-only-auth-secret-with-at-least-32-chars", TALENTRANK_USE_PRISMA: process.env.QA_USE_PRISMA || "false", OPENAI_API_KEY: "", TALENTRANK_LLM_RANKING: "false", TALENTRANK_STORAGE_PROVIDER: "", TALENTRANK_STORAGE_UPLOAD_URL: "", TALENTRANK_MALWARE_PROVIDER: "", TALENTRANK_MALWARE_SCAN_URL: "", TALENTRANK_BOOTSTRAP_EMAIL: "", TALENTRANK_BOOTSTRAP_PASSWORD: "", TALENTRANK_EMAIL_PROVIDER: "webhook", TALENTRANK_EMAIL_FROM: "qa-sender@example.invalid", TALENTRANK_EMAIL_WEBHOOK_URL: `http://127.0.0.1:${emailServer.address().port}` },
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stdout.on("data", data => { serverOutput += data; }); server.stderr.on("data", data => { serverOutput += data; });
    for (let attempt = 0; attempt < 60; attempt++) {
      try { await api("/api/auth/session"); break; } catch (error) { if (attempt === 59) throw new Error(`Server did not start: ${serverOutput.slice(-2000)}`); await pause(500); }
    }
  }
  await api("/api/screen", post({ job: { description: jd }, resumes: [{ fileName: "qa.txt", text: resume(0) }] }), 401);
  pass("anonymous screening denied");
  const signup = await api("/api/auth/signup", post({ email, password, name: "TalentRank QA", organizationName: "Synthetic QA workspace" }));
  if (process.env.QA_ACCOUNT_FILE) await writeFile(process.env.QA_ACCOUNT_FILE, JSON.stringify({ email, password, base }), { mode: 0o600 });
  assert.ok(signup.body.user.id); assert.ok(cookie);
  await api("/api/auth/logout", { method: "POST" }); cookie = "";
  await api("/api/auth/login", post({ email, password: "incorrect-password" }), 401);
  await api("/api/auth/login", post({ email, password, remember: true }));
  assert.equal((await api("/api/auth/session")).body.user.email, email);
  pass("signup, logout, invalid-password rejection, sign-in, session cookie");
  if (!process.env.QA_BASE_URL) {
    await api("/api/auth/password-reset", post({ email: "invalid" }), 400);
    await api("/api/auth/password-reset", post({ email }));
    const resetEmail = emailMessages.find(item => item.template === "password_reset");
    assert.ok(resetEmail);
    const resetUrl = new URL(resetEmail.text.match(/https?:\/\/\S+/)[0]);
    assert.equal(resetUrl.origin, base);
    const resetToken = resetUrl.searchParams.get("reset");
    password = crypto.randomBytes(20).toString("base64url");
    await api("/api/auth/password-reset/confirm", post({ token: resetToken, password }));
    await api("/api/auth/login", post({ email, password }));
    await api("/api/auth/password-reset/confirm", post({ token: resetToken, password }), 400);
    pass("password-reset email template, link origin, password replacement, single-use token");
  }
  for (const route of ["/dashboard", "/screen", "/workspace", "/quality", "/export", "/trust", "/calibration", "/compliance"]) {
    const page = await api(route);
    assert.notEqual(new URL(page.response.url).pathname, "/login", `${route} lost the authenticated session`);
  }
  pass("authenticated product pages render");

  const files = Array.from({ length: count }, (_, i) => process.env.QA_PDF_HEAVY === "true" || i % 50 === 0
    ? new File([pdfBytes(resume(i))], `QA_Candidate_${i}.pdf`, { type: "application/pdf" })
    : new File([resume(i)], `QA_Candidate_${i}.txt`, { type: "text/plain" }));
  if (process.env.QA_SCANNED_PDF) files[files.length - 1] = new File([await readFile(process.env.QA_SCANNED_PDF)], "Tara_Prasad_Behera_QA_Scanned.pdf", { type: "application/pdf" });
  if (count > 4) {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file("_rels/.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file("word/document.xml", `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${resume(3).split("\n").map(line => `<w:p><w:r><w:t>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</w:t></w:r></w:p>`).join("")}</w:body></w:document>`);
    files[3] = new File([await zip.generateAsync({ type: "nodebuffer" })], "QA-docx-resume.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    files[2] = new File([resume(2)], "QA-markdown-resume.md", { type: "text/markdown" });
  }
  if (process.env.QA_FIXTURE_DIR) {
    await mkdir(process.env.QA_FIXTURE_DIR, { recursive: true });
    for (let i = 0; i < Number(process.env.QA_FIXTURE_COUNT || count); i++) {
      const name = `QA_Candidate_${String(i).padStart(4, "0")}.${i % 50 === 0 ? "pdf" : "txt"}`;
      await writeFile(path.join(process.env.QA_FIXTURE_DIR, name), i % 50 === 0 ? pdfBytes(resume(i)) : resume(i));
    }
    await writeFile(path.join(process.env.QA_FIXTURE_DIR, "job-description.md"), jd);
  }
  const run = createUploadRun(files, [], { title: "QA Mechanical Engineer", description: jd, roleTemplate: "auto", hardRules: [] });
  let duplicateKey;
  let duplicateIds;
  let lostResponseInjected = false;
  let checkpoint;
  const start = performance.now();
  const send = async (body, key) => {
    // Exercise the exact browser transport, including HTML gateway errors and
    // interrupted response bodies, instead of bypassing its typed retries.
    const payload = await requestJson(`${base}/api/screen`, { method: "POST", headers: { cookie, "idempotency-key": key }, body }, 240_000);
    if (!lostResponseInjected) { lostResponseInjected = true; duplicateKey = key; duplicateIds = payload.results.map(item => item.candidate.id); throw new ApiRequestError("Simulated lost response after server commit", 503); }
    if (key === duplicateKey) assert.deepEqual(payload.results.map(item => item.candidate.id), duplicateIds);
    return payload;
  };
  const save = async state => {
    checkpoint = { ...state, errors: [...state.errors], batches: state.batches.map(batch => ({ ...batch, files: [...batch.files] })) };
    await writeFile(path.join(directory, "progress.json"), JSON.stringify({ jobId: state.jobId, completed: state.batches.filter(batch => batch.done).reduce((n, batch) => n + batch.response.results.length, 0), total: count, updatedAt: new Date().toISOString() }));
  };
  await executeUploadRun(run, { send, save, progress: () => {}, paused: () => run.batches.filter(batch => batch.done).length === 5 });
  assert.equal(run.batches.filter(batch => batch.done).length, Math.min(5, run.batches.length));
  await executeUploadRun(checkpoint || run, { send, save, progress: state => { const done = state.batches.filter(batch => batch.done).length; if (done % 20 === 0) console.log(JSON.stringify({ progress: done, batches: state.batches.length })); } });
  const final = checkpoint || run;
  const results = final.batches.flatMap(batch => batch.response?.results || []);
  assert.equal(results.length, count); assert.equal(final.errors.length, 0);
  assert.ok(results.some(item => item.resume.parser === "pdf"));
  if (count > 4) assert.ok(results.some(item => item.resume.parser === "docx"));
  if (process.env.QA_SCANNED_PDF) assert.ok(results.some(item => item.resume.parser === "pdf+ocr"));
  const countsBy = values => Object.fromEntries([...new Set(values)].map(value => [value, values.filter(item => item === value).length]));
  const providerEvidence = {
    parsers: countsBy(results.map(item => item.resume.parser)),
    rankingModels: countsBy(results.map(item => item.matchRun.modelVersion)),
    scanner: countsBy(results.map(item => item.resume.warnings?.find(warning => warning.startsWith("Upload scanner:")) || "not-reported")),
    storage: countsBy(results.map(item => item.resume.warnings?.find(warning => warning.startsWith("Storage provider:")) || "not-reported")),
    llmFallbackCount: results.filter(item => item.matchRun.riskFlags.some(flag => /LLM ranking unavailable/i.test(flag))).length,
  };
  const jobId = final.jobId;
  const persisted = (await api(`/api/matches?jobId=${jobId}`)).body.matchRuns;
  assert.equal(persisted.length, count); assert.equal(new Set(persisted.map(item => item.candidateId)).size, count);
  assert.ok(persisted.every(item => item.resume?.id));
  if (!process.env.QA_BASE_URL || process.env.QA_REQUIRE_INGESTION_METADATA === "true") {
    assert.ok(persisted.every(item => item.resume?.warnings?.some(warning => warning.startsWith("Upload scanner:"))), "ingestion warnings survive database reload");
  }
  pass("bulk upload, lost-response retry, pause/resume, exactly-once persistence", { resumes: count, seconds: Math.round((performance.now() - start) / 1000), providers: providerEvidence });

  const sample = results[0];
  const download = await api(`/api/resumes/${sample.resume.id}/download`);
  assert.match(download.body, /Mechanical design engineer/);
  const search = await api("/api/candidates/search?q=SolidWorks&mode=lexical&limit=50");
  assert.equal(search.body.poolSize, count); assert.ok(search.body.results.length);
  pass("original resume download and candidate search");
  const hybrid = await api("/api/candidates/search?q=mechanical%20design&mode=hybrid&limit=10");
  assert.ok(hybrid.body.results.length);
  pass("semantic indexing and hybrid search");
  await api("/api/decisions", post({ jobId, candidateId: sample.candidate.id, decision: "hold", notes: "Synthetic QA verification" }), 201);
  const decisions = (await api(`/api/decisions?jobId=${jobId}`)).body.decisions;
  assert.ok(decisions.some(item => item.candidateId === sample.candidate.id && item.decision === "hold"));
  const exported = await api(`/api/admin/candidates/export?jobId=${jobId}`);
  assert.ok(exported.body.includes(sample.candidate.name));
  if (!process.env.QA_BASE_URL || process.env.QA_REQUIRE_INGESTION_METADATA === "true") {
    const scores = [...exported.body.matchAll(/^"\d+","(?:[^"]|"")*","(\d*)",/gm)].map(match => Number(match[1]));
    assert.equal(scores.length, count);
    assert.deepEqual(scores, [...scores].sort((a, b) => b - a), "CSV ranks follow scores");
    assert.ok(exported.body.includes("Upload scanner:"), "CSV retains provider warnings");
  }
  const lastPage = await api(`/workspace?jobId=${jobId}&page=${Math.ceil(count / 25)}`);
  assert.ok(lastPage.body.includes("Candidate archive"));
  pass("review decision, candidate export, archive pagination");
  await api("/api/benchmarks", post({ jobId, candidateId: sample.candidate.id, label: "good_match" }), 201);
  assert.ok((await api(`/api/benchmarks?jobId=${jobId}`)).body.labels.length);
  const explanation = await api(`/api/compliance/explainability?matchRunId=${sample.matchRun.id}`);
  assert.equal(explanation.body.candidate.id, sample.candidate.id);
  assert.ok((await api("/api/admin/backup")).body.matches.length >= count);
  pass("benchmark labels, explainability, workspace backup");

  const reranked = await api("/api/screen", post({ job: { title: "QA saved-pool rerank", description: jd }, resumeIds: [sample.resume.id] }, { "idempotency-key": crypto.randomUUID() }), 201);
  assert.equal(reranked.body.results.length, 1);
  assert.equal(reranked.body.results[0].candidate.id, sample.candidate.id);
  assert.equal(reranked.body.results[0].resume.id, sample.resume.id);
  await api("/api/screen", post({ job: { description: jd }, resumes: [{ fileName: "different.txt", text: resume(999) }] }, { "idempotency-key": duplicateKey }), 409);
  pass("saved candidate reranking and conflicting retry-key rejection");

  const mixed = new FormData(); mixed.append("job", JSON.stringify({ description: jd })); mixed.append("jobId", jobId);
  mixed.append("resumes", new File([resume(999)], "QA-valid.txt", { type: "text/plain" }));
  mixed.append("resumes", new File(["INVOICE payment total $500"], "invoice.txt", { type: "text/plain" }));
  const partial = await api("/api/screen", { method: "POST", headers: { "idempotency-key": crypto.randomUUID() }, body: mixed }, 201);
  assert.equal(partial.body.results.length, 1); assert.equal(partial.body.errors.length, 1); assert.equal(partial.body.errors[0].fileName, "invoice.txt");
  pass("invalid resume isolated without losing valid files");

  const originalCookie = cookie;
  await api("/api/auth/signup", post({ email: `qa-other-${crypto.randomUUID()}@example.invalid`, password, name: "Other QA Workspace" }));
  assert.equal((await api(`/api/matches?jobId=${jobId}`)).body.matchRuns.length, 0);
  await api(`/api/resumes/${sample.resume.id}/download`, {}, 404);
  await api("/api/auth/invites", post({ email, name: "Cross-workspace invite should fail", role: "admin" }), 400);
  cookie = originalCookie;
  await api("/api/auth/logout", { method: "POST" });
  cookie = "";
  await api("/api/screen", post({ job: { description: jd }, resumes: [{ fileName: "qa.txt", text: resume(1) }] }), 401);
  pass("workspace isolation and logout enforcement");
  if (process.env.QA_ACCOUNT_FILE) await writeFile(process.env.QA_ACCOUNT_FILE, JSON.stringify({ email, password, base }), { mode: 0o600 });
  await writeFile(path.join(directory, "verification.json"), JSON.stringify({ base, jobId, checks, completedAt: new Date().toISOString() }, null, 2));
  console.log(JSON.stringify({ complete: true, report: path.join(directory, "verification.json"), checks: checks.length }));
} catch (error) {
  console.error(error.stack || error);
  if (serverOutput) console.error(serverOutput.slice(-3500));
  process.exitCode = 1;
} finally {
  if (server && process.env.QA_KEEP_SERVER !== "true") server.kill();
  if (emailServer && process.env.QA_KEEP_SERVER !== "true") emailServer.close();
}
