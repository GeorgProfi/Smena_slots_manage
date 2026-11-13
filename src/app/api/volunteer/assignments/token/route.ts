import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

function adminClient() {
  return createAdminClient();
}

async function getUser() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user ?? null;
}

export async function GET(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = adminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("calendar_token")
      .eq("id", user.id)
      .single();

    if (error) throw error;

    return NextResponse.json({ token: data?.calendar_token ?? null });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Failed to fetch token" }, { status: 500 });
  }
}
