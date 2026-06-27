-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('DINE_IN', 'TAKEAWAY', 'DELIVERY');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "orderType" "OrderType" NOT NULL DEFAULT 'DINE_IN';
