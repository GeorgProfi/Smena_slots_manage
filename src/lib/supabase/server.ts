import { createAdminClient } from "@/lib/db/admin";
import { destroySession, getAuthUserForApi, getSessionUser } from "@/lib/auth/session";

export function createClient() {
  return {
    auth: {
      getUser: getAuthUserForApi,
      getSession: async () => {
        const user = await getSessionUser();
        return {
          data: {
            session: user
              ? {
                  user: { id: user.id, email: user.email, user_metadata: {} },
                }
              : null,
          },
        };
      },
      signOut: destroySession,
      exchangeCodeForSession: async () => ({ error: { message: "OAuth is not available" } }),
    },
    from: (table: string) => createAdminClient().from(table),
  };
}
