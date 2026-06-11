import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sseNotify } from "@/lib/sse";
import { logAudit, getIp } from "@/lib/audit";
import { NextResponse } from "next/server";

async function ensureColumns() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "servedByUserId" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "isComped" BOOLEAN NOT NULL DEFAULT false`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMP(3)`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "voidReason" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "compReason" TEXT`);
}

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

  await ensureColumns();

  const { orderId, itemId } = await params;

  // Read optional body
  let cancel = false;
  let goBack = false;
  let serve  = false;
  let unserve = false;
  let comp    = false;
  let compReason: string | null = null;
  try {
    const body = await req.json();
    cancel     = !!body?.cancel;
    goBack     = !!body?.goBack;
    serve      = !!body?.serve;
    unserve    = !!body?.unserve;
    comp       = !!body?.comp;
    compReason = body?.compReason ?? null;
  } catch { /* no body — forward advance */ }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { item: { select: { name: true } } } } },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (session.user.role !== "SUPER_ADMIN") {
    const access = await prisma.restaurantUser.findFirst({
      where: { userId: session.user.id, restaurantId: order.restaurantId },
    });
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orderItem = order.items.find(i => i.id === itemId);
  if (!orderItem) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  /* ── Serve / un-serve a single item (physical delivery to table) ── */
  if (serve || unserve) {
    if (orderItem.itemStatus === "CANCELLED") {
      return NextResponse.json({ error: "Item is cancelled" }, { status: 400 });
    }
    const servedAt = serve ? new Date() : null;
    await prisma.orderItem.update({
      where: { id: itemId },
      data: {
        servedAt,
        itemStatus: serve ? "SERVED" : (orderItem.itemStatus === "SERVED" ? "DONE" : orderItem.itemStatus),
        servedByUserId: serve ? session.user.id : null,
      },
    });
    sseNotify(order.restaurantId);
    return NextResponse.json({ servedAt: servedAt?.toISOString() ?? null });
  }

  /* ── Cancel a single item ── */
  if (cancel) {
    if (orderItem.itemStatus === "CANCELLED") {
      return NextResponse.json({ error: "Already cancelled" }, { status: 400 });
    }
    await prisma.orderItem.update({
      where: { id: itemId },
      data: { itemStatus: "CANCELLED" },
    });
    // Recalculate order total (exclude cancelled + comped items)
    const remaining = order.items.filter(i => i.id !== itemId && i.itemStatus !== "CANCELLED" && !i.isComped);
    const newTotal = remaining.reduce((s, i) => s + i.price * i.quantity, 0);
    await prisma.order.update({ where: { id: orderId }, data: { totalAmount: newTotal } });
    await logAudit({
      userId: session.user.id, userEmail: session.user.email,
      action: "CANCEL_ORDER_ITEM", entity: "OrderItem", entityId: itemId,
      entityName: `${orderItem.item.name} ×${orderItem.quantity}`,
      meta: { orderId, tableNumber: order.tableNumber, newTotal },
      ip: getIp(req),
    });
    sseNotify(order.restaurantId);
    return NextResponse.json({ itemStatus: "CANCELLED", orderDelivered: false, newTotal });
  }

  /* ── Comp a single item (give for free) ── */
  if (comp) {
    if (orderItem.itemStatus === "CANCELLED") {
      return NextResponse.json({ error: "Item is cancelled" }, { status: 400 });
    }
    await prisma.orderItem.update({
      where: { id: itemId },
      data: { isComped: !orderItem.isComped, compReason: !orderItem.isComped ? (compReason ?? null) : null },
    });
    const toggling = !orderItem.isComped;
    // Recalculate total: exclude cancelled and comped items
    const allItems = order.items.map(i => i.id === itemId ? { ...i, isComped: toggling } : i);
    const newTotal = allItems
      .filter(i => i.itemStatus !== "CANCELLED" && !i.isComped)
      .reduce((s, i) => s + i.price * i.quantity, 0);
    await prisma.order.update({ where: { id: orderId }, data: { totalAmount: newTotal } });
    await logAudit({
      userId: session.user.id, userEmail: session.user.email,
      action: toggling ? "COMP_ORDER_ITEM" : "UNCOMP_ORDER_ITEM",
      entity: "OrderItem", entityId: itemId,
      entityName: `${orderItem.item.name} ×${orderItem.quantity}`,
      meta: { orderId, tableNumber: order.tableNumber, reason: compReason, newTotal },
      ip: getIp(req),
    });
    sseNotify(order.restaurantId);
    return NextResponse.json({ isComped: toggling, newTotal });
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

  const now = new Date();
  await prisma.orderItem.update({
    where: { id: itemId },
    data: {
      itemStatus: nextItemStatus,
      // Record firedAt when item first enters PREPARING (if not already set from fire-course)
      ...(nextItemStatus === "PREPARING" && !orderItem.firedAt ? { firedAt: now } : {}),
      // Record completion time
      ...(nextItemStatus === "DONE" ? { doneAt: now } : {}),
    },
  });

  // Check if all non-cancelled, non-held items are now DONE
  const allDone = order.items.every(i => {
    if (i.heldUntilFired) return true; // held items don't block order completion
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
