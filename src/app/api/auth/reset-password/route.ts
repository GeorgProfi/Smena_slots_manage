import { NextResponse } from "next/server";
import { query } from "@/lib/db/pool";
import { setUserPassword } from "@/lib/db/admin";
import { validatePassword } from "@/lib/auth/password";
import { setSessionUser } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token : "";
    const password = typeof body.password === "string" ? body.password : "";
  const err = validatePassword(password);
    if (err) {
      return NextResponse.json({ error: err }, { status: 400 });
    }
    if (!token) {
      return NextResponse.json({ error: "Invalid or missing token" }, { status: 400 });
    }
    const { rows } = await query<{ id: string; email: string }>(
      `SELECT id, email FROM auth_users
       WHERE reset_token = $1 AND reset_token_expires_at > now()
       LIMIT 1`,
      [token]
    );
    const user = rows[0];
    if (!user) {
      return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
    }
    await setUserPassword(user.id, password);
    await setSessionUser({ id: user.id, email: user.email });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Reset failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
