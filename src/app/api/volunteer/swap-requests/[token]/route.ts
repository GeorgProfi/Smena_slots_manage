import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { query } from "@/lib/db/pool";
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

export async function GET(
  request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const admin = adminClient();

    // Fetch swap request by token
    const { rows } = await query<{
      id: string;
      status: string;
      created_at: string;
      requester_name: string | null;
      role_name: string;
      sub_start: string;
      sub_end: string;
      event_title: string;
      event_start: string;
      event_end: string;
      event_location: string | null;
    }>(
      `SELECT sr.id, sr.status, sr.created_at, p.full_name AS requester_name,
        ss.role_name, ss.start_time AS sub_start, ss.end_time AS sub_end,
        e.title AS event_title, e.start_time AS event_start, e.end_time AS event_end, e.location AS event_location
       FROM swap_requests sr
       JOIN shift_assignments sa ON sa.id = sr.assignment_id
       JOIN sub_shifts ss ON ss.id = sa.sub_shift_id
       JOIN events e ON e.id = ss.event_id
       JOIN profiles p ON p.id = sr.requester_id
       WHERE sr.share_token = $1 AND sr.status = 'open'
       LIMIT 1`,
      [params.token]
    );

    const swapRequest = rows[0];
    if (!swapRequest) {
      return NextResponse.json(
        { error: "Swap request not found or expired" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: swapRequest.id,
      status: swapRequest.status,
      created_at: swapRequest.created_at,
      requester_name: swapRequest.requester_name ?? "Unknown",
      role_name: swapRequest.role_name,
      start_time: swapRequest.sub_start ?? swapRequest.event_start,
      end_time: swapRequest.sub_end ?? swapRequest.event_end,
      event_title: swapRequest.event_title,
      event_location: swapRequest.event_location,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? "Failed to load swap request" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { action } = await request.json();
    if (!action || !["accept", "decline"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action" },
        { status: 400 }
      );
    }

    const admin = adminClient();

    // Fetch swap request
    const { data: swapRequest, error: swapErr } = await admin
      .from("swap_requests")
      .select("id, requester_id, assignment_id, status")
      .eq("share_token", params.token)
      .single();

    if (swapErr || !swapRequest) {
      return NextResponse.json(
        { error: "Swap request not found" },
        { status: 404 }
      );
    }

    if (swapRequest.status !== "open") {
      return NextResponse.json(
        { error: "Swap request is no longer available" },
        { status: 409 }
      );
    }

    // Can't accept your own swap request
    if (swapRequest.requester_id === user.id) {
      return NextResponse.json(
        { error: "You cannot accept your own swap request" },
        { status: 403 }
      );
    }

    if (action === "decline") {
      // Just mark it as cancelled
      const { error: updateErr } = await admin
        .from("swap_requests")
        .update({ status: "cancelled" })
        .eq("id", swapRequest.id);

      if (updateErr) throw updateErr;

      return NextResponse.json({ success: true, status: "cancelled" });
    }

    // Handle accept: swap the assignments
    // 1. Get both assignments
    const { data: assignment1, error: err1 } = await admin
      .from("shift_assignments")
      .select("id, user_id, sub_shift_id")
      .eq("id", swapRequest.assignment_id)
      .single();

    if (err1 || !assignment1) {
      return NextResponse.json(
        { error: "Original assignment not found" },
        { status: 404 }
      );
    }

    // Find this user's assignment for the same sub_shift (if exists)
    const { data: userAssignments } = await admin
      .from("shift_assignments")
      .select("id, user_id, sub_shift_id")
      .eq("user_id", user.id)
      .eq("sub_shift_id", assignment1.sub_shift_id);

    if (userAssignments && userAssignments.length > 0) {
      return NextResponse.json(
        { error: "You are already assigned to this shift" },
        { status: 409 }
      );
    }

    // 2. Swap users: update both assignments to swap user_id
    const { error: swapErr1 } = await admin
      .from("shift_assignments")
      .update({ user_id: user.id })
      .eq("id", assignment1.id);

    if (swapErr1) throw swapErr1;

    // 3. Mark swap request as accepted
    const { error: acceptErr } = await admin
      .from("swap_requests")
      .update({ status: "accepted", accepted_by_id: user.id })
      .eq("id", swapRequest.id);

    if (acceptErr) throw acceptErr;

    return NextResponse.json({ success: true, status: "accepted" });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? "Failed to process swap request" },
      { status: 500 }
    );
  }
}
