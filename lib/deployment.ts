export function frontendOnlyMode() {
  return Boolean(process.env.TALENTRANK_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL) && process.env.TALENTRANK_FRONTEND_ONLY === "true";
}

export function publicAppUrl() {
  return process.env.TALENTRANK_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";
}

export function isLocalUrl(url: URL) {
  return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "0.0.0.0";
}
