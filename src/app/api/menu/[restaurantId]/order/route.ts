import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const { restaurantId } = await params;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId, isActive: true, ordersEnabled: true },
    select: { id: true },
  });
  if (!restaurant) {
    return NextResponse.json({ error: "Ordering not available" }, { status: 403 });
  }

  const body = await req.json();
  const { tableNumber, customerName, customerPhone, notes, items } = body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "No items" }, { status: 400 });
  }

  // Validate items exist and are active
  const itemIds = items.map((i: { itemId: string }) => i.itemId);
  const dbItems = await prisma.item.findMany({
    where: { id: { in: itemIds }, isActive: true },
    select: { id: true, price: true },
  });
  const priceMap = Object.fromEntries(dbItems.map(i => [i.id, i.price]));

  type CartModifier = { groupName: string; label: string; priceAdd: number };
  type CartItem = { itemId: string; quantity: number; notes?: string; modifiers?: CartModifier[] };

  // Only include items that exist
  const validItems = items.filter((i: CartItem) => priceMap[i.itemId]);
  if (validItems.length === 0) {
    return NextResponse.json({ error: "No valid items" }, { status: 400 });
  }

  const totalAmount = validItems.reduce(
    (sum: number, i: CartItem) =>
      sum + (priceMap[i.itemId] + (i.modifiers?.reduce((s, m) => s + m.priceAdd, 0) ?? 0)) * i.quantity,
    0
  );

  // Create order + items (without modifiers first for id access)
  const order = await prisma.order.create({
    data: {
      restaurantId,
      tableNumber: tableNumber ?? null,
      customerName: customerName ?? null,
      customerPhone: customerPhone ?? null,
      notes: notes ?? null,
      totalAmount,
      items: {
        create: validItems.map((i: CartItem) => ({
          itemId: i.itemId,
          quantity: i.quantity,
          price: priceMap[i.itemId] + (i.modifiers?.reduce((s, m) => s + m.priceAdd, 0) ?? 0),
          notes: i.notes ?? null,
        })),
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

  return NextResponse.json(order, { status: 201 });
}
