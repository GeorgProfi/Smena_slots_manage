import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { query } from "@/lib/db/pool";
import { sendShiftAssignmentNotification } from "@/lib/notificationHelpers";

const ASSIGNABLE_ROLES = new Set(["volunteer", "admin", "super_admin"]);

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const sub_shift_id =
      typeof body.sub_shift_id === "string" ? body.sub_shift_id.trim() : "";
    const user_id = typeof body.user_id === "string" ? body.user_id.trim() : "";

    if (!sub_shift_id || !user_id) {
      return NextResponse.json(
        { error: "Укажите слот (sub_shift_id) и пользователя" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: profile, error: profErr } = await admin
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", user_id)
      .single();
    if (profErr || !profile) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }
    if (!ASSIGNABLE_ROLES.has(profile.role as string)) {
      return NextResponse.json(
        { error: "На слот можно назначить только курьера или администратора" },
        { status: 400 }
      );
    }

    const { data: subShift, error: ssErr } = await admin
      .from("sub_shifts")
      .select("id,capacity,role_name,start_time,end_time,event_id")
      .eq("id", sub_shift_id)
      .single();
    if (ssErr || !subShift) {
      return NextResponse.json({ error: "Слот не найден" }, { status: 404 });
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
      return NextResponse.json({ error: "Слот заполнен" }, { status: 409 });
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
        [user_id, effectiveStart, effectiveEnd]
      );
      if (overlaps.length > 0) {
        return NextResponse.json(
          { error: "У пользователя уже есть пересекающаяся смена" },
          { status: 409 }
        );
      }
    }

    const { data: inserted, error: insertErr } = await admin
      .from("shift_assignments")
      .insert({ sub_shift_id, user_id, status: "confirmed" })
      .select("id,status,created_at,user_id")
      .single();
    if (insertErr) {
      if (insertErr.code === "23505") {
        return NextResponse.json(
          { error: "Пользователь уже назначен на этот слот" },
          { status: 409 }
        );
      }
      throw insertErr;
    }

    sendShiftAssignmentNotification(user_id, {
      eventTitle: (eventRow?.title as string) ?? "Слот",
      roleName: subShift.role_name as string,
      startTime: effectiveStart ?? new Date().toISOString(),
      location: eventRow?.location as string | undefined,
    }).catch((err) => console.error("Failed to send assignment notification:", err));

    const takenAt =
      inserted?.created_at instanceof Date
        ? inserted.created_at.toISOString()
        : String(inserted?.created_at ?? new Date().toISOString());

    return NextResponse.json({
      assignment_id: inserted?.id,
      user_id,
      full_name: profile.full_name ?? "—",
      taken_at: takenAt,
      status: inserted?.status ?? "confirmed",
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Не удалось назначить";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Укажите id назначения" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: existing, error: fetchErr } = await admin
      .from("shift_assignments")
      .select("id")
      .eq("id", id)
      .single();
    if (fetchErr || !existing) {
      return NextResponse.json({ error: "Назначение не найдено" }, { status: 404 });
    }

    const { error: delErr } = await admin.from("shift_assignments").delete().eq("id", id);
    if (delErr) throw delErr;

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Не удалось снять назначение";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}