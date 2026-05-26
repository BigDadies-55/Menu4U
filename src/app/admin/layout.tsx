import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isSuperAdmin = session.user.role === "SUPER_ADMIN";

  if (!isSuperAdmin) {
    let user: { emailVerified: Date | null; termsAccepted: boolean } | null = null;
    try {
      user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { emailVerified: true, termsAccepted: true },
      });
    } catch {
      // DB columns may not exist yet — allow access until migration runs
    }

    if (!user?.emailVerified) redirect("/verify-email");
    if (!user?.termsAccepted) redirect("/terms");
  }

  // Determine which KDS views this user can see
  let kdsView = "ALL";
  if (!isSuperAdmin) {
    try {
      const link = await prisma.restaurantUser.findFirst({
        where: { userId: session.user.id },
        include: { restaurant: { select: { kdsView: true } } },
      });
      kdsView = link?.restaurant?.kdsView ?? "STATION_DARK";
    } catch {
      kdsView = "STATION_DARK";
    }
  }

  // Load site config — try with newest columns first, degrade gracefully
  let adminPalette  = "dark";
  let adminBg       = "#1a1d23";
  let adminBgImage: string | null = null;
  let siteLogo: string | null = null;
  let siteName = "Menu4U";
  let adminSidebarBg: string | null = null;
  let adminSidebarAccent: string | null = null;
  let adminSidebarTextColor = "#9ca3af";
  let adminContentTextColor = "#e9ecef";
  let adminTopBarBg: string | null = null;
  let adminTopBarTextColor = "#374151";
  try {
    // Full query (all columns including recently added ones)
    type FullRow = {
      adminPalette: string; adminBg: string; adminBgImage: string | null;
      logo: string | null; siteName: string;
      adminSidebarBg: string | null; adminSidebarAccent: string | null;
      adminSidebarTextColor: string; adminContentTextColor: string;
      adminTopBarBg: string | null; adminTopBarTextColor: string;
    };
    const rows = await prisma.$queryRaw<FullRow[]>`
      SELECT "adminPalette", "adminBg", "adminBgImage", "logo", "siteName",
             "adminSidebarBg", "adminSidebarAccent",
             "adminSidebarTextColor", "adminContentTextColor",
             "adminTopBarBg", "adminTopBarTextColor"
      FROM "SiteConfig" WHERE id = 'default' LIMIT 1
    `;
    // Detect light backgrounds (plain hex starting with #f/#e/#d/#c/#b/#a, or light gradients)
    function isLightBg(bg: string): boolean {
      if (!bg) return true;
      // Plain light hex: #f..., #e..., #d..., #c..., #b..., #a..., #9...
      if (/^#[98765432fedcbaFEDCBA]/i.test(bg)) return true;
      // Gradient — light if it doesn't contain any dark hex (#0xx, #1xx, #2xx, #3xx)
      if (bg.includes("gradient") && !/gradient.*#[0-3][0-9a-fA-F]{4,5}/i.test(bg)) return true;
      return false;
    }
    function isLightText(t: string): boolean {
      return /^#[0-6]/i.test(t);
    }

    if (rows[0]) {
      adminPalette           = rows[0].adminPalette           ?? "dark";
      const rawBg            = rows[0].adminBg                ?? "#1a1d23";
      adminBg                = isLightBg(rawBg) ? "#1a1d23" : rawBg;
      adminBgImage           = rows[0].adminBgImage           ?? null;
      siteLogo               = rows[0].logo                   ?? null;
      siteName               = rows[0].siteName               ?? "Menu4U";
      adminSidebarBg         = rows[0].adminSidebarBg         ?? null;
      adminSidebarAccent     = rows[0].adminSidebarAccent     ?? null;
      adminSidebarTextColor  = rows[0].adminSidebarTextColor  ?? "#9ca3af";
      const rawText          = rows[0].adminContentTextColor  ?? "#e9ecef";
      adminContentTextColor  = isLightText(rawText) ? "#e9ecef" : rawText;
      adminTopBarBg          = rows[0].adminTopBarBg          ?? null;
      adminTopBarTextColor   = rows[0].adminTopBarTextColor   ?? "#adb5bd";
    }
  } catch {
    // Newer columns may not exist — fall back to base columns only
    try {
      type BaseRow = { adminPalette: string; logo: string | null; siteName: string };
      const rows = await prisma.$queryRaw<BaseRow[]>`
        SELECT "adminPalette", "logo", "siteName"
        FROM "SiteConfig" WHERE id = 'default' LIMIT 1
      `;
      if (rows[0]) {
        adminPalette = rows[0].adminPalette ?? "dark";
        siteLogo     = rows[0].logo         ?? null;
        siteName     = rows[0].siteName     ?? "Menu4U";
      }
    } catch {
      // Table doesn't exist yet — use defaults
    }
  }

  return (
    <AdminShell
      user={session.user}
      kdsView={kdsView}
      adminPalette={adminPalette}
      adminBg={adminBg}
      adminBgImage={adminBgImage}
      siteLogo={siteLogo}
      siteName={siteName}
      adminSidebarBg={adminSidebarBg}
      adminSidebarAccent={adminSidebarAccent}
      adminSidebarTextColor={adminSidebarTextColor}
      adminContentTextColor={adminContentTextColor}
      adminTopBarBg={adminTopBarBg}
      adminTopBarTextColor={adminTopBarTextColor}
    >
      {children}
    </AdminShell>
  );
}
