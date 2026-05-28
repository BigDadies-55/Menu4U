import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sseNotify } from "@/lib/sse";
import { NextResponse } from "next/server";
import { logAudit, getIp } from "@/lib/audit";

const VALID_STATUSES = ["PENDING","CONFIRMED","PREPARING","READY","DELIVERED","CANCELLED"];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId } = await params;
  const { status } = await req.json();

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  type OrderRow = {
    restaurantId: string; status: string;
    loyaltyMemberId: string | null; loyaltyDiscountType: string | null;
    loyaltyDiscountAmount: number | null; loyaltyCouponId: string | null;
  };
  const orders = await prisma.$queryRawUnsafe<OrderRow[]>(
    `SELECT "restaurantId", "status",
            "loyaltyMemberId", "loyaltyDiscountType",
            "loyaltyDiscountAmount", "loyaltyCouponId"
     FROM "Order" WHERE "id" = $1 LIMIT 1`,
    orderId
  );
  const order = orders[0];
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Check access
  if (session.user.role !== "SUPER_ADMIN") {
    const access = await prisma.restaurantUser.findUnique({
      where: { userId_restaurantId: { userId: session.user.id, restaurantId: order.restaurantId } },
    });
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [updated] = await prisma.$transaction([
    prisma.order.update({ where: { id: orderId }, data: { status } }),
    prisma.orderStatusLog.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus: status,
        changedBy: session.user.id,
      },
    }),
  ]);

  // Refund loyalty redemption when cancelling an order that had a discount
  if (
    status === "CANCELLED" &&
    order.status !== "CANCELLED" &&
    order.loyaltyMemberId &&
    order.loyaltyDiscountAmount &&
    order.loyaltyDiscountAmount > 0
  ) {
    try {
      if (order.loyaltyDiscountType === "POINTS") {
        // Find the original REDEEM transaction to know exactly how many points were taken
        type TxRow = { points: number };
        const txRows = await prisma.$queryRawUnsafe<TxRow[]>(
          `SELECT "points" FROM "LoyaltyTransaction"
           WHERE "orderId" = $1 AND "memberId" = $2 AND "type" = 'REDEEM'
           ORDER BY "createdAt" DESC LIMIT 1`,
          orderId, order.loyaltyMemberId
        );
        const pointsToRefund = txRows[0] ? Math.abs(txRows[0].points) : 0;
        if (pointsToRefund > 0) {
          await prisma.loyaltyMember.update({
            where: { id: order.loyaltyMemberId },
            data: { points: { increment: pointsToRefund } },
          });
          await prisma.loyaltyTransaction.create({
            data: {
              memberId: order.loyaltyMemberId,
              orderId,
              type: "REFUND",
              points: pointsToRefund,
              note: `החזר נקודות — ביטול הזמנה ₪${order.loyaltyDiscountAmount.toFixed(2)}`,
            },
          });
        }
      } else if (order.loyaltyDiscountType === "COUPON" && order.loyaltyCouponId) {
        // Un-mark the coupon so it can be reused
        await prisma.$executeRawUnsafe(
          `UPDATE "LoyaltyCoupon" SET "usedAt" = NULL, "usedAtRestaurantId" = NULL WHERE "id" = $1`,
          order.loyaltyCouponId
        );
        await prisma.loyaltyTransaction.create({
          data: {
            memberId: order.loyaltyMemberId,
            orderId,
            type: "REFUND",
            points: 0,
            note: `החזר קופון — ביטול הזמנה ₪${order.loyaltyDiscountAmount.toFixed(2)}`,
          },
        });
      }
    } catch { /* non-critical — order is already cancelled */ }
  }

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email,
    action: "UPDATE_ORDER_STATUS",
    entity: "order",
    entityId: orderId,
    entityName: `Order ${orderId.slice(-6)} → ${status}`,
    ip: getIp(req),
  });

  sseNotify(order.restaurantId);

  return NextResponse.json(updated);
}
