ALTER TABLE billing_transactions
  DROP CONSTRAINT IF EXISTS billing_transactions_kind_check;

ALTER TABLE billing_transactions
  ADD CONSTRAINT billing_transactions_kind_check
  CHECK (kind IN ('payment', 'refund', 'reversal'));

CREATE INDEX IF NOT EXISTS webhook_events_processed_idx
  ON webhook_events(processed_at)
  WHERE processed_at IS NULL;

