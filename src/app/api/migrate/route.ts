import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await auth();
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";
  const hasSecret = secret && process.env.SETUP_SECRET && secret === process.env.SETUP_SECRET;

  if (!isSuperAdmin && !hasSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'OWNER' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Role')) THEN
          ALTER TYPE "Role" ADD VALUE 'OWNER';
        END IF;
      END $$;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "phone2" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "orderPhone" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT '{}';
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "locationUrl" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Menu" ADD COLUMN IF NOT EXISTS "isPrimary" BOOLEAN NOT NULL DEFAULT false;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Menu" ADD COLUMN IF NOT EXISTS "scheduleDays" TEXT[] DEFAULT '{}';
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Menu" ADD COLUMN IF NOT EXISTS "scheduleFrom" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Menu" ADD COLUMN IF NOT EXISTS "scheduleTo" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "MenuView" (
        "id" TEXT NOT NULL,
        "restaurantId" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "refId" TEXT,
        "refName" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "MenuView_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "MenuView_restaurantId_fkey" FOREIGN KEY ("restaurantId")
          REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "menuTheme" TEXT NOT NULL DEFAULT 'luxury';
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AuditLog" (
        "id"         TEXT NOT NULL,
        "userId"     TEXT,
        "userEmail"  TEXT,
        "action"     TEXT NOT NULL,
        "entity"     TEXT,
        "entityId"   TEXT,
        "entityName" TEXT,
        "meta"       JSONB,
        "ip"         TEXT,
        "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt" DESC);
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "subscriptionFrom" TIMESTAMP(3);
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "subscriptionTo" TIMESTAMP(3);
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "termsAccepted" BOOLEAN NOT NULL DEFAULT false;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "termsAcceptedIp" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "termsAcceptedUserAgent" TEXT;
    `);
    // Mark all existing users (created before email-OTP feature) as already verified
    await prisma.$executeRawUnsafe(`
      UPDATE "User" SET "emailVerified" = "createdAt" WHERE "emailVerified" IS NULL;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "menuPalette" TEXT NOT NULL DEFAULT '0';
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "menuPaletteData" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "ordersEnabled" BOOLEAN NOT NULL DEFAULT false;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "tableLayoutJson" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "kdsView" TEXT NOT NULL DEFAULT 'STATION_DARK';
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "customDomain" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "copyright" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SiteConfig" (
        "id"           TEXT NOT NULL DEFAULT 'default',
        "siteName"     TEXT NOT NULL DEFAULT 'Menu4U',
        "logo"         TEXT,
        "domain"       TEXT,
        "copyright"    TEXT,
        "adminPalette" TEXT NOT NULL DEFAULT 'dark',
        "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SiteConfig_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(`
      INSERT INTO "SiteConfig" ("id", "updatedAt") VALUES ('default', NOW()) ON CONFLICT DO NOTHING;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "adminBg" TEXT NOT NULL DEFAULT '#f0ece3';
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "adminBgImage" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "adminSidebarBg" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "adminSidebarAccent" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "adminSidebarTextColor" TEXT NOT NULL DEFAULT '#9ca3af';
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "adminContentTextColor" TEXT NOT NULL DEFAULT '#111827';
    `);
    await logAudit({ action: "RUN_MIGRATION", entity: "system" });
    return NextResponse.json({ success: true, message: "Migrations applied" });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
