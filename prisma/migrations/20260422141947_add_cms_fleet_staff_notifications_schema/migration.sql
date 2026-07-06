-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "company_name" TEXT,
ADD COLUMN     "customer_type" TEXT DEFAULT 'Individual';

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "line_items" JSONB;

-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "employment_type" TEXT,
ADD COLUMN     "entry_level" TEXT,
ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "assigned_staff_id" TEXT,
ADD COLUMN     "color" TEXT,
ADD COLUMN     "insurance_cost" DOUBLE PRECISION,
ADD COLUMN     "insurance_provider" TEXT,
ADD COLUMN     "policy_number" TEXT,
ADD COLUMN     "purchase_date" TIMESTAMP(3),
ADD COLUMN     "purchase_price" DOUBLE PRECISION,
ADD COLUMN     "type" TEXT,
ADD COLUMN     "vin" TEXT;

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SystemAlert',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_records" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "total_hours" DOUBLE PRECISION NOT NULL,
    "hourly_rate" DOUBLE PRECISION NOT NULL,
    "gross_pay" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_business_id_is_read_createdAt_idx" ON "notifications"("business_id", "is_read", "createdAt");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_assigned_staff_id_fkey" FOREIGN KEY ("assigned_staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
