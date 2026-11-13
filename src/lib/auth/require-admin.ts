import type { User } from "@supabase/supabase-js";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export type AdminAuthResult =
  | { ok: true; user: User; role: string }
  | { ok: false; status: number; error: string; user: null; role: null };

export async function requireAdmin(): Promise<AdminAuthResult> {
  const supabase = createServerSupabaseClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return { ok: false, status: 401, error: "Unauthorized", user: null, role: null };
  }
  const user = userData.user;
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profErr || !profile || !["admin", "super_admin"].includes(profile.role)) {
    return { ok: false, status: 403, error: "Forbidden", user: null, role: null };
  }
  return { ok: true, user, role: profile.role };
}
