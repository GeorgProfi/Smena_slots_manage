import { destroySession } from "@/lib/auth/session";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  await destroySession();
  return NextResponse.redirect(new URL("/login", request.url));
}

export async function GET(request: Request) {
  await destroySession();
  return NextResponse.redirect(new URL("/login", request.url));
}
