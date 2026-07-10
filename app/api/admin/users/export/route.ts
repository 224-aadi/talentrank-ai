import { NextResponse } from "next/server";
import { listAuthUsers, requireRole, type AuthUser } from "@/lib/auth";

function csvCell(value: string) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export async function GET() {
  try {
    await requireRole("admin");
    const users = await listAuthUsers();
    const rows = [
      ["Name", "Email", "Role", "ID"],
      ...users.map((user: AuthUser) => [user.name, user.email, user.role, user.id]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="talentrank-users-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Users export failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
