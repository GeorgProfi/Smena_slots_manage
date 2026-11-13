import { NextResponse } from "next/server";

/** Legacy OAuth callback — redirects to login (Postgres auth has no OAuth). */
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/login`);
}
