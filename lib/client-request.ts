export class ApiRequestError extends Error {
  status: number;
  retryAfterMs: number;
  constructor(message: string, status: number, retryAfterMs = 0) {
    super(message); this.status = status; this.retryAfterMs = retryAfterMs;
  }
}

export async function requestJson<T>(path: string, init?: RequestInit, timeoutMs = 45_000): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new ApiRequestError("The service took too long to respond or the connection was interrupted. Please try again.", 503);
  }
  const text = await response.text();
  let payload: any;
  let validJson = true;
  try { payload = JSON.parse(text); } catch { payload = {}; validJson = false; }
  if (!response.ok) {
    const retryAfter = response.headers.get("retry-after");
    const seconds = Number(retryAfter);
    const retryAfterMs = retryAfter ? (Number.isFinite(seconds) ? seconds * 1000 : Math.max(0, Date.parse(retryAfter) - Date.now())) : 0;
    throw new ApiRequestError(typeof payload.error === "string" ? payload.error : `Request failed (${response.status}). Please try again.`, response.status, retryAfterMs);
  }
  if (!validJson || !text || !payload || typeof payload !== "object") throw new ApiRequestError("The service returned an incomplete response. Please try again.", 502);
  return payload as T;
}
