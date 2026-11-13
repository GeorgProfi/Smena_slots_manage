import type { SessionOptions } from "iron-session";

export const SESSION_COOKIE = "volunty_session";

export type AppSession = {
  userId?: string;
  email?: string;
  role?: string;
};

function cookieSecure(): boolean {
  if (process.env.COOKIE_SECURE === "false") return false;
  if (process.env.COOKIE_SECURE === "true") return true;
  // За nginx с HTTPS — куки Secure; для локального docker без SSL: COOKIE_SECURE=false
  return process.env.NODE_ENV === "production";
}

export function getSessionOptions(): SessionOptions {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters");
  }
  return {
    password,
    cookieName: SESSION_COOKIE,
    cookieOptions: {
      secure: cookieSecure(),
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    },
  };
}
