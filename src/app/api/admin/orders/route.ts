import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");
  const activeOnly = searchParams.get("activeOnly") === "1";

  const role = session.user.role;
  const userId = session.user.id;

  // Build restaurant filter
  let restaurantFilter: { in: string[] } | undefined;
  if (role !== "SUPER_ADMIN") {
    const userRestaurants = await prisma.restaurantUser.findMany({
      where: { userId },
      select: { restaurantId: true },
    });
    const ids = userRestaurants.map(r => r.restaurantId);
    if (restaurantId && !ids.includes(restaurantId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    restaurantFilter = { in: restaurantId ? [restaurantId] : ids };
  } else if (restaurantId) {
    restaurantFilter = { in: [restaurantId] };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const statusFilter: any = activeOnly ? { notIn: ["CANCELLED"] } : undefined;
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let createdAtFilter: any = activeOnly && !fromParam ? { gte: since24h } : undefined;
  if (fromParam) {
    createdAtFilter = { gte: new Date(fromParam), ...(toParam ? { lte: new Date(toParam) } : {}) };
  }

  const orders = await prisma.order.findMany({
    where: {
      ...(restaurantFilter ? { restaurantId: restaurantFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
    },
    orderBy: { createdAt: "asc" },
    include: {
      restaurant: { select: { id: true, name: true } },
      items: {
        include: { item: { select: { name: true, prepTime: true } } },
        orderBy: { id: "asc" },
      },
    },
  });

  // For activeOnly: filter out tables that were explicitly closed (have a TableSession)
  if (activeOnly && !fromParam) {
    let closedKeys = new Set<string>();
    try {
      const sessions = await prisma.tableSession.findMany({
        where: {
          ...(restaurantFilter ? { restaurantId: { in: restaurantFilter.in } } : {}),
          closedAt: { gte: since24h },
        },
        select: { restaurantId: true, tableNumber: true },
      });
      closedKeys = new Set(sessions.map(s => `${s.restaurantId}:${s.tableNumber ?? ""}`));
    } catch { /* TableSession table may not exist yet */ }

    if (closedKeys.size > 0) {
      const filtered = orders.filter(o => {
        if (o.status !== "DELIVERED") return true;
        return !closedKeys.has(`${o.restaurantId}:${o.tableNumber ?? ""}`);
      });
      return NextResponse.json(filtered);
    }
  }

  return NextResponse.json(orders);
}
