import { NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { sendShiftAssignmentNotification } from "@/lib/notificationHelpers";
import { query, withTransaction } from "@/lib/db/pool";
import type { PoolClient } from "pg";

class SignupHttpError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "SignupHttpError";
  }
}

function pgErrorCode(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "code" in err) {
    return String((err as { code: string }).code);
  }
  return undefined;
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

type SignupResult = {
  id: string;
  status: string;
  sub_shift_id: string;
  role_name: string;
  start_time: string | null;
  end_time: string | null;
  event_title: string;
  event_location: string | null;
  event_start_time: string | null;
  event_end_time: string | null;
  effectiveStart: string | null;
};

async function signupForSubShift(
  client: PoolClient,
  userId: string,
  sub_shift_id: string
): Promise<SignupResult> {
  const subShiftRes = await client.query<{
    id: string;
    capacity: number;
    role_name: string;
    start_time: string;
    end_time: string;
    event_id: string;
  }>(
    `SELECT id, capacity, role_name, start_time, end_time, event_id
     FROM sub_shifts
     WHERE id = $1
     FOR UPDATE`,
    [sub_shift_id]
  );

  const subShift = subShiftRes.rows[0];
  if (!subShift) {
    throw new SignupHttpError("Shift not found", 404);
  }

  const eventRes = await client.query<{
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    location: string | null;
  }>(`SELECT id, title, start_time, end_time, location FROM events WHERE id = $1`, [
    subShift.event_id,
  ]);
  const eventRow = eventRes.rows[0];

  const countRes = await client.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM shift_assignments WHERE sub_shift_id = $1`,
    [sub_shift_id]
  );
  const filled = countRes.rows[0]?.c ?? 0;
  const capacity = subShift.capacity ?? 0;
  if (capacity > 0 && filled >= capacity) {
    throw new SignupHttpError("Shift is full", 409);
  }

  const effectiveStart = subShift.start_time ?? eventRow?.start_time ?? null;
  const effectiveEnd = subShift.end_time ?? eventRow?.end_time ?? null;

  if (effectiveStart && effectiveEnd) {
    const overlapRes = await client.query<{ id: string }>(
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
      [userId, effectiveStart, effectiveEnd]
    );
    if (overlapRes.rows.length > 0) {
      throw new SignupHttpError("Shift overlaps with your existing schedule", 409);
    }
  }

  try {
    const insertRes = await client.query<{ id: string; status: string }>(
      `INSERT INTO shift_assignments (sub_shift_id, user_id, status)
       VALUES ($1, $2, 'confirmed')
       RETURNING id, status`,
      [sub_shift_id, userId]
    );
    const inserted = insertRes.rows[0];
    if (!inserted) {
      throw new Error("Insert failed");
    }

    return {
      id: inserted.id,
      status: inserted.status,
      sub_shift_id,
      role_name: subShift.role_name,
      start_time: subShift.start_time,
      end_time: subShift.end_time,
      event_title: eventRow?.title ?? "",
      event_location: eventRow?.location ?? null,
      event_start_time: eventRow?.start_time ?? null,
      event_end_time: eventRow?.end_time ?? null,
      effectiveStart,
    };
  } catch (e: unknown) {
    const code = pgErrorCode(e);
    if (code === "23505") {
      throw new SignupHttpError("You are already signed up for this shift", 409);
    }
    if (code === "23514") {
      throw new SignupHttpError("Shift is full", 409);
    }
    throw e;
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

    const signup = await withTransaction((client) =>
      signupForSubShift(client, user.id, sub_shift_id)
    );

    sendShiftAssignmentNotification(user.id, {
      eventTitle: signup.event_title || "Event",
      roleName: signup.role_name,
      startTime: signup.effectiveStart ?? new Date().toISOString(),
      location: signup.event_location ?? undefined,
    }).catch((err) => {
      console.error("Failed to send assignment notification:", err);
    });

    const responsePayload = {
      id: signup.id,
      status: signup.status,
      sub_shift_id: signup.sub_shift_id,
      role_name: signup.role_name,
      start_time: signup.start_time,
      end_time: signup.end_time,
      event_title: signup.event_title,
      event_location: signup.event_location,
      event_start_time: signup.event_start_time,
      event_end_time: signup.event_end_time,
    };

    return NextResponse.json(responsePayload);
  } catch (e: unknown) {
    if (e instanceof SignupHttpError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : "Failed to sign up";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}