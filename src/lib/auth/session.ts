import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { getSessionOptions, type AppSession } from "@/lib/auth/session-options";

export type SessionUser = {
  id: string;
  email: string;
  role?: string;
};

export async function getSession() {
  return getIronSession<AppSession>(cookies(), getSessionOptions());
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session.userId || !session.email) {
    return null;
  }
  return { id: session.userId, email: session.email, role: session.role };
}

export async function setSessionUser(user: SessionUser) {
  const session = await getSession();
  session.userId = user.id;
  session.email = user.email;
  session.role = user.role;
  await session.save();
}

export async function destroySession() {
  const session = await getSession();
  session.destroy();
}

/** Supabase-compatible shape for gradual migration */
export async function getAuthUserForApi() {
  const user = await getSessionUser();
  if (!user) {
    return { data: { user: null }, error: null as { message: string } | null };
  }
  return {
    data: {
      user: {
        id: user.id,
        email: user.email,
        user_metadata: {},
      },
    },
    error: null as { message: string } | null,
  };
}
