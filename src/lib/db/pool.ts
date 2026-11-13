import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __voluntyPgPool: Pool | undefined;
}

function getConnectionString(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const user = process.env.POSTGRES_USER ?? "volunty";
  const password = process.env.POSTGRES_PASSWORD ?? "volunty";
  const host = process.env.POSTGRES_HOST ?? "localhost";
  const port = process.env.POSTGRES_PORT ?? "5432";
  const database = process.env.POSTGRES_DB ?? "volunty";
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

export function getPool(): Pool {
  if (!global.__voluntyPgPool) {
    global.__voluntyPgPool = new Pool({
      connectionString: getConnectionString(),
      max: 10,
    });
  }
  return global.__voluntyPgPool;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<{ rows: T[]; rowCount: number }> {
  const pool = getPool();
  const result = await pool.query(text, params);
  return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
}
