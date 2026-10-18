import { z } from "zod";
import { apiFailure } from "@/lib/errors";
import { db, inTransaction } from "@/lib/db";
import { createSubscription } from "@/lib/paypal";
import { currentUser, encrypt, jsonError, limitRequest, secureId } from "@/lib/security";

export const runtime = "nodejs";
const bodySchema = z.object({ familyName: z.string().trim().min(2).max(100), profile: z.object({ age: z.number().int().min(13).max(120), relation: z.string().trim().min(2).max(80), careFocus: z.array(z.enum(["parenting", "aging-parent"])).max(2) }).strict() }).strict();

export async function POST(request: Request) {
  try {
    if (!(await limitRequest(request, "billing:checkout", 5))) return jsonError("Too many checkout attempts. Try again shortly.", 429);
    const user = await currentUser();
    if (!user) return jsonError("Sign in with a verified email before checkout.", 401);
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("Check your family and profile details.", 400);
    const { familyName, profile } = parsed.data;
    const plan = await inTransaction(async (client) => {
      const membership = await client.query(`SELECT m.family_id,m.role,m.status,f.status AS family_status
        FROM family_members m JOIN families f ON f.id=m.family_id WHERE m.user_id=$1 FOR UPDATE`, [user.id]);
      if (membership.rowCount && !(membership.rows[0].role === "owner" && membership.rows[0].family_status !== "active")) throw new Error("USER_ALREADY_IN_FAMILY");
      const existingFamily = await client.query("SELECT id,seat_limit FROM families WHERE owner_id=$1 FOR UPDATE", [user.id]);
      const profileRow = await client.query("SELECT trial_used_at FROM user_profiles WHERE user_id=$1 FOR UPDATE", [user.id]);
      const trial = !profileRow.rows[0]?.trial_used_at && !existingFamily.rowCount;
      const previousSeats = Number(existingFamily.rows[0]?.seat_limit ?? 5);
      const seats = Math.max(5, Math.min(100, previousSeats));
      const planId = trial ? process.env.PAYPAL_TRIAL_PLAN_ID : process.env.PAYPAL_STANDARD_PLAN_ID;
      if (!planId) throw new Error("PAYPAL_PLAN_NOT_CONFIGURED");
      await client.query(`INSERT INTO user_profiles(user_id,profile_ciphertext) VALUES($1,$2)
        ON CONFLICT(user_id) DO UPDATE SET profile_ciphertext=EXCLUDED.profile_ciphertext,updated_at=now()`, [user.id, encrypt(JSON.stringify(profile))]);
      const pending = await client.query("SELECT id,paypal_subscription_id,approval_url FROM billing_intents WHERE owner_id=$1 AND status='pending' FOR UPDATE", [user.id]);
      if (pending.rows[0]?.paypal_subscription_id && pending.rows[0]?.approval_url) return { ...pending.rows[0], reuse: true };
      const id = pending.rows[0]?.id ?? secureId();
      if (!pending.rowCount) await client.query(
        `INSERT INTO billing_intents(id,owner_id,family_name,profile_ciphertext,paypal_plan_id,seat_limit,trial_requested)
         VALUES($1,$2,$3,$4,$5,$6,$7)`, [id, user.id, familyName, encrypt(JSON.stringify(profile)), planId, seats, trial]);
      else await client.query("UPDATE billing_intents SET family_name=$2,profile_ciphertext=$3,paypal_plan_id=$4,seat_limit=$5,trial_requested=$6,updated_at=now() WHERE id=$1", [id, familyName, encrypt(JSON.stringify(profile)), planId, seats, trial]);
      return { id, plan_id: planId, seat_limit: seats, reuse: false };
    });
    if (plan.reuse) return Response.json({ approvalUrl: plan.approval_url }, { headers: { "Cache-Control": "no-store" } });
    const subscription = await createSubscription(plan.id, plan.plan_id, plan.seat_limit);
    const subscriptionId = String(subscription.id ?? "");
    const approval = Array.isArray(subscription.links) ? (subscription.links as Array<{ rel?: string; href?: string }>).find((link) => link.rel === "approve")?.href : undefined;
    if (!subscriptionId || !approval) throw new Error("PAYPAL_APPROVAL_LINK_MISSING");
    await db().query("UPDATE billing_intents SET paypal_subscription_id=$2,approval_url=$3,updated_at=now() WHERE id=$1", [plan.id, subscriptionId, approval]);
    return Response.json({ approvalUrl: approval }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "USER_ALREADY_IN_FAMILY") return jsonError("This account already belongs to a family workspace.", 409);
    return apiFailure(error);
  }
}
