-- Add splashImage field to Restaurant for custom landing page background
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "splashImage" TEXT;
