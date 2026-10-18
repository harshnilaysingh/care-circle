import { apiFailure } from "@/lib/errors";
import { db, inTransaction } from "@/lib/db";
import { jsonError, requireActiveFamily, writeAudit, lockActiveFamily } from "@/lib/security";

export const runtime = "nodejs";

export async function DELETE(request: Request, context: { params: Promise<{ inviteId: string }> }) {
  try {
    const access = await requireActiveFamily(request, 20);
    if ("response" in access) return access.response;
    if (access.family.ownerId !== access.user.id) return jsonError("Only the family owner can cancel invitations.", 403);
    const { inviteId } = await context.params;
    const updated = await inTransaction(async (client) => {
      await lockActiveFamily(client, access.family.id);
      const result = await client.query(`UPDATE family_invites SET status='cancelled',invitee_email_hash=NULL,invite_profile_ciphertext=''
        WHERE id=$1 AND family_id=$2 AND status='pending' RETURNING id`, [inviteId, access.family.id]);
      if (result.rowCount) await writeAudit(client, access.family.id, access.user.id, "invite.cancelled", "invite", inviteId);
      return result.rowCount;
    });
    if (!updated) return jsonError("That invitation is no longer pending.", 404);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiFailure(error); }
}
