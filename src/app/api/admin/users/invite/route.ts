import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const fullName =
      typeof body.fullName === "string" && body.fullName.trim()
        ? body.fullName.trim()
        : undefined;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    }

    const origin = new URL(request.url).origin;
    const redirectTo = new URL("/auth/callback", origin);
    redirectTo.searchParams.set("next", "/reset-password");

    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirectTo.toString(),
      data: fullName ? { full_name: fullName } : undefined,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      userId: data.user?.id ?? null,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Invite failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
