import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RestaurantDetail = {
  id: string;
  name: string;
  _count: { menus: number };
};

type MenuViewStats = {
  totalViews: number;
  last7days: number;
  topCategories: { refName: string; count: number }[];
  topItems: { refName: string; count: number }[];
};

async function getStats(userId: string, role: string) {
  if (role === "SUPER_ADMIN") {
    const [restaurants, users, items] = await Promise.all([
      prisma.restaurant.count(),
      prisma.user.count(),
      prisma.item.count(),
    ]);
    const restaurantDetails = await prisma.restaurant.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        _count: { select: { menus: true } },
      },
    });
    return { restaurants, users, items, restaurantDetails };
  }

  const userRestaurants = await prisma.restaurantUser.findMany({
    where: { userId },
    select: { restaurantId: true },
  });
  const restaurantIds = userRestaurants.map((r) => r.restaurantId);

  const items = await prisma.item.count({
    where: { category: { menu: { restaurantId: { in: restaurantIds } } } },
  });

  const restaurantDetails = await prisma.restaurant.findMany({
    where: { id: { in: restaurantIds } },
    select: {
      id: true,
      name: true,
      _count: { select: { menus: true } },
    },
  });

  return { restaurants: restaurantIds.length, users: null, items, restaurantDetails };
}

async function getMenuViewStats(restaurantIds: string[]): Promise<Record<string, MenuViewStats>> {
  if (restaurantIds.length === 0) return {};
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [allViews, recentViews] = await Promise.all([
    prisma.menuView.groupBy({
      by: ["restaurantId", "type", "refName"],
      where: { restaurantId: { in: restaurantIds } },
      _count: true,
    }),
    prisma.menuView.groupBy({
      by: ["restaurantId"],
      where: { restaurantId: { in: restaurantIds }, type: "page", createdAt: { gte: since7 } },
      _count: true,
    }),
  ]);

  const result: Record<string, MenuViewStats> = {};
  for (const id of restaurantIds) {
    const pageViews = allViews.filter(v => v.restaurantId === id && v.type === "page");
    const catViews = allViews.filter(v => v.restaurantId === id && v.type === "category" && v.refName);
    const itemViews = allViews.filter(v => v.restaurantId === id && v.type === "item" && v.refName);
    const recent = recentViews.find(v => v.restaurantId === id);

    result[id] = {
      totalViews: pageViews.reduce((s, v) => s + v._count, 0),
      last7days: recent?._count ?? 0,
      topCategories: catViews
        .sort((a, b) => b._count - a._count)
        .slice(0, 3)
        .map(v => ({ refName: v.refName!, count: v._count })),
      topItems: itemViews
        .sort((a, b) => b._count - a._count)
        .slice(0, 3)
        .map(v => ({ refName: v.refName!, count: v._count })),
    };
  }
  return result;
}

export default async function AdminDashboard() {
  const session = await auth();
  if (!session?.user) return null;

  const stats = await getStats(session.user.id, session.user.role);

  const restaurantIds = (stats.restaurantDetails ?? []).map(r => r.id);
  const menuViewStats = await getMenuViewStats(restaurantIds);

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

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-3 ${card.color}`}>
              {card.icon}
            </div>
            <div className="text-2xl font-bold text-gray-900">{card.value}</div>
            <div className="text-sm text-gray-500 mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      {stats.restaurantDetails && stats.restaurantDetails.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">המסעדות שלי</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.restaurantDetails.map((r) => {
              const mv = menuViewStats[r.id];
              return (
                <div key={r.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm" style={{ background: "linear-gradient(135deg,#8B6914,#C9A84C)" }}>
                      {r.name[0]}
                    </div>
                    <div className="font-semibold text-gray-900">{r.name}</div>
                  </div>

                  <div className="text-center mb-4">
                    <div className="text-lg font-bold text-gray-900">{r._count.menus}</div>
                    <div className="text-xs text-gray-400">תפריטים</div>
                  </div>

                  {/* menu views analytics */}
                  {mv && (
                    <div className="border-t border-gray-100 pt-3 mt-1">
                      <div className="flex items-center gap-1 mb-2">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">צפיות בתפריט</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-center mb-3">
                        <div className="bg-amber-50 rounded-lg py-2">
                          <div className="text-base font-bold text-amber-700">{mv.totalViews}</div>
                          <div className="text-xs text-gray-400">סה״כ</div>
                        </div>
                        <div className="bg-amber-50 rounded-lg py-2">
                          <div className="text-base font-bold text-amber-700">{mv.last7days}</div>
                          <div className="text-xs text-gray-400">7 ימים אחרונים</div>
                        </div>
                      </div>
                      {mv.topCategories.length > 0 && (
                        <div className="mb-2">
                          <div className="text-xs text-gray-400 mb-1">קטגוריות מובילות</div>
                          {mv.topCategories.map(c => (
                            <div key={c.refName} className="flex justify-between text-xs py-0.5">
                              <span className="text-gray-600 truncate max-w-[130px]">{c.refName}</span>
                              <span className="font-medium text-amber-700">{c.count}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {mv.topItems.length > 0 && (
                        <div>
                          <div className="text-xs text-gray-400 mb-1">פריטים מובילים</div>
                          {mv.topItems.map(i => (
                            <div key={i.refName} className="flex justify-between text-xs py-0.5">
                              <span className="text-gray-600 truncate max-w-[130px]">{i.refName}</span>
                              <span className="font-medium text-amber-700">{i.count}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
