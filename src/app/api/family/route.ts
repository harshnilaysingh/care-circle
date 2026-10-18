import { apiFailure } from "@/lib/errors";
import { db } from "@/lib/db";
import { decrypt, jsonError, requireActiveFamily } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const access = await requireActiveFamily(request, 30);
    if ("response" in access) return access.response;
    const { family, user } = access;
    const members = (await db().query(`SELECT m.user_id AS id,u.name,m.role,m.status,m.added_at
      FROM family_members m JOIN "user" u ON u.id=m.user_id WHERE m.family_id=$1 AND m.status='active' ORDER BY (m.role='owner') DESC,m.added_at`, [family.id])).rows;
    const pendingRows = family.role === "owner" ? (await db().query(`SELECT id,invitee_email_hash,invite_profile_ciphertext,expires_at,created_at
      FROM family_invites WHERE family_id=$1 AND status='pending' AND expires_at>now() ORDER BY created_at DESC`, [family.id])).rows : [];
    const invites = pendingRows.map((row) => {
      let profile: Record<string, unknown> = {};
      try { profile = JSON.parse(decrypt(row.invite_profile_ciphertext) ?? "{}"); } catch { /* corrupted data is not returned */ }
      return { id: row.id, name: profile.name, email: profile.email, relation: profile.relation, expiresAt: row.expires_at };
    });
    return Response.json({ family, members, invites, isOwner: family.ownerId === user.id }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiFailure(error); }
}
