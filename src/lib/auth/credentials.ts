import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { query } from "@/lib/db/pool";
import { validatePassword } from "@/lib/auth/password";

const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string, skipValidation = false): Promise<string> {
  if (!skipValidation) {
    const err = validatePassword(password);
    if (err) {
      throw new Error(err);
    }
  }
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export async function findUserByEmail(email: string) {
  const { rows } = await query<{
    id: string;
    email: string;
    password_hash: string;
  }>("SELECT id, email, password_hash FROM auth_users WHERE lower(email) = lower($1) LIMIT 1", [
    email.trim(),
  ]);
  return rows[0] ?? null;
}

export async function createAuthUserWithProfile(input: {
  email: string;
  password: string;
  fullName?: string;
  skipPasswordValidation?: boolean;
  emailVerified?: boolean;
}) {
  if (!input.skipPasswordValidation) {
    const err = validatePassword(input.password);
    if (err) throw new Error(err);
  }
  const passwordHash = await hashPassword(input.password, input.skipPasswordValidation);
  const emailVerified = input.emailVerified !== false;
  const { rows } = await query<{ id: string }>(
    `WITH nu AS (
      INSERT INTO auth_users (email, password_hash, email_verified_at)
      VALUES (lower($1), $2, ${emailVerified ? "now()" : "NULL"})
      RETURNING id
    )
    INSERT INTO profiles (id, full_name, calendar_token)
    SELECT nu.id, $3, encode(gen_random_bytes(16), 'hex') FROM nu
    RETURNING id`,
    [input.email.trim(), passwordHash, input.fullName ?? null]
  );
  return rows[0]?.id ?? null;
}

export function generateResetToken(): string {
  return randomBytes(32).toString("hex");
}
