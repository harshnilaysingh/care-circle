import { z } from "zod";
import { apiFailure } from "@/lib/errors";
import { db, inTransaction } from "@/lib/db";
import { currentUser, encrypt, hashEmail, hashInvite, jsonError, limitRequest, writeAudit } from "@/lib/security";
import { evaluateFamilyJoin } from "@/lib/family-join-policy.mjs";

export const runtime = "nodejs";
const joinSchema = z.object({ code: z.string().trim().min(20).max(200) }).strict();

export async function POST(request: Request) {
  try {
    if (!(await limitRequest(request, "family:join", 8))) return jsonError("Too many join attempts. Try again shortly.", 429);
    const user = await currentUser();
    if (!user) return jsonError("Sign in with a verified email to use this invite.", 401);
    const parsed = joinSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("Enter a valid invite code.", 400);
    const result = await inTransaction(async (client) => {
      const invite = (await client.query("SELECT * FROM family_invites WHERE code_hash=$1 FOR UPDATE", [hashInvite(parsed.data.code)])).rows[0];
      if (!invite) throw new Error("INVITE_INVALID");
      const family = (await client.query("SELECT * FROM families WHERE id=$1 FOR UPDATE", [invite.family_id])).rows[0];
      const membership = (await client.query("SELECT family_id,status,role FROM family_members WHERE user_id=$1 FOR UPDATE", [user.id])).rows[0];
      const count = family ? Number((await client.query("SELECT count(*)::int AS count FROM family_members WHERE family_id=$1 AND status='active'", [family.id])).rows[0].count) : 0;
      const decision = evaluateFamilyJoin({
        inviteExists: true,
        inviteStatus: invite.status,
        redeemedBy: invite.redeemed_by,
        userId: user.id,
        expiresAt: invite.expires_at,
        inviteeEmailHash: invite.invitee_email_hash,
        userEmailHash: hashEmail(user.email),
        familyStatus: family?.status,
        subscriptionStatus: family?.subscription_status,
        inviteFamilyId: invite.family_id,
        memberFamilyId: membership?.family_id,
        memberStatus: membership?.status,
        usedSeats: count,
        seatLimit: Number(family?.seat_limit ?? 0),
      });
      if (!decision.ok) throw new Error(decision.reason);
      if (decision.alreadyJoined) {
        await client.query(`UPDATE family_invites SET status='accepted',redeemed_by=$2,redeemed_at=now(),invitee_email_hash=NULL,invite_profile_ciphertext=''
          WHERE id=$1`, [invite.id, user.id]);
        return { familyId: invite.family_id, alreadyJoined: true };
      }
      if (membership) {
        await client.query("UPDATE family_members SET status='active',removed_at=NULL,added_at=now() WHERE user_id=$1 AND family_id=$2", [user.id, family.id]);
      } else {
        await client.query("INSERT INTO family_members(user_id,family_id,role,status) VALUES($1,$2,'member','active')", [user.id, family.id]);
      }
      await client.query(`INSERT INTO user_profiles(user_id,profile_ciphertext) VALUES($1,$2) ON CONFLICT(user_id) DO NOTHING`, [user.id, invite.invite_profile_ciphertext]);
      await client.query(`UPDATE family_invites SET status='accepted',redeemed_by=$2,redeemed_at=now(),invitee_email_hash=NULL,invite_profile_ciphertext=''
        WHERE id=$1`, [invite.id, user.id]);
      await writeAudit(client, family.id, user.id, "member.joined", "family_member", user.id);
      return { familyId: family.id, alreadyJoined: false };
    });
    return Response.json({ ok: true, ...result, redirectTo: "/workspace" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") return jsonError("This account already belongs to a family workspace.", 409);
    if (error instanceof Error) {
      if (error.message === "INVITE_INVALID") return jsonError("This invite is invalid, expired, or already used.", 404);
      if (error.message === "INVITE_EMAIL_MISMATCH") return jsonError("Sign in with the email address this invitation was sent to.", 403);
      if (error.message === "FAMILY_INACTIVE") return jsonError("The family subscription is not active.", 403);
      if (error.message === "USER_ALREADY_IN_FAMILY") return jsonError("This account already belongs to another family.", 409);
      if (error.message === "NO_SEATS") return jsonError("All seats are currently in use. Ask the owner to add a seat.", 409);
    }
    return apiFailure(error);
  }
}

