import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Ensure loyalty-related columns on Order exist
async function ensureColumns() {
  await Promise.allSettled([
    prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "loyaltyMemberId" TEXT`),
    prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "loyaltyMemberName" TEXT`),
    prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "loyaltyDiscountType" TEXT`),
    prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "loyaltyDiscountAmount" FLOAT`),
    prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "loyaltyCouponId" TEXT`),
  ]);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const { restaurantId } = await params;
  await ensureColumns();

  const { orderId, memberId, type, pointsToRedeem, couponId } = await req.json();

  if (!orderId || !memberId || !type) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  // Validate member belongs to this restaurant
  const member = await prisma.loyaltyMember.findFirst({
    where: { id: memberId, restaurantId },
  });
  if (!member) return NextResponse.json({ error: "member_not_found" }, { status: 404 });

  // Validate order belongs to this restaurant and is still open
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      restaurantId,
      status: { notIn: ["PAID", "CANCELLED", "DELIVERED"] },
    },
    select: {
      id: true,
      totalAmount: true,
      loyaltyMemberId: true,
      loyaltyMemberName: true,
    },
  });

  if (!order) return NextResponse.json({ error: "order_not_found" }, { status: 404 });

  // Already redeemed by someone else?
  if (order.loyaltyMemberId && order.loyaltyMemberId !== memberId) {
    return NextResponse.json({
      error: "already_redeemed",
      byName: order.loyaltyMemberName,
    }, { status: 409 });
  }

  // Already redeemed by this same member
  if (order.loyaltyMemberId === memberId) {
    return NextResponse.json({ error: "already_redeemed_self" }, { status: 409 });
  }

  // Fetch loyalty settings
  const settings = await prisma.loyaltySettings.findUnique({
    where: { restaurantId },
  });
  const shekelPerPoint = settings?.shekelPerPoint ?? 0.1;
  const minRedeemPoints = settings?.minRedeemPoints ?? 100;

  let discountAmount = 0;

  if (type === "POINTS") {
    if (!pointsToRedeem || pointsToRedeem < minRedeemPoints) {
      return NextResponse.json({ error: "insufficient_points", minRequired: minRedeemPoints }, { status: 400 });
    }
    if (member.points < pointsToRedeem) {
      return NextResponse.json({ error: "insufficient_points" }, { status: 400 });
    }
    discountAmount = pointsToRedeem * shekelPerPoint;
  } else if (type === "COUPON") {
    if (!couponId) return NextResponse.json({ error: "missing_coupon" }, { status: 400 });

    // Resolve group for cross-branch coupon support
    let groupId: string | null = null;
    try {
      type GRow = { groupId: string | null };
      const rows = await prisma.$queryRawUnsafe<GRow[]>(
        `SELECT "groupId" FROM "Restaurant" WHERE "id" = $1 LIMIT 1`,
        restaurantId
      );
      groupId = rows[0]?.groupId ?? null;
    } catch { /* ignore */ }

    // Use raw SQL to include validForGroupId (column not yet in generated Prisma types)
    type CouponRow = { id: string; memberId: string; restaurantId: string; type: string; value: number; description: string | null; usedAt: Date | null; expiresAt: Date | null };
    const couponRows = groupId
      ? await prisma.$queryRawUnsafe<CouponRow[]>(
          `SELECT * FROM "LoyaltyCoupon" WHERE "id" = $1 AND "memberId" = $2 AND "usedAt" IS NULL
           AND ("restaurantId" = $3 OR "validForGroupId" = $4) LIMIT 1`,
          couponId, memberId, restaurantId, groupId
        )
      : await prisma.$queryRawUnsafe<CouponRow[]>(
          `SELECT * FROM "LoyaltyCoupon" WHERE "id" = $1 AND "memberId" = $2 AND "usedAt" IS NULL
           AND "restaurantId" = $3 LIMIT 1`,
          couponId, memberId, restaurantId
        );
    const coupon = couponRows[0] ?? null;
    if (!coupon) return NextResponse.json({ error: "coupon_invalid" }, { status: 400 });
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return NextResponse.json({ error: "coupon_expired" }, { status: 400 });
    }
    discountAmount = coupon.type === "DISCOUNT_PERCENT"
      ? Math.round((order.totalAmount * coupon.value / 100) * 100) / 100
      : coupon.value;
  } else {
    return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  }

  const discountedTotal = Math.max(0, order.totalAmount - discountAmount);

  // Atomic lock — update loyalty fields AND reduce totalAmount in one statement
  const result = await prisma.$executeRawUnsafe(
    `UPDATE "Order"
     SET "loyaltyMemberId" = $1, "loyaltyMemberName" = $2,
         "loyaltyDiscountType" = $3, "loyaltyDiscountAmount" = $4,
         "loyaltyCouponId" = $5, "totalAmount" = $6
     WHERE id = $7 AND ("loyaltyMemberId" IS NULL)`,
    memberId, member.name, type, discountAmount, couponId ?? null, discountedTotal, orderId
  );

  if (result === 0) {
    // Race condition — someone else just got in
    const fresh = await prisma.order.findUnique({
      where: { id: orderId },
      select: { loyaltyMemberName: true },
    });
    return NextResponse.json({
      error: "already_redeemed",
      byName: fresh?.loyaltyMemberName ?? "אחר",
    }, { status: 409 });
  }

  // Commit: deduct points / mark coupon used + create transaction
  if (type === "POINTS") {
    await prisma.loyaltyMember.update({
      where: { id: memberId },
      data: { points: { decrement: pointsToRedeem } },
    });
    await prisma.loyaltyTransaction.create({
      data: {
        memberId,
        orderId,
        type: "REDEEM",
        points: -pointsToRedeem,
        note: `מימוש נקודות — הנחה ₪${discountAmount.toFixed(2)}`,
      },
    });
  } else if (type === "COUPON" && couponId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "LoyaltyCoupon" SET "usedAt" = NOW(), "usedAtRestaurantId" = $1 WHERE "id" = $2`,
      restaurantId, couponId
    );
    await prisma.loyaltyTransaction.create({
      data: {
        memberId,
        orderId,
        type: "REDEEM",
        points: 0,
        note: `מימוש קופון — הנחה ₪${discountAmount.toFixed(2)}`,
      },
    });
  }

  return NextResponse.json({ ok: true, discountAmount });
}
