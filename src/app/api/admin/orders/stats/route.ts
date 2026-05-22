import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");
  const days = parseInt(searchParams.get("days") ?? "30");

  const since = new Date();
  since.setDate(since.getDate() - days);

  const role = session.user.role;
  const userId = session.user.id;

  // Determine accessible restaurant IDs
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

  const orderWhere = {
    createdAt: { gte: since },
    ...(allowedIds ? { restaurantId: { in: allowedIds } } : {}),
  };

  const [orders, statusLogs] = await Promise.all([
    prisma.order.findMany({
      where: orderWhere,
      select: {
        id: true,
        restaurantId: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        updatedAt: true,
        restaurant: { select: { name: true } },
        items: {
          select: {
            quantity: true,
            price: true,
            item: { select: { prepTime: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.orderStatusLog.findMany({
      where: {
        changedAt: { gte: since },
        order: allowedIds ? { restaurantId: { in: allowedIds } } : undefined,
      },
      orderBy: { changedAt: "asc" },
    }),
  ]);

  // Group logs by orderId
  const logsByOrder = new Map<string, typeof statusLogs>();
  for (const log of statusLogs) {
    if (!logsByOrder.has(log.orderId)) logsByOrder.set(log.orderId, []);
    logsByOrder.get(log.orderId)!.push(log);
  }

  // Compute per-status durations (minutes)
  const durations: Record<string, number[]> = {
    PENDING: [], CONFIRMED: [], PREPARING: [], READY: [],
  };
  const totalTimes: number[] = [];

  for (const order of orders) {
    const logs = (logsByOrder.get(order.id) ?? []).sort(
      (a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime()
    );
    if (logs.length === 0) continue;

    let prevTime = new Date(order.createdAt).getTime();
    let prevStatus = "PENDING";

    for (const log of logs) {
      const duration = (new Date(log.changedAt).getTime() - prevTime) / 60000;
      if (durations[prevStatus] !== undefined && duration >= 0) {
        durations[prevStatus].push(duration);
      }
      prevTime = new Date(log.changedAt).getTime();
      prevStatus = log.toStatus;
    }

    // Total time: createdAt → last log
    const last = logs[logs.length - 1];
    if (["DELIVERED"].includes(last.toStatus)) {
      const total = (new Date(last.changedAt).getTime() - new Date(order.createdAt).getTime()) / 60000;
      totalTimes.push(total);
    }
  }

  // Orders by hour of day (0-23)
  const byHour = Array.from({ length: 24 }, () => 0);
  for (const o of orders) {
    const h = new Date(o.createdAt).getHours();
    byHour[h]++;
  }

  // Orders by day (last `days` days)
  const byDay: { date: string; count: number; revenue: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayOrders = orders.filter(o => o.createdAt.toISOString().slice(0, 10) === dateStr);
    byDay.push({
      date: dateStr,
      count: dayOrders.length,
      revenue: dayOrders.reduce((s, o) => s + o.totalAmount, 0),
    });
  }

  // Status distribution
  const statusCounts: Record<string, number> = {
    PENDING: 0, CONFIRMED: 0, PREPARING: 0, READY: 0, DELIVERED: 0, CANCELLED: 0,
  };
  for (const o of orders) statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;

  // Total revenue
  const totalRevenue = orders
    .filter(o => o.status !== "CANCELLED")
    .reduce((s, o) => s + o.totalAmount, 0);

  // Average items per order
  const avgItems = orders.length
    ? avg(orders.map(o => o.items.reduce((s, i) => s + i.quantity, 0)))
    : 0;

  // Expected prep time from item data
  const avgExpectedPrepTime = (() => {
    const times: number[] = [];
    for (const o of orders) {
      const orderMaxPrep = Math.max(...o.items.map(i => i.item.prepTime ?? 0));
      if (orderMaxPrep > 0) times.push(orderMaxPrep);
    }
    return avg(times);
  })();

  const stats = {
    period: days,
    totalOrders: orders.length,
    totalRevenue,
    avgOrderValue: orders.length ? totalRevenue / orders.filter(o => o.status !== "CANCELLED").length : 0,
    avgItems: Math.round(avgItems * 10) / 10,
    statusCounts,
    cancelRate: orders.length ? (statusCounts.CANCELLED / orders.length) * 100 : 0,
    completionRate: orders.length ? (statusCounts.DELIVERED / orders.length) * 100 : 0,
    durations: {
      PENDING: { avg: avg(durations.PENDING), median: median(durations.PENDING), count: durations.PENDING.length },
      CONFIRMED: { avg: avg(durations.CONFIRMED), median: median(durations.CONFIRMED), count: durations.CONFIRMED.length },
      PREPARING: { avg: avg(durations.PREPARING), median: median(durations.PREPARING), count: durations.PREPARING.length },
      READY: { avg: avg(durations.READY), median: median(durations.READY), count: durations.READY.length },
    },
    totalTime: { avg: avg(totalTimes), median: median(totalTimes), count: totalTimes.length },
    avgExpectedPrepTime,
    byHour,
    byDay,
    peakHour: byHour.indexOf(Math.max(...byHour)),
    hasLogs: statusLogs.length > 0,
  };

  return NextResponse.json(stats);
}
