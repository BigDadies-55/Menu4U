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
  } catch {
    return NextResponse.json({ error: "Table not found – run /api/migrate first" }, { status: 500 });
  }
}
