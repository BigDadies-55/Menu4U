import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const DEFAULTS = {
  id: "default", siteName: "Menu4U", logo: null, domain: null,
  copyright: null, adminPalette: "dark", adminBg: "#f0ece3", adminBgImage: null,
  adminSidebarBg: null, adminSidebarAccent: null,
  adminSidebarTextColor: "#9ca3af", adminContentTextColor: "#111827",
  adminTopBarBg: null as string | null, adminTopBarTextColor: "#374151",
  // extended fields
  contactEmail: null as string | null, contactPhone: null as string | null,
  address: null as string | null,
  timezone: "Asia/Jerusalem", currency: "ILS", interfaceLanguage: "he",
  privacyUrl: null as string | null, termsUrl: null as string | null,
  showPrivacyPolicy: true, enableLoyaltyPoints: true,
  enableOnlineOrders: false, showPrices: true,
};

export async function GET() {
  try {
    const rows = await prisma.$queryRaw<typeof DEFAULTS[]>`
      SELECT * FROM "SiteConfig" WHERE id = 'default' LIMIT 1
    `;
    return NextResponse.json(rows[0] ?? DEFAULTS);
  } catch {
    return NextResponse.json(DEFAULTS);
  }
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const {
    siteName, logo, domain, copyright, adminPalette, adminBg, adminBgImage,
    adminSidebarBg, adminSidebarAccent, adminSidebarTextColor, adminContentTextColor,
    adminTopBarBg, adminTopBarTextColor,
    contactEmail, contactPhone, address,
    timezone, currency, interfaceLanguage,
    privacyUrl, termsUrl,
    showPrivacyPolicy, enableLoyaltyPoints, enableOnlineOrders, showPrices,
  } = body;
  try {
    // Ensure all optional columns exist before writing
    await Promise.allSettled([
      prisma.$executeRawUnsafe(`ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "adminBg" TEXT NOT NULL DEFAULT '#f7f5f2'`),
      prisma.$executeRawUnsafe(`ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "adminBgImage" TEXT`),
      prisma.$executeRawUnsafe(`ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "adminSidebarBg" TEXT`),
      prisma.$executeRawUnsafe(`ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "adminSidebarAccent" TEXT`),
      prisma.$executeRawUnsafe(`ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "adminSidebarTextColor" TEXT NOT NULL DEFAULT '#9ca3af'`),
      prisma.$executeRawUnsafe(`ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "adminContentTextColor" TEXT NOT NULL DEFAULT '#111827'`),
      prisma.$executeRawUnsafe(`ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "adminTopBarBg" TEXT`),
      prisma.$executeRawUnsafe(`ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "adminTopBarTextColor" TEXT NOT NULL DEFAULT '#374151'`),
      prisma.$executeRawUnsafe(`ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "logo" TEXT`),
      prisma.$executeRawUnsafe(`ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "domain" TEXT`),
      prisma.$executeRawUnsafe(`ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "copyright" TEXT`),
      prisma.$executeRawUnsafe(`ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT`),
      prisma.$executeRawUnsafe(`ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT`),
      prisma.$executeRawUnsafe(`ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "address" TEXT`),
      prisma.$executeRawUnsafe(`ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'Asia/Jerusalem'`),
      prisma.$executeRawUnsafe(`ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'ILS'`),
      prisma.$executeRawUnsafe(`ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "interfaceLanguage" TEXT NOT NULL DEFAULT 'he'`),
      prisma.$executeRawUnsafe(`ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "privacyUrl" TEXT`),
      prisma.$executeRawUnsafe(`ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "termsUrl" TEXT`),
      prisma.$executeRawUnsafe(`ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "showPrivacyPolicy" BOOLEAN NOT NULL DEFAULT true`),
      prisma.$executeRawUnsafe(`ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "enableLoyaltyPoints" BOOLEAN NOT NULL DEFAULT true`),
      prisma.$executeRawUnsafe(`ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "enableOnlineOrders" BOOLEAN NOT NULL DEFAULT false`),
      prisma.$executeRawUnsafe(`ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "showPrices" BOOLEAN NOT NULL DEFAULT true`),
    ]);

    // Ensure the row exists
    await prisma.$executeRawUnsafe(
      `INSERT INTO "SiteConfig" (id, "updatedAt") VALUES ('default', NOW()) ON CONFLICT (id) DO NOTHING`
    );

    // Now update all fields
    await prisma.$executeRawUnsafe(`
      UPDATE "SiteConfig" SET
        "siteName"               = $1,
        "logo"                   = $2,
        "domain"                 = $3,
        "copyright"              = $4,
        "adminPalette"           = $5,
        "adminBg"                = $6,
        "adminBgImage"           = $7,
        "adminSidebarBg"         = $8,
        "adminSidebarAccent"     = $9,
        "adminSidebarTextColor"  = $10,
        "adminContentTextColor"  = $11,
        "adminTopBarBg"          = $12,
        "adminTopBarTextColor"   = $13,
        "contactEmail"           = $14,
        "contactPhone"           = $15,
        "address"                = $16,
        "timezone"               = $17,
        "currency"               = $18,
        "interfaceLanguage"      = $19,
        "privacyUrl"             = $20,
        "termsUrl"               = $21,
        "showPrivacyPolicy"      = $22,
        "enableLoyaltyPoints"    = $23,
        "enableOnlineOrders"     = $24,
        "showPrices"             = $25,
        "updatedAt"              = NOW()
      WHERE id = 'default'
    `,
      siteName ?? "Menu4U", logo ?? null, domain ?? null,
      copyright ?? null, adminPalette ?? "dark",
      adminBg ?? "#f0ece3", adminBgImage ?? null,
      adminSidebarBg ?? null, adminSidebarAccent ?? null,
      adminSidebarTextColor ?? "#9ca3af", adminContentTextColor ?? "#111827",
      adminTopBarBg ?? null, adminTopBarTextColor ?? "#374151",
      contactEmail ?? null, contactPhone ?? null, address ?? null,
      timezone ?? "Asia/Jerusalem", currency ?? "ILS", interfaceLanguage ?? "he",
      privacyUrl ?? null, termsUrl ?? null,
      showPrivacyPolicy ?? true, enableLoyaltyPoints ?? true,
      enableOnlineOrders ?? false, showPrices ?? true,
    );

    await logAudit({ action: "UPDATE_SITE_CONFIG", entity: "SiteConfig" });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[site-config PATCH]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
