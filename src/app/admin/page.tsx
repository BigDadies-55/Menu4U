import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AnalyticsSection from "./AnalyticsSection";
import DashboardExtra from "./DashboardExtra";
export const dynamic = "force-dynamic";

async function getStats(userId: string, role: string) {
  if (role === "SUPER_ADMIN") {
    const [restaurants, users, items] = await Promise.all([
      prisma.restaurant.count(),
      prisma.user.count(),
      prisma.item.count(),
    ]);
    const restaurantDetails = await prisma.restaurant.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { menus: true } } },
    });
    return { restaurants, users, items, restaurantDetails };
  }

  const userRestaurants = await prisma.restaurantUser.findMany({
    where: { userId },
    select: { restaurantId: true },
  });
  const restaurantIds = userRestaurants.map(r => r.restaurantId);

  const items = await prisma.item.count({
    where: { category: { menu: { restaurantId: { in: restaurantIds } } } },
  });
  const restaurantDetails = await prisma.restaurant.findMany({
    where: { id: { in: restaurantIds } },
    select: { id: true, name: true, _count: { select: { menus: true } } },
  });

  return { restaurants: restaurantIds.length, users: null, items, restaurantDetails };
}

export default async function AdminDashboard() {
  const session = await auth();
  if (!session?.user) return null;

  const stats = await getStats(session.user.id, session.user.role);

  return (
    <div className="p-4 md:p-8" style={{ background: "#1a1d23", minHeight: "100vh" }}>
      {/* Live dashboard widgets — KPIs, chart, top items, tables, bottom row */}
      <DashboardExtra
        isSuperAdmin={session.user.role === "SUPER_ADMIN"}
        restaurants={(stats.restaurantDetails ?? []).map(r => ({ id: r.id, name: r.name }))}
      />

      {/* Per-restaurant analytics (menu views) */}
      {stats.restaurantDetails && stats.restaurantDetails.length > 0 && (
        <div className="mt-6">
          <AnalyticsSection restaurants={stats.restaurantDetails} />
        </div>
      )}
    </div>
  );
}
