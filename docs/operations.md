# Operations runbook

## Readiness endpoint and logs

`GET /api/health` returns `200 {"status":"ok"}` only after the database is reachable and migration `0002_billing_reversals.sql` has been applied. It returns a generic `503` when the app is not ready and does not expose secrets or database details. Point an uptime monitor at this route and alert on non-200 responses.

API errors are logged with a bounded error code and error type, without request bodies or care content. Use Vercel runtime logs to investigate errors; do not add invite codes, email addresses, AI prompts, care notes, or financial amounts to log messages.

## Database backups and restore

1. Enable automated backups/PITR in the production Postgres provider and limit restore privileges.
2. Before launch, restore a recent backup into a separate database, apply pending migrations, and verify the application can read/decrypt representative test records.
3. Record who can request/approve a production restore and where the recovery log is kept.
4. Never run restore drills against the production database.

## Encryption key custody

`DATA_ENCRYPTION_KEY` is required to read encrypted profile, invite, care, chat, and household-finance fields. Store it in Vercel’s encrypted environment store and an approved, access-controlled recovery vault. Do not place it in source control, tickets, chat, or ordinary backups. A database backup without the matching key cannot restore readable private data. Rotation is not automatic; plan a versioned re-encryption migration before replacing the key.

## Billing and webhook incidents

- Keep PayPal sandbox and live credentials, plans, and webhook IDs separate.
- Verify signatures before trusting an event. `webhook_events.event_id` provides duplicate-delivery protection; inspect unprocessed rows after an incident.
- If access is incorrect, compare the family subscription state with the PayPal subscription before manually changing records. Record an audit action and retain the PayPal event reference.
- For a confirmed refund or payment reversal, keep access inactive until the owner resolves billing with support.

## Privacy and security requests

Use the configured `SUPPORT_EMAIL` to receive account, export, correction, deletion, billing, and security reports. Verify account ownership through the authenticated account before acting. Record request status and completion without copying care content into the support ticket. Confirm any retention required for billing, fraud prevention, or law before deleting records.

## Incident response

1. Acknowledge the report and assign one incident owner.
2. Preserve relevant Vercel, database, and PayPal event records without copying sensitive content.
3. Restrict affected credentials or sessions and assess family/workspace impact.
4. Restore service or data from a tested backup if needed; preserve the encryption key used by that backup.
5. Notify affected users and authorities where required by applicable law; document timing, scope, and corrective actions.

