import { randomUUID } from "node:crypto";
import { PAYPAL_SUBSCRIPTION_WEBHOOK_EVENTS } from "../src/lib/paypal-webhook-policy.mjs";

const mode = process.env.PAYPAL_MODE || "sandbox";
if (!new Set(["sandbox", "live"]).has(mode)) throw new Error("PAYPAL_MODE must be sandbox or live");
const id = process.env.PAYPAL_CLIENT_ID;
const secret = process.env.PAYPAL_CLIENT_SECRET;
const appUrl = process.env.APP_URL;
if (!id || !secret) throw new Error("Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in your local environment first.");
if (!appUrl) throw new Error("Set APP_URL to the deployed CareCircle URL first.");
const api = mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
const auth = Buffer.from(`${id}:${secret}`).toString("base64");
const tokenRes = await fetch(`${api}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
if (!tokenRes.ok) throw new Error(`PayPal token request failed (${tokenRes.status}).`);
const { access_token: token } = await tokenRes.json();
async function request(path, method, body) {
  const response = await fetch(`${api}${path}`, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": randomUUID() }, ...(method === "GET" ? {} : { body: JSON.stringify(body) }) });
  const result = await response.json();
  if (!response.ok) throw new Error(`${method} ${path} failed (${response.status}): ${JSON.stringify(result)}`);
  return result;
}
const product = await request("/v1/catalogs/products", "POST", {
  name: "CareCircle Family Plan", description: "Monthly access for a family care workspace", type: "SERVICE", category: "SOFTWARE",
});
const makePlan = async (trial) => request("/v1/billing/plans", "POST", {
  product_id: product.id,
  name: trial ? "CareCircle Monthly Family Plan with Trial" : "CareCircle Monthly Family Plan",
  description: trial ? "One month free, then $2 per seat monthly; five seats total $10 per month." : "$2 per seat monthly; five seats total $10 per month.",
  billing_cycles: [
    ...(trial ? [{ frequency: { interval_unit: "MONTH", interval_count: 1 }, tenure_type: "TRIAL", sequence: 1, total_cycles: 1,
      pricing_scheme: { fixed_price: { value: "0", currency_code: "USD" } } }] : []),
    { frequency: { interval_unit: "MONTH", interval_count: 1 }, tenure_type: "REGULAR", sequence: trial ? 2 : 1, total_cycles: 0,
      pricing_scheme: { fixed_price: { value: "2", currency_code: "USD" } } },
  ],
  payment_preferences: { auto_bill_outstanding: true, payment_failure_threshold: 1 },
});
const trialPlan = await makePlan(true);
const standardPlan = await makePlan(false);
const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/billing/webhook`;
const existingWebhooks = await request("/v1/notifications/webhooks?page_size=100", "GET", {});
const existing = existingWebhooks.webhooks?.find((webhook) => webhook.url === webhookUrl);
let webhook = existing;
if (existing) {
  const currentEvents = Array.isArray(existing.event_types) ? existing.event_types : [];
  const known = new Set(currentEvents.map((event) => event.name));
  const missingEvents = PAYPAL_SUBSCRIPTION_WEBHOOK_EVENTS.filter((name) => !known.has(name));
  if (missingEvents.length) {
    webhook = await request(`/v1/notifications/webhooks/${encodeURIComponent(existing.id)}`, "PATCH", [
      { op: "replace", path: "/event_types", value: [...currentEvents, ...missingEvents.map((name) => ({ name }))] },
    ]);
  }
} else {
  webhook = await request("/v1/notifications/webhooks", "POST", {
    url: webhookUrl,
    event_types: PAYPAL_SUBSCRIPTION_WEBHOOK_EVENTS.map((name) => ({ name })),
  });
}
console.log(JSON.stringify({ productId: product.id, trialPlanId: trialPlan.id, standardPlanId: standardPlan.id, webhookId: webhook.id, webhookUrl, mode }, null, 2));

