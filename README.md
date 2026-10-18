# CareCircle

CareCircle is a Next.js family-care workspace. The public landing page is available without an account; private family data and the real workspace require a verified account in a currently active PayPal family subscription.

## Product rules

- A family owner starts one monthly subscription with a one-month free trial.
- Five total seats (including the owner) cost $10/month after the trial.
- Each seat above five costs another $2/month. New seats require the owner’s PayPal approval and take effect after PayPal confirms the subscription quantity change.
- Invites are single-use, email-bound, expire after seven days, and do not reserve seats.
- A user can belong to only one family. The owner cannot be removed.
- A cancelled, suspended, expired, failed, or refunded subscription blocks member access.

## Stack

- Next.js App Router and React
- Better Auth with PostgreSQL-backed password accounts, verified email, and database-backed rate limiting
- Neon PostgreSQL (pooled `DATABASE_URL`) with SQL migrations
- PayPal Subscriptions REST API and verified webhooks
- Resend for verification and password-reset email
- OpenAI Responses API for opt-in parenting and aging-parent guidance

## Configuration

Copy `.env.example` into a local, untracked `.env.local` for development. Keep all secrets server-only; never use `NEXT_PUBLIC_` for them.

Required environment values:

| Variable | Purpose |
| --- | --- |
| `APP_URL` | Canonical CareCircle URL, such as the production Vercel alias |
| `BETTER_AUTH_SECRET` | Random secret of at least 32 bytes for Better Auth |
| `DATABASE_URL` | Neon pooled PostgreSQL connection string with TLS |
| `DATA_ENCRYPTION_KEY` | Base64-encoded random 32-byte AES-256-GCM key, separate from the auth secret |
| `RESEND_API_KEY`, `EMAIL_FROM` | Verified-email and password-reset delivery |
| `SUPPORT_EMAIL` | Public support contact shown on the Support page |
| `PAYPAL_MODE` | `sandbox` for development, `live` only after sandbox verification |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | PayPal REST API app credentials |
| `PAYPAL_TRIAL_PLAN_ID`, `PAYPAL_STANDARD_PLAN_ID` | Plan IDs created by the setup script |
| `PAYPAL_WEBHOOK_ID` | Webhook ID registered with PayPal |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Optional AI service credentials and an account-enabled model |

Generate secrets locally with a cryptographic random generator. Do not commit `.env.local` or paste secret values into chat. Add credentials in Vercel Project Settings → Environment Variables, for Preview and Production as appropriate, then redeploy.

## First setup

1. Connect a Neon PostgreSQL database to the `care-circle` Vercel project and copy its pooled connection string into the local environment.
2. Add the PayPal app credentials to a local environment and set `PAYPAL_MODE=sandbox` and `APP_URL` to the deployed CareCircle URL.
3. Run `npm install`, then `npm run paypal:setup`. It creates the trial and standard $2-per-seat plans and the PayPal webhook. Add the printed plan and webhook IDs to Vercel.
4. Set `BETTER_AUTH_SECRET`, `DATA_ENCRYPTION_KEY`, Resend credentials, and optional OpenAI credentials in Vercel.
5. Run `npm run db:migrate` once against the Neon database. Migrations are intentionally run explicitly rather than during every serverless build.
6. Redeploy, then run `npm test`, verify `/api/health`, and complete every applicable scenario in [the pre-launch acceptance checklist](docs/prelaunch-acceptance.md).

The setup script creates PayPal resources each time it is run; it reuses an existing webhook for the same URL. Store the printed IDs securely in Vercel. Use separate sandbox and live PayPal apps, plan IDs, webhook IDs, and credentials.

The PayPal setup script updates an existing webhook to include required events, including refunds and payment reversals. It may create duplicate product/plan resources if run again; preserve the current plan IDs and do not rerun in production without reviewing the PayPal account first.

## Development

```sh
npm install
npm test
npm run db:migrate
npm run dev
```

`npm run build` is the production build check. The `/workspace` and `/family` pages require a configured database and authenticated active family; API requests return a safe configuration error until external services are connected.

## Security and data handling

- Better Auth manages password hashing, opaque HttpOnly sessions, email verification, and logout.
- New account creation screens age before collecting account details, and Better Auth rejects signup requests that do not pass the server-side 13–120 age check. Age is removed from the auth request before user storage; profile age is stored with the encrypted profile.
- Family membership, billing status, ownership, and seat checks are enforced server-side. Seat joins lock the family row before counting and inserting.
- Invitation codes are stored as SHA-256 hashes. Invitee email is stored as a hash; the invite profile, updates, messages, notes, appointments, and financial values are encrypted with AES-256-GCM before database storage.
- API request limits use a keyed hash of the source address; raw addresses and request bodies are not logged.
- AI guidance requires explicit consent, is not persisted, and is presented as everyday support rather than medical advice.
- Audit records contain action names and entity identifiers, not care text, chat content, invite codes, or financial amounts.
- Owner-managed subscription cancellation is sent to PayPal and immediately disables family access when accepted. Refund requests are handled through support and PayPal.
- `/api/health` reports database/migration readiness without exposing service configuration.

## Policies and operations

Public Privacy, Terms, Billing & refunds, and Support pages are available in the app. Set `SUPPORT_EMAIL` before deployment. These documents are product drafts; have qualified counsel review them for the markets where CareCircle will be sold. Account export/deletion still requires an operator workflow. See [operations](docs/operations.md) and [pre-launch acceptance](docs/prelaunch-acceptance.md).

## Deployment status

The frontend is deployed on Vercel. Backend code is present in this repository, but real sign-in, billing, and family data remain unavailable until the Neon database, PayPal credentials/plans/webhook, Resend sender, support contact, and encryption/auth secrets above are configured and verified. Never advertise the backend as live before those dependencies and the sandbox flow have been checked.

