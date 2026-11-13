import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { query } from "@/lib/db/pool";
import { requireAdmin } from "@/lib/auth/require-admin";

function adminClient() {
  return createAdminClient();
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const admin = adminClient();
    const volunteerId = params.id;

    // Fetch volunteer profile
    const { data: profile, error: profErr } = await admin
      .from("profiles")
      .select("id, full_name, role, phone_number")
      .eq("id", volunteerId)
      .single();
    if (profErr || !profile) {
      return NextResponse.json({ error: "Volunteer not found" }, { status: 404 });
    }

    // Get email separately from auth table
    const { data: { users }, error: authErr } = await admin.auth.admin.listUsers();
    const authUser = users?.find((u: any) => u.id === volunteerId);
    const email = authUser?.email ?? "";

    // Fetch all assignments with event details
    const { rows: assignments } = await query<{
      id: string;
      status: string;
      created_at: string;
      role_name: string;
      start_time: string;
      end_time: string;
      event_title: string;
      event_id: string;
    }>(
      `SELECT sa.id, sa.status, sa.created_at,
        ss.role_name, COALESCE(ss.start_time, e.start_time) AS start_time, ss.end_time,
        e.title AS event_title, e.id AS event_id
       FROM shift_assignments sa
       JOIN sub_shifts ss ON ss.id = sa.sub_shift_id
       JOIN events e ON e.id = ss.event_id
       WHERE sa.user_id = $1
       ORDER BY sa.created_at DESC`,
      [volunteerId]
    );

    const mapped_assignments = assignments.map((a) => ({
      id: a.id,
      status: a.status,
      created_at: a.created_at,
      role_name: a.role_name,
      start_time: a.start_time,
      end_time: a.end_time,
      event_title: a.event_title,
      event_id: a.event_id,
    }));

    // Separate upcoming and past assignments
    const now = new Date();
    const upcoming = mapped_assignments.filter(a => new Date(a.start_time) > now);
    const past = mapped_assignments.filter(a => new Date(a.start_time) <= now);

    return NextResponse.json({
      id: profile.id,
      full_name: profile.full_name || "Unknown",
      email: email,
      phone_number: profile.phone_number || null,
      role: profile.role,
      upcoming,
      past,
      assignment_count: mapped_assignments.length,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? "Failed to fetch volunteer details" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { action } = await request.json();
    const userId = params.id;

    if (action === "promote") {
      // Promote volunteer to admin
      const admin = adminClient();
      
      // Check target user role
      const { data: profile, error: fetchErr } = await admin
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();
      if (fetchErr || !profile) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      if (profile.role !== "volunteer") {
        return NextResponse.json(
          { error: "Can only promote volunteers to admin" },
          { status: 400 }
        );
      }

      // Update role to admin
      const { error: updateErr } = await admin
        .from("profiles")
        .update({ role: "admin" })
        .eq("id", userId);
      if (updateErr) throw updateErr;

      return NextResponse.json({ success: true, message: "User promoted to admin" });
    }

    if (action === "delete") {
      // Delete user account
      const admin = adminClient();

      // Check target user role - cannot delete other managers
      const { data: profile, error: fetchErr } = await admin
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();
      if (fetchErr || !profile) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      if (profile.role !== "volunteer") {
        return NextResponse.json(
          { error: "Cannot delete manager accounts" },
          { status: 403 }
        );
      }

      // Delete from auth
      const { error: deleteAuthErr } = await admin.auth.admin.deleteUser(userId);
      if (deleteAuthErr) throw deleteAuthErr;

      // Delete profile (cascade will handle assignments)
      const { error: deleteProfileErr } = await admin
        .from("profiles")
        .delete()
        .eq("id", userId);
      if (deleteProfileErr) throw deleteProfileErr;

      return NextResponse.json({ success: true, message: "User account deleted" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? "Failed to update user" },
      { status: 500 }
    );
  }
}
