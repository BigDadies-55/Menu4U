import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sseNotify } from "@/lib/sse";
import { NextResponse } from "next/server";
import { logAudit, getIp } from "@/lib/audit";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");
  const activeOnly = searchParams.get("activeOnly") === "1";

  const role = session.user.role;
  const userId = session.user.id;

  // Build restaurant filter
  let restaurantFilter: { in: string[] } | undefined;
  if (role !== "SUPER_ADMIN") {
    const userRestaurants = await prisma.restaurantUser.findMany({
      where: { userId },
      select: { restaurantId: true },
    });
    const ids = userRestaurants.map(r => r.restaurantId);
    if (restaurantId && !ids.includes(restaurantId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    restaurantFilter = { in: restaurantId ? [restaurantId] : ids };
  } else if (restaurantId) {
    restaurantFilter = { in: [restaurantId] };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const statusFilter: any = activeOnly ? { notIn: ["CANCELLED", "PAID", "DELIVERED"] } : undefined;

  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let createdAtFilter: any;
  if (fromParam) {
    createdAtFilter = { gte: new Date(fromParam), ...(toParam ? { lte: new Date(toParam) } : {}) };
  } else if (activeOnly) {
    createdAtFilter = { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) };
  }

  const orders = await prisma.order.findMany({
    where: {
      ...(restaurantFilter ? { restaurantId: restaurantFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
    },
    orderBy: { createdAt: "asc" },
    include: {
      restaurant: { select: { id: true, name: true } },
      items: {
        include: {
          item: { select: { name: true, prepTime: true, category: { select: { name: true } } } },
          modifiers: { select: { groupName: true, label: true, priceAdd: true } },
        },
        orderBy: [{ course: "asc" }, { id: "asc" }],
      },
    },
  });

  return NextResponse.json(orders);
}

/* ── POST: Create a waiter-side order (goes directly to CONFIRMED) ── */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { restaurantId, tableNumber, notes, items } = body;

  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });
  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "No items" }, { status: 400 });
  }

  // Verify access
  if (session.user.role !== "SUPER_ADMIN") {
    const access = await prisma.restaurantUser.findUnique({
      where: { userId_restaurantId: { userId: session.user.id, restaurantId } },
    });
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Validate items
  type CartItem = { itemId: string; quantity: number; notes?: string; course?: number; modifiers?: { groupName: string; label: string; priceAdd: number }[] };
  const itemIds = items.map((i: CartItem) => i.itemId);
  const dbItems = await prisma.item.findMany({
    where: { id: { in: itemIds }, isActive: true },
    select: { id: true, price: true, category: { select: { autoReady: true } } },
  });
  const priceMap     = Object.fromEntries(dbItems.map(i => [i.id, i.price]));
  const autoReadySet = new Set(dbItems.filter(i => i.category.autoReady).map(i => i.id));
  const validItems = items.filter((i: CartItem) => priceMap[i.itemId]);
  if (validItems.length === 0) return NextResponse.json({ error: "No valid items" }, { status: 400 });

  const totalAmount = validItems.reduce(
    (sum: number, i: CartItem) =>
      sum + (priceMap[i.itemId] + (i.modifiers?.reduce((s, m) => s + m.priceAdd, 0) ?? 0)) * i.quantity,
    0
  );

  // Waiter orders go directly to CONFIRMED; course 2+ items are held
  const order = await prisma.order.create({
    data: {
      restaurantId,
      tableNumber: tableNumber ?? null,
      notes: notes ?? null,
      totalAmount,
      status: "CONFIRMED",        // ← skip PENDING
      orderSource: "WAITER",
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
            ...(isAutoReady ? { itemStatus: "DONE" } : {}),
            heldUntilFired: !isAutoReady && course > 1,
          };
        }),
      },
    },
    include: {
      items: {
        include: {
          item: { select: { name: true, prepTime: true, category: { select: { name: true } } } },
          modifiers: true,
        },
      },
    },
  });

  // Create modifiers
  for (let idx = 0; idx < validItems.length; idx++) {
    const ci = validItems[idx] as CartItem;
    if (ci.modifiers && ci.modifiers.length > 0) {
      const orderItem = order.items[idx];
      if (orderItem) {
        await prisma.orderItemModifier.createMany({
          data: ci.modifiers.map((m, midx) => ({
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

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email,
    action: "CREATE_WAITER_ORDER",
    entity: "order",
    entityId: order.id,
    entityName: `שולחן ${tableNumber ?? "–"} · ₪${totalAmount.toFixed(0)}`,
    ip: getIp(req),
  });

  sseNotify(restaurantId);
  return NextResponse.json(order, { status: 201 });
}
