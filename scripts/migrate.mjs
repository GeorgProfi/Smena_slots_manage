#!/usr/bin/env node
/**
 * Applies SQL files from docker/postgres/migrations in lexicographic order.
 * Tracks applied files in schema_migrations.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getDatabaseUrl() {
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

function getMigrationsDir() {
  return (
    process.env.MIGRATIONS_DIR ??
    path.join(__dirname, "..", "docker", "postgres", "migrations")
  );
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function appliedFilenames(client) {
  const res = await client.query("SELECT filename FROM schema_migrations ORDER BY filename");
  return new Set(res.rows.map((r) => r.filename));
}

async function applyMigration(client, filePath, filename) {
  const sql = fs.readFileSync(filePath, "utf8");
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  }
}

async function main() {
  const dir = getMigrationsDir();
  if (!fs.existsSync(dir)) {
    console.log(`No migrations directory at ${dir}, nothing to do.`);
    return;
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("No migration files found.");
    return;
  }

  const pool = new pg.Pool({ connectionString: getDatabaseUrl() });
  const client = await pool.connect();

  try {
    await ensureMigrationsTable(client);
    const applied = await appliedFilenames(client);

    let count = 0;
    for (const filename of files) {
      if (applied.has(filename)) {
        continue;
      }
      const filePath = path.join(dir, filename);
      console.log(`Applying ${filename}...`);
      await applyMigration(client, filePath, filename);
      count += 1;
      console.log(`Applied ${filename}.`);
    }

    if (count === 0) {
      console.log("Database schema is up to date.");
    } else {
      console.log(`Applied ${count} migration(s).`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});