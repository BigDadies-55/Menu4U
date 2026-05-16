import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";

type RestaurantDetail = {
  id: string;
  name: string;
  _count: { orders: number; menus: number };
  orders: { totalAmount: number }[];
};

type MenuViewStats = {
  totalViews: number;
  last7days: number;
  topCategories: { refName: string; count: number }[];
  topItems: { refName: string; count: number }[];
};

async function getStats(userId: string, role: string) {
  if (role === "SUPER_ADMIN") {
    const [restaurants, users, orders, items] = await Promise.all([
      prisma.restaurant.count(),
      prisma.user.count(),
      prisma.order.count(),
      prisma.item.count(),
    ]);
    const revenue = await prisma.order.aggregate({ _sum: { totalAmount: true } });
    return {
      restaurants,
      users,
      orders,
      items,
      revenue: revenue._sum.totalAmount ?? 0,
      restaurantDetails: undefined as RestaurantDetail[] | undefined,
    };
  }

  const userRestaurants = await prisma.restaurantUser.findMany({
    where: { userId },
    select: { restaurantId: true },
  });
  const restaurantIds = userRestaurants.map((r) => r.restaurantId);

  const [orders, items] = await Promise.all([
    prisma.order.count({ where: { restaurantId: { in: restaurantIds } } }),
    prisma.item.count({
      where: { category: { menu: { restaurantId: { in: restaurantIds } } } },
    }),
  ]);
  const revenue = await prisma.order.aggregate({
    where: { restaurantId: { in: restaurantIds } },
    _sum: { totalAmount: true },
  });

  const restaurantDetails = await prisma.restaurant.findMany({
    where: { id: { in: restaurantIds } },
    select: {
      id: true,
      name: true,
      _count: { select: { orders: true, menus: true } },
      orders: { select: { totalAmount: true } },
    },
  });

  return {
    restaurants: restaurantIds.length,
    users: null,
    orders,
    items,
    revenue: revenue._sum.totalAmount ?? 0,
    restaurantDetails: restaurantDetails as RestaurantDetail[],
  };
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

  const restaurantIds = stats.restaurantDetails
    ? stats.restaurantDetails.map(r => r.id)
    : session.user.role === "SUPER_ADMIN"
      ? (await prisma.restaurant.findMany({ select: { id: true } })).map(r => r.id)
      : [];
  const menuViewStats = await getMenuViewStats(restaurantIds);

  let recentOrdersWhere = {};
  if (session.user.role !== "SUPER_ADMIN") {
    const userRestaurants = await prisma.restaurantUser.findMany({
      where: { userId: session.user.id },
      select: { restaurantId: true },
    });
    recentOrdersWhere = { restaurantId: { in: userRestaurants.map((r) => r.restaurantId) } };
  }
  const recentOrders = await prisma.order.findMany({
    where: recentOrdersWhere,
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { restaurant: { select: { name: true } } },
  });

  const cards = [
    { label: "מסעדות", value: stats.restaurants, icon: "🍽️", color: "bg-amber-50 text-amber-700" },
    ...(stats.users !== null
      ? [{ label: "משתמשים", value: stats.users, icon: "👥", color: "bg-purple-50 text-purple-600" }]
      : []),
    { label: "הזמנות", value: stats.orders, icon: "🛒", color: "bg-blue-50 text-blue-600" },
    { label: "פריטים בתפריט", value: stats.items, icon: "🍕", color: "bg-green-50 text-green-600" },
    { label: "הכנסות", value: formatPrice(stats.revenue), icon: "💰", color: "bg-yellow-50 text-yellow-600" },
  ];

  const statusLabels: Record<string, string> = {
    PENDING: "ממתין",
    CONFIRMED: "אושר",
    PREPARING: "בהכנה",
    READY: "מוכן",
    DELIVERED: "נמסר",
    CANCELLED: "בוטל",
  };

  const statusColors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    CONFIRMED: "bg-blue-100 text-blue-800",
    PREPARING: "bg-amber-100 text-amber-800",
    READY: "bg-green-100 text-green-800",
    DELIVERED: "bg-gray-100 text-gray-800",
    CANCELLED: "bg-red-100 text-red-800",
  };

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
              const rev = r.orders.reduce((s, o) => s + o.totalAmount, 0);
              const mv = menuViewStats[r.id];
              return (
                <div key={r.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm" style={{ background: "linear-gradient(135deg,#8B6914,#C9A84C)" }}>
                      {r.name[0]}
                    </div>
                    <div className="font-semibold text-gray-900">{r.name}</div>
                  </div>

                  {/* order / menu / revenue */}
                  <div className="grid grid-cols-3 gap-2 text-center mb-4">
                    <div>
                      <div className="text-lg font-bold text-gray-900">{r._count.orders}</div>
                      <div className="text-xs text-gray-400">הזמנות</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-gray-900">{r._count.menus}</div>
                      <div className="text-xs text-gray-400">תפריטים</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-gray-900">₪{Math.round(rev)}</div>
                      <div className="text-xs text-gray-400">הכנסות</div>
                    </div>
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">הזמנות אחרונות</h2>
        </div>
        {recentOrders.length === 0 ? (
          <div className="p-8 text-center text-gray-400">אין הזמנות עדיין</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentOrders.map((order) => (
              <div key={order.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">
                    {order.customerName ?? "לקוח אנונימי"}
                    {order.tableNumber && (
                      <span className="text-gray-400 text-sm mr-2">שולחן {order.tableNumber}</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">{order.restaurant.name}</div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[order.status]}`}>
                    {statusLabels[order.status]}
                  </span>
                  <span className="font-semibold text-gray-900">{formatPrice(order.totalAmount)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
