import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { logAudit, getIp } from "@/lib/audit";

export async function POST(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId } = await params;
  const { items, tableAllergens } = await req.json();

  await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "tableAllergens" TEXT[] NOT NULL DEFAULT '{}'`);

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (session.user.role !== "SUPER_ADMIN") {
    const access = await prisma.restaurantUser.findUnique({
      where: { userId_restaurantId: { userId: session.user.id, restaurantId: order.restaurantId } },
    });
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const itemRows = Array.isArray(items) ? items : [];
  if (itemRows.length === 0 && tableAllergens === undefined)
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  let addedTotal = 0;
  let mapped: {
    itemId: string; quantity: number; price: number; notes: string | null;
    course: number; heldUntilFired: boolean; itemStatus: string;
  }[] = [];

  if (itemRows.length > 0) {
    const itemIds = itemRows.map((i: { itemId: string }) => i.itemId);
    const dbItems = await prisma.item.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, price: true, category: { select: { autoReady: true } } },
    });
    const itemMap = Object.fromEntries(dbItems.map(i => [i.id, i]));

    mapped = itemRows.map((i: { itemId: string; quantity?: number; course?: number; notes?: string }) => {
      const db = itemMap[i.itemId];
      const course = i.course ?? 1;
      return {
        itemId: i.itemId,
        quantity: i.quantity ?? 1,
        price: db?.price ?? 0,
        notes: i.notes ?? null,
        course,
        heldUntilFired: course > 1,
        itemStatus: db?.category?.autoReady ? "DONE" : "PENDING",
      };
    });

    addedTotal = mapped.reduce((s, i) => s + i.price * i.quantity, 0);
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      ...(addedTotal > 0 ? { totalAmount: { increment: addedTotal } } : {}),
      ...(Array.isArray(tableAllergens) ? { tableAllergens } : {}),
      ...(mapped.length > 0 ? { items: { create: mapped } } : {}),
    },
  });

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email,
    action: "ADD_ITEMS_TO_ORDER",
    entity: "order",
    entityId: orderId,
    meta: { addedCount: mapped.length, addedTotal },
    ip: getIp(req),
  });

  return NextResponse.json({ success: true, totalAmount: updatedOrder.totalAmount });
}
