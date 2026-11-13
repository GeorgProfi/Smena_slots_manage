import { NextResponse } from "next/server";
import { findUserByEmail, verifyPassword } from "@/lib/auth/credentials";
import { setSessionUser } from "@/lib/auth/session";
import { query } from "@/lib/db/pool";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }
    const row = await findUserByEmail(email);
    if (!row) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    const ok = await verifyPassword(password, row.password_hash);
    if (!ok) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    const { rows: profiles } = await query<{ role: string }>(
      "SELECT role FROM profiles WHERE id = $1 LIMIT 1",
      [row.id]
    );
    await setSessionUser({
      id: row.id,
      email: row.email,
      role: profiles[0]?.role,
    });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
