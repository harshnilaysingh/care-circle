import { z } from "zod";
import { activateSubscription } from "@/lib/billing";
import { apiFailure } from "@/lib/errors";
import { db, inTransaction } from "@/lib/db";
import { verifyWebhook } from "@/lib/paypal";
import { jsonError, writeAudit } from "@/lib/security";
import { classifyPayPalEvent, getPayPalEventIds } from "@/lib/paypal-webhook-policy.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const eventSchema = z.object({ id: z.string().min(1), event_type: z.string().min(1), resource: z.record(z.string(), z.unknown()).default({}) }).passthrough();

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (raw.length > 1_000_000) return jsonError("Webhook payload is too large.", 413);
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return jsonError("Invalid webhook payload.", 400); }
    const safe = eventSchema.safeParse(parsed);
    if (!safe.success) return jsonError("Invalid webhook event.", 400);
    const event = safe.data;
    if (!(await verifyWebhook(event, request))) return jsonError("Webhook signature could not be verified.", 400);
    await inTransaction(async (client) => {
      const inserted = await client.query(`INSERT INTO webhook_events(event_id,event_type,resource_id,payload_digest)
        VALUES($1,$2,$3,$4) ON CONFLICT(event_id) DO NOTHING RETURNING event_id`,
        [event.id, event.event_type, typeof event.resource.id === "string" ? event.resource.id : null, await digest(raw)]);
      if (!inserted.rowCount) return;
      const resource = event.resource;
      const impact = classifyPayPalEvent(event.event_type);
      const { subscriptionId, paymentId } = getPayPalEventIds(event.event_type, resource);
      if (impact === "subscription-active" && subscriptionId) {
        const familyId = await activateSubscription(client, subscriptionId, stringValue(resource.custom_id), resource);
        if (familyId) {
          const qty = Number(resource.quantity);
          if (Number.isInteger(qty) && qty >= 5 && qty <= 100) {
            const requestRow = (await client.query("SELECT id FROM seat_change_requests WHERE family_id=$1 AND requested_limit=$2 AND status='pending' FOR UPDATE", [familyId, qty])).rows[0];
            if (requestRow) {
              await client.query("UPDATE families SET seat_limit=$2,updated_at=now() WHERE id=$1", [familyId, qty]);
              await client.query("UPDATE seat_change_requests SET status='approved',updated_at=now() WHERE id=$1", [requestRow.id]);
              await writeAudit(client, familyId, null, "seats.updated", "family", familyId);
            }
          }
        }
      } else if (impact === "subscription-inactive" && subscriptionId) {
        const family = (await client.query("UPDATE families SET status='inactive',subscription_status=$2,updated_at=now() WHERE paypal_subscription_id=$1 RETURNING id,owner_id", [subscriptionId, event.event_type.split(".").at(-1)])).rows[0];
        if (family) await writeAudit(client, family.id, family.owner_id, "subscription.inactive", "family", family.id);
      } else if (impact === "payment" && subscriptionId) {
        const family = (await client.query("SELECT id FROM families WHERE paypal_subscription_id=$1 FOR UPDATE", [subscriptionId])).rows[0];
        if (family && typeof resource.id === "string") await client.query(`INSERT INTO billing_transactions(provider_resource_id,family_id,subscription_id,kind,status)
          VALUES($1,$2,$3,'payment',$4) ON CONFLICT(provider_resource_id) DO NOTHING`, [resource.id, family.id, subscriptionId, String(resource.status ?? "COMPLETED")]);
      } else if (impact === "refund" || impact === "reversal") {
        const transactionId = paymentId ?? stringValue(resource.capture_id) ?? event.id;
        const family = (await client.query(`SELECT id,owner_id,paypal_subscription_id FROM families WHERE paypal_subscription_id=$1 OR id=(SELECT family_id FROM billing_transactions WHERE provider_resource_id=$2 LIMIT 1) FOR UPDATE`, [subscriptionId ?? "", transactionId])).rows[0];
        if (family) {
          const kind = impact === "reversal" ? "reversal" : "refund";
          const status = impact === "reversal" ? "REVERSED" : "REFUNDED";
          await client.query(`INSERT INTO billing_transactions(provider_resource_id,family_id,subscription_id,kind,status)
            VALUES($1,$2,$3,$4,$5) ON CONFLICT(provider_resource_id) DO UPDATE SET kind=EXCLUDED.kind,status=EXCLUDED.status`,
            [transactionId, family.id, family.paypal_subscription_id, kind, status]);
          await client.query("UPDATE families SET status='inactive',subscription_status=$2,updated_at=now() WHERE id=$1", [family.id, status]);
          await writeAudit(client, family.id, family.owner_id, impact === "reversal" ? "subscription.reversed" : "subscription.refunded", "family", family.id);
        }
      }
      await client.query("UPDATE webhook_events SET processed_at=now() WHERE event_id=$1", [event.id]);
    });
    return Response.json({ received: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiFailure(error); }
}

function stringValue(value: unknown) { return typeof value === "string" && value.length ? value : null; }
async function digest(value: string) {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(value).digest("hex");
}

