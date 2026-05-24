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
  let kdsView = "ALL"; // SUPER_ADMIN sees all
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

  return <AdminShell user={session.user} kdsView={kdsView}>{children}</AdminShell>;
}
