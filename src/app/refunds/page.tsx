import PolicyPage from "../policy-page";

export default function RefundsPage() {
  return <PolicyPage title="Billing, cancellation, and refunds" intro="The family owner manages the monthly subscription and any seat increases. PayPal processes all payments for CareCircle.">
    <section><h2>Trial and recurring charges</h2><p>Eligible new family owners receive a 30-day free trial. After the trial, PayPal charges $10 USD per month for the first five seats and $2 USD per month for each seat above five. Added seats require PayPal approval and take effect after PayPal confirms the subscription update.</p></section>
    <section><h2>Canceling a subscription</h2><p>The owner can cancel from the subscription section of Family Management. After PayPal accepts the request, the subscription is canceled and access for all members is disabled immediately. If the in-app cancellation is unavailable, use PayPal’s subscription controls and contact support so we can confirm the family access state.</p></section>
    <section><h2>Refund requests</h2><p>Contact CareCircle Support with the account email, PayPal transaction reference, and a brief description of the issue. We review refund requests individually and process approved refunds through PayPal. Refunds are not automatic on cancellation. This policy does not limit any refund or cancellation rights required by the law that applies to you.</p></section>
    <section><h2>Billing errors</h2><p>If a charge or seat count looks wrong, contact support promptly. We will review the PayPal subscription and event record, correct the account where appropriate, and explain any adjustment.</p></section>
  </PolicyPage>;
}

