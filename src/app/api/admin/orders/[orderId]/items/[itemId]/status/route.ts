import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sseNotify } from "@/lib/sse";
import { NextResponse } from "next/server";

const ITEM_NEXT: Record<string, string> = {
  PENDING: "PREPARING",
  PREPARING: "DONE",
};
const ITEM_PREV: Record<string, string> = {
  PREPARING: "PENDING",
  DONE: "PREPARING",
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orderId: string; itemId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId, itemId } = await params;

  // Read optional body
  let cancel = false;
  let goBack = false;
  try {
    const body = await req.json();
    cancel = !!body?.cancel;
    goBack = !!body?.goBack;
  } catch { /* no body — forward advance */ }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const orderItem = order.items.find(i => i.id === itemId);
  if (!orderItem) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  /* ── Cancel a single item ── */
  if (cancel) {
    if (orderItem.itemStatus === "CANCELLED") {
      return NextResponse.json({ error: "Already cancelled" }, { status: 400 });
    }
    await prisma.orderItem.update({
      where: { id: itemId },
      data: { itemStatus: "CANCELLED" },
    });
    // Recalculate order total (exclude cancelled items)
    const remaining = order.items.filter(i => i.id !== itemId && i.itemStatus !== "CANCELLED");
    const newTotal = remaining.reduce((s, i) => s + i.price * i.quantity, 0);
    await prisma.order.update({ where: { id: orderId }, data: { totalAmount: newTotal } });
    sseNotify(order.restaurantId);
    return NextResponse.json({ itemStatus: "CANCELLED", orderDelivered: false, newTotal });
  }

  /* ── Go backwards ── */
  if (goBack) {
    const prevStatus = ITEM_PREV[orderItem.itemStatus];
    if (!prevStatus) return NextResponse.json({ error: "Already at start" }, { status: 400 });
    await prisma.orderItem.update({ where: { id: itemId }, data: { itemStatus: prevStatus } });
    // If order was READY or DELIVERED, reopen it (items not all done anymore)
    if (order.status === "READY" || order.status === "DELIVERED") {
      await prisma.order.update({ where: { id: orderId }, data: { status: "PREPARING" } });
    }
    sseNotify(order.restaurantId);
    return NextResponse.json({ itemStatus: prevStatus, orderReady: false });
  }

  /* ── Advance forward (default) ── */
  const nextItemStatus = ITEM_NEXT[orderItem.itemStatus];
  if (!nextItemStatus) return NextResponse.json({ error: "Already done" }, { status: 400 });

  await prisma.orderItem.update({
    where: { id: itemId },
    data: { itemStatus: nextItemStatus },
  });

  // Check if all non-cancelled items are now DONE
  const allDone = order.items.every(i => {
    if (i.id === itemId) return nextItemStatus === "DONE";
    return i.itemStatus === "DONE" || i.itemStatus === "CANCELLED";
  });

  if (allDone) {
    await prisma.$transaction([
      prisma.order.update({ where: { id: orderId }, data: { status: "READY" } }),
      prisma.orderStatusLog.create({
        data: {
          id: `${orderId}-auto-${Date.now()}`,
          orderId,
          fromStatus: order.status,
          toStatus: "READY",
          changedBy: session.user.id,
        },
      }),
    ]);
  }

  sseNotify(order.restaurantId);
  return NextResponse.json({ itemStatus: nextItemStatus, orderReady: allDone });
}
