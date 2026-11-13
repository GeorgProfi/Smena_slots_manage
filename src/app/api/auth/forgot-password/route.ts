import { NextResponse } from "next/server";
import { findUserByEmail, generateResetToken } from "@/lib/auth/credentials";
import { query } from "@/lib/db/pool";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }
    const user = await findUserByEmail(email);
    if (user) {
      const token = generateResetToken();
      await query(
        `UPDATE auth_users SET reset_token = $1, reset_token_expires_at = now() + interval '1 day' WHERE id = $2`,
        [token, user.id]
      );
      const origin = new URL(request.url).origin;
      console.info(`[password-reset] ${origin}/reset-password?token=${token}`);
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
