import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { asRows } from "@/lib/db/query";
import { query } from "@/lib/db/pool";
import { requireAdmin } from "@/lib/auth/require-admin";

function adminClient() {
  return createAdminClient();
}

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const admin = adminClient();
    const { data: requestsData, error } = await admin
      .from("swap_requests")
      .select("id, assignment_id, requester_id, status, created_at")
      .eq("status", "open")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const requests = asRows<{
      id: string;
      assignment_id: string;
      requester_id: string;
      status: string;
      created_at: string;
    }>(requestsData);
    if (requests.length === 0) {
      return NextResponse.json([]);
    }

    const assignmentIds = requests.map((r) => r.assignment_id);
    const { data: assignmentsData, error: assignErr } = await admin
      .from("shift_assignments")
      .select("id, sub_shift_id, user_id")
      .in("id", assignmentIds);
    if (assignErr) throw assignErr;

    const assignments = asRows<{ id: string; sub_shift_id: string; user_id: string }>(assignmentsData);
    const subShiftIds = assignments.map((a) => a.sub_shift_id);
    const { data: subShiftsData, error: ssErr } = await admin
      .from("sub_shifts")
      .select("id, event_id, role_name, start_time, end_time")
      .in("id", subShiftIds);
    if (ssErr) throw ssErr;

    const subShifts = asRows<{
      id: string;
      event_id: string;
      role_name: string;
      start_time: string;
      end_time: string;
    }>(subShiftsData);
    const eventIds = subShifts.map((s) => s.event_id);
    const { data: eventsData, error: evErr } = await admin
      .from("events")
      .select("id, title, start_time, end_time")
      .in("id", eventIds);
    if (evErr) throw evErr;
    const events = asRows<{ id: string; title: string; start_time: string; end_time: string }>(eventsData);

    const profilesMap: Record<string, { email?: string; full_name?: string }> = {};
    const requesterIds = Array.from(new Set(requests.map((r) => r.requester_id)));
    if (requesterIds.length) {
      const { rows: profs } = await query<{ id: string; full_name: string; email: string }>(
        `SELECT p.id, p.full_name, u.email
         FROM profiles p
         JOIN auth_users u ON u.id = p.id
         WHERE p.id = ANY($1::uuid[])`,
        [requesterIds]
      );
      profs.forEach((p) => {
        profilesMap[p.id] = { email: p.email, full_name: p.full_name };
      });
    }

    const subShiftMap = Object.fromEntries(subShifts.map((s) => [s.id, s]));
    const eventMap = Object.fromEntries(events.map((e) => [e.id, e]));

    const result = requests.map((r) => {
      const assignment = assignments.find((a) => a.id === r.assignment_id);
      const sub = assignment ? subShiftMap[assignment.sub_shift_id] : undefined;
      const evt = sub ? eventMap[sub.event_id] : undefined;
      const requester = profilesMap[r.requester_id] ?? {};
      return {
        id: r.id,
        status: r.status,
        created_at: r.created_at,
        assignment_id: r.assignment_id,
        requester_name: requester.full_name ?? "Unknown",
        requester_email: requester.email ?? "",
        role_name: sub?.role_name ?? "",
        start_time: sub?.start_time ?? evt?.start_time,
        end_time: sub?.end_time ?? evt?.end_time,
        event_title: evt?.title ?? "",
      };
    });

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Failed to fetch swap requests" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const admin = adminClient();

    const { id, action, accepted_by_id } = await request.json();
    if (!id || !action) {
      return NextResponse.json({ error: "Missing id or action" }, { status: 400 });
    }

    if (!["accept", "decline", "cancel"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Load swap request and related assignment
    const { data: swap, error: swapErr } = await admin
      .from("swap_requests")
      .select("id, status, assignment_id, requester_id")
      .eq("id", id)
      .single();
    if (swapErr || !swap) {
      return NextResponse.json({ error: "Swap request not found" }, { status: 404 });
    }

    if (swap.status !== "open" && action === "accept") {
      return NextResponse.json({ error: "Swap request is not open" }, { status: 409 });
    }

    if (action === "decline") {
      const { error: updErr } = await admin
        .from("swap_requests")
        .update({ status: "cancelled" })
        .eq("id", swap.id);
      if (updErr) throw updErr;

      // Reset assignment back to confirmed (the requester keeps the shift)
      const { error: assignUpdErr } = await admin
        .from("shift_assignments")
        .update({ status: "confirmed" })
        .eq("id", swap.assignment_id);
      if (assignUpdErr) throw assignUpdErr;

      return NextResponse.json({ success: true, status: "cancelled" });
    }

    if (action === "cancel") {
      // Admin cancel: free the requester from the shift by deleting the assignment.
      // This will cascade delete the swap_request due to FK ON DELETE CASCADE.
      const { error: delErr } = await admin
        .from("shift_assignments")
        .delete()
        .eq("id", swap.assignment_id);
      if (delErr) throw delErr;

      return NextResponse.json({ success: true, status: "cancelled", freed: true });
    }

    // Accept path: requires accepted_by_id
    if (action === "accept") {
      if (!accepted_by_id) {
        return NextResponse.json({ error: "accepted_by_id is required" }, { status: 400 });
      }

      // Verify target user exists and is a volunteer (or admin allowed)
      const { data: profile, error: profErr } = await admin
        .from("profiles")
        .select("id, role")
        .eq("id", accepted_by_id)
        .single();
      if (profErr || !profile) {
        return NextResponse.json({ error: "Selected user not found" }, { status: 404 });
      }

      // Ensure the selected user is not already assigned to this sub_shift
      const { data: assignment, error: aErr } = await admin
        .from("shift_assignments")
        .select("id, sub_shift_id")
        .eq("id", swap.assignment_id)
        .single();
      if (aErr || !assignment) {
        return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
      }

      const { data: existingData } = await admin
        .from("shift_assignments")
        .select("id")
        .eq("user_id", accepted_by_id)
        .eq("sub_shift_id", assignment.sub_shift_id)
        .limit(1);
      const existing = asRows<{ id: string }>(existingData);
      if (existing.length > 0) {
        return NextResponse.json({ error: "User already assigned to this shift" }, { status: 409 });
      }

      // Reassign the shift to the selected user and confirm
      const { error: reassignErr } = await admin
        .from("shift_assignments")
        .update({ user_id: accepted_by_id, status: "confirmed" })
        .eq("id", swap.assignment_id);
      if (reassignErr) throw reassignErr;

      // Mark swap request as accepted
      const { error: accErr } = await admin
        .from("swap_requests")
        .update({ status: "accepted", accepted_by_id })
        .eq("id", swap.id);
      if (accErr) throw accErr;

      return NextResponse.json({ success: true, status: "accepted" });
    }

    return NextResponse.json({ error: "Unhandled action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Failed to update swap request" }, { status: 500 });
  }
}
