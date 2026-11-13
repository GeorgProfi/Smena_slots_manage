import { from } from "@/lib/db/query";
import { query } from "@/lib/db/pool";
import {
  createAuthUserWithProfile,
  generateResetToken,
  hashPassword,
} from "@/lib/auth/credentials";

export function createAdminClient() {
  return {
    from,
    auth: {
      admin: {
        async listUsers() {
          const { rows } = await query<{ id: string; email: string }>(
            "SELECT id, email FROM auth_users ORDER BY created_at ASC"
          );
          return { data: { users: rows }, error: null };
        },
        async deleteUser(userId: string) {
          const { rowCount } = await query("DELETE FROM auth_users WHERE id = $1", [userId]);
          if (rowCount === 0) {
            return { data: null, error: { message: "User not found" } };
          }
          return { data: { user: { id: userId } }, error: null };
        },
        async createUser(options: {
          email: string;
          password: string;
          email_confirm?: boolean;
          user_metadata?: { full_name?: string };
        }) {
          try {
            const id = await createAuthUserWithProfile({
              email: options.email,
              password: options.password,
              fullName: options.user_metadata?.full_name,
            });
            if (!id) {
              return { data: { user: null }, error: { message: "Failed to create user" } };
            }
            const verified = options.email_confirm !== false;
            const { rows } = await query<{
              id: string;
              email: string;
              email_verified_at: string | null;
            }>(
              verified
                ? "UPDATE auth_users SET email_verified_at = now() WHERE id = $1 RETURNING id, email, email_verified_at"
                : "SELECT id, email, email_verified_at FROM auth_users WHERE id = $1",
              [id]
            );
            const user = rows[0];
            return {
              data: {
                user: user
                  ? {
                      id: user.id,
                      email: user.email,
                      email_confirmed_at: user.email_verified_at,
                    }
                  : null,
              },
              error: null,
            };
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Create user failed";
            const status = msg.includes("duplicate") || msg.includes("unique") ? 422 : 400;
            return { data: { user: null }, error: { message: msg, status } };
          }
        },
        async inviteUserByEmail(
          email: string,
          options?: { redirectTo?: string; data?: { full_name?: string } }
        ) {
          void options?.redirectTo;
          try {
            const tempPassword = generateResetToken();
            const id = await createAuthUserWithProfile({
              email,
              password: tempPassword,
              fullName: options?.data?.full_name,
              skipPasswordValidation: true,
            });
            if (!id) {
              return { data: { user: null }, error: { message: "Invite failed" } };
            }
            const token = generateResetToken();
            await query(
              `UPDATE auth_users SET reset_token = $1, reset_token_expires_at = now() + interval '7 days' WHERE id = $2`,
              [token, id]
            );
            if (process.env.NODE_ENV !== "production") {
              console.info(`[invite] Set password: /reset-password?token=${token}`);
            }
            return { data: { user: { id } }, error: null };
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Invite failed";
            return { data: { user: null }, error: { message: msg } };
          }
        },
      },
    },
  };
}

export async function setUserPassword(userId: string, password: string) {
  const passwordHash = await hashPassword(password);
  await query(
    "UPDATE auth_users SET password_hash = $1, reset_token = NULL, reset_token_expires_at = NULL, updated_at = now() WHERE id = $2",
    [passwordHash, userId]
  );
}
