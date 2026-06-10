-- AlterTable: add adminPalette to Restaurant (if not already present)
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "adminPalette" TEXT NOT NULL DEFAULT 'dark';
