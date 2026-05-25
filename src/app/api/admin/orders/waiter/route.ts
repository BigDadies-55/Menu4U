import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sseNotify } from "@/lib/sse";
import { NextResponse } from "next/server";
import { logAudit, getIp } from "@/lib/audit";

/**
 * POST /api/admin/orders/waiter
 *
 * Creates a free-text waiter order (no item IDs needed).
 * Goes directly to CONFIRMED status, bypassing PENDING.
 * Each free-text item gets a placeholder itemId linked to a special
 * "waiter-item" sentinel, stored with the item name in notes.
 *
 * Body: {
 *   restaurantId: string
 *   tableNumber: string
 *   notes?: string
 *   items: Array<{ name: string; price: number; course: number; qty: number }>
 * }
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { restaurantId, tableNumber, notes, items } = body;

  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });
  if (!tableNumber)  return NextResponse.json({ error: "tableNumber required" }, { status: 400 });
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

  // Verify restaurant exists
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } });
  if (!restaurant) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });

  // Find or create a sentinel "POS Item" item in the restaurant's first menu
  // We use a special approach: find any active item to use as the itemId placeholder,
  // but store the real name in the notes field
  const anyItem = await prisma.item.findFirst({
    where: { category: { menu: { restaurantId } }, isActive: true },
    select: { id: true },
  });

  if (!anyItem) {
    return NextResponse.json({ error: "No menu items found for this restaurant" }, { status: 400 });
  }

  type FreeItem = { name: string; price: number; course: number; qty: number };

  const totalAmount = items.reduce((s: number, i: FreeItem) => s + i.price * i.qty, 0);

  // Create waiter order — directly CONFIRMED, course management applied
  const order = await prisma.order.create({
    data: {
      restaurantId,
      tableNumber,
      notes: notes ?? null,
      totalAmount,
      status: "CONFIRMED",
      orderSource: "WAITER",
      items: {
        create: (items as FreeItem[]).map(i => ({
          itemId: anyItem.id, // placeholder item ID
          quantity: i.qty,
          price: i.price,
          notes: i.name, // item name stored in notes since we're using placeholder
          course: i.course ?? 1,
          heldUntilFired: (i.course ?? 1) > 1,
        })),
      },
    },
    include: {
      items: {
        include: {
          item: { select: { name: true, prepTime: true } },
        },
      },
    },
  });

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email,
    action: "CREATE_WAITER_ORDER",
    entity: "order",
    entityId: order.id,
    entityName: `שולחן ${tableNumber} · ₪${totalAmount.toFixed(0)} · ${items.length} פריטים`,
    ip: getIp(req),
  });

  sseNotify(restaurantId);
  return NextResponse.json(order, { status: 201 });
}
