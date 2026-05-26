import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId") ?? undefined;
  const role = session.user.role;
  const userId = session.user.id;

  // Resolve allowed restaurant IDs for this user
  let allowedIds: string[] | null = null;
  if (role !== "SUPER_ADMIN") {
    const links = await prisma.restaurantUser.findMany({
      where: { userId },
      select: { restaurantId: true },
    });
    allowedIds = links.map(l => l.restaurantId);
    if (restaurantId && !allowedIds.includes(restaurantId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (restaurantId) allowedIds = [restaurantId];
  } else if (restaurantId) {
    allowedIds = [restaurantId];
  }

  const restaurantWhere = allowedIds ? { restaurantId: { in: allowedIds } } : {};

  // Today boundaries (local midnight)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // 30-day range for chart
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const [
    todayOrders,
    openOrders,
    recentOrders,
    chartOrders,
    topItemsRaw,
    menuViewsToday,
    subscriptions,
    statusCounts,
    cancelledToday,
  ] = await Promise.all([
    // Today's orders count + revenue
    prisma.order.aggregate({
      where: { ...restaurantWhere, createdAt: { gte: todayStart }, status: { not: "CANCELLED" } },
      _count: { id: true },
      _sum: { totalAmount: true },
    }),

    // Currently open orders
    prisma.order.count({
      where: { ...restaurantWhere, status: { in: ["PENDING", "CONFIRMED", "PREPARING"] } },
    }),

    // Last 10 orders (any status)
    prisma.order.findMany({
      where: restaurantWhere,
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        tableNumber: true,
        customerName: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        restaurant: { select: { name: true } },
      },
    }),

    // Last 30 days orders for chart
    prisma.order.findMany({
      where: { ...restaurantWhere, createdAt: { gte: thirtyDaysAgo }, status: { not: "CANCELLED" } },
      select: { createdAt: true, totalAmount: true },
      orderBy: { createdAt: "asc" },
    }),

    // Top items last 30 days
    prisma.orderItem.groupBy({
      by: ["itemId"],
      where: { order: { ...restaurantWhere, createdAt: { gte: thirtyDaysAgo }, status: { not: "CANCELLED" } } },
      _sum: { quantity: true, price: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),

    // Menu views today
    prisma.menuView.count({
      where: { ...(allowedIds ? { restaurantId: { in: allowedIds } } : {}), createdAt: { gte: todayStart } },
    }),

    // Restaurants with subscription expiry in next 14 days
    prisma.restaurant.findMany({
      where: {
        ...(allowedIds ? { id: { in: allowedIds } } : {}),
        subscriptionTo: { gte: new Date(), lte: new Date(Date.now() + 14 * 86400000) },
      },
      select: { id: true, name: true, subscriptionTo: true },
    }),

    // Status counts for today
    prisma.order.groupBy({
      by: ["status"],
      where: { ...restaurantWhere, createdAt: { gte: todayStart } },
      _count: { id: true },
    }),

    // Cancelled orders today
    prisma.order.count({
      where: { ...restaurantWhere, createdAt: { gte: todayStart }, status: "CANCELLED" },
    }),
  ]);

  // Resolve item names for top items
  const itemIds = topItemsRaw.map(r => r.itemId);
  const itemNames = await prisma.item.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, name: true },
  });
  const nameMap = Object.fromEntries(itemNames.map(i => [i.id, i.name]));

  const topItems = topItemsRaw.map(r => ({
    name: nameMap[r.itemId] ?? r.itemId,
    quantity: r._sum.quantity ?? 0,
    revenue: r._sum.price ?? 0,
  }));

  // Build revenue chart: one entry per day for last 30 days
  const byDay: { date: string; revenue: number; orders: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayOrders = chartOrders.filter(o => o.createdAt.toISOString().slice(0, 10) === dateStr);
    byDay.push({
      date: dateStr,
      revenue: dayOrders.reduce((s, o) => s + o.totalAmount, 0),
      orders: dayOrders.length,
    });
  }

  // Build statusCounts object
  const statusCountsObj: Record<string, number> = {};
  for (const s of statusCounts) statusCountsObj[s.status] = s._count.id;

  // Week stats from last 7 days of byDay
  const last7 = byDay.slice(-7);
  const weekRevenue = last7.reduce((s, d) => s + d.revenue, 0);
  const weekOrders  = last7.reduce((s, d) => s + d.orders,  0);

  // Restaurant stats: per-restaurant completion rate (last 30 days), only when not filtering by specific restaurant
  let restaurantStats: { id: string; name: string; total: number; completed: number; pct: number }[] = [];
  if (!restaurantId) {
    const allRestaurantIds = allowedIds ?? (await prisma.restaurant.findMany({ select: { id: true } })).map(r => r.id);
    const restaurantNames = await prisma.restaurant.findMany({
      where: { id: { in: allRestaurantIds } },
      select: { id: true, name: true },
    });
    const nameByRestaurant = Object.fromEntries(restaurantNames.map(r => [r.id, r.name]));

    const thirtyDaysAgoStats = new Date();
    thirtyDaysAgoStats.setDate(thirtyDaysAgoStats.getDate() - 30);
    thirtyDaysAgoStats.setHours(0, 0, 0, 0);

    const statsPerRestaurant = await prisma.order.groupBy({
      by: ["restaurantId", "status"],
      where: {
        restaurantId: { in: allRestaurantIds },
        createdAt: { gte: thirtyDaysAgoStats },
        status: { not: "CANCELLED" },
      },
      _count: { id: true },
    });

    const totalsMap: Record<string, { total: number; completed: number }> = {};
    for (const row of statsPerRestaurant) {
      if (!totalsMap[row.restaurantId]) totalsMap[row.restaurantId] = { total: 0, completed: 0 };
      totalsMap[row.restaurantId].total += row._count.id;
      if (row.status === "DELIVERED" || row.status === "PAID") {
        totalsMap[row.restaurantId].completed += row._count.id;
      }
    }

    restaurantStats = allRestaurantIds.map(id => {
      const t = totalsMap[id] ?? { total: 0, completed: 0 };
      return {
        id,
        name: nameByRestaurant[id] ?? id,
        total: t.total,
        completed: t.completed,
        pct: t.total > 0 ? Math.round((t.completed / t.total) * 100) : 0,
      };
    }).filter(r => r.total > 0);
  }

  return NextResponse.json({
    kpis: {
      todayRevenue: todayOrders._sum.totalAmount ?? 0,
      todayOrderCount: todayOrders._count.id,
      openOrders,
      menuViewsToday,
    },
    recentOrders,
    topItems,
    revenueChart: byDay,
    expiringSubscriptions: subscriptions.map(s => ({
      id: s.id,
      name: s.name,
      subscriptionTo: s.subscriptionTo?.toISOString() ?? null,
    })),
    statusCounts: statusCountsObj,
    weekStats: { revenue: weekRevenue, orders: weekOrders },
    cancelledToday,
    restaurantStats,
  });
}
