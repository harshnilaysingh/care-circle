CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL DEFAULT false,
  "image" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY,
  "expiresAt" timestamptz NOT NULL,
  "token" text NOT NULL UNIQUE,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS session_user_id_idx ON "session"("userId");
CREATE INDEX IF NOT EXISTS session_expires_at_idx ON "session"("expiresAt");
CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "scope" text,
  "password" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS account_user_id_idx ON "account"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS account_provider_account_idx ON "account"("providerId", "accountId");
CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verification_identifier_idx ON "verification"("identifier");
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id text PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  profile_ciphertext text NOT NULL,
  trial_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS families (
  id text PRIMARY KEY,
  owner_id text NOT NULL UNIQUE REFERENCES "user"("id") ON DELETE RESTRICT,
  display_name text NOT NULL,
  seat_limit integer NOT NULL DEFAULT 5 CHECK (seat_limit BETWEEN 5 AND 100),
  status text NOT NULL CHECK (status IN ('pending', 'active', 'inactive')),
  paypal_subscription_id text UNIQUE,
  paypal_plan_id text,
  subscription_status text,
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS family_members (
  user_id text PRIMARY KEY REFERENCES "user"("id") ON DELETE RESTRICT,
  family_id text NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'member')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
  added_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz
);
CREATE INDEX IF NOT EXISTS family_members_family_status_idx ON family_members(family_id, status);
CREATE TABLE IF NOT EXISTS family_invites (
  id text PRIMARY KEY,
  family_id text NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  invited_by text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  invitee_email_hash text,
  invite_profile_ciphertext text NOT NULL,
  code_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'cancelled', 'expired')),
  redeemed_by text REFERENCES "user"("id") ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  redeemed_at timestamptz
);
CREATE INDEX IF NOT EXISTS family_invites_family_status_idx ON family_invites(family_id, status);
CREATE INDEX IF NOT EXISTS family_invites_expiry_idx ON family_invites(expires_at);
CREATE TABLE IF NOT EXISTS billing_intents (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  family_name text NOT NULL,
  profile_ciphertext text NOT NULL,
  paypal_subscription_id text UNIQUE,
  paypal_plan_id text NOT NULL,
  family_id text REFERENCES families(id) ON DELETE SET NULL,
  seat_limit integer NOT NULL DEFAULT 5 CHECK (seat_limit BETWEEN 5 AND 100),
  trial_requested boolean NOT NULL DEFAULT false,
  approval_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'failed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS billing_intents_one_pending_owner_idx ON billing_intents(owner_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS billing_intents_owner_idx ON billing_intents(owner_id, created_at DESC);
CREATE TABLE IF NOT EXISTS seat_change_requests (
  id text PRIMARY KEY,
  family_id text NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  requested_limit integer NOT NULL CHECK (requested_limit BETWEEN 6 AND 100),
  approval_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'failed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS seat_change_one_pending_family_idx ON seat_change_requests(family_id) WHERE status = 'pending';
CREATE TABLE IF NOT EXISTS webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  resource_id text,
  payload_digest text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE TABLE IF NOT EXISTS family_tasks (
  id text PRIMARY KEY,
  family_id text NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  created_by text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  assigned_to text REFERENCES "user"("id") ON DELETE SET NULL,
  title text NOT NULL,
  detail_ciphertext text,
  due_at timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS daily_updates (
  id text PRIMARY KEY,
  family_id text NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  created_by text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  body_ciphertext text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS chat_messages (
  id text PRIMARY KEY,
  family_id text NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  created_by text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  body_ciphertext text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS care_appointments (
  id text PRIMARY KEY,
  family_id text NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  created_by text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  location_ciphertext text,
  notes_ciphertext text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS care_notes (
  id text PRIMARY KEY,
  family_id text NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  created_by text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  title text NOT NULL,
  body_ciphertext text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS household_finances (
  family_id text PRIMARY KEY REFERENCES families(id) ON DELETE CASCADE,
  monthly_income_ciphertext text,
  monthly_budget_ciphertext text,
  currency_code char(3) NOT NULL DEFAULT 'USD',
  updated_by text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_events (
  id text PRIMARY KEY,
  family_id text NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  actor_id text REFERENCES "user"("id") ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_events_family_time_idx ON audit_events(family_id, created_at DESC);
CREATE TABLE IF NOT EXISTS api_rate_limits (
  bucket_hash text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count >= 0)
);
CREATE TABLE IF NOT EXISTS "rateLimit" (
  id text PRIMARY KEY,
  key text NOT NULL UNIQUE,
  count integer NOT NULL DEFAULT 0,
  "lastRequest" bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS billing_transactions (
  provider_resource_id text PRIMARY KEY,
  family_id text NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  subscription_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('payment', 'refund')),
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS billing_transactions_family_idx ON billing_transactions(family_id, created_at DESC);
