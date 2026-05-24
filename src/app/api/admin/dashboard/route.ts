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
  });
}
