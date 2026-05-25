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

  const cards = [
    { label: "מסעדות",       value: stats.restaurants, icon: "🍽️" },
    ...(stats.users !== null
      ? [{ label: "משתמשים", value: stats.users,        icon: "👥" }]
      : []),
    { label: "פריטים בתפריט", value: stats.items,      icon: "🍕" },
  ];

  return (
    <div className="p-4 md:p-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {cards.map(card => (
          <div key={card.label}
            className="bg-white rounded-xl px-4 py-4 shadow-sm flex items-center gap-3"
            style={{ border: "1px solid #e8ecf1", borderRight: "3px solid #c9a84c" }}>
            <div className="text-2xl shrink-0">{card.icon}</div>
            <div>
              <div className="text-2xl font-bold leading-none" style={{ color: "#0f172a" }}>{card.value}</div>
              <div className="text-xs mt-1.5" style={{ color: "#94a3b8" }}>{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Live dashboard widgets — KPIs, chart, top items */}
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
