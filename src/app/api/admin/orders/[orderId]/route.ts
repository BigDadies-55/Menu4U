import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId } = await params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        orderBy: [{ course: "asc" }, { createdAt: "asc" }],
        include: {
          item: { select: { name: true, allergens: true } },
          modifiers: true,
        },
      },
    },
  });

  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (session.user.role !== "SUPER_ADMIN") {
    const access = await prisma.restaurantUser.findUnique({
      where: { userId_restaurantId: { userId: session.user.id, restaurantId: order.restaurantId } },
    });
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    id: order.id,
    orderNumber: order.orderNumber,
    totalAmount: order.totalAmount,
    status: order.status,
    tableAllergens: order.tableAllergens,
    coversCount: order.coversCount,
    notes: order.notes,
    items: order.items.map(oi => ({
      id: oi.id,
      itemId: oi.itemId,
      itemName: oi.item.name,
      itemAllergens: oi.item.allergens,
      quantity: oi.quantity,
      price: oi.price,
      notes: oi.notes,
      itemStatus: oi.itemStatus,
      course: oi.course,
      heldUntilFired: oi.heldUntilFired,
      firedAt: oi.firedAt,
      doneAt: oi.doneAt,
      servedAt: oi.servedAt,
      isComped: oi.isComped,
      modifiers: oi.modifiers,
    })),
  });
}
