import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { query } from "@/lib/db/pool";

function adminClient() {
  return createAdminClient();
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const admin = adminClient();

    // Fetch organization timezone from settings
    const { data: settings } = await admin
      .from("organization_settings")
      .select("value")
      .eq("key", "timezone")
      .single();
    const timezone = (settings?.value as string) || "Europe/Brussels";

    // Lookup user by calendar token
    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("id,full_name")
      .eq("calendar_token", token)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Fetch user's assignments with event details
    const { rows: assignments } = await query<{
      id: string;
      role_name: string;
      sub_start: string;
      sub_end: string;
      event_title: string;
      event_start: string;
      event_end: string;
      event_location: string | null;
    }>(
      `SELECT sa.id, ss.role_name,
        ss.start_time AS sub_start, ss.end_time AS sub_end,
        e.title AS event_title, e.start_time AS event_start, e.end_time AS event_end, e.location AS event_location
       FROM shift_assignments sa
       JOIN sub_shifts ss ON ss.id = sa.sub_shift_id
       JOIN events e ON e.id = ss.event_id
       WHERE sa.user_id = $1 AND sa.status = 'confirmed'
       ORDER BY sa.created_at DESC`,
      [profile.id as string]
    );

    // Build iCalendar format (RFC 5545)
    const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const events: string[] = [];

    // Emit stored UTC instant directly as UTC to avoid double offsets
    const formatUTC = (dateStr: string) => {
      if (!dateStr) return "";
      const d = new Date(dateStr);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
    };

    assignments.forEach((row) => {
      const startTime = formatUTC(row.sub_start || row.event_start || "");
      const endTime = formatUTC(row.sub_end || row.event_end || "");

      if (!startTime || !endTime) return;

      const uid = `shift-${row.id}@volunty.local`;
      const title = `${row.event_title} - ${row.role_name}`;
      const description = `Role: ${row.role_name}${row.event_location ? `\nLocation: ${row.event_location}` : ""}`;
      const location = row.event_location || "";

      events.push(`BEGIN:VEVENT
UID:${uid}
DTSTAMP:${now}
DTSTART:${startTime}
DTEND:${endTime}
SUMMARY:${escapeCalendarText(title)}
DESCRIPTION:${escapeCalendarText(description)}
LOCATION:${escapeCalendarText(location)}
STATUS:CONFIRMED
END:VEVENT`);
    });

    const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//VolunTy//Calendar Feed//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:${escapeCalendarText(`${profile.full_name || "Volunteer"} Shifts`)}
X-WR-TIMEZONE:UTC
${events.join("\n")}
END:VCALENDAR`;

    return new NextResponse(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${profile.full_name || "shifts"}.ics"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Failed to generate calendar" }, { status: 500 });
  }
}

function escapeCalendarText(text: string): string {
  if (!text) return "";
  return text
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/\n/g, "\\n")
    .substring(0, 1000); // Limit length
}
