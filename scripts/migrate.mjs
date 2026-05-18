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
