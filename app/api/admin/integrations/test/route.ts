import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { runProviderDiagnostic, runProviderDiagnostics } from "@/lib/provider-diagnostics";

const diagnosticKeys = ["database", "storage", "malware", "ocr", "embeddings", "oidc", "observability"] as const;

const schema = z.object({
  key: z.enum(diagnosticKeys).optional(),
});

export async function POST(request: Request) {
  try {
    await requireRole("admin");
    const input = schema.parse(await request.json().catch(() => ({})));
    const result = input.key ? await runProviderDiagnostic(input.key) : await runProviderDiagnostics();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Integration diagnostics failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
