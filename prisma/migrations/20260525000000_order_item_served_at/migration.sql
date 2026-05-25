-- Add servedAt to OrderItem to track per-dish physical serving

ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "servedAt" TIMESTAMP(3);
