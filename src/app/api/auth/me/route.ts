import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/db/admin";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: profile, error: profErr } = await admin
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", user.id)
      .single();

    if (profErr || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: profile.full_name as string,
        role: (profile.role as string) ?? user.role,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to get user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
