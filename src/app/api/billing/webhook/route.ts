import { z } from "zod";
import { randomUUID } from "node:crypto";
import { activateSubscription } from "@/lib/billing";
import { apiFailure } from "@/lib/errors";
import { db, inTransaction } from "@/lib/db";
import { verifyWebhook } from "@/lib/paypal";
import { jsonError, writeAudit } from "@/lib/security";

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
      const subscriptionId = stringValue(resource.id) && event.event_type.startsWith("BILLING.SUBSCRIPTION.")
        ? stringValue(resource.id)
        : stringValue(resource.billing_agreement_id) ?? stringValue(resource.subscription_id);
      if (["BILLING.SUBSCRIPTION.ACTIVATED", "BILLING.SUBSCRIPTION.UPDATED"].includes(event.event_type) && subscriptionId) {
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
      } else if (["BILLING.SUBSCRIPTION.CANCELLED", "BILLING.SUBSCRIPTION.SUSPENDED", "BILLING.SUBSCRIPTION.EXPIRED", "BILLING.SUBSCRIPTION.PAYMENT.FAILED"].includes(event.event_type) && subscriptionId) {
        const family = (await client.query("UPDATE families SET status='inactive',subscription_status=$2,updated_at=now() WHERE paypal_subscription_id=$1 RETURNING id,owner_id", [subscriptionId, event.event_type.split(".").at(-1)])).rows[0];
        if (family) await writeAudit(client, family.id, family.owner_id, "subscription.inactive", "family", family.id);
      } else if (["BILLING.SUBSCRIPTION.PAYMENT.COMPLETED", "PAYMENT.SALE.COMPLETED", "PAYMENT.CAPTURE.COMPLETED"].includes(event.event_type) && subscriptionId) {
        const family = (await client.query("SELECT id FROM families WHERE paypal_subscription_id=$1 FOR UPDATE", [subscriptionId])).rows[0];
        if (family && typeof resource.id === "string") await client.query(`INSERT INTO billing_transactions(provider_resource_id,family_id,subscription_id,kind,status)
          VALUES($1,$2,$3,'payment',$4) ON CONFLICT(provider_resource_id) DO NOTHING`, [resource.id, family.id, subscriptionId, String(resource.status ?? "COMPLETED")]);
      } else if (["PAYMENT.CAPTURE.REFUNDED", "PAYMENT.SALE.REFUNDED"].includes(event.event_type)) {
        const related = resource.supplementary_data && typeof resource.supplementary_data === "object" ? (resource.supplementary_data as Record<string, unknown>).related_ids : undefined;
        const relatedIds = related && typeof related === "object" ? related as Record<string, unknown> : {};
        const captureId = stringValue(relatedIds.capture_id) ?? stringValue(resource.capture_id) ?? stringValue(resource.id);
        const subId = stringValue(resource.billing_agreement_id) ?? stringValue(resource.subscription_id);
        const family = (await client.query(`SELECT id,owner_id,paypal_subscription_id FROM families WHERE paypal_subscription_id=$1 OR id=(SELECT family_id FROM billing_transactions WHERE provider_resource_id=$2 LIMIT 1) FOR UPDATE`, [subId ?? "", captureId ?? ""])).rows[0];
        if (family) {
          if (captureId) await client.query(`INSERT INTO billing_transactions(provider_resource_id,family_id,subscription_id,kind,status)
            VALUES($1,$2,$3,'refund','REFUNDED') ON CONFLICT(provider_resource_id) DO NOTHING`, [String(resource.id ?? randomUUID()), family.id, family.paypal_subscription_id]);
          await client.query("UPDATE families SET status='inactive',subscription_status='REFUNDED',updated_at=now() WHERE id=$1", [family.id]);
          await writeAudit(client, family.id, family.owner_id, "subscription.refunded", "family", family.id);
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
