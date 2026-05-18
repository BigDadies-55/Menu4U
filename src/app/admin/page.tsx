import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AnalyticsSection from "./AnalyticsSection";
import MigrateButton from "./MigrateButton";

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
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          שלום, {session.user.name ?? session.user.email} 👋
        </h1>
        <p className="text-gray-500 mt-1">ברוך הבא לממשק הניהול של Menu4U</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        {cards.map(card => (
          <div key={card.label} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-3 ${card.color}`}>
              {card.icon}
            </div>
            <div className="text-2xl font-bold text-gray-900">{card.value}</div>
            <div className="text-sm text-gray-500 mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      {session.user.role === "SUPER_ADMIN" && <MigrateButton />}

      {stats.restaurantDetails && stats.restaurantDetails.length > 0 && (
        <AnalyticsSection restaurants={stats.restaurantDetails} />
      )}
    </div>
  );
}
