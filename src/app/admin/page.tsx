import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardExtra from "./DashboardExtra";
import PageShell from "@/components/admin/PageShell";
export const dynamic = "force-dynamic";

async function getStats(userId: string, role: string) {
  if (role === "SUPER_ADMIN") {
    const restaurantDetails = await prisma.restaurant.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { menus: true } } },
    });
    return { restaurantDetails };
  }

  const userRestaurants = await prisma.restaurantUser.findMany({
    where: { userId },
    select: { restaurantId: true },
  });
  const restaurantIds = userRestaurants.map(r => r.restaurantId);
  const restaurantDetails = await prisma.restaurant.findMany({
    where: { id: { in: restaurantIds } },
    select: { id: true, name: true, _count: { select: { menus: true } } },
  });

  return { restaurantDetails };
}

export default async function AdminDashboard() {
  const session = await auth();
  if (!session?.user) return null;

  const stats = await getStats(session.user.id, session.user.role);

  return (
    <PageShell>
      <DashboardExtra
        isSuperAdmin={session.user.role === "SUPER_ADMIN"}
        restaurants={(stats.restaurantDetails ?? []).map(r => ({ id: r.id, name: r.name }))}
      />
    </PageShell>
  );
}
