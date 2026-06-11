import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

async function ensureColumns() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "servedByUserId" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "isComped" BOOLEAN NOT NULL DEFAULT false`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMP(3)`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "voidReason" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "compReason" TEXT`);
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureColumns();

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");
  const tableNumber  = searchParams.get("tableNumber") ?? undefined;
  const days         = Math.min(30, Math.max(1, parseInt(searchParams.get("days") ?? "7", 10)));

  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  if (session.user.role !== "SUPER_ADMIN") {
    const access = await prisma.restaurantUser.findUnique({
      where: { userId_restaurantId: { userId: session.user.id, restaurantId } },
    });
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const since = new Date(Date.now() - days * 86_400_000);

  // ── 1. Fetch table sessions (closed tables) ──
  const sessions = await prisma.tableSession.findMany({
    where: {
      restaurantId,
      ...(tableNumber ? { tableNumber } : {}),
      closedAt: { gte: since },
    },
    orderBy: { closedAt: "desc" },
    take: 100,
  });

  // ── 2. Fetch orders in the same window ──
  const orders = await prisma.order.findMany({
    where: {
      restaurantId,
      ...(tableNumber ? { tableNumber } : {}),
      createdAt: { gte: since },
    },
    include: {
      items: {
        select: {
          id: true, quantity: true, price: true, itemStatus: true,
          servedAt: true, servedByUserId: true, firedAt: true, doneAt: true,
          item: { select: { name: true } },
        },
      },
      statusLogs: { orderBy: { changedAt: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });

  // ── 3. Resolve user names for all referenced user IDs ──
  const userIds = new Set<string>();
  for (const o of orders) {
    if (o.createdByUserId) userIds.add(o.createdByUserId);
    if (o.closedByUserId)  userIds.add(o.closedByUserId);
    for (const sl of o.statusLogs) {
      if (sl.changedBy) userIds.add(sl.changedBy);
    }
    for (const it of o.items) {
      if (it.servedByUserId) userIds.add(it.servedByUserId);
    }
  }

  const users = userIds.size > 0
    ? await prisma.user.findMany({
        where: { id: { in: [...userIds] } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const userMap = new Map(users.map(u => [u.id, u.name ?? u.email ?? u.id]));

  function actorName(id: string | null | undefined): string {
    if (!id) return "מערכת";
    return userMap.get(id) ?? id;
  }

  // ── 4. Build per-table timeline events ──
  type Event = {
    type: string;
    at: string;
    actor: string;
    actorId: string | null;
    detail: string;
    orderId?: string;
    tableNumber?: string;
  };

  const eventsByTable = new Map<string, Event[]>();

  function addEvent(table: string, ev: Event) {
    if (!eventsByTable.has(table)) eventsByTable.set(table, []);
    eventsByTable.get(table)!.push(ev);
  }

  for (const order of orders) {
    const tbl = order.tableNumber ?? "—";

    // Order created
    addEvent(tbl, {
      type: "ORDER_CREATED",
      at: order.createdAt.toISOString(),
      actor: actorName(order.createdByUserId),
      actorId: order.createdByUserId,
      detail: `${order.items.length} פריטים · ₪${order.totalAmount.toFixed(0)}`,
      orderId: order.id,
      tableNumber: tbl,
    });

    // Order status transitions (from statusLogs)
    for (const log of order.statusLogs) {
      if (log.toStatus === "PAID") {
        addEvent(tbl, {
          type: "TABLE_PAID",
          at: log.changedAt.toISOString(),
          actor: actorName(order.closedByUserId ?? log.changedBy),
          actorId: order.closedByUserId ?? log.changedBy ?? null,
          detail: `₪${order.totalAmount.toFixed(0)}`,
          orderId: order.id,
          tableNumber: tbl,
        });
      } else if (log.toStatus === "CANCELLED") {
        addEvent(tbl, {
          type: "ORDER_CANCELLED",
          at: log.changedAt.toISOString(),
          actor: actorName(log.changedBy),
          actorId: log.changedBy ?? null,
          detail: `הזמנה בוטלה`,
          orderId: order.id,
          tableNumber: tbl,
        });
      }
    }

    // Items served
    for (const item of order.items) {
      if (item.servedAt) {
        addEvent(tbl, {
          type: "ITEM_SERVED",
          at: item.servedAt.toISOString(),
          actor: actorName(item.servedByUserId),
          actorId: item.servedByUserId,
          detail: `${item.item.name} ×${item.quantity}`,
          orderId: order.id,
          tableNumber: tbl,
        });
      }
    }
  }

  // Sort each table's events chronologically
  for (const [, evts] of eventsByTable) {
    evts.sort((a, b) => a.at.localeCompare(b.at));
  }

  // ── 5. Build waiter insights ──
  type WaiterStats = {
    id: string; name: string;
    ordersCreated: number; tablesClosed: number; itemsServed: number;
    totalRevenue: number;
  };
  const waiterStatsMap = new Map<string, WaiterStats>();

  function getWaiter(id: string): WaiterStats {
    if (!waiterStatsMap.has(id)) {
      waiterStatsMap.set(id, {
        id, name: actorName(id),
        ordersCreated: 0, tablesClosed: 0, itemsServed: 0, totalRevenue: 0,
      });
    }
    return waiterStatsMap.get(id)!;
  }

  let totalItemsServed   = 0;
  let totalItemsCancelled = 0;
  const hourCounts = new Array<number>(24).fill(0);

  for (const order of orders) {
    if (order.createdByUserId) {
      const w = getWaiter(order.createdByUserId);
      w.ordersCreated++;
      w.totalRevenue += order.totalAmount;
    }
    if (order.closedByUserId) {
      getWaiter(order.closedByUserId).tablesClosed++;
    }
    hourCounts[new Date(order.createdAt).getHours()]++;

    for (const item of order.items) {
      if (item.servedAt && item.servedByUserId) {
        getWaiter(item.servedByUserId).itemsServed++;
        totalItemsServed++;
      }
      if (item.itemStatus === "CANCELLED") totalItemsCancelled++;
    }
  }

  const totalItems = orders.reduce((s, o) => s + o.items.length, 0);
  const cancellationRatePercent = totalItems > 0
    ? Math.round((totalItemsCancelled / totalItems) * 1000) / 10
    : 0;

  const busiestHour = hourCounts.indexOf(Math.max(...hourCounts));

  const avgSessionMinutes = sessions.length > 0
    ? Math.round(
        sessions.reduce((s, sess) => {
          return s + (sess.closedAt.getTime() - sess.openedAt.getTime()) / 60_000;
        }, 0) / sessions.length
      )
    : 0;

  const avgAmountPerSession = sessions.length > 0
    ? Math.round(sessions.reduce((s, sess) => s + sess.totalAmount, 0) / sessions.length)
    : 0;

  const topWaiters = [...waiterStatsMap.values()]
    .sort((a, b) => b.ordersCreated - a.ordersCreated)
    .slice(0, 5);

  // ── 6. Distinct table numbers (for selector) ──
  const tableNumbers = [...new Set([
    ...sessions.map(s => s.tableNumber),
    ...orders.map(o => o.tableNumber).filter(Boolean) as string[],
  ])].sort((a, b) => {
    const na = parseInt(a), nb = parseInt(b);
    return isNaN(na) || isNaN(nb) ? a.localeCompare(b) : na - nb;
  });

  // ── 7. Build flat event list (filtered by tableNumber if given) ──
  const allEvents: Event[] = [];
  if (tableNumber) {
    allEvents.push(...(eventsByTable.get(tableNumber) ?? []));
  } else {
    for (const [, evts] of eventsByTable) allEvents.push(...evts);
    allEvents.sort((a, b) => b.at.localeCompare(a.at)); // newest first for all-tables view
  }

  return NextResponse.json({
    tableNumbers,
    sessions: sessions.map(s => ({
      id: s.id,
      tableNumber: s.tableNumber,
      openedAt: s.openedAt.toISOString(),
      closedAt: s.closedAt.toISOString(),
      totalAmount: s.totalAmount,
      orderCount: s.orderCount,
      durationMinutes: Math.round((s.closedAt.getTime() - s.openedAt.getTime()) / 60_000),
    })),
    events: allEvents,
    insights: {
      totalSessions: sessions.length,
      totalOrders: orders.length,
      avgSessionMinutes,
      avgAmountPerSession,
      cancellationRatePercent,
      busiestHour,
      topWaiters,
    },
  });
}
