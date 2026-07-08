import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { incrementMetric, logEvent } from "@/lib/observability";
import { clientKey, checkRateLimit } from "@/lib/rate-limit";
import { readStoredFile } from "@/lib/secure-storage";
import { getResumeDocument } from "@/lib/store";

export async function GET(_: Request, context: { params: Promise<{ resumeId: string }> }) {
  try {
    const user = await requireRole("recruiter");
    const rateLimit = checkRateLimit(await clientKey("resume-download"), 60, 60_000);
    if (!rateLimit.ok) {
      return NextResponse.json({ error: "Too many download requests. Try again shortly." }, { status: 429 });
    }
    const { resumeId } = await context.params;
    const resume = await getResumeDocument(resumeId);
    if (!resume) return NextResponse.json({ error: "Resume not found." }, { status: 404 });
    if (!resume.storageKey.startsWith("secure/")) {
      return NextResponse.json({ error: "Original file is not available in secure storage." }, { status: 404 });
    }

    const buffer = await readStoredFile(resume.storageKey);
    incrementMetric("resume.download");
    logEvent("resume.download", { resumeId, candidateId: resume.candidateId, actorId: user.id });
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "content-type": resume.mimeType || "application/octet-stream",
        "content-disposition": `attachment; filename="${resume.fileName.replace(/"/g, "")}"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Resume download failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
