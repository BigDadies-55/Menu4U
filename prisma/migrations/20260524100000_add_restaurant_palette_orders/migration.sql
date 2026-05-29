-- Add missing Restaurant columns that were in the schema but never migrated

ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "menuPalette"     TEXT NOT NULL DEFAULT '0';
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "menuPaletteData" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "ordersEnabled"   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "tableLayoutJson" TEXT;
