import { apiFailure } from "@/lib/errors";
import { inTransaction } from "@/lib/db";
import { jsonError, requireActiveFamily, writeAudit, lockActiveFamily } from "@/lib/security";

export const runtime = "nodejs";

export async function DELETE(request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const access = await requireActiveFamily(request, 20);
    if ("response" in access) return access.response;
    if (access.family.ownerId !== access.user.id) return jsonError("Only the family owner can remove a member.", 403);
    const { userId } = await context.params;
    if (userId === access.family.ownerId) return jsonError("The owner cannot be removed from the family.", 400);
    const count = await inTransaction(async (client) => {
      await lockActiveFamily(client, access.family.id);
      const result = await client.query(`UPDATE family_members SET status='removed',removed_at=now()
        WHERE user_id=$1 AND family_id=$2 AND status='active' AND role<>'owner' RETURNING user_id`, [userId, access.family.id]);
      if (result.rowCount) await writeAudit(client, access.family.id, access.user.id, "member.removed", "family_member", userId);
      return result.rowCount;
    });
    if (!count) return jsonError("That family member was not found.", 404);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiFailure(error); }
}
