import { z } from "zod";
import { apiFailure } from "@/lib/errors";
import { db, inTransaction } from "@/lib/db";
import { currentUser, encrypt, hashEmail, hashInvite, jsonError, newInviteCode, requireActiveFamily, secureId, writeAudit, lockActiveFamily } from "@/lib/security";

export const runtime = "nodejs";
const inviteSchema = z.object({ name: z.string().trim().min(2).max(100), email: z.string().trim().email().max(254), age: z.number().int().min(13).max(120), relation: z.string().trim().min(2).max(80) }).strict();

export async function POST(request: Request) {
  try {
    const access = await requireActiveFamily(request, 10);
    if ("response" in access) return access.response;
    if (access.family.ownerId !== access.user.id) return jsonError("Only the family owner can create invitations.", 403);
    const appUrl = process.env.APP_URL;
    if (!appUrl) throw new Error("APP_URL_NOT_CONFIGURED");
    const parsed = inviteSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("Check the invitation details and try again.", 400);
    const email = parsed.data.email.toLowerCase();
    const code = newInviteCode();
    const id = secureId();
    const row = await inTransaction(async (client) => {
      await lockActiveFamily(client, access.family.id);
      await client.query(`UPDATE family_invites SET status='expired',invitee_email_hash=NULL,invite_profile_ciphertext=''
        WHERE family_id=$1 AND status='pending' AND expires_at<=now()`, [access.family.id]);
      const pending = await client.query("SELECT count(*)::int AS count FROM family_invites WHERE family_id=$1 AND status='pending' AND expires_at>now()", [access.family.id]);
      if (Number(pending.rows[0].count) >= 20) throw new Error("TOO_MANY_INVITES");
      const result = await client.query(`INSERT INTO family_invites(id,family_id,invited_by,invitee_email_hash,invite_profile_ciphertext,code_hash,expires_at)
        VALUES($1,$2,$3,$4,$5,$6,now()+interval '7 days') RETURNING expires_at`,
        [id, access.family.id, access.user.id, hashEmail(email), encrypt(JSON.stringify({ ...parsed.data, email })), hashInvite(code)]);
      await writeAudit(client, access.family.id, access.user.id, "invite.created", "invite", id);
      return result.rows[0];
    });
    return Response.json({ id, code, url: `${appUrl}/?invite=${encodeURIComponent(code)}#join`, expiresAt: row.expires_at }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "TOO_MANY_INVITES") return jsonError("This family has reached the limit of 20 pending invitations.", 409);
    if (error instanceof Error && error.message === "FAMILY_INACTIVE") return jsonError("This family subscription is inactive.", 403);
    return apiFailure(error);
  }
}
