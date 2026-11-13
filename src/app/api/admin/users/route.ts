import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { asRows } from "@/lib/db/query";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const admin = createAdminClient();

    const { data: profilesData, error: profError } = await admin
      .from("profiles")
      .select("id, full_name, role");
    if (profError) throw profError;

    const profiles = asRows<{ id: string; full_name: string; role: string }>(profilesData);

    const { data: authUsers, error: authError } = await admin.auth.admin.listUsers();
    if (authError) throw authError;

    const emailMap = new Map(
      (authUsers?.users ?? []).map((u: { id: string; email: string }) => [u.id, u.email])
    );

    const mapped = profiles.map((p) => ({
      id: p.id,
      full_name: p.full_name,
      role: p.role,
      email: emailMap.get(p.id) ?? null,
    }));
    return NextResponse.json(mapped);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to fetch users";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id, role } = await request.json();
    if (!id || !role) {
      return NextResponse.json({ error: "Missing id or role" }, { status: 400 });
    }

    if (!["admin", "super_admin", "volunteer"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: targetProfile, error: fetchErr } = await admin
      .from("profiles")
      .select("role")
      .eq("id", id)
      .single();
    if (fetchErr || !targetProfile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (targetProfile.role === "super_admin" || role === "super_admin") {
      if (auth.role !== "super_admin") {
        return NextResponse.json(
          { error: "Only super_admin can modify super_admin role" },
          { status: 403 }
        );
      }
    }

    const { error } = await admin.from("profiles").update({ role }).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to update role";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
