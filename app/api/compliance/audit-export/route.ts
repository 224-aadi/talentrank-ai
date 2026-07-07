import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { auditExport } from "@/lib/store";

export async function GET() {
  try {
    await requireRole("admin");
    const exportPayload = await auditExport();
    return NextResponse.json(exportPayload, {
      headers: {
        "content-disposition": `attachment; filename="talentrank-audit-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Audit export failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
