import Link from "next/link";
import PolicyPage from "../policy-page";

export const dynamic = "force-dynamic";

export default function SupportPage() {
  const email = process.env.SUPPORT_EMAIL?.trim();
  return <PolicyPage title="CareCircle Support" intro="We can help with account access, invitations, billing, privacy requests, and family workspace questions.">
    <section><h2>Contact us</h2>{email ? <p>Email <a href={`mailto:${email}`}>{email}</a>. Include the account email and a short description of the issue. Do not email passwords, invite codes, medical records, or payment-card details.</p> : <p>Support email is not configured yet. CareCircle’s operator must set the <code>SUPPORT_EMAIL</code> production environment variable before accepting customers.</p>}</section>
    <section><h2>Quick help</h2><p>Owners can manage invitations, members, seats, and subscription cancellation from <Link href="/family">Family Management</Link>. Invited members must use the email address the owner invited.</p><p>For a privacy, correction, export, or deletion request, clearly say what you would like us to review. We will verify the account before responding.</p></section>
  </PolicyPage>;
}

