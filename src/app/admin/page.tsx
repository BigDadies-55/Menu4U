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
    { label: "מסעדות", value: stats.restaurants, icon: "🍽️", color: "bg-amber-50 text-amber-700" },
    ...(stats.users !== null
      ? [{ label: "משתמשים", value: stats.users, icon: "👥", color: "bg-purple-50 text-purple-600" }]
      : []),
    { label: "פריטים בתפריט", value: stats.items, icon: "🍕", color: "bg-green-50 text-green-600" },
  ];

  return (
    <div className="p-4 md:p-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {cards.map(card => (
          <div key={card.label} className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0 ${card.color}`}>
              {card.icon}
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900 leading-tight">{card.value}</div>
              <div className="text-xs text-gray-400 mt-0.5">{card.label}</div>
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
