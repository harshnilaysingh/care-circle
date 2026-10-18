import { z } from "zod";
import { activateSubscription } from "@/lib/billing";
import { apiFailure } from "@/lib/errors";
import { db, inTransaction } from "@/lib/db";
import { showSubscription } from "@/lib/paypal";
import { currentUser, jsonError, limitRequest } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    if (!(await limitRequest(request, "billing:confirm", 10))) return jsonError("Too many confirmation attempts.", 429);
    const user = await currentUser();
    if (!user) return jsonError("Sign in to continue.", 401);
    const subscriptionId = z.string().min(5).max(80).safeParse(new URL(request.url).searchParams.get("subscription_id"));
    if (!subscriptionId.success) return jsonError("Invalid subscription reference.", 400);
    const intent = (await db().query("SELECT * FROM billing_intents WHERE owner_id=$1 AND paypal_subscription_id=$2", [user.id, subscriptionId.data])).rows[0];
    if (!intent) return jsonError("We could not find this checkout for your account.", 404);
    const provider = await showSubscription(subscriptionId.data);
    if (provider.status !== "ACTIVE" || provider.custom_id !== intent.id) return jsonError("PayPal approval is still pending.", 409);
    const familyId = await inTransaction((client) => activateSubscription(client, subscriptionId.data, intent.id, provider));
    if (!familyId) return jsonError("We could not activate this family. Contact support.", 409);
    return Response.json({ ok: true, familyId, redirectTo: "/workspace" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiFailure(error); }
}
