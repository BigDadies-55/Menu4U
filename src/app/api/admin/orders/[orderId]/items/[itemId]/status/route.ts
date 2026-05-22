import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const ITEM_NEXT: Record<string, string> = {
  PENDING: "PREPARING",
  PREPARING: "DONE",
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orderId: string; itemId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId, itemId } = await params;

  // Fetch order + all its items
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const orderItem = order.items.find(i => i.id === itemId);
  if (!orderItem) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const nextItemStatus = ITEM_NEXT[orderItem.itemStatus];
  if (!nextItemStatus) return NextResponse.json({ error: "Already done" }, { status: 400 });

  // Update this item's status
  await prisma.orderItem.update({
    where: { id: itemId },
    data: { itemStatus: nextItemStatus },
  });

  // Check if all items are now DONE
  const allDone = order.items.every(i =>
    i.id === itemId ? nextItemStatus === "DONE" : i.itemStatus === "DONE"
  );

  if (allDone) {
    // Auto-close the order
    await prisma.$transaction([
      prisma.order.update({ where: { id: orderId }, data: { status: "DELIVERED" } }),
      prisma.orderStatusLog.create({
        data: {
          id: `${orderId}-auto-${Date.now()}`,
          orderId,
          fromStatus: order.status,
          toStatus: "DELIVERED",
          changedBy: session.user.id,
        },
      }),
    ]);
  }

  return NextResponse.json({ itemStatus: nextItemStatus, orderDelivered: allDone });
}
