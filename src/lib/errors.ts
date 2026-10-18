import { jsonError } from "@/lib/security";

export function apiFailure(error: unknown) {
  const rawCode = error instanceof Error ? error.message : "UNKNOWN";
  const code = /^[A-Z0-9_]{1,64}$/.test(rawCode) ? rawCode : "INTERNAL_ERROR";
  const errorType = error instanceof Error && /^[A-Za-z]{1,40}$/.test(error.name) ? error.name : "UnknownError";
  const log = (event: string) => console.error(JSON.stringify({ level: "error", service: "carecircle", event, code, errorType }));
  if (rawCode === "FAMILY_INACTIVE") return jsonError("The family subscription is no longer active.", 403);
  if (rawCode.includes("NOT_CONFIGURED") || rawCode.startsWith("INVALID_")) {
    log("service_configuration_error");
    return jsonError("This service is not configured yet. Please try again later.", 503);
  }
  if (rawCode.startsWith("PAYPAL_API_") || rawCode.startsWith("PAYPAL_AUTH_")) {
    log("payment_provider_error");
    return jsonError("PayPal could not complete that request. Please try again.", 502);
  }
  log("request_failed");
  return jsonError("Something went wrong. Please try again.", 500);
}

