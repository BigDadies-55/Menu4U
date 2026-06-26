import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sseNotify } from "@/lib/sse";
import { notifyRestaurant } from "@/lib/push";
import { NextResponse } from "next/server";
import { logAudit, getIp } from "@/lib/audit";
import { idempotencyKey, getIdempotent, saveIdempotent } from "@/lib/idempotency";

/**
 * POST /api/admin/orders/waiter
 *
 * Creates a waiter order using real item IDs — exactly like a customer order.
 * Goes directly to CONFIRMED status, bypassing PENDING.
 * Prices are taken from the DB (not from client) for integrity.
 *
 * Body: {
 *   restaurantId: string
 *   tableNumber:  string
 *   coversCount?: number
 *   notes?:       string
 *   items: Array<{ itemId: string; quantity: number; notes?: string; course?: number }>
 * }
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Idempotency — a replayed offline order returns the original result, never a duplicate.
  const idemKey = idempotencyKey(req);
  const cached = await getIdempotent(idemKey);
  if (cached) return NextResponse.json(cached.response, { status: cached.statusCode });

  const body = await req.json();
  const { restaurantId, tableNumber, notes, coversCount, tableAllergens, items } = body;

  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });
  if (!tableNumber)  return NextResponse.json({ error: "tableNumber required" }, { status: 400 });
  if (!Array.isArray(items) || items.length === 0)
    return NextResponse.json({ error: "No items" }, { status: 400 });

  // Verify access
  if (session.user.role !== "SUPER_ADMIN") {
    const access = await prisma.restaurantUser.findUnique({
      where: { userId_restaurantId: { userId: session.user.id, restaurantId } },
    });
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify restaurant exists
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } });
  if (!restaurant) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });

  // Ensure order counter table + column exist (same as customer API)
  await Promise.allSettled([
    prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "orderNumber" INTEGER`),
    prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "tableAllergens" TEXT[] NOT NULL DEFAULT '{}'`),
    prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "OrderCounter" ("restaurantId" TEXT PRIMARY KEY, "counter" INTEGER NOT NULL DEFAULT 0)`),
  ]);

  type ReqItem = { itemId: string; quantity: number; notes?: string; course?: number };

  // Validate items exist and are active in this restaurant — fetch DB price
  const itemIds = (items as ReqItem[]).map(i => i.itemId);
  const dbItems = await prisma.item.findMany({
    where: { id: { in: itemIds }, isActive: true, category: { menu: { restaurantId } } },
    select: { id: true, price: true, name: true, category: { select: { autoReady: true } } },
  });

  if (dbItems.length === 0)
    return NextResponse.json({ error: "No valid items found" }, { status: 400 });

  const priceMap     = Object.fromEntries(dbItems.map(i => [i.id, i.price]));
  const autoReadySet = new Set(dbItems.filter(i => i.category.autoReady).map(i => i.id));

  const validItems = (items as ReqItem[]).filter(i => priceMap[i.itemId] !== undefined);
  const totalAmount = validItems.reduce((s, i) => s + priceMap[i.itemId] * i.quantity, 0);

  // Atomic order number
  const counterResult = await prisma.$queryRawUnsafe<{ counter: bigint }[]>(
    `INSERT INTO "OrderCounter" ("restaurantId", "counter")
     VALUES ($1, 1)
     ON CONFLICT ("restaurantId") DO UPDATE SET "counter" = "OrderCounter"."counter" + 1
     RETURNING "counter"`,
    restaurantId
  );
  const orderNumber = Number(counterResult[0]?.counter ?? 1);

  // Create order with real item IDs — directly CONFIRMED
  const order = await prisma.order.create({
    data: {
      restaurantId,
      tableNumber,
      notes:          notes ?? null,
      coversCount:    coversCount ? Number(coversCount) : null,
      tableAllergens: Array.isArray(tableAllergens) ? tableAllergens : [],
      totalAmount,
      orderNumber,
      status:          "CONFIRMED",
      orderSource:     "WAITER",
      createdByUserId: session.user.id,
      items: {
        create: validItems.map(i => {
          const course      = i.course ?? 1;
          const isAutoReady = autoReadySet.has(i.itemId);
          return {
            itemId:         i.itemId,
            quantity:       i.quantity,
            price:          priceMap[i.itemId],
            notes:          i.notes ?? null,
            course,
            // autoReady items (drinks/bar) skip kitchen — mark DONE immediately
            ...(isAutoReady ? { itemStatus: "DONE" } : {}),
            heldUntilFired: !isAutoReady && course > 1,
          };
        }),
      },
    },
    include: {
      items: { include: { item: { select: { name: true, prepTime: true } } } },
    },
  });

  // If all items are autoReady (DONE), advance order to READY immediately —
  // mirrors the allDone check in the item-status route for customer orders.
  const allItemsDone = order.items.every(i =>
    (i as unknown as { itemStatus: string; heldUntilFired: boolean }).itemStatus === "DONE" ||
    (i as unknown as { heldUntilFired: boolean }).heldUntilFired
  );
  if (allItemsDone) {
    await prisma.order.update({ where: { id: order.id }, data: { status: "READY" } });
    (order as unknown as { status: string }).status = "READY";
  }

  await logAudit({
    userId:     session.user.id,
    userEmail:  session.user.email,
    action:     "CREATE_WAITER_ORDER",
    entity:     "order",
    entityId:   order.id,
    entityName: `שולחן ${tableNumber} · ₪${totalAmount.toFixed(0)} · ${validItems.length} פריטים`,
    ip:         getIp(req),
  });

  sseNotify(restaurantId);
  notifyRestaurant(restaurantId, "ORDER_CREATED", {
    title: "🍽️ הזמנה חדשה",
    body: `שולחן ${tableNumber} · ${validItems.length} פריטים · ₪${totalAmount.toFixed(0)}`,
    url: "/admin/orders",
    tag: `order-${order.id}`,
  });
  await saveIdempotent(idemKey, 201, order);
  return NextResponse.json(order, { status: 201 });
}
