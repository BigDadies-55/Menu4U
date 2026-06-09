import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "Missing restaurantId" }, { status: 400 });

  // auth check
  const role = session.user.role as string;
  if (!["SUPER_ADMIN", "ADMIN", "OWNER", "SHIFT_MANAGER"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!["SUPER_ADMIN", "ADMIN"].includes(role)) {
    const link = await prisma.restaurantUser.findFirst({
      where: { restaurantId, userId: session.user.id },
    });
    if (!link) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cutoff = new Date(Date.now() - 8 * 60 * 60 * 1000); // last 8h

  const orders = await prisma.order.findMany({
    where: {
      restaurantId,
      status: { notIn: ["PAID", "CANCELLED"] },
      createdAt: { gte: cutoff },
    },
    include: {
      items: {
        include: { item: { select: { id: true, name: true, price: true } } },
      },
      statusLogs: { orderBy: { changedAt: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });

  // group by table
  const tableMap = new Map<string, typeof orders>();
  for (const o of orders) {
    const key = o.tableNumber ?? "—";
    if (!tableMap.has(key)) tableMap.set(key, []);
    tableMap.get(key)!.push(o);
  }

  const now = Date.now();

  const tables = Array.from(tableMap.entries()).map(([tableNumber, tOrders]) => {
    const startedAt = tOrders[0]?.createdAt ?? new Date();
    const totalAmount = tOrders.reduce((s, o) => s + o.totalAmount, 0);
    const coversCount = Math.max(0, ...tOrders.map(o => o.coversCount ?? 0));
    const allItems = tOrders.flatMap(o => o.items);
    const ageMin = (now - startedAt.getTime()) / 60000;

    // determine status
    let status: "green" | "red" | "purple" = "green";

    // red: any item PREPARING > 15 min since firedAt, or table > 50 min
    const hasLongPrep = allItems.some(i =>
      i.itemStatus === "PREPARING" && i.firedAt &&
      (now - i.firedAt.getTime()) / 60000 > 15
    );
    const isVeryOld = ageMin > 50;
    if (hasLongPrep || isVeryOld) status = "red";

    // purple: all mains DONE/DELIVERED for > 5 min (upsell dessert)
    const mains = allItems.filter(i => i.course === 2);
    const allMainsDone = mains.length > 0 && mains.every(i =>
      ["DONE", "DELIVERED"].includes(i.itemStatus)
    );
    const oldestMainDone = mains.length > 0
      ? Math.max(...mains.map(i => i.doneAt?.getTime() ?? 0))
      : 0;
    const mainsDoneMin = oldestMainDone ? (now - oldestMainDone) / 60000 : 0;
    if (status === "green" && allMainsDone && mainsDoneMin > 5) status = "purple";

    const statusTag = status === "red"
      ? (hasLongPrep ? "⏱ עיכוב הכנה" : "⚠ שולחן ותיק")
      : status === "purple"
      ? "✦ הצע קינוח"
      : "✓ זרימה תקינה";

    return {
      tableNumber,
      status,
      statusTag,
      coversCount,
      totalAmount,
      ageMin: Math.floor(ageMin),
      startedAt: startedAt.toISOString(),
      itemCount: allItems.length,
      orders: tOrders.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        totalAmount: o.totalAmount,
        coversCount: o.coversCount,
        createdAt: o.createdAt.toISOString(),
        items: o.items.map(i => ({
          id: i.id,
          name: i.item.name,
          basePrice: i.item.price,
          quantity: i.quantity,
          price: i.price,
          notes: i.notes,
          itemStatus: i.itemStatus,
          course: i.course,
          heldUntilFired: i.heldUntilFired,
          firedAt: i.firedAt?.toISOString() ?? null,
          doneAt: i.doneAt?.toISOString() ?? null,
          servedAt: i.servedAt?.toISOString() ?? null,
          createdAt: o.createdAt.toISOString(),
          isComped: i.isComped,
        })),
        statusLogs: o.statusLogs.map(l => ({
          fromStatus: l.fromStatus,
          toStatus: l.toStatus,
          changedAt: l.changedAt.toISOString(),
          changedBy: l.changedBy,
        })),
      })),
    };
  });

  // sort: red first, then purple, then green
  tables.sort((a, b) => {
    const order = { red: 0, purple: 1, green: 2 };
    return order[a.status] - order[b.status];
  });

  return NextResponse.json({ tables });
}
