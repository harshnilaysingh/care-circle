export const PAYPAL_SUBSCRIPTION_WEBHOOK_EVENTS = Object.freeze([
  "BILLING.SUBSCRIPTION.ACTIVATED",
  "BILLING.SUBSCRIPTION.UPDATED",
  "BILLING.SUBSCRIPTION.CANCELLED",
  "BILLING.SUBSCRIPTION.SUSPENDED",
  "BILLING.SUBSCRIPTION.EXPIRED",
  "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
  "BILLING.SUBSCRIPTION.PAYMENT.COMPLETED",
  "PAYMENT.SALE.COMPLETED",
  "PAYMENT.SALE.REFUNDED",
  "PAYMENT.SALE.REVERSED",
  "PAYMENT.CAPTURE.COMPLETED",
  "PAYMENT.CAPTURE.REFUNDED",
  "PAYMENT.CAPTURE.REVERSED",
]);

const inactiveSubscriptionEvents = new Set([
  "BILLING.SUBSCRIPTION.CANCELLED",
  "BILLING.SUBSCRIPTION.SUSPENDED",
  "BILLING.SUBSCRIPTION.EXPIRED",
  "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
]);

const paymentEvents = new Set([
  "BILLING.SUBSCRIPTION.PAYMENT.COMPLETED",
  "PAYMENT.SALE.COMPLETED",
  "PAYMENT.CAPTURE.COMPLETED",
]);

const refundEvents = new Set(["PAYMENT.CAPTURE.REFUNDED", "PAYMENT.SALE.REFUNDED"]);

export function classifyPayPalEvent(eventType) {
  if (eventType === "BILLING.SUBSCRIPTION.ACTIVATED" || eventType === "BILLING.SUBSCRIPTION.UPDATED") return "subscription-active";
  if (inactiveSubscriptionEvents.has(eventType)) return "subscription-inactive";
  if (paymentEvents.has(eventType)) return "payment";
  if (refundEvents.has(eventType)) return "refund";
  if (eventType === "PAYMENT.SALE.REVERSED" || eventType === "PAYMENT.CAPTURE.REVERSED") return "reversal";
  return "ignore";
}

export function getPayPalEventIds(eventType, resource = {}) {
  const supplementary = resource.supplementary_data;
  const relatedIds = supplementary && typeof supplementary === "object" && !Array.isArray(supplementary)
    ? supplementary.related_ids
    : undefined;
  const related = relatedIds && typeof relatedIds === "object" && !Array.isArray(relatedIds) ? relatedIds : {};
  const text = (value) => typeof value === "string" && value.length > 0 ? value : null;
  const subscriptionId = eventType.startsWith("BILLING.SUBSCRIPTION.")
    ? text(resource.id)
    : text(resource.billing_agreement_id) ?? text(resource.subscription_id);
  const paymentId = text(related.sale_id) ?? text(related.capture_id) ?? text(resource.id);
  return { subscriptionId, paymentId };
}

