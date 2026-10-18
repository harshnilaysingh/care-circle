import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await db().query(`SELECT EXISTS (
      SELECT 1 FROM schema_migrations WHERE name='0002_billing_reversals.sql'
    ) AS ready`);
    if (!result.rows[0]?.ready) {
      return Response.json({ status: "not_ready" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(JSON.stringify({ level: "error", event: "health_check_failed", code: error instanceof Error ? error.message : "UNKNOWN" }));
    return Response.json({ status: "not_ready" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

