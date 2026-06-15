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
  const vals = [
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
  ];
  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "SiteConfig" (
        id, "siteName", "logo", "domain", "copyright",
        "adminPalette", "adminBg", "adminBgImage",
        "adminSidebarBg", "adminSidebarAccent", "adminSidebarTextColor", "adminContentTextColor",
        "adminTopBarBg", "adminTopBarTextColor",
        "contactEmail", "contactPhone", "address",
        "timezone", "currency", "interfaceLanguage",
        "privacyUrl", "termsUrl",
        "showPrivacyPolicy", "enableLoyaltyPoints", "enableOnlineOrders", "showPrices",
        "updatedAt"
      ) VALUES (
        'default', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        "siteName"              = EXCLUDED."siteName",
        "logo"                  = EXCLUDED."logo",
        "domain"                = EXCLUDED."domain",
        "copyright"             = EXCLUDED."copyright",
        "adminPalette"          = EXCLUDED."adminPalette",
        "adminBg"               = EXCLUDED."adminBg",
        "adminBgImage"          = EXCLUDED."adminBgImage",
        "adminSidebarBg"        = EXCLUDED."adminSidebarBg",
        "adminSidebarAccent"    = EXCLUDED."adminSidebarAccent",
        "adminSidebarTextColor" = EXCLUDED."adminSidebarTextColor",
        "adminContentTextColor" = EXCLUDED."adminContentTextColor",
        "adminTopBarBg"         = EXCLUDED."adminTopBarBg",
        "adminTopBarTextColor"  = EXCLUDED."adminTopBarTextColor",
        "contactEmail"          = EXCLUDED."contactEmail",
        "contactPhone"          = EXCLUDED."contactPhone",
        "address"               = EXCLUDED."address",
        "timezone"              = EXCLUDED."timezone",
        "currency"              = EXCLUDED."currency",
        "interfaceLanguage"     = EXCLUDED."interfaceLanguage",
        "privacyUrl"            = EXCLUDED."privacyUrl",
        "termsUrl"              = EXCLUDED."termsUrl",
        "showPrivacyPolicy"     = EXCLUDED."showPrivacyPolicy",
        "enableLoyaltyPoints"   = EXCLUDED."enableLoyaltyPoints",
        "enableOnlineOrders"    = EXCLUDED."enableOnlineOrders",
        "showPrices"            = EXCLUDED."showPrices",
        "updatedAt"             = NOW()
    `, ...vals);
    await logAudit({ action: "UPDATE_SITE_CONFIG", entity: "SiteConfig" });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[site-config PATCH]", e);
    return NextResponse.json({ error: "DB error – run /api/migrate first" }, { status: 500 });
  }
}
