import { prisma } from "@/lib/prisma";
import { sseNotify } from "@/lib/sse";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const { restaurantId } = await params;

  // Inline migrations
  await Promise.allSettled([
    prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "orderNumber" INTEGER`),
    prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "OrderCounter" ("restaurantId" TEXT PRIMARY KEY, "counter" INTEGER NOT NULL DEFAULT 0)`),
    prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "loyaltyMemberId" TEXT`),
    prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "loyaltyMemberName" TEXT`),
    prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "loyaltyDiscountType" TEXT`),
    prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "loyaltyDiscountAmount" DOUBLE PRECISION`),
    prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "loyaltyCouponId" TEXT`),
  ]);

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId, isActive: true, ordersEnabled: true },
    select: { id: true },
  });
  if (!restaurant) {
    return NextResponse.json({ error: "Ordering not available" }, { status: 403 });
  }

  const body = await req.json();
  const {
    tableNumber, customerName, customerPhone, notes, items,
    loyaltyMemberId, loyaltyMemberName, loyaltyDiscountType,
    loyaltyDiscountAmount, loyaltyCouponId, loyaltyPointsToRedeem,
  } = body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "No items" }, { status: 400 });
  }

  // Validate items exist and are active — also fetch category.autoReady for drink routing
  const itemIds = items.map((i: { itemId: string }) => i.itemId);
  const dbItems = await prisma.item.findMany({
    where: { id: { in: itemIds }, isActive: true },
    select: { id: true, price: true, category: { select: { autoReady: true } } },
  });
  const priceMap    = Object.fromEntries(dbItems.map(i => [i.id, i.price]));
  const autoReadySet = new Set(dbItems.filter(i => i.category.autoReady).map(i => i.id));

  type CartModifier = { groupName: string; label: string; priceAdd: number };
  type CartItem = { itemId: string; quantity: number; notes?: string; course?: number; modifiers?: CartModifier[] };

  // Only include items that exist
  const validItems = items.filter((i: CartItem) => priceMap[i.itemId]);
  if (validItems.length === 0) {
    return NextResponse.json({ error: "No valid items" }, { status: 400 });
  }

  const baseTotal = validItems.reduce(
    (sum: number, i: CartItem) =>
      sum + (priceMap[i.itemId] + (i.modifiers?.reduce((s, m) => s + m.priceAdd, 0) ?? 0)) * i.quantity,
    0
  );
  // Apply pre-order loyalty discount if provided
  const discount = loyaltyMemberId && loyaltyDiscountAmount > 0 ? loyaltyDiscountAmount : 0;
  const totalAmount = Math.max(0, baseTotal - discount);

  // Get next order number for this restaurant (atomic)
  const counterResult = await prisma.$queryRawUnsafe<{ counter: bigint }[]>(
    `INSERT INTO "OrderCounter" ("restaurantId", "counter")
     VALUES ($1, 1)
     ON CONFLICT ("restaurantId") DO UPDATE SET "counter" = "OrderCounter"."counter" + 1
     RETURNING "counter"`,
    restaurantId
  );
  const orderNumber = Number(counterResult[0]?.counter ?? 1);

  // Create order + items
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order = await (prisma.order.create as any)({
    data: {
      restaurantId,
      tableNumber: tableNumber ?? null,
      customerName: customerName ?? null,
      customerPhone: customerPhone ?? null,
      notes: notes ?? null,
      totalAmount,
      orderNumber,
      orderSource: "CUSTOMER",
      // Pre-order loyalty discount fields
      ...(loyaltyMemberId ? {
        loyaltyMemberId,
        loyaltyMemberName: loyaltyMemberName ?? null,
        loyaltyDiscountType: loyaltyDiscountType ?? null,
        loyaltyDiscountAmount: discount > 0 ? discount : null,
        loyaltyCouponId: loyaltyCouponId ?? null,
      } : {}),
      items: {
        create: validItems.map((i: CartItem) => {
          const course = i.course ?? 1;
          const isAutoReady = autoReadySet.has(i.itemId);
          return {
            itemId: i.itemId,
            quantity: i.quantity,
            price: priceMap[i.itemId] + (i.modifiers?.reduce((s, m) => s + m.priceAdd, 0) ?? 0),
            notes: i.notes ?? null,
            course,
            // autoReady items (drinks/bar) skip kitchen — mark DONE immediately
            ...(isAutoReady ? { itemStatus: "DONE" } : {}),
            heldUntilFired: !isAutoReady && course > 1,
          };
        }),
      },
    },
    include: { items: true },
  });

  // Create OrderItemModifier records
  for (let idx = 0; idx < validItems.length; idx++) {
    const ci = validItems[idx] as CartItem;
    if (ci.modifiers && ci.modifiers.length > 0) {
      const orderItem = order.items[idx];
      if (orderItem) {
        await prisma.orderItemModifier.createMany({
          data: ci.modifiers.map((m: CartModifier, midx: number) => ({
            id: `oim-${orderItem.id}-${midx}`,
            orderItemId: orderItem.id,
            groupName: m.groupName,
            label: m.label,
            priceAdd: m.priceAdd,
          })),
        });
      }
    }
  }

  // Commit pre-order loyalty discount (best-effort — order already created)
  if (loyaltyMemberId && discount > 0) {
    try {
      if (loyaltyDiscountType === "POINTS" && loyaltyPointsToRedeem > 0) {
        await prisma.loyaltyMember.update({
          where: { id: loyaltyMemberId },
          data: { points: { decrement: loyaltyPointsToRedeem } },
        });
        await prisma.loyaltyTransaction.create({
          data: {
            id: `lt-${Date.now()}`,
            memberId: loyaltyMemberId,
            orderId: order.id,
            type: "REDEEM",
            points: -loyaltyPointsToRedeem,
            note: `מימוש נקודות — הנחה ₪${discount.toFixed(2)}`,
          },
        });
      } else if (loyaltyDiscountType === "COUPON" && loyaltyCouponId) {
        await prisma.$executeRawUnsafe(
          `UPDATE "LoyaltyCoupon" SET "usedAt" = NOW(), "usedAtRestaurantId" = $1 WHERE "id" = $2 AND "usedAt" IS NULL`,
          restaurantId, loyaltyCouponId
        );
        await prisma.loyaltyTransaction.create({
          data: {
            id: `lt-${Date.now()}`,
            memberId: loyaltyMemberId,
            orderId: order.id,
            type: "REDEEM",
            points: 0,
            note: `מימוש קופון — הנחה ₪${discount.toFixed(2)}`,
          },
        });
      }
    } catch { /* non-critical — order is already saved */ }
  }

  sseNotify(restaurantId);

  return NextResponse.json(order, { status: 201 });
}
