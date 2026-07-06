-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('Scheduled', 'Sent', 'Delivered', 'Failed', 'Cancelled');

-- CreateEnum
CREATE TYPE "FollowUpChannel" AS ENUM ('SMS', 'Email', 'Call');

-- CreateEnum
CREATE TYPE "FollowUpType" AS ENUM ('Quote', 'Invoice', 'JobReminder', 'PaymentRequest');

-- CreateEnum
CREATE TYPE "TeamCheckinStatus" AS ENUM ('Pending', 'Received', 'Missed', 'Escalated');

-- CreateEnum
CREATE TYPE "VoiceGender" AS ENUM ('Male', 'Female', 'Neutral');

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "ai_receptionist_name" TEXT,
ADD COLUMN     "business_hours" JSONB,
ADD COLUMN     "owner_phone" TEXT,
ADD COLUMN     "service_area_description" TEXT,
ADD COLUMN     "timezone" TEXT,
ADD COLUMN     "voice_gender" "VoiceGender";

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "auto_reminders_paused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "customer_responded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "follow_up_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_follow_up" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "address" TEXT,
ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "service_type" TEXT;

-- AlterTable
ALTER TABLE "price_book_items" ADD COLUMN     "estimated_duration_hours" DOUBLE PRECISION,
ADD COLUMN     "recognition_tags" JSONB;

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "auto_reminders_paused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "follow_up_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "active_job_id" TEXT,
ADD COLUMN     "check_in_frequency_hours" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "name" TEXT;

-- CreateTable
CREATE TABLE "follow_ups" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "type" "FollowUpType" NOT NULL,
    "reference_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "scheduled_for" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "channel" "FollowUpChannel" NOT NULL DEFAULT 'SMS',
    "status" "FollowUpStatus" NOT NULL DEFAULT 'Scheduled',
    "tone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_checkins" (
    "id" TEXT NOT NULL,
    "job_id" TEXT,
    "staff_id" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "received_at" TIMESTAMP(3),
    "message" TEXT,
    "status" "TeamCheckinStatus" NOT NULL DEFAULT 'Pending',
    "escalated" BOOLEAN NOT NULL DEFAULT false,
    "escalated_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_checkins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transactions" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "vendor" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "category" TEXT,
    "confidence" DOUBLE PRECISION,
    "source" TEXT,
    "is_income" BOOLEAN NOT NULL DEFAULT false,
    "receipt_url" TEXT,
    "raw_description" TEXT,
    "normalized_vendor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorization_rules" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "vendor_pattern" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "auto_apply" BOOLEAN NOT NULL DEFAULT true,
    "last_applied_at" TIMESTAMP(3),
    "match_count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorization_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_event_logs" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" TEXT,
    "details" JSONB,
    "job_id" TEXT,
    "customer_id" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_event_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_active_job_id_fkey" FOREIGN KEY ("active_job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_checkins" ADD CONSTRAINT "team_checkins_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_checkins" ADD CONSTRAINT "team_checkins_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_event_logs" ADD CONSTRAINT "ai_event_logs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_event_logs" ADD CONSTRAINT "ai_event_logs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_event_logs" ADD CONSTRAINT "ai_event_logs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
