import { auth } from "@/lib/auth";
import { T, ADMIN_PALETTES } from "@/lib/ui";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user as { requires2fa?: boolean }).requires2fa) redirect("/verify-2fa");
  if (session.user.mustChangePassword) redirect("/change-password");

  const isSuperAdmin = session.user.role === "SUPER_ADMIN";

  if (!isSuperAdmin) {
    let user: { emailVerified: Date | null; termsAccepted: boolean; username?: string | null; status?: string } | null = null;
    try {
      user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { emailVerified: true, termsAccepted: true, username: true, status: true },
      });
    } catch {
      // DB columns may not exist yet — allow access until migration runs
    }

    if (!user?.emailVerified) redirect("/verify-email");
    if (!(user as { username?: string | null })?.username) redirect("/onboarding/username");
    if ((user as { status?: string })?.status === "PENDING") redirect("/onboarding/profile");
    if (!user?.termsAccepted) redirect("/terms");
  }

  // Determine which KDS views this user can see + per-restaurant palette
  let kdsView = "ALL";
  let restaurantPalette = "dark";
  if (!isSuperAdmin) {
    try {
      const link = await prisma.restaurantUser.findFirst({
        where: { userId: session.user.id },
        include: { restaurant: { select: { kdsView: true, adminPalette: true } } },
      });
      kdsView           = link?.restaurant?.kdsView      ?? "STATION_DARK";
      restaurantPalette = (link?.restaurant as { adminPalette?: string })?.adminPalette ?? "dark";
    } catch {
      kdsView = "STATION_DARK";
    }
  }

  // Load site config — try with newest columns first, degrade gracefully
  let adminPalette  = "dark";
  let adminBg: string       = "var(--c-bg)";
  let adminBgImage: string | null = null;
  let siteLogo: string | null = null;
  let siteName = "Menu4U";
  let adminSidebarBg: string | null = null;
  let adminSidebarAccent: string | null = null;
  let adminSidebarTextColor: string = T.muted;
  let adminContentTextColor: string = T.text;
  let adminTopBarBg: string | null = null;
  let adminTopBarTextColor: string = T.panel;
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

    // Old system-default backgrounds that predate the T token system.
    // If DB still holds one of these, we treat it as "no custom override" and use T instead.
    const LEGACY_SYSTEM_BGS = new Set([
      "#0d0f18","#120b1e","#080f1e","#071510","#150a0e", // old ADMIN_PALETTE_MAP bgs
      "#1a1d23","#0a0402","#160805","#1a0c06",           // old inline defaults
    ]);

    if (rows[0]) {
      adminPalette           = rows[0].adminPalette           ?? "dark";
      const rawBg            = rows[0].adminBg                ?? "";
      // Gradients are always valid custom backgrounds; legacy hex values fall back to the theme default
      const isCustomBg = rawBg && (rawBg.includes("gradient") || (!LEGACY_SYSTEM_BGS.has(rawBg) && !isLightBg(rawBg)));
      adminBg                = isCustomBg ? rawBg : "var(--c-bg)";
      adminBgImage           = rows[0].adminBgImage           ?? null;
      siteLogo               = rows[0].logo                   ?? null;
      siteName               = rows[0].siteName               ?? "Menu4U";
      adminSidebarBg         = rows[0].adminSidebarBg         ?? null;
      adminSidebarAccent     = rows[0].adminSidebarAccent     ?? null;
      adminSidebarTextColor  = rows[0].adminSidebarTextColor  ?? T.muted;
      const rawText          = rows[0].adminContentTextColor  ?? T.text;
      adminContentTextColor  = isLightText(rawText) ? T.text : rawText;
      adminTopBarBg          = rows[0].adminTopBarBg          ?? null;
      adminTopBarTextColor   = rows[0].adminTopBarTextColor   ?? T.sub;
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

  const effectivePalette = isSuperAdmin ? adminPalette : restaurantPalette;
  const paletteVars = ADMIN_PALETTES[effectivePalette] ?? ADMIN_PALETTES["dark"];
  const cssVars = Object.entries(paletteVars).map(([k, v]) => `${k}:${v}`).join(";");

  return (
    <>
      <style>{`:root{${cssVars}}`}</style>
      <AdminShell
        user={session.user}
        kdsView={kdsView}
        idleTimeoutMinutes={(session.user as { idleTimeoutMinutes?: number })?.idleTimeoutMinutes ?? 0}
        adminPalette={effectivePalette}
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
    </>
  );
}
