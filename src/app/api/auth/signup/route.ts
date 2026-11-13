import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { isSelfSignupAllowed } from "@/lib/auth/organization-settings";
import { validatePassword } from "@/lib/auth/password";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const fullName =
      typeof body.fullName === "string" && body.fullName.trim()
        ? body.fullName.trim()
        : undefined;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    const allowed = await isSelfSignupAllowed();
    if (!allowed) {
      return NextResponse.json(
        { error: "Registration is invite-only. Contact your organization administrator." },
        { status: 403 }
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: fullName ? { full_name: fullName } : undefined,
    });

    if (error) {
      const message =
        error.message.includes("duplicate") || error.message.includes("unique")
          ? "An account with this email already exists. Try signing in or reset your password."
          : error.message;
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const needsEmailConfirmation = !data.user?.email_confirmed_at;

    return NextResponse.json({
      needsEmailConfirmation,
      userId: data.user?.id ?? null,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Signup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
