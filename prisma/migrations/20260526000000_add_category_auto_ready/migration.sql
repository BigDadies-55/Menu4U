-- Add autoReady flag to Category
-- When true, order items in this category are marked DONE immediately (no kitchen routing)
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "autoReady" BOOLEAN NOT NULL DEFAULT false;
