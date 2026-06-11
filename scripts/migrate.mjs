import pg from "pg";
const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL });

const sqls = [
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'OWNER' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Role')) THEN
      ALTER TYPE "Role" ADD VALUE 'OWNER';
    END IF;
  END $$;`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'SHIFT_MANAGER' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Role')) THEN
      ALTER TYPE "Role" ADD VALUE 'SHIFT_MANAGER';
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
  `CREATE TABLE IF NOT EXISTS "ItemModifierGroup" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "itemId" TEXT NOT NULL REFERENCES "Item"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "maxSelect" INTEGER NOT NULL DEFAULT 1,
  "order" INTEGER NOT NULL DEFAULT 0
)`,
  `CREATE TABLE IF NOT EXISTS "ItemModifier" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "groupId" TEXT NOT NULL REFERENCES "ItemModifierGroup"("id") ON DELETE CASCADE,
  "label" TEXT NOT NULL,
  "priceAdd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "order" INTEGER NOT NULL DEFAULT 0
)`,
  `CREATE TABLE IF NOT EXISTS "OrderItemModifier" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orderItemId" TEXT NOT NULL REFERENCES "OrderItem"("id") ON DELETE CASCADE,
  "groupName" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "priceAdd" DOUBLE PRECISION NOT NULL DEFAULT 0
)`,
  `ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "servedAt" TIMESTAMP(3);`,
  `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "coversCount" INTEGER;`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3);`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP(3);`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);`,
  `CREATE TABLE IF NOT EXISTS "PasswordPolicy" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "maxAgeDays" INTEGER NOT NULL DEFAULT 0,
    "minLength" INTEGER NOT NULL DEFAULT 8,
    "requireUppercase" BOOLEAN NOT NULL DEFAULT false,
    "requireNumbers" BOOLEAN NOT NULL DEFAULT false,
    "requireSymbols" BOOLEAN NOT NULL DEFAULT false,
    "idleTimeoutMinutes" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordPolicy_pkey" PRIMARY KEY ("id")
  );`,
  `ALTER TABLE "PasswordPolicy" ADD COLUMN IF NOT EXISTS "historyCount" INTEGER NOT NULL DEFAULT 3;`,
  `CREATE TABLE IF NOT EXISTS "PasswordHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordHistory_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PasswordHistory_userId_fkey" FOREIGN KEY ("userId")
      REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,
  `CREATE INDEX IF NOT EXISTS "PasswordHistory_userId_idx" ON "PasswordHistory"("userId");`,
  // Auth security: account lockout + TOTP
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpSecret" TEXT;`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpEnabled" BOOLEAN NOT NULL DEFAULT false;`,
  `ALTER TABLE "LoyaltyMember" ADD COLUMN IF NOT EXISTS "lastSmsSentAt" TIMESTAMP(3);`,
  // Waiter tracking fields for per-table timeline
  `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;`,
  `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "closedByUserId" TEXT;`,
  `ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "servedByUserId" TEXT;`,
  // Waiter station assignments
  `CREATE TABLE IF NOT EXISTS "WaiterStation" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tableNumbers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WaiterStation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WaiterStation_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE,
    CONSTRAINT "WaiterStation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "WaiterStation_restaurantId_userId_key" ON "WaiterStation"("restaurantId", "userId");`,
  // allergens on Item
  `ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "allergens" TEXT[] DEFAULT '{}';`,
  // manager PIN for void/comp
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "managerPin" TEXT;`,
  // Push subscriptions
  `CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "endpoint"  TEXT NOT NULL,
    "p256dh"    TEXT NOT NULL,
    "auth"      TEXT NOT NULL,
    "events"    TEXT[] NOT NULL DEFAULT ARRAY['ORDER_CREATED','COURSE_DONE','TABLE_PAYMENT','ITEM_VOID']::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_userId_endpoint_key" ON "PushSubscription"("userId","endpoint");`,
  // Shifts
  `CREATE TABLE IF NOT EXISTS "Shift" (
    "id"           TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "date"         TEXT NOT NULL,
    "shiftType"    TEXT NOT NULL,
    "startTime"    TEXT NOT NULL,
    "endTime"      TEXT NOT NULL,
    "role"         TEXT,
    "notes"        TEXT,
    "status"       TEXT NOT NULL DEFAULT 'SCHEDULED',
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Shift_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE,
    CONSTRAINT "Shift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS "ShiftRequest" (
    "id"           TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "shiftId"      TEXT NOT NULL,
    "fromUserId"   TEXT NOT NULL,
    "toUserId"     TEXT,
    "type"         TEXT NOT NULL,
    "reason"       TEXT,
    "status"       TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShiftRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ShiftRequest_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE,
    CONSTRAINT "ShiftRequest_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE,
    CONSTRAINT "ShiftRequest_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE,
    CONSTRAINT "ShiftRequest_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE SET NULL
  );`,
  `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "shiftConfig" TEXT;`,
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
