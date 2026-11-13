import type { SessionOptions } from "iron-session";

export const SESSION_COOKIE = "volunty_session";

export type AppSession = {
  userId?: string;
  email?: string;
  role?: string;
};

export function getSessionOptions(): SessionOptions {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters");
  }
  return {
    password,
    cookieName: SESSION_COOKIE,
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    },
  };
}
