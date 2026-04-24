-- Add quote line items + decline reason
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "decline_reason" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "line_items" JSONB;

-- Add provider to fleet repairs
ALTER TABLE "fleet_repairs" ADD COLUMN IF NOT EXISTS "provider" TEXT;
