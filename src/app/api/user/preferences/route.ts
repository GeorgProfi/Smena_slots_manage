import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/db/admin";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("user_preferences")
      .select("dark_mode, email_notifications, push_notifications_enabled")
      .eq("user_id", user.id)
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data ?? { dark_mode: false, email_notifications: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to load preferences";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const admin = createAdminClient();
    const { error } = await admin.from("user_preferences").upsert(
      {
        user_id: user.id,
        dark_mode: Boolean(body.dark_mode),
        email_notifications: Boolean(body.email_notifications),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to save preferences";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
