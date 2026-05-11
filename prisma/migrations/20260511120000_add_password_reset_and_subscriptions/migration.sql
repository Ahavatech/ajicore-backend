-- Password reset fields on users
ALTER TABLE "users"
ADD COLUMN "password_reset_code" TEXT,
ADD COLUMN "password_reset_expires_at" TIMESTAMP(3),
ADD COLUMN "password_reset_used_at" TIMESTAMP(3),
ADD COLUMN "password_reset_channel" TEXT;

-- Subscription status enum
CREATE TYPE "SubscriptionStatus" AS ENUM (
  'incomplete',
  'incomplete_expired',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'paused'
);

-- Business subscriptions
CREATE TABLE "business_subscriptions" (
  "id" TEXT NOT NULL,
  "business_id" TEXT NOT NULL,
  "stripe_customer_id" TEXT,
  "stripe_subscription_id" TEXT,
  "stripe_price_id" TEXT,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'incomplete',
  "trial_start" TIMESTAMP(3),
  "trial_end" TIMESTAMP(3),
  "current_period_start" TIMESTAMP(3),
  "current_period_end" TIMESTAMP(3),
  "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
  "canceled_at" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "business_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "business_subscriptions_stripe_subscription_id_key"
ON "business_subscriptions"("stripe_subscription_id");

CREATE INDEX "business_subscriptions_business_id_status_idx"
ON "business_subscriptions"("business_id", "status");

ALTER TABLE "business_subscriptions"
ADD CONSTRAINT "business_subscriptions_business_id_fkey"
FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Stripe / subscription event storage
CREATE TABLE "subscription_payment_events" (
  "id" TEXT NOT NULL,
  "business_id" TEXT,
  "business_subscription_id" TEXT,
  "stripe_event_id" TEXT NOT NULL,
  "stripe_customer_id" TEXT,
  "stripe_subscription_id" TEXT,
  "stripe_invoice_id" TEXT,
  "stripe_payment_intent_id" TEXT,
  "event_type" TEXT NOT NULL,
  "status" TEXT,
  "payload" JSONB,
  "occurred_at" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "subscription_payment_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscription_payment_events_stripe_event_id_key"
ON "subscription_payment_events"("stripe_event_id");

CREATE INDEX "subscription_payment_events_business_id_event_type_idx"
ON "subscription_payment_events"("business_id", "event_type");

CREATE INDEX "subscription_payment_events_stripe_subscription_id_idx"
ON "subscription_payment_events"("stripe_subscription_id");

ALTER TABLE "subscription_payment_events"
ADD CONSTRAINT "subscription_payment_events_business_id_fkey"
FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "subscription_payment_events"
ADD CONSTRAINT "subscription_payment_events_business_subscription_id_fkey"
FOREIGN KEY ("business_subscription_id") REFERENCES "business_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
