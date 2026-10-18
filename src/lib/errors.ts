import { jsonError } from "@/lib/security";

export function apiFailure(error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  if (code === "FAMILY_INACTIVE") return jsonError("The family subscription is no longer active.", 403);
  if (code.includes("NOT_CONFIGURED") || code.startsWith("INVALID_")) {
    console.error("CareCircle service configuration error:", code);
    return jsonError("This service is not configured yet. Please try again later.", 503);
  }
  if (code.startsWith("PAYPAL_API_") || code.startsWith("PAYPAL_AUTH_")) {
    console.error("CareCircle payment provider error:", code);
    return jsonError("PayPal could not complete that request. Please try again.", 502);
  }
  console.error("CareCircle request failed:", code);
  return jsonError("Something went wrong. Please try again.", 500);
}
