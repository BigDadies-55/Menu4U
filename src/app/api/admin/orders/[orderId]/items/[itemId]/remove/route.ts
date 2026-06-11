import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sseNotify } from "@/lib/sse";
import { NextResponse } from "next/server";

// DELETE — remove a PENDING (held, not yet fired) item without manager PIN
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ orderId: string; itemId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId, itemId } = await params;

  const orderItem = await prisma.orderItem.findUnique({
    where: { id: itemId },
    include: { order: true, item: { select: { name: true } } },
  });

  if (!orderItem || orderItem.orderId !== orderId)
    return NextResponse.json({ error: "פריט לא נמצא" }, { status: 404 });

  if (orderItem.voidedAt || orderItem.itemStatus === "CANCELLED")
    return NextResponse.json({ error: "פריט כבר בוטל" }, { status: 400 });

  // Only allow removing items that haven't been fired to the kitchen yet
  const canRemove = orderItem.heldUntilFired || !orderItem.firedAt;
  if (!canRemove)
    return NextResponse.json({ error: "הפריט כבר נשלח למטבח — דרוש אישור מנהל לביטול" }, { status: 403 });

  const refund = orderItem.price * orderItem.quantity;
  await prisma.$transaction([
    prisma.orderItem.update({
      where: { id: itemId },
      data: { voidedAt: new Date(), voidReason: "הוסר ע\"י מלצר", itemStatus: "CANCELLED" },
    }),
    prisma.order.update({
      where: { id: orderId },
      data: { totalAmount: { decrement: refund } },
    }),
  ]);

  sseNotify(orderItem.order.restaurantId);
  return NextResponse.json({ ok: true });
}
