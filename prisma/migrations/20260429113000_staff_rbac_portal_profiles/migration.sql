-- Staff RBAC, portal, and personal profile support.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
    CREATE TYPE "UserRole" AS ENUM ('admin', 'staff');
  END IF;
END $$;

ALTER TYPE "QuoteStatus" ADD VALUE IF NOT EXISTS 'Accepted';

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'admin';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "business_id" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "staff_id" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone_number" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" TEXT;

ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "availability_schedule" JSONB;
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "current_status" TEXT NOT NULL DEFAULT 'Clocked Out';

ALTER TABLE "timesheets" ADD COLUMN IF NOT EXISTS "break_started_at" TIMESTAMP(3);
ALTER TABLE "timesheets" ADD COLUMN IF NOT EXISTS "accumulated_break_minutes" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "site_notes" TEXT;

UPDATE "users" u
SET "business_id" = b."id"
FROM "businesses" b
WHERE b."owner_id" = u."id"
  AND u."business_id" IS NULL;

UPDATE "users" u
SET "phone_number" = s."phone"
FROM "staff" s
WHERE u."staff_id" = s."id"
  AND u."phone_number" IS NULL
  AND s."phone" IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_business_id_fkey'
  ) THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "users_business_id_fkey"
      FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_staff_id_fkey'
  ) THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "users_staff_id_fkey"
      FOREIGN KEY ("staff_id") REFERENCES "staff"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "users_staff_id_key" ON "users"("staff_id");
CREATE INDEX IF NOT EXISTS "users_business_id_idx" ON "users"("business_id");
CREATE INDEX IF NOT EXISTS "staff_business_status_idx" ON "staff"("business_id", "current_status");
