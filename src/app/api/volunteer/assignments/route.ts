import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { sendShiftAssignmentNotification } from "@/lib/notificationHelpers";
import { query } from "@/lib/db/pool";

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

    const { rows } = await query<{
      id: string;
      status: string;
      sub_shift_id: string;
      role_name: string;
      sub_start: string;
      sub_end: string;
      event_id: string;
      event_title: string;
      event_location: string | null;
      event_start: string;
      event_end: string;
    }>(
      `SELECT sa.id, sa.status, sa.sub_shift_id,
        ss.role_name, ss.start_time AS sub_start, ss.end_time AS sub_end, ss.event_id,
        e.title AS event_title, e.location AS event_location,
        e.start_time AS event_start, e.end_time AS event_end
       FROM shift_assignments sa
       JOIN sub_shifts ss ON ss.id = sa.sub_shift_id
       JOIN events e ON e.id = ss.event_id
       WHERE sa.user_id = $1
       ORDER BY sa.created_at DESC`,
      [user.id]
    );

    const result = rows.map((row) => ({
      id: row.id,
      status: row.status,
      sub_shift_id: row.sub_shift_id,
      role_name: row.role_name,
      start_time: row.sub_start ?? row.event_start,
      end_time: row.sub_end ?? row.event_end,
      event_id: row.event_id,
      event_title: row.event_title,
      event_location: row.event_location,
      event_start_time: row.event_start,
      event_end_time: row.event_end,
    }));

    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to load assignments";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sub_shift_id } = await request.json();
    if (!sub_shift_id) {
      return NextResponse.json({ error: "Missing sub_shift_id" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: subShift, error: ssErr } = await admin
      .from("sub_shifts")
      .select("id,capacity,role_name,start_time,end_time,event_id")
      .eq("id", sub_shift_id)
      .single();
    if (ssErr) throw ssErr;
    if (!subShift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    const { data: eventRow } = await admin
      .from("events")
      .select("id,title,start_time,end_time,location")
      .eq("id", subShift.event_id as string)
      .single();

    const { count } = await admin
      .from("shift_assignments")
      .select("id", { count: "exact", head: true })
      .eq("sub_shift_id", sub_shift_id);

    const capacity = (subShift.capacity as number) ?? 0;
    const filled = count ?? 0;
    if (capacity > 0 && filled >= capacity) {
      return NextResponse.json({ error: "Shift is full" }, { status: 409 });
    }

    const effectiveStart = (subShift.start_time as string) ?? (eventRow?.start_time as string);
    const effectiveEnd = (subShift.end_time as string) ?? (eventRow?.end_time as string);

    if (effectiveStart && effectiveEnd) {
      const { rows: overlaps } = await query<{ id: string }>(
        `SELECT sa.id
         FROM shift_assignments sa
         JOIN sub_shifts ss ON ss.id = sa.sub_shift_id
         JOIN events e ON e.id = ss.event_id
         WHERE sa.user_id = $1
           AND sa.status IN ('confirmed', 'pending_swap')
           AND tstzrange(
             COALESCE(ss.start_time, e.start_time),
             COALESCE(ss.end_time, e.end_time),
             '[)'
           ) && tstzrange($2::timestamptz, $3::timestamptz, '[)')`,
        [user.id, effectiveStart, effectiveEnd]
      );
      if (overlaps.length > 0) {
        return NextResponse.json({ error: "Shift overlaps with your existing schedule" }, { status: 409 });
      }
    }

    const { data: inserted, error: insertErr } = await admin
      .from("shift_assignments")
      .insert({ sub_shift_id, user_id: user.id, status: "confirmed" })
      .select("id,status")
      .single();
    if (insertErr) {
      if (insertErr.code === "23505") {
        return NextResponse.json({ error: "You are already signed up for this shift" }, { status: 409 });
      }
      throw insertErr;
    }

    const responsePayload = {
      id: inserted?.id,
      status: inserted?.status ?? "confirmed",
      sub_shift_id,
      role_name: subShift.role_name,
      start_time: subShift.start_time,
      end_time: subShift.end_time,
      event_title: eventRow?.title ?? "",
      event_location: eventRow?.location ?? null,
      event_start_time: eventRow?.start_time ?? null,
      event_end_time: eventRow?.end_time ?? null,
    };

    sendShiftAssignmentNotification(user.id, {
      eventTitle: (eventRow?.title as string) ?? "Event",
      roleName: subShift.role_name as string,
      startTime: effectiveStart ?? new Date().toISOString(),
      location: eventRow?.location as string | undefined,
    }).catch((err) => {
      console.error("Failed to send assignment notification:", err);
    });

    return NextResponse.json(responsePayload);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to sign up";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
