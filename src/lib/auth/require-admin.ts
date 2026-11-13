import type { SessionUser } from "@/lib/auth/session";
import { getSessionUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/db/admin";

export type AdminAuthResult =
  | { ok: true; user: SessionUser; role: string }
  | { ok: false; status: number; error: string; user: null; role: null };

export async function requireAdmin(): Promise<AdminAuthResult> {
  const user = await getSessionUser();
  if (!user) {
    return { ok: false, status: 401, error: "Unauthorized", user: null, role: null };
  }
  const admin = createAdminClient();
  const { data: profile, error: profErr } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profErr || !profile || !["admin", "super_admin"].includes(profile.role as string)) {
    return { ok: false, status: 403, error: "Forbidden", user: null, role: null };
  }
  return { ok: true, user, role: profile.role as string };
}
