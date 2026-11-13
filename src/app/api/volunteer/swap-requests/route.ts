import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { query } from "@/lib/db/pool";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import crypto from "crypto";
import webpush from "web-push";

function adminClient() {
  return createAdminClient();
}

async function getUser() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user ?? null;
}

export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rows: requests } = await query<{
      id: string;
      status: string;
      created_at: string;
      share_token: string;
      requester_id: string;
      event_id: string;
      role_name: string;
      sub_start: string;
      sub_end: string;
      event_title: string;
      event_start: string;
      event_end: string;
      event_location: string | null;
    }>(
      `SELECT sr.id, sr.status, sr.created_at, sr.share_token, sr.requester_id,
        e.id AS event_id, ss.role_name, ss.start_time AS sub_start, ss.end_time AS sub_end,
        e.title AS event_title, e.start_time AS event_start, e.end_time AS event_end, e.location AS event_location
       FROM swap_requests sr
       JOIN shift_assignments sa ON sa.id = sr.assignment_id
       JOIN sub_shifts ss ON ss.id = sa.sub_shift_id
       JOIN events e ON e.id = ss.event_id
       WHERE sr.status IN ('open', 'accepted')`
    );

    const result = requests.map((r) => ({
      id: r.id,
      status: r.status,
      created_at: r.created_at,
      share_token: r.share_token,
      is_mine: r.requester_id === user.id,
      requester_id: r.requester_id,
      event_id: r.event_id,
      role_name: r.role_name,
      start_time: r.sub_start ?? r.event_start,
      end_time: r.sub_end ?? r.event_end,
      event_title: r.event_title,
      event_location: r.event_location,
      share_link: `/swap-requests/${r.share_token}`,
    }));

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? "Failed to load swap requests" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { assignment_id } = await request.json();
    if (!assignment_id) {
      return NextResponse.json(
        { error: "Missing assignment_id" },
        { status: 400 }
      );
    }

    const admin = adminClient();

    // Verify this assignment belongs to the user
    const { data: assignment, error: assignErr } = await admin
      .from("shift_assignments")
      .select("id, user_id")
      .eq("id", assignment_id)
      .single();

    if (assignErr || !assignment) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }

    if (assignment.user_id !== user.id) {
      return NextResponse.json(
        { error: "You can only swap your own assignments" },
        { status: 403 }
      );
    }

    // Check if there's already an open swap request for this assignment
    const { data: existingSwap } = await admin
      .from("swap_requests")
      .select("id")
      .eq("assignment_id", assignment_id)
      .eq("status", "open")
      .single();

    if (existingSwap) {
      return NextResponse.json(
        { error: "You already have an open swap request for this shift" },
        { status: 409 }
      );
    }

    // Generate unique share token
    const share_token = crypto.randomBytes(16).toString("hex");

    // Create swap request
    const { data: inserted, error: insertErr } = await admin
      .from("swap_requests")
      .insert({
        assignment_id,
        requester_id: user.id,
        status: "open",
        share_token,
      })
      .select("id, share_token, created_at")
      .single();

    if (insertErr) throw insertErr;

    // Update assignment status to pending_swap
    const { error: updateErr } = await admin
      .from("shift_assignments")
      .update({ status: "pending_swap" })
      .eq("id", assignment_id);

    if (updateErr) throw updateErr;

    const { rows: shiftRows } = await query<{
      role_name: string;
      start_time: string;
      event_title: string;
      event_start: string;
    }>(
      `SELECT ss.role_name, COALESCE(ss.start_time, e.start_time) AS start_time,
              e.title AS event_title, e.start_time AS event_start
       FROM shift_assignments sa
       JOIN sub_shifts ss ON ss.id = sa.sub_shift_id
       JOIN events e ON e.id = ss.event_id
       WHERE sa.id = $1`,
      [assignment_id]
    );
    const subShift = shiftRows[0];

    // Load push subscriptions (exclude requester)
    const { data: subscriptions } = await admin
      .from("user_preferences")
      .select("user_id, push_subscription")
      .eq("push_notifications_enabled", true)
      .not("push_subscription", "is", null)
      .neq("user_id", user.id);

    let sent = 0;

    if (subscriptions && subscriptions.length > 0 && subShift?.start_time) {
      // Configure VAPID once
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT!,
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        process.env.VAPID_PRIVATE_KEY!
      );

      const role = subShift.role_name || "Shift";
      const when = new Date(subShift.start_time).toLocaleString();
      const payload = JSON.stringify({
        title: "New Swap Request",
        body: `${role} on ${when} is available to swap`,
        data: { url: "/swap-requests" },
        tag: `swap-${inserted.id}`,
      });

      for (const sub of subscriptions) {
        try {
          if (!sub.push_subscription) continue;
          await webpush.sendNotification(sub.push_subscription as any, payload);
          sent++;
        } catch (err) {
          console.error("swap push send error", err);
        }
      }
    }

    return NextResponse.json({
      id: inserted.id,
      share_token: inserted.share_token,
      share_link: `/swap-requests/${inserted.share_token}`,
      created_at: inserted.created_at,
      notifications_sent: sent,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? "Failed to create swap request" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await request.json();
    if (!id) {
      return NextResponse.json(
        { error: "Missing swap request id" },
        { status: 400 }
      );
    }

    const admin = adminClient();

    // Verify this swap request belongs to the user
    const { data: swapRequest, error: fetchErr } = await admin
      .from("swap_requests")
      .select("id, requester_id, assignment_id")
      .eq("id", id)
      .single();

    if (fetchErr || !swapRequest) {
      return NextResponse.json(
        { error: "Swap request not found" },
        { status: 404 }
      );
    }

    if (swapRequest.requester_id !== user.id) {
      return NextResponse.json(
        { error: "You can only cancel your own swap requests" },
        { status: 403 }
      );
    }

    // Cancel the request
    const { error: cancelErr } = await admin
      .from("swap_requests")
      .update({ status: "cancelled" })
      .eq("id", id);

    if (cancelErr) throw cancelErr;

    // Update assignment status back to confirmed
    const { error: updateErr } = await admin
      .from("shift_assignments")
      .update({ status: "confirmed" })
      .eq("id", swapRequest.assignment_id);

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? "Failed to cancel swap request" },
      { status: 500 }
    );
  }
}
