/*
  Warnings:

  - The values [Pending] on the enum `JobStatus` will be removed. If these variants are still used in the database, this will fail.
  - The `category` column on the `expenses` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `quote_invoices` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('EstimateScheduled', 'Draft', 'Sent', 'Approved', 'Declined', 'Expired');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('Job', 'ServiceCall');

-- CreateEnum
CREATE TYPE "UnknownServiceHandling" AS ENUM ('FreeEstimate', 'PaidServiceCall', 'TransferCall');

-- CreateEnum
CREATE TYPE "PriceType" AS ENUM ('Fixed', 'Range', 'NeedsOnsite');

-- CreateEnum
CREATE TYPE "VisitType" AS ENUM ('FreeEstimate', 'PaidServiceCall');

-- CreateEnum
CREATE TYPE "JobSource" AS ENUM ('AI', 'Manual', 'SMS');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('Materials', 'Labor', 'Equipment', 'Fuel', 'Insurance', 'Utilities', 'Marketing', 'Other');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InvoiceStatus" ADD VALUE 'Refunded';
ALTER TYPE "InvoiceStatus" ADD VALUE 'Voided';

-- AlterEnum
BEGIN;
CREATE TYPE "JobStatus_new" AS ENUM ('Scheduled', 'InProgress', 'Completed', 'Invoiced', 'Cancelled');
ALTER TABLE "public"."jobs" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "jobs" ALTER COLUMN "status" TYPE "JobStatus_new" USING ("status"::text::"JobStatus_new");
ALTER TYPE "JobStatus" RENAME TO "JobStatus_old";
ALTER TYPE "JobStatus_new" RENAME TO "JobStatus";
DROP TYPE "public"."JobStatus_old";
ALTER TABLE "jobs" ALTER COLUMN "status" SET DEFAULT 'Scheduled';
COMMIT;

-- DropForeignKey
ALTER TABLE "quote_invoices" DROP CONSTRAINT "quote_invoices_job_id_fkey";

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "ai_business_description" TEXT,
ADD COLUMN     "cost_per_mile_over_radius" DOUBLE PRECISION,
ADD COLUMN     "home_base_zip" TEXT,
ADD COLUMN     "payment_follow_up_days" JSONB,
ADD COLUMN     "payment_interval" TEXT,
ADD COLUMN     "quote_expiry_days" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "service_radius_miles" DOUBLE PRECISION,
ADD COLUMN     "unknown_service_call_fee" DOUBLE PRECISION,
ADD COLUMN     "unknown_service_handling" "UnknownServiceHandling" NOT NULL DEFAULT 'FreeEstimate';

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "zip_code" TEXT;

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "receipt_url" TEXT,
DROP COLUMN "category",
ADD COLUMN     "category" "ExpenseCategory" NOT NULL DEFAULT 'Other';

-- AlterTable
ALTER TABLE "job_materials" ADD COLUMN     "unit_cost" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "actual_end_time" TIMESTAMP(3),
ADD COLUMN     "actual_start_time" TIMESTAMP(3),
ADD COLUMN     "from_quote_id" TEXT,
ADD COLUMN     "is_emergency" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "photos_urls" JSONB,
ADD COLUMN     "price_book_item_id" TEXT,
ADD COLUMN     "service_call_fee" DOUBLE PRECISION,
ADD COLUMN     "source" "JobSource" NOT NULL DEFAULT 'Manual',
ADD COLUMN     "title" TEXT,
ADD COLUMN     "type" "JobType" NOT NULL DEFAULT 'Job',
ALTER COLUMN "status" SET DEFAULT 'Scheduled';

-- AlterTable
ALTER TABLE "materials" ADD COLUMN     "unit" TEXT;

-- AlterTable
ALTER TABLE "timesheets" ADD COLUMN     "job_id" TEXT;

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "year" INTEGER;

-- DropTable
DROP TABLE "quote_invoices";

-- CreateTable
CREATE TABLE "service_categories" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "custom_description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_book_items" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "category_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "can_quote_phone" BOOLEAN NOT NULL DEFAULT false,
    "price_type" "PriceType" NOT NULL DEFAULT 'NeedsOnsite',
    "price" DOUBLE PRECISION,
    "price_min" DOUBLE PRECISION,
    "price_max" DOUBLE PRECISION,
    "visit_type" "VisitType" NOT NULL DEFAULT 'FreeEstimate',
    "service_call_fee" DOUBLE PRECISION,
    "suggested_materials" JSONB,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_book_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "assigned_staff_id" TEXT,
    "status" "QuoteStatus" NOT NULL DEFAULT 'EstimateScheduled',
    "title" TEXT,
    "description" TEXT,
    "price_book_item_id" TEXT,
    "scheduled_estimate_date" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "declined_at" TIMESTAMP(3),
    "total_amount" DOUBLE PRECISION,
    "notes" TEXT,
    "is_emergency" BOOLEAN NOT NULL DEFAULT false,
    "source" "JobSource" NOT NULL DEFAULT 'Manual',
    "converted_to_job_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'Draft',
    "notes" TEXT,
    "internal_notes" TEXT,
    "due_date" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "voided_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "refund_amount" DOUBLE PRECISION,
    "refund_reason" TEXT,
    "payment_url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "is_credit" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_edit_logs" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "edited_by" TEXT,
    "changes" JSONB NOT NULL,
    "edited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_edit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "payment_method" TEXT,
    "stripe_payment_id" TEXT,
    "notes" TEXT,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_book_items" ADD CONSTRAINT "price_book_items_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_book_items" ADD CONSTRAINT "price_book_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_assigned_staff_id_fkey" FOREIGN KEY ("assigned_staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_converted_to_job_id_fkey" FOREIGN KEY ("converted_to_job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_edit_logs" ADD CONSTRAINT "invoice_edit_logs_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_edit_logs" ADD CONSTRAINT "invoice_edit_logs_edited_by_fkey" FOREIGN KEY ("edited_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
