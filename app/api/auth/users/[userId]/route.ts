import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, updateAuthUserRole } from "@/lib/auth";

const schema = z.object({
  role: z.enum(["admin", "recruiter", "reviewer"]),
});

export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    await requireRole("admin");
    const { userId } = await context.params;
    const input = schema.parse(await request.json());
    return NextResponse.json({ user: await updateAuthUserRole(userId, input.role) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update user";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
