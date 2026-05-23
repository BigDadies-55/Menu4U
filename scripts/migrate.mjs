import pg from "pg";
const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL });

const sqls = [
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'OWNER' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Role')) THEN
      ALTER TYPE "Role" ADD VALUE 'OWNER';
    END IF;
  END $$;`,
  `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "phone2" TEXT;`,
  `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "orderPhone" TEXT;`,
  `ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT '{}';`,
  `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "locationUrl" TEXT;`,
  `ALTER TABLE "Menu" ADD COLUMN IF NOT EXISTS "isPrimary" BOOLEAN NOT NULL DEFAULT false;`,
  `ALTER TABLE "Menu" ADD COLUMN IF NOT EXISTS "scheduleDays" TEXT[] DEFAULT '{}';`,
  `ALTER TABLE "Menu" ADD COLUMN IF NOT EXISTS "scheduleFrom" TEXT;`,
  `ALTER TABLE "Menu" ADD COLUMN IF NOT EXISTS "scheduleTo" TEXT;`,
  `CREATE TABLE IF NOT EXISTS "MenuView" (
    "id" TEXT NOT NULL, "restaurantId" TEXT NOT NULL, "type" TEXT NOT NULL,
    "refId" TEXT, "refName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MenuView_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MenuView_restaurantId_fkey" FOREIGN KEY ("restaurantId")
      REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,
  `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "menuTheme" TEXT NOT NULL DEFAULT 'luxury';`,
  `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "menuPalette" TEXT NOT NULL DEFAULT '0'`,
  `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "menuPaletteData" TEXT`,
  `CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL, "userId" TEXT, "userEmail" TEXT, "action" TEXT NOT NULL,
    "entity" TEXT, "entityId" TEXT, "entityName" TEXT, "meta" JSONB, "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt" DESC);`,
  `CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");`,
  `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "subscriptionFrom" TIMESTAMP(3);`,
  `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "subscriptionTo" TIMESTAMP(3);`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "termsAccepted" BOOLEAN NOT NULL DEFAULT false;`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "termsAcceptedIp" TEXT;`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "termsAcceptedUserAgent" TEXT;`,
  `UPDATE "User" SET "emailVerified" = "createdAt" WHERE "emailVerified" IS NULL;`,
  `ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'WAITER';`,
  `ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'DISPLAY';`,
  `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "ordersEnabled" BOOLEAN NOT NULL DEFAULT false;`,
  `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "tableLayoutJson" TEXT;`,
  `ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "prepTime" INTEGER;`,
  `CREATE TABLE IF NOT EXISTS "OrderStatusLog" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedBy" TEXT,
    CONSTRAINT "OrderStatusLog_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrderStatusLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE
  );`,
  `CREATE INDEX IF NOT EXISTS "OrderStatusLog_orderId_idx" ON "OrderStatusLog"("orderId");`,
  `CREATE INDEX IF NOT EXISTS "OrderStatusLog_changedAt_idx" ON "OrderStatusLog"("changedAt" DESC);`,
  `ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "itemStatus" TEXT NOT NULL DEFAULT 'PENDING';`,
  `CREATE TABLE IF NOT EXISTS "TableSession" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "tableNumber" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TableSession_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TableSession_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE
  );`,
  `CREATE INDEX IF NOT EXISTS "TableSession_restaurantId_idx" ON "TableSession"("restaurantId");`,
  `CREATE INDEX IF NOT EXISTS "TableSession_closedAt_idx" ON "TableSession"("closedAt" DESC);`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PAID' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'OrderStatus')) THEN
      ALTER TYPE "OrderStatus" ADD VALUE 'PAID';
    END IF;
  END $$;`,
];

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("[migrate] No DATABASE_URL — skipping.");
    return;
  }
  await client.connect();
  console.log("[migrate] Running...");
  for (const sql of sqls) {
    try { await client.query(sql); } catch (e) { console.warn("[migrate] warn:", e.message); }
  }
  await client.end();
  console.log("[migrate] Done.");
}

run().catch(e => { console.error("[migrate] Fatal:", e.message); process.exit(0); });
