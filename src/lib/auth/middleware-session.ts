import { getIronSession } from "iron-session";
import { NextRequest, NextResponse } from "next/server";
import { getSessionOptions, type AppSession } from "@/lib/auth/session-options";

const protectedRoutes = ["/admin", "/volunteer"];
const authRoutes = ["/login", "/signup", "/forgot-password", "/reset-password"];

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } });
  const session = await getIronSession<AppSession>(request, response, getSessionOptions());

  const userId = session.userId;
  const pathname = request.nextUrl.pathname;

  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isProtectedRoute && !userId) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if ((pathname === "/admin" || pathname.startsWith("/admin/")) && userId) {
    if (!session.role || !["admin", "super_admin"].includes(session.role)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  const isAuthRoute = authRoutes.some((route) => pathname === route);
  if (isAuthRoute && userId) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}
