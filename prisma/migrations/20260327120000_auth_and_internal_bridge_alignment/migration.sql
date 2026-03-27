ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "phone_otp" TEXT,
ADD COLUMN IF NOT EXISTS "phone_otp_expires_at" TIMESTAMP(3);

ALTER TABLE "businesses"
ADD COLUMN IF NOT EXISTS "business_structure" TEXT,
ADD COLUMN IF NOT EXISTS "internal_api_token" TEXT;

UPDATE "businesses"
SET "internal_api_token" = md5("id" || clock_timestamp()::text)
WHERE "internal_api_token" IS NULL;

ALTER TABLE "businesses"
ALTER COLUMN "internal_api_token" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "businesses_internal_api_token_key"
ON "businesses"("internal_api_token");
