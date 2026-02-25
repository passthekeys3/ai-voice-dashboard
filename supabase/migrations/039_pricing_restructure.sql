-- Pricing restructure: Self-Service vs Managed plans with metered per-minute billing
-- plan_type: 'self_service' (default) or 'managed' (done-for-you)
-- metered_subscription_item_id: Stripe subscription item for per-minute usage reporting

ALTER TABLE agencies ADD COLUMN IF NOT EXISTS plan_type text DEFAULT 'self_service';
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS metered_subscription_item_id text;

-- Backfill existing subscribers as self_service
UPDATE agencies SET plan_type = 'self_service' WHERE subscription_status IS NOT NULL AND plan_type IS NULL;
