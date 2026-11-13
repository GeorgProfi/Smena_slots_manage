import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function GET() {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("organization_settings")
      .select("key, value");

    if (error) throw error;

    const settings = Object.fromEntries(
      (data || []).map((s: { key: string; value: string }) => [s.key, s.value])
    );

    return NextResponse.json(settings);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to fetch settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json({ error: "Missing key or value" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("organization_settings")
      .upsert({ key, value: String(value), updated_at: new Date().toISOString() }, { onConflict: "key" });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to update setting";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
