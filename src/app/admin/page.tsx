import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";

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

  return {
    restaurants: restaurantIds.length,
    users: null,
    orders,
    items,
    revenue: revenue._sum.totalAmount ?? 0,
  };
}

export default async function AdminDashboard() {
  const session = await auth();
  if (!session?.user) return null;

  const stats = await getStats(session.user.id, session.user.role);

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
    { label: "מסעדות", value: stats.restaurants, icon: "🍽️", color: "bg-emerald-50 text-emerald-700" },
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
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          שלום, {session.user.name ?? session.user.email} 👋
        </h1>
        <p className="text-gray-500 mt-1">ברוך הבא לממשק הניהול של Menu4U</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
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
                <div className="flex items-center gap-4">
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
