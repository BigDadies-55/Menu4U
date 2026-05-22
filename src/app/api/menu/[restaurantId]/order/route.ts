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

  // Only include items that exist
  const validItems = items.filter((i: { itemId: string }) => priceMap[i.itemId]);
  if (validItems.length === 0) {
    return NextResponse.json({ error: "No valid items" }, { status: 400 });
  }

  const totalAmount = validItems.reduce(
    (sum: number, i: { itemId: string; quantity: number }) => sum + priceMap[i.itemId] * i.quantity,
    0
  );

  const order = await prisma.order.create({
    data: {
      restaurantId,
      tableNumber: tableNumber ?? null,
      customerName: customerName ?? null,
      customerPhone: customerPhone ?? null,
      notes: notes ?? null,
      totalAmount,
      items: {
        create: validItems.map((i: { itemId: string; quantity: number; notes?: string }) => ({
          itemId: i.itemId,
          quantity: i.quantity,
          price: priceMap[i.itemId],
          notes: i.notes ?? null,
        })),
      },
    },
    include: { items: true },
  });

  return NextResponse.json(order, { status: 201 });
}
