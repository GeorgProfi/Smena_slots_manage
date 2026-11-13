import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { setUserPassword } from "@/lib/db/admin";
import { validatePassword } from "@/lib/auth/password";

export async function PATCH(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const password = typeof body.password === "string" ? body.password : "";
    const err = validatePassword(password);
    if (err) {
      return NextResponse.json({ error: err }, { status: 400 });
    }
    await setUserPassword(user.id, password);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
