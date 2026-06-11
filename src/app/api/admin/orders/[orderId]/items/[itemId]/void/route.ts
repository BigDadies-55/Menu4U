import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sseNotify } from "@/lib/sse";
import { logAudit, getIp } from "@/lib/audit";
import { verifyManagerToken } from "@/lib/verifyManagerToken";
import { notifyRestaurant } from "@/lib/push";
import { NextResponse } from "next/server";

// PATCH — void (cancel) a sent item. Requires managerToken.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orderId: string; itemId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId, itemId } = await params;
  const { managerToken, reason } = await req.json();

  await prisma.$executeRawUnsafe(`ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMP(3)`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "voidReason" TEXT`);

  const claims = await verifyManagerToken(managerToken ?? "");
  if (!claims) return NextResponse.json({ error: "נדרש אישור מנהל — PIN פג תוקף או שגוי" }, { status: 403 });

  const orderItem = await prisma.orderItem.findUnique({
    where: { id: itemId },
    include: { order: true, item: { select: { name: true } } },
  });
  if (!orderItem || orderItem.orderId !== orderId)
    return NextResponse.json({ error: "פריט לא נמצא" }, { status: 404 });
  if (orderItem.voidedAt)
    return NextResponse.json({ error: "פריט כבר בוטל" }, { status: 400 });

  // Mark voided + update order total
  const refund = orderItem.price * orderItem.quantity;
  await prisma.$transaction([
    prisma.orderItem.update({
      where: { id: itemId },
      data: { voidedAt: new Date(), voidReason: reason ?? null, itemStatus: "CANCELLED" },
    }),
    prisma.order.update({
      where: { id: orderId },
      data: { totalAmount: { decrement: refund } },
    }),
  ]);

  await logAudit({
    userId: session.user.id, userEmail: session.user.email,
    action: "VOID_ORDER_ITEM", entity: "orderItem", entityId: itemId,
    entityName: `${orderItem.item.name} × ${orderItem.quantity} — אושר ע"י ${claims.managerName}${reason ? ` (${reason})` : ""}`,
    ip: getIp(req),
  });

  sseNotify(orderItem.order.restaurantId);
  notifyRestaurant(orderItem.order.restaurantId, "ITEM_VOID", {
    title: "⚠️ פריט בוטל (VOID)",
    body: `${orderItem.item.name} ×${orderItem.quantity} — שולחן ${orderItem.order.tableNumber ?? "—"}${reason ? ` · ${reason}` : ""}`,
    url: "/admin/orders",
    tag: `void-${itemId}`,
  });
  return NextResponse.json({ ok: true });
}
