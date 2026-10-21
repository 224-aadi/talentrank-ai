import assert from "node:assert/strict";
import test from "node:test";
import { createUploadRun, executeUploadRun, planResumeBatches, uploadChunkBytes } from "../lib/upload-queue.ts";
import { ApiRequestError, requestJson } from "../lib/client-request.ts";

const files = (count: number) => Array.from({ length: count }, (_, i) => new File(["QA resume"], `candidate-${i}.txt`, { type: "text/plain" }));
const payload = (form: FormData) => ({ job: { id: "job-qa" }, results: form.getAll("resumes").map(file => ({ name: (file as File).name })), errors: [] });

test("550 selected resumes survive throttling, a lost response, pause, and resume exactly once", async () => {
  const run = createUploadRun(files(550), [], { description: "QA role" });
  const accepted = new Map<string, any>();
  const attempts = new Map<string, number>();
  let saved = 0;
  let slept = 0;
  const send = async (form: FormData, key: string) => {
    const attempt = (attempts.get(key) || 0) + 1; attempts.set(key, attempt);
    if (key.endsWith(":1") && attempt === 1) throw new ApiRequestError("busy", 429, 2000);
    if (!accepted.has(key)) accepted.set(key, payload(form));
    if (key.endsWith(":2") && attempt === 1) throw new ApiRequestError("lost response", 503);
    return accepted.get(key);
  };
  const options = { send, save: async () => { saved++; }, progress: () => {}, wait: async (ms: number) => { slept += ms; } };
  await executeUploadRun(run, { ...options, paused: () => saved === 5 });
  assert.equal(run.batches.filter(batch => batch.done).length, 5);
  await executeUploadRun(run, options);
  assert.equal(run.batches.length, 138);
  assert.equal(run.batches.reduce((sum, batch) => sum + batch.response.results.length, 0), 550);
  assert.equal(new Set([...accepted.values()].flatMap(value => value.results.map((row: any) => row.name))).size, 550);
  assert.equal(accepted.size, 138);
  assert.ok(slept >= 3000);
});

test("proxy-size packing accounts for the JD only on the first request and isolates oversized files", () => {
  const input = Array.from({ length: 10 }, (_, index) => new File([new Uint8Array(1_000_000)], `${index}.pdf`));
  const { batches, errors } = planResumeBatches([...input, new File([new Uint8Array(uploadChunkBytes + 1)], "too-large.pdf")], 1_000_000);
  assert.equal(batches.flat().length, 10);
  assert.equal(errors.length, 1);
  assert.equal(batches[0].length, 2);
  assert.equal(batches[1].length, 3);
  batches.forEach((batch, i) => assert.ok(batch.reduce((n, file) => n + file.size, i === 0 ? 1_000_000 : 0) <= uploadChunkBytes));
});

test("session expiration leaves the current batch resumable without retrying unauthorized requests", async () => {
  const run = createUploadRun(files(8), [], {});
  let calls = 0;
  await assert.rejects(() => executeUploadRun(run, { save: async () => {}, progress: () => {}, send: async form => { if (++calls === 2) throw new ApiRequestError("Sign in again", 401); return payload(form); } }), /Sign in again/);
  assert.equal(run.batches[0].done, true);
  assert.equal(run.batches[1].done, false);
  assert.equal(calls, 2);
});

test("a failed browser checkpoint preserves the original first-request identity", async () => {
  const run = createUploadRun(files(1), [], {});
  await assert.rejects(() => executeUploadRun(run, { save: async () => { throw new Error("quota"); }, progress: () => {}, send: async form => payload(form) }), /quota/);
  assert.equal(run.jobId, undefined);
  assert.equal(run.batches[0].done, false);
});

test("network errors become retryable errors and honor Retry-After", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new TypeError("network down"); };
    await assert.rejects(() => requestJson("/api/auth/login"), (error: any) => error.status === 503);
    globalThis.fetch = async () => new Response('{"error":"busy"}', { status: 429, headers: { "retry-after": "7" } });
    await assert.rejects(() => requestJson("/api/screen"), (error: any) => error.status === 429 && error.retryAfterMs === 7000);
  } finally { globalThis.fetch = original; }
});
