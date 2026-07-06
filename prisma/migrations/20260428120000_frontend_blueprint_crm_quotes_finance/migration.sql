-- Frontend blueprint: CRM, scheduling, quote/invoice finance, and price book economics.

ALTER TYPE "QuoteStatus" ADD VALUE IF NOT EXISTS 'Pending';
ALTER TYPE "QuoteStatus" ADD VALUE IF NOT EXISTS 'Appointment';
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'Pending';

ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "poc_name" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "location_main" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "location_other" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "warranty_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "warranty_due" TIMESTAMP(3);
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "profile_image_url" TEXT;

ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "quote_number" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "service_name" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "service_category" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "contract_type" JSONB;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "warranty_due" TIMESTAMP(3);
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "photos" JSONB;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "scheduled_estimate_time" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "scheduled_start_time" TIMESTAMP(3);
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "scheduled_end_time" TIMESTAMP(3);
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "viewed_at" TIMESTAMP(3);
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "follow_up_at" TIMESTAMP(3);
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "manual_subtotal" DOUBLE PRECISION;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "subtotal" DOUBLE PRECISION;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "discount_percent" DOUBLE PRECISION;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "discount_amount" DOUBLE PRECISION;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "tax_percent" DOUBLE PRECISION;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "tax_amount" DOUBLE PRECISION;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "deposit_percent" DOUBLE PRECISION;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "deposit_amount" DOUBLE PRECISION;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "due_amount" DOUBLE PRECISION;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "payment_due_terms" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "is_estimate_appointment" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "customer_id" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "invoice_number" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "service_name" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "service_category" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "contract_type" JSONB;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "warranty_due" TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "photos" JSONB;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "manual_subtotal" DOUBLE PRECISION;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "subtotal" DOUBLE PRECISION;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "discount_percent" DOUBLE PRECISION;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "discount_amount" DOUBLE PRECISION;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "tax_percent" DOUBLE PRECISION;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "tax_amount" DOUBLE PRECISION;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "deposit_percent" DOUBLE PRECISION;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "deposit_amount" DOUBLE PRECISION;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "due_amount" DOUBLE PRECISION;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "total_amount" DOUBLE PRECISION;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "payment_due_terms" TEXT;

UPDATE "invoices" i
SET "customer_id" = j."customer_id"
FROM "jobs" j
WHERE i."job_id" = j."id"
  AND i."customer_id" IS NULL;

ALTER TABLE "invoices" ALTER COLUMN "job_id" DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_customer_id_fkey'
  ) THEN
    ALTER TABLE "invoices"
      ADD CONSTRAINT "invoices_customer_id_fkey"
      FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "price_book_items" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "price_book_items" ADD COLUMN IF NOT EXISTS "labor_time" TEXT;
ALTER TABLE "price_book_items" ADD COLUMN IF NOT EXISTS "labor_cost" DOUBLE PRECISION;
ALTER TABLE "price_book_items" ADD COLUMN IF NOT EXISTS "materials" JSONB;
ALTER TABLE "price_book_items" ADD COLUMN IF NOT EXISTS "tools" JSONB;
ALTER TABLE "price_book_items" ADD COLUMN IF NOT EXISTS "total_materials_cost" DOUBLE PRECISION;
ALTER TABLE "price_book_items" ADD COLUMN IF NOT EXISTS "total_tools_cost" DOUBLE PRECISION;
ALTER TABLE "price_book_items" ADD COLUMN IF NOT EXISTS "base_cost" DOUBLE PRECISION;
ALTER TABLE "price_book_items" ADD COLUMN IF NOT EXISTS "flat_rate" DOUBLE PRECISION;
ALTER TABLE "price_book_items" ADD COLUMN IF NOT EXISTS "margin_amount" DOUBLE PRECISION;
ALTER TABLE "price_book_items" ADD COLUMN IF NOT EXISTS "margin_percent" DOUBLE PRECISION;

ALTER TABLE "business_finance_settings" ADD COLUMN IF NOT EXISTS "markup_percent" DOUBLE PRECISION NOT NULL DEFAULT 49;

CREATE INDEX IF NOT EXISTS "quotes_business_status_schedule_idx"
  ON "quotes"("business_id", "status", "scheduled_start_time");

CREATE INDEX IF NOT EXISTS "invoices_business_customer_status_idx"
  ON "invoices"("business_id", "customer_id", "status");
