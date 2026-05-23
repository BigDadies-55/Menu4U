import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tableNumber, restaurantId } = await req.json();
  if (!tableNumber || !restaurantId) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  // Auth: non-superadmin must belong to this restaurant
  const role = session.user.role;
  if (role !== "SUPER_ADMIN") {
    const link = await prisma.restaurantUser.findFirst({
      where: { userId: session.user.id, restaurantId },
    });
    if (!link) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // All non-cancelled, non-paid orders for this table
  const openOrders = await prisma.order.findMany({
    where: {
      restaurantId,
      tableNumber,
      status: { notIn: ["CANCELLED", "PAID"] },
    },
    select: { id: true, status: true, totalAmount: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  if (openOrders.length === 0) {
    return NextResponse.json({ closed: 0, totalAmount: 0 });
  }

  const totalAmount = openOrders.reduce((s, o) => s + o.totalAmount, 0);
  const openedAt = openOrders[0]?.createdAt ?? new Date();

  // Mark all open orders as PAID
  await prisma.$transaction([
    prisma.order.updateMany({
      where: { id: { in: openOrders.map(o => o.id) } },
      data: { status: "PAID" },
    }),
    prisma.orderStatusLog.createMany({
      data: openOrders.map(o => ({
        id: `close-${o.id}-${Date.now()}`,
        orderId: o.id,
        fromStatus: o.status,
        toStatus: "PAID",
        changedBy: session.user.id,
      })),
      skipDuplicates: true,
    }),
  ]);

  // Best-effort: record table session (non-critical, won't fail the close)
  try {
    await prisma.tableSession.create({
      data: {
        id: `ts-${restaurantId}-${tableNumber}-${Date.now()}`,
        restaurantId,
        tableNumber,
        openedAt,
        closedAt: new Date(),
        totalAmount,
        orderCount: openOrders.length,
      },
    });
  } catch { /* migration may not have run yet — ignore */ }

  return NextResponse.json({ closed: openOrders.length, totalAmount });
}
