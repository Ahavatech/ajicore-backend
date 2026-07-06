ALTER TABLE "customers"
  ALTER COLUMN "first_name" DROP NOT NULL,
  ALTER COLUMN "last_name" DROP NOT NULL;

ALTER TABLE "jobs"
  ADD COLUMN IF NOT EXISTS "estimated_time" TEXT;
