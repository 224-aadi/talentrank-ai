import { ApiRequestError, requestJson } from "./client-request";

export const uploadChunkBytes = 3_200_000;
export const uploadChunkFiles = 4;
export type UploadFailure = { fileName: string; error: string; index?: number };
export type UploadBatch = { id: string; files: File[]; savedIds: string[]; done: boolean; response?: any };
export type UploadRun = {
  id: string; job: Record<string, unknown>; jobFile?: File; jobId?: string;
  batches: UploadBatch[]; errors: UploadFailure[]; total: number;
};

export function planResumeBatches(files: File[], firstRequestBytes = 0) {
  const batches: File[][] = [];
  const errors: UploadFailure[] = [];
  if (firstRequestBytes > uploadChunkBytes) throw new Error("The JD file is too large. Paste its text or choose a file smaller than 3.2 MB.");
  let current: File[] = [];
  let bytes = firstRequestBytes;
  for (const file of files) {
    if (file.size > uploadChunkBytes) { errors.push({ fileName: file.name, error: "File exceeds the 3.2 MB upload limit. Compress this file and upload it separately." }); continue; }
    if (current.length && (current.length >= uploadChunkFiles || bytes + file.size > uploadChunkBytes)) {
      batches.push(current); current = []; bytes = 0;
    }
    if (!batches.length && !current.length && bytes + file.size > uploadChunkBytes) {
      errors.push({ fileName: file.name, error: "This resume and JD exceed the upload limit together. Paste the JD text and try again." }); continue;
    }
    current.push(file); bytes += file.size;
  }
  if (current.length) batches.push(current);
  return { batches, errors };
}

export function createUploadRun(files: File[], savedIds: string[], job: Record<string, unknown>, jobFile?: File): UploadRun {
  const planned = planResumeBatches(files, jobFile?.size || 0);
  const id = crypto.randomUUID();
  const batches: UploadBatch[] = planned.batches.map((chunk, index) => ({ id: `${id}:${index}`, files: chunk, savedIds: [], done: false }));
  for (let index = 0; index < savedIds.length; index += 32) {
    batches.push({ id: `${id}:saved:${index}`, files: [], savedIds: savedIds.slice(index, index + 32), done: false });
  }
  if (!batches.length) throw new Error(planned.errors[0]?.error || "Upload resumes or select saved candidates.");
  return { id, batches, errors: planned.errors, job, jobFile, total: files.length + savedIds.length };
}

export async function executeUploadRun(run: UploadRun, options: {
  save: (run: UploadRun, batch?: UploadBatch) => Promise<void>;
  progress: (run: UploadRun, message: string) => void;
  paused?: () => boolean;
  send?: (form: FormData, key: string) => Promise<any>;
  wait?: (ms: number) => Promise<void>;
}) {
  const wait = options.wait || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const send = options.send || ((body, key) => requestJson<any>("/api/screen", { method: "POST", body, headers: { "Idempotency-Key": key } }, 240_000));
  for (const batch of run.batches) {
    if (batch.done) continue;
    if (options.paused?.()) return;
    const form = new FormData();
    // This value is stable for retries, including a lost first response.
    if (run.jobId) form.append("jobId", run.jobId);
    form.append("job", JSON.stringify(run.job));
    if (!run.jobId && run.jobFile) form.append("jobDescriptionFile", run.jobFile);
    for (const file of batch.files) form.append("resumes", file);
    form.append("savedResumeIds", JSON.stringify(batch.savedIds));
    let payload: any;
    for (let attempt = 0; ; attempt++) {
      try { payload = await send(form, batch.id); break; }
      catch (error) {
        if (!(error instanceof ApiRequestError) || ![408, 429, 500, 502, 503, 504].includes(error.status) || attempt >= 4) throw error;
        const delay = Math.min(65_000, Math.max(error.retryAfterMs, 1000 * 2 ** attempt));
        options.progress(run, `Connection interrupted. Retrying this batch in ${Math.ceil(delay / 1000)} seconds; completed results are saved.`);
        // Short waits allow pause controls to remain responsive.
        for (let elapsed = 0; elapsed < delay; elapsed += 1000) { if (options.paused?.()) return; await wait(Math.min(1000, delay - elapsed)); }
      }
    }
    if (!payload?.job?.id || !Array.isArray(payload.results)) throw new ApiRequestError("The service returned an incomplete screening result. Resume this batch to try again.", 502);
    const submitted = batch.files.length + batch.savedIds.length;
    if (payload.results.length + (payload.errors?.length || 0) !== submitted) throw new ApiRequestError("The screening result did not account for every file. Resume this batch to try again.", 502);
    const previousJobId = run.jobId;
    const previousErrors = run.errors.length;
    run.jobId ||= payload.job.id;
    batch.response = payload;
    batch.done = true;
    run.errors.push(...(payload.errors || []));
    // Persist before advancing; the idempotency key remains stable if saving
    // fails or the tab closes between the server commit and this checkpoint.
    try { await options.save(run, batch); }
    catch (error) {
      batch.done = false; batch.response = undefined;
      run.jobId = previousJobId; run.errors.length = previousErrors;
      throw error;
    }
    options.progress(run, `${run.batches.filter(item => item.done).reduce((n, item) => n + item.response.results.length, 0)} of ${run.total} resumes ranked${run.errors.length ? `; ${run.errors.length} files need attention` : ""}`);
    batch.files = [];
  }
}

async function queueDb() {
  return await new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open("talentrank-upload-queue", 1);
    open.onupgradeneeded = () => { open.result.createObjectStore("queues"); open.result.createObjectStore("batches"); };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(new Error("Your browser could not save the upload queue. Allow site storage and try again."));
  });
}

export async function saveUploadRun(owner: string, run: UploadRun, changed?: UploadBatch) {
  const db = await queueDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["queues", "batches"], "readwrite");
      if (!changed) {
        const old = tx.objectStore("queues").get(owner);
        old.onsuccess = () => {
          if (old.result?.id && old.result.id !== run.id) for (const id of old.result.batches) tx.objectStore("batches").delete(id);
        };
      }
      tx.objectStore("queues").put({ ...run, batches: run.batches.map(batch => batch.id) }, owner);
      for (const batch of changed ? [changed] : run.batches) tx.objectStore("batches").put(batch.done ? { ...batch, files: [] } : batch, batch.id);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(new Error("The upload queue could not be saved. Completed results are on the server. Free browser storage and resume."));
    });
  } finally { db.close(); }
}

export async function loadUploadRun(owner: string): Promise<UploadRun | null> {
  const db = await queueDb();
  try {
    const read = (store: string, key: string) => new Promise<any>((resolve, reject) => {
      const request = db.transaction(store).objectStore(store).get(key);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    const run = await read("queues", owner);
    if (!run) return null;
    const batches = await Promise.all(run.batches.map((id: string) => read("batches", id)));
    if (batches.some(batch => !batch)) throw new Error("Some queued files are missing. Please select them again.");
    return { ...run, batches };
  } finally { db.close(); }
}
