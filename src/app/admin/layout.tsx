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

  // Load site config (with fallback when table doesn't exist yet)
  let adminPalette = "dark";
  let siteLogo: string | null = null;
  let siteName = "Menu4U";
  try {
    type Row = { adminPalette: string; logo: string | null; siteName: string };
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT "adminPalette", "logo", "siteName" FROM "SiteConfig" WHERE id = 'default' LIMIT 1
    `;
    if (rows[0]) {
      adminPalette = rows[0].adminPalette ?? "dark";
      siteLogo     = rows[0].logo ?? null;
      siteName     = rows[0].siteName ?? "Menu4U";
    }
  } catch {
    // Table doesn't exist yet — use defaults
  }

  return (
    <AdminShell
      user={session.user}
      kdsView={kdsView}
      adminPalette={adminPalette}
      siteLogo={siteLogo}
      siteName={siteName}
    >
      {children}
    </AdminShell>
  );
}
