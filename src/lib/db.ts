import { Pool, type PoolClient } from "pg";

declare global {
  // Reuse one small pool across hot reloads and warm serverless invocations.
  var careCirclePool: Pool | undefined;
}

export function db(): Pool {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_NOT_CONFIGURED");
  if (!globalThis.careCirclePool) {
    globalThis.careCirclePool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      allowExitOnIdle: true,
    });
  }
  return globalThis.careCirclePool;
}

export async function inTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
