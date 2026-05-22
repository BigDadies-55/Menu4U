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

  // Get all active orders for this table
  const activeOrders = await prisma.order.findMany({
    where: {
      restaurantId,
      tableNumber,
      status: { notIn: ["DELIVERED", "CANCELLED"] },
    },
    select: { id: true, status: true, totalAmount: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  if (activeOrders.length === 0) {
    return NextResponse.json({ closed: 0, totalAmount: 0 });
  }

  const totalAmount = activeOrders.reduce((s, o) => s + o.totalAmount, 0);
  const openedAt = activeOrders[0].createdAt;

  await prisma.$transaction([
    // Mark all active orders as DELIVERED
    prisma.order.updateMany({
      where: { id: { in: activeOrders.map(o => o.id) } },
      data: { status: "DELIVERED" },
    }),
    // Create status logs for each order
    prisma.orderStatusLog.createMany({
      data: activeOrders.map(o => ({
        id: `close-${o.id}-${Date.now()}`,
        orderId: o.id,
        fromStatus: o.status,
        toStatus: "DELIVERED",
        changedBy: session.user.id,
      })),
      skipDuplicates: true,
    }),
    // Record the table session
    prisma.tableSession.create({
      data: {
        id: `ts-${restaurantId}-${tableNumber}-${Date.now()}`,
        restaurantId,
        tableNumber,
        openedAt,
        totalAmount,
        orderCount: activeOrders.length,
      },
    }),
  ]);

  return NextResponse.json({ closed: activeOrders.length, totalAmount });
}
