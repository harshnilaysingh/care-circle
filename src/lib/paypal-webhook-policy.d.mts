export type PayPalEventImpact = "subscription-active" | "subscription-inactive" | "payment" | "refund" | "reversal" | "ignore";
export declare const PAYPAL_SUBSCRIPTION_WEBHOOK_EVENTS: readonly string[];
export declare function classifyPayPalEvent(eventType: string): PayPalEventImpact;
export declare function getPayPalEventIds(
  eventType: string,
  resource?: Record<string, unknown>,
): { subscriptionId: string | null; paymentId: string | null };

