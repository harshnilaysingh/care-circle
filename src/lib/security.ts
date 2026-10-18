import { createHash, createHmac, randomBytes, randomUUID, createCipheriv, createDecipheriv } from "node:crypto";
import { headers } from "next/headers";
import type { PoolClient } from "pg";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export type SessionUser = { id: string; name: string; email: string };
export type FamilyAccess = { id: string; name: string; ownerId: string; role: "owner" | "member"; seats: number; usedSeats: number; status: "active" };

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export function secureId() { return randomUUID(); }
export function newInviteCode() { return randomBytes(24).toString("base64url"); }
export function hashInvite(code: string) { return createHash("sha256").update(code.trim()).digest("hex"); }
export function hashEmail(email: string) { return createHash("sha256").update(email.trim().toLowerCase()).digest("hex"); }

function encryptionKey() {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_NOT_CONFIGURED");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("INVALID_ENCRYPTION_KEY");
  return key;
}

export function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((part) => part.toString("base64url")).join(".");
}

export function decrypt(value: string | null | undefined) {
  if (!value) return null;
  const [iv, tag, body] = value.split(".").map((part) => Buffer.from(part, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}

export async function limitRequest(request: Request, route: string, max = 60) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("AUTH_NOT_CONFIGURED");
  const ip = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const bucket = createHmac("sha256", secret).update(`${route}:${ip}`).digest("hex");
  const result = await db().query(
    `INSERT INTO api_rate_limits(bucket_hash, window_start, request_count) VALUES ($1, now(), 1)
     ON CONFLICT(bucket_hash) DO UPDATE SET
       request_count = CASE WHEN api_rate_limits.window_start < now() - interval '1 minute' THEN 1 ELSE api_rate_limits.request_count + 1 END,
       window_start = CASE WHEN api_rate_limits.window_start < now() - interval '1 minute' THEN now() ELSE api_rate_limits.window_start END
     RETURNING request_count`, [bucket]);
  return Number(result.rows[0].request_count) <= max;
}

export async function currentUser(): Promise<SessionUser | null> {
  const session = await auth().api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  return { id: session.user.id, name: session.user.name, email: session.user.email };
}

export async function activeFamily(userId: string): Promise<FamilyAccess | null> {
  const result = await db().query(
    `SELECT f.id, f.display_name, f.owner_id, f.seat_limit, f.status, m.role,
            (SELECT count(*)::int FROM family_members active WHERE active.family_id=f.id AND active.status='active') AS used_seats
       FROM family_members m JOIN families f ON f.id=m.family_id
      WHERE m.user_id=$1 AND m.status='active' AND f.status='active'
        AND f.subscription_status IN ('ACTIVE','APPROVED') LIMIT 1`, [userId]);
  const row = result.rows[0];
  if (!row) return null;
  return { id: row.id, name: row.display_name, ownerId: row.owner_id, role: row.role, seats: row.seat_limit, usedSeats: Number(row.used_seats), status: row.status };
}

export async function lockActiveFamily(client: PoolClient, familyId: string) {
  const result = await client.query(`SELECT id FROM families WHERE id=$1 AND status='active'
    AND subscription_status IN ('ACTIVE','APPROVED') FOR UPDATE`, [familyId]);
  if (!result.rowCount) throw new Error("FAMILY_INACTIVE");
}

export async function requireActiveFamily(request: Request, maxRequests = 120) {
  if (!(await limitRequest(request, new URL(request.url).pathname, maxRequests))) return { response: jsonError("Too many requests. Please try again shortly.", 429) } as const;
  const user = await currentUser();
  if (!user) return { response: jsonError("Sign in to continue.", 401) } as const;
  const family = await activeFamily(user.id);
  if (!family) return { response: jsonError("An active family subscription is required.", 403) } as const;
  return { user, family } as const;
}

export async function writeAudit(client: PoolClient, familyId: string, actorId: string | null, action: string, entityType: string, entityId?: string) {
  await client.query("INSERT INTO audit_events(id,family_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,$3,$4,$5,$6)", [secureId(), familyId, actorId, action, entityType, entityId ?? null]);
}
