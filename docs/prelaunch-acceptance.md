# CareCircle pre-launch acceptance

Do not announce paid access or switch PayPal to live until all required checks below pass against the production project and the verified sender domain. Use separate PayPal sandbox and live apps, plans, webhook IDs, and credentials.

## Account and workspace

- [ ] Create an owner account; verify email; sign in; confirm a secure session cookie is issued.
- [ ] Confirm a user without an active family is redirected to the create/join gate and all family APIs return 403.
- [ ] Complete a sandbox trial checkout; verify the signed PayPal activation event creates exactly one family and owner membership.
- [ ] Repeat the same webhook event; verify no duplicate family, membership, billing row, or audit action is created.
- [ ] Invite a member and verify the link is single use, bound to the invited email, and expires after seven days.
- [ ] Verify a pending invite does not reserve a seat and a removed member can rejoin only with a still-valid invitation.
- [ ] Attempt two joins for the last seat concurrently; exactly one may succeed.
- [ ] Verify users cannot join a second family, members cannot manage owner-only settings, and the owner cannot be removed.

## Billing and access

- [ ] Confirm five seats price at $10/month after the 30-day trial and each additional seat adds $2/month.
- [ ] Test successful payment, payment failure, suspension, expiration, cancellation, refund, and reversal webhooks.
- [ ] Verify every delivery is signature-checked and duplicate event IDs are processed once.
- [ ] Confirm refund or reversal immediately disables family access and writes only metadata to the audit log.
- [ ] Approve a seat increase through PayPal; verify access increases only after PayPal confirms the new quantity.
- [ ] Cancel as owner; verify PayPal accepts cancellation, all family access ends, and the UI explains the effect.
- [ ] Test checkout cancellation, PayPal timeouts, provider errors, and a database failure after PayPal approval; confirm safe recovery instructions.

## Privacy, support, and recovery

- [ ] Review Privacy, Terms, Billing & refunds, and Support with qualified counsel for each sales market. Confirm merchant identity, governing law, support response expectations, taxes, trial eligibility, and any statutory cancellation/refund rights.
- [ ] Confirm the intended age policy is enforced before collecting personal information and on the server; prevent under-13 signups and invitations as required for each market.
- [ ] Set a monitored `SUPPORT_EMAIL`; submit an account access, billing, privacy, export, and deletion request and confirm an owner can process each one.
- [ ] Confirm no personal care text, invite code, full IP, payment detail, or prompt is present in application logs.
- [ ] Verify Neon backups are enabled, then restore a backup into a separate database and confirm the encryption key decrypts restored private fields.
- [ ] Store the encryption key in an approved secret manager with restricted access and a recovery owner. Practice the documented key recovery process.
- [ ] Configure an uptime alert on `/api/health`, error alerts for failed requests, and a named on-call/support owner.
- [ ] Run keyboard, mobile, screen-reader, dependency/security, and load checks on the production candidate.

## Current code limitations

- The repository contains unit tests for PayPal event classification, not an end-to-end integration suite. Database concurrency, auth, invitation, and live PayPal scenarios still need the acceptance checks above.
- The encryption key is a single environment secret. Back it up securely; key rotation requires a planned decrypt/re-encrypt procedure and a versioned-key design before rotation.
- Account export/deletion requests currently require an operator workflow; document and test that process before accepting customers.
- The Vercel project must have its database and provider configuration attached, migrations applied, and monitoring alerts enabled before these checks can pass.

