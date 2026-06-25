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
      ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "adminBg" TEXT NOT NULL DEFAULT '#f7f5f2';
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
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "adminTopBarBg" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "adminTopBarTextColor" TEXT NOT NULL DEFAULT '#374151';
    `);
    await prisma.$executeRawUnsafe(`
  CREATE TABLE IF NOT EXISTS "Customer" (
    "id"           TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "phone"        TEXT,
    "email"        TEXT,
    "notes"        TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Customer_restaurantId_fkey" FOREIGN KEY ("restaurantId")
      REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE
  );
`);
    await prisma.$executeRawUnsafe(`
  CREATE INDEX IF NOT EXISTS "Customer_restaurantId_idx" ON "Customer"("restaurantId");
`);
    // Customer OTP + verification columns
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "otpHash"    TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "otpExpiry"  TIMESTAMP(3);
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "isVerified" BOOLEAN NOT NULL DEFAULT false;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "couponCode" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'he';
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "translations" JSONB;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "translations" JSONB;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Restaurant" ALTER COLUMN "menuTheme" SET DEFAULT 'elegant';
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "welcomeText" TEXT;
    `);
    // Course management + POS source + timing fields
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "orderSource" TEXT NOT NULL DEFAULT 'CUSTOMER';
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "course" INTEGER NOT NULL DEFAULT 1;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "heldUntilFired" BOOLEAN NOT NULL DEFAULT false;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "firedAt" TIMESTAMP(3);
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "doneAt" TIMESTAMP(3);
    `);
    // OrderItem: comp support
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "servedAt" TIMESTAMP(3);
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "isComped" BOOLEAN NOT NULL DEFAULT false;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "compReason" TEXT;
    `);
    // WaiterStation: station assignment
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "WaiterStation" (
        "id"           TEXT NOT NULL,
        "restaurantId" TEXT NOT NULL,
        "userId"       TEXT NOT NULL,
        "tableNumbers" TEXT[] DEFAULT '{}',
        "label"        TEXT,
        "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "WaiterStation_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "WaiterStation_restaurantId_fkey" FOREIGN KEY ("restaurantId")
          REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "WaiterStation_userId_fkey" FOREIGN KEY ("userId")
          REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "WaiterStation_restaurantId_userId_key" UNIQUE ("restaurantId", "userId")
      );
    `);
    // ── User: security / TOTP / onboarding columns ──
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User"
        ADD COLUMN IF NOT EXISTS "mustChangePassword"  BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "passwordChangedAt"   TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "lastActivityAt"      TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "lastLoginAt"         TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "lockedUntil"         TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "totpSecret"          TEXT,
        ADD COLUMN IF NOT EXISTS "totpPendingSecret"   TEXT,
        ADD COLUMN IF NOT EXISTS "totpEnabled"         BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "managerPin"          TEXT,
        ADD COLUMN IF NOT EXISTS "status"              TEXT NOT NULL DEFAULT 'PENDING',
        ADD COLUMN IF NOT EXISTS "username"            TEXT,
        ADD COLUMN IF NOT EXISTS "firstName"           TEXT,
        ADD COLUMN IF NOT EXISTS "lastName"            TEXT,
        ADD COLUMN IF NOT EXISTS "phone"               TEXT;
    `);
    // ── InviteStatus enum + UserInvite table ──
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InviteStatus') THEN
          CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'COMPLETED', 'EXPIRED', 'CANCELLED');
        END IF;
      END $$;
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "UserInvite" (
        "id"             TEXT         NOT NULL,
        "token"          TEXT         NOT NULL,
        "firstName"      TEXT         NOT NULL,
        "lastName"       TEXT         NOT NULL,
        "email"          TEXT,
        "phone"          TEXT,
        "role"           "Role"       NOT NULL,
        "restaurantIds"  TEXT[]       NOT NULL DEFAULT '{}',
        "invitedById"    TEXT         NOT NULL,
        "status"         "InviteStatus" NOT NULL DEFAULT 'PENDING',
        "expiresAt"      TIMESTAMP(3) NOT NULL,
        "reminderSentAt" TIMESTAMP(3),
        "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "UserInvite_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "UserInvite_token_key" UNIQUE ("token"),
        CONSTRAINT "UserInvite_invitedById_fkey"
          FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "UserInvite_token_idx"  ON "UserInvite"("token");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "UserInvite_status_idx" ON "UserInvite"("status");`);
    // ── OtpCode table ──
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "OtpCode" (
        "id"         TEXT         NOT NULL,
        "identifier" TEXT         NOT NULL,
        "channel"    TEXT         NOT NULL,
        "code"       TEXT         NOT NULL,
        "expires"    TIMESTAMP(3) NOT NULL,
        "attempts"   INT          NOT NULL DEFAULT 0,
        CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "OtpCode_identifier_idx" ON "OtpCode"("identifier");`);
    // ── BARTENDER role ──
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'BARTENDER' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Role')) THEN
          ALTER TYPE "Role" ADD VALUE 'BARTENDER';
        END IF;
      END $$;
    `);
    // ── Category course ──
    await prisma.$executeRawUnsafe(`ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "course" INTEGER NOT NULL DEFAULT 1;`);

    await logAudit({ action: "RUN_MIGRATION", entity: "system" });
    return NextResponse.json({ success: true, message: "Migrations applied" });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
