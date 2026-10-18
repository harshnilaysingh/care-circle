import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const folder = join(root, "migrations");
const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10000 });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const names = (await readdir(folder)).filter((name) => name.endsWith(".sql")).sort();
  for (const name of names) {
    const exists = await client.query("SELECT 1 FROM schema_migrations WHERE name = $1", [name]);
    if (exists.rowCount) continue;
    const sql = await readFile(join(folder, name), "utf8");
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations(name) VALUES ($1)", [name]);
    console.log("Applied migration:", name);
  }
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
