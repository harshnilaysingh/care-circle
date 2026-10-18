import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyPayPalEvent,
  getPayPalEventIds,
  PAYPAL_SUBSCRIPTION_WEBHOOK_EVENTS,
} from "../src/lib/paypal-webhook-policy.mjs";

test("PayPal webhook registration includes every access-changing billing event", () => {
  for (const event of [
    "BILLING.SUBSCRIPTION.ACTIVATED",
    "BILLING.SUBSCRIPTION.CANCELLED",
    "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
    "PAYMENT.SALE.REFUNDED",
    "PAYMENT.SALE.REVERSED",
    "PAYMENT.CAPTURE.REVERSED",
  ]) assert.ok(PAYPAL_SUBSCRIPTION_WEBHOOK_EVENTS.includes(event), `${event} is registered`);
});

test("subscription state-changing events are classified explicitly", () => {
  assert.equal(classifyPayPalEvent("BILLING.SUBSCRIPTION.ACTIVATED"), "subscription-active");
  assert.equal(classifyPayPalEvent("BILLING.SUBSCRIPTION.SUSPENDED"), "subscription-inactive");
  assert.equal(classifyPayPalEvent("BILLING.SUBSCRIPTION.PAYMENT.FAILED"), "subscription-inactive");
  assert.equal(classifyPayPalEvent("SOME.UNKNOWN.EVENT"), "ignore");
});

test("refund and reversal events remain distinct and both are recognized", () => {
  assert.equal(classifyPayPalEvent("PAYMENT.SALE.REFUNDED"), "refund");
  assert.equal(classifyPayPalEvent("PAYMENT.CAPTURE.REFUNDED"), "refund");
  assert.equal(classifyPayPalEvent("PAYMENT.SALE.REVERSED"), "reversal");
  assert.equal(classifyPayPalEvent("PAYMENT.CAPTURE.REVERSED"), "reversal");
});

test("webhook resource identifiers support subscription and related payment lookup", () => {
  assert.deepEqual(getPayPalEventIds("BILLING.SUBSCRIPTION.ACTIVATED", { id: "I-SUB" }), {
    subscriptionId: "I-SUB", paymentId: "I-SUB",
  });
  assert.deepEqual(getPayPalEventIds("PAYMENT.SALE.REVERSED", {
    id: "SALE-1",
    billing_agreement_id: "I-SUB",
    supplementary_data: { related_ids: { sale_id: "SALE-ORIGINAL" } },
  }), { subscriptionId: "I-SUB", paymentId: "SALE-ORIGINAL" });
});

