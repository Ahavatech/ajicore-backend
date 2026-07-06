-- DropIndex
DROP INDEX "invoices_business_customer_status_idx";

-- DropIndex
DROP INDEX "quotes_business_status_schedule_idx";

-- DropIndex
DROP INDEX "staff_business_status_idx";

-- DropIndex
DROP INDEX "users_business_id_idx";

-- AlterTable
ALTER TABLE "bookkeeping_transactions" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "raw_description" TEXT,
ADD COLUMN     "receipt_url" TEXT,
ADD COLUMN     "tags" JSONB,
ADD COLUMN     "vendor" TEXT,
ALTER COLUMN "category" DROP NOT NULL;

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "is_phone_verified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "custom_category_name" TEXT;

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "custom_category_name" TEXT;

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "discount_amount" DOUBLE PRECISION,
ADD COLUMN     "discount_percent" DOUBLE PRECISION,
ADD COLUMN     "labor_cost" DOUBLE PRECISION,
ADD COLUMN     "labor_time" TEXT,
ADD COLUMN     "materials" JSONB,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "subtotal" DOUBLE PRECISION,
ADD COLUMN     "tax_amount" DOUBLE PRECISION,
ADD COLUMN     "tax_percent" DOUBLE PRECISION,
ADD COLUMN     "tools" JSONB,
ADD COLUMN     "total_amount" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "price_book_items" ADD COLUMN     "service_cost" DOUBLE PRECISION DEFAULT 0;
