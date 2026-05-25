import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { restaurantId } = body;
  // tableNumber may be null (orders placed without a table number)
  const tableNumber: string | null = body.tableNumber !== undefined ? (body.tableNumber || null) : null;

  if (!restaurantId) {
    return NextResponse.json({ error: "Missing restaurantId" }, { status: 400 });
  }

  // Auth: non-superadmin must belong to this restaurant
  const role = session.user.role;
  if (role !== "SUPER_ADMIN") {
    const link = await prisma.restaurantUser.findFirst({
      where: { userId: session.user.id, restaurantId },
    });
    if (!link) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // All non-cancelled, non-paid orders for this table.
  // When tableNumber is null we match BOTH null and "" because some orders
  // arrive with tableNumber="" (empty string) from the public menu form.
  const tableFilter = tableNumber === null
    ? { OR: [{ tableNumber: null as string | null }, { tableNumber: "" }] }
    : { tableNumber };

  const openOrders = await prisma.order.findMany({
    where: {
      restaurantId,
      ...tableFilter,
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

  // ── CRITICAL: mark orders PAID (standalone update — not bundled with optional logging) ──
  await prisma.order.updateMany({
    where: { id: { in: openOrders.map(o => o.id) } },
    data: { status: "PAID" },
  });

  // ── BEST-EFFORT: status log (failure here must NOT roll back the PAID update) ──
  try {
    await prisma.orderStatusLog.createMany({
      data: openOrders.map(o => ({
        orderId: o.id,
        fromStatus: o.status,
        toStatus: "PAID",
        changedBy: session.user.id ?? null,
      })),
      skipDuplicates: true,
    });
  } catch { /* non-critical */ }

  // ── BEST-EFFORT: table session record ──
  try {
    if (tableNumber) {   // only when there's a real table number (String field is non-nullable)
      await prisma.tableSession.create({
        data: {
          restaurantId,
          tableNumber,
          openedAt,
          closedAt: new Date(),
          totalAmount,
          orderCount: openOrders.length,
        },
      });
    }
  } catch { /* migration may not have run yet — ignore */ }

  return NextResponse.json({ closed: openOrders.length, totalAmount });
}
