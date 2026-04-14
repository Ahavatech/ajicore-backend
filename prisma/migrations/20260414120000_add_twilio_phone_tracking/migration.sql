ALTER TABLE "businesses"
ADD COLUMN "twilio_phone_sid" TEXT,
ADD COLUMN "twilio_phone_friendly_name" TEXT;

CREATE UNIQUE INDEX "businesses_twilio_phone_sid_key" ON "businesses"("twilio_phone_sid");
