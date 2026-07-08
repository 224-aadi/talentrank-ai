import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { integrationStatus } from "@/lib/integrations";

export async function GET() {
  try {
    await requireRole("admin");
    return NextResponse.json(integrationStatus());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Integration status unavailable";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
