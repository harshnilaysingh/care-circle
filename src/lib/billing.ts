import type { PoolClient } from "pg";
import { secureId, writeAudit } from "@/lib/security";

export async function activateSubscription(client: PoolClient, subscriptionId: string, intentId: string | null, provider: Record<string, unknown>) {
  if (provider.status !== "ACTIVE") return null;
  const intentResult = await client.query(
    `SELECT * FROM billing_intents WHERE paypal_subscription_id=$1 OR ($2::text IS NOT NULL AND id=$2) FOR UPDATE`,
    [subscriptionId, intentId]);
  const intent = intentResult.rows[0];
  if (!intent) {
    const existing = await client.query("SELECT id FROM families WHERE paypal_subscription_id=$1 FOR UPDATE", [subscriptionId]);
    return existing.rows[0]?.id ?? null;
  }
  if (intent.paypal_subscription_id && intent.paypal_subscription_id !== subscriptionId) return null;
  const quantity = Math.min(100, Math.max(5, Number(provider.quantity) || Number(intent.seat_limit) || 5));
  let family = (await client.query("SELECT * FROM families WHERE owner_id=$1 FOR UPDATE", [intent.owner_id])).rows[0];
  if (family?.paypal_subscription_id && family.paypal_subscription_id !== subscriptionId && family.status === "active") return null;
  if (!family) {
    const id = secureId();
    family = (await client.query(
      `INSERT INTO families(id,owner_id,display_name,seat_limit,status,paypal_subscription_id,paypal_plan_id,subscription_status)
       VALUES($1,$2,$3,$4,'active',$5,$6,'ACTIVE') RETURNING *`,
      [id, intent.owner_id, intent.family_name, quantity, subscriptionId, intent.paypal_plan_id])).rows[0];
    await client.query("INSERT INTO family_members(user_id,family_id,role,status) VALUES($1,$2,'owner','active')", [intent.owner_id, family.id]);
  } else {
    if (family.paypal_subscription_id === subscriptionId && ["REFUNDED", "CANCELLED", "EXPIRED"].includes(family.subscription_status)) return null;
    if (intent.status === "active" && family.paypal_subscription_id === subscriptionId && family.status === "active") return family.id as string;
    family = (await client.query(
      `UPDATE families SET display_name=$2,seat_limit=$3,status='active',paypal_subscription_id=$4,paypal_plan_id=$5,
          subscription_status='ACTIVE',updated_at=now() WHERE id=$1 RETURNING *`,
      [family.id, intent.family_name, quantity, subscriptionId, intent.paypal_plan_id])).rows[0];
    const membership = await client.query("SELECT family_id FROM family_members WHERE user_id=$1 FOR UPDATE", [intent.owner_id]);
    if (membership.rows[0] && membership.rows[0].family_id !== family.id) return null;
    await client.query(`INSERT INTO family_members(user_id,family_id,role,status) VALUES($1,$2,'owner','active')
      ON CONFLICT(user_id) DO UPDATE SET status='active',removed_at=NULL WHERE family_members.family_id=EXCLUDED.family_id`, [intent.owner_id, family.id]);
  }
  await client.query("UPDATE billing_intents SET status='active',family_id=$2,updated_at=now() WHERE id=$1", [intent.id, family.id]);
  if (intent.trial_requested) await client.query("UPDATE user_profiles SET trial_used_at=COALESCE(trial_used_at,now()) WHERE user_id=$1", [intent.owner_id]);
  await writeAudit(client, family.id, intent.owner_id, "subscription.activated", "family", family.id);
  return family.id as string;
}
