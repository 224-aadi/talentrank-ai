export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "Request failed.";
  if (message === "Authentication required.") return { status: 401, message: "Your session has expired. Sign in again to continue." };
  if (/^Requires .+ role/.test(message)) return { status: 403, message };
  const code = (error as { code?: string } | null)?.code || "";
  if (/^P(100[0-9]|101[0-7]|2024|2037)$/.test(code) || /prisma\.|database probe|error querying the database|database server|tenant\/user|connection.*(closed|refused|pool)/i.test(message)) {
    return { status: 503, message: "The service cannot connect to its database right now. Please try again shortly." };
  }
  if (/timed? ?out|timeout|fetch failed|HTTP (?:429|5\d\d)|connection.*interrupted/i.test(message)) {
    return { status: 503, message: "A processing service is temporarily unavailable. Please try again shortly; completed uploads are saved." };
  }
  return { status: 400, message };
}
