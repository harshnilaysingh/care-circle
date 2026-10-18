import { randomUUID } from "node:crypto";

type PayPalObject = Record<string, unknown>;
type Token = { value: string; expires: number };
let tokenCache: Token | undefined;

export function paypalBase() {
  const mode = process.env.PAYPAL_MODE ?? "sandbox";
  if (mode !== "sandbox" && mode !== "live") throw new Error("INVALID_PAYPAL_MODE");
  return mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

async function accessToken() {
  if (tokenCache && tokenCache.expires > Date.now() + 30_000) return tokenCache.value;
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("PAYPAL_NOT_CONFIGURED");
  const response = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`PAYPAL_AUTH_${response.status}`);
  const data = await response.json() as { access_token: string; expires_in: number };
  tokenCache = { value: data.access_token, expires: Date.now() + data.expires_in * 1000 };
  return tokenCache.value;
}

export async function paypalRequest(path: string, method = "GET", body?: PayPalObject, requestId?: string): Promise<PayPalObject> {
  const response = await fetch(`${paypalBase()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(method !== "GET" ? { "PayPal-Request-Id": requestId ?? randomUUID() } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({})) as PayPalObject;
  if (!response.ok) throw new Error(`PAYPAL_API_${response.status}`);
  return data;
}

export async function createSubscription(intentId: string, planId: string, quantity = 5) {
  const appUrl = process.env.APP_URL;
  if (!planId || !appUrl) throw new Error("PAYPAL_PLAN_NOT_CONFIGURED");
  return paypalRequest("/v1/billing/subscriptions", "POST", {
    plan_id: planId,
    quantity: String(quantity),
    custom_id: intentId,
    application_context: {
      brand_name: "CareCircle",
      user_action: "SUBSCRIBE_NOW",
      shipping_preference: "NO_SHIPPING",
      return_url: `${appUrl}/billing/success`,
      cancel_url: `${appUrl}/?checkout=cancelled`,
    },
  }, intentId);
}

export async function reviseSubscription(subscriptionId: string, planId: string, quantity: number) {
  return paypalRequest(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/revise`, "POST", {
    plan_id: planId,
    quantity: String(quantity),
  });
}

export async function cancelSubscription(subscriptionId: string) {
  return paypalRequest(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, "POST", {
    reason: "The family owner cancelled the CareCircle subscription.",
  });
}

export async function showSubscription(subscriptionId: string) {
  return paypalRequest(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`);
}

export async function verifyWebhook(event: PayPalObject, request: Request) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) throw new Error("PAYPAL_WEBHOOK_NOT_CONFIGURED");
  const names = ["paypal-transmission-id", "paypal-transmission-time", "paypal-cert-url", "paypal-auth-algo", "paypal-transmission-sig"] as const;
  const [transmission_id, transmission_time, cert_url, auth_algo, transmission_sig] = names.map((name) => request.headers.get(name) ?? "");
  if ([transmission_id, transmission_time, cert_url, auth_algo, transmission_sig].some((value) => !value)) return false;
  const result = await paypalRequest("/v1/notifications/verify-webhook-signature", "POST", {
    transmission_id, transmission_time, cert_url, auth_algo, transmission_sig, webhook_id: webhookId, webhook_event: event,
  });
  return result.verification_status === "SUCCESS";
}

