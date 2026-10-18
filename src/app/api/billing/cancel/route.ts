import { apiFailure } from "@/lib/errors";
import { db, inTransaction } from "@/lib/db";
import { cancelSubscription } from "@/lib/paypal";
import { currentUser, jsonError, limitRequest, writeAudit } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!(await limitRequest(request, "billing:cancel", 3))) return jsonError("Too many cancellation attempts.", 429);
    const user = await currentUser();
    if (!user) return jsonError("Sign in to continue.", 401);
    const family = (await db().query(`SELECT id,owner_id,paypal_subscription_id FROM families
      WHERE owner_id=$1 AND status='active'`, [user.id])).rows[0];
    if (!family) return jsonError("Active family owner access is required.", 403);
    if (!family.paypal_subscription_id) return jsonError("No PayPal subscription is connected to this family.", 503);

    await cancelSubscription(family.paypal_subscription_id);
    await inTransaction(async (client) => {
      const locked = (await client.query("SELECT id,owner_id,paypal_subscription_id,status FROM families WHERE id=$1 FOR UPDATE", [family.id])).rows[0];
      if (!locked || locked.owner_id !== user.id || locked.paypal_subscription_id !== family.paypal_subscription_id) throw new Error("BILLING_STATE_CHANGED");
      if (locked.status === "active") {
        await client.query("UPDATE families SET status='inactive',subscription_status='CANCELLED',updated_at=now() WHERE id=$1", [family.id]);
        await writeAudit(client, family.id, user.id, "subscription.cancelled", "family", family.id);
      }
    });
    return Response.json({ ok: true, redirectTo: "/?access=required" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "BILLING_STATE_CHANGED") return jsonError("Billing changed while cancellation was processing. Refresh and contact support if access remains active.", 409);
    return apiFailure(error);
  }
}

