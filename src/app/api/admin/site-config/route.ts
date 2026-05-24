import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const DEFAULTS = {
  id: "default", siteName: "Menu4U", logo: null, domain: null,
  copyright: null, adminPalette: "dark", adminBg: "#f0ece3", adminBgImage: null,
  adminSidebarBg: null, adminSidebarAccent: null,
  adminSidebarTextColor: "#9ca3af", adminContentTextColor: "#111827",
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
  const { siteName, logo, domain, copyright, adminPalette, adminBg, adminBgImage,
          adminSidebarBg, adminSidebarAccent, adminSidebarTextColor, adminContentTextColor } = body;
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
        "updatedAt"              = NOW()
      WHERE id = 'default'
    `, siteName ?? "Menu4U", logo ?? null, domain ?? null,
       copyright ?? null, adminPalette ?? "dark",
       adminBg ?? "#f0ece3", adminBgImage ?? null,
       adminSidebarBg ?? null, adminSidebarAccent ?? null,
       adminSidebarTextColor ?? "#9ca3af", adminContentTextColor ?? "#111827");
    await logAudit({ action: "UPDATE_SITE_CONFIG", entity: "SiteConfig" });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Table not found – run /api/migrate first" }, { status: 500 });
  }
}
