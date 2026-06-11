import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

async function ensureOrderItemColumns() {
  const cols: [string, string][] = [
    [`"isComped" BOOLEAN NOT NULL DEFAULT false`, "isComped"],
    [`"compReason" TEXT`, "compReason"],
    [`"voidedAt" TIMESTAMP(3)`, "voidedAt"],
    [`"voidReason" TEXT`, "voidReason"],
    [`"servedByUserId" TEXT`, "servedByUserId"],
    [`"itemStatus" TEXT NOT NULL DEFAULT 'PENDING'`, "itemStatus"],
    [`"course" INTEGER NOT NULL DEFAULT 1`, "course"],
    [`"heldUntilFired" BOOLEAN NOT NULL DEFAULT false`, "heldUntilFired"],
    [`"firedAt" TIMESTAMP(3)`, "firedAt"],
    [`"doneAt" TIMESTAMP(3)`, "doneAt"],
    [`"servedAt" TIMESTAMP(3)`, "servedAt"],
  ];
  for (const [col] of cols) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS ${col}`);
    } catch { /* ignore if column already exists */ }
  }

  // Ensure OrderItemModifier table exists
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "OrderItemModifier" (
        "id" TEXT NOT NULL,
        "orderItemId" TEXT NOT NULL,
        "groupName" TEXT NOT NULL,
        "label" TEXT NOT NULL,
        "priceAdd" DOUBLE PRECISION NOT NULL DEFAULT 0,
        CONSTRAINT "OrderItemModifier_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "OrderItemModifier_orderItemId_fkey" FOREIGN KEY ("orderItemId")
          REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
  } catch { /* already exists */ }

  // Ensure allergens columns
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "allergens" TEXT[] NOT NULL DEFAULT '{}'`);
  } catch { /* ignore */ }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "tableAllergens" TEXT[] NOT NULL DEFAULT '{}'`);
  } catch { /* ignore */ }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "coversCount" INTEGER`);
  } catch { /* ignore */ }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "notes" TEXT`);
  } catch { /* ignore */ }
}

export async function GET(_req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureOrderItemColumns();

  const { orderId } = await params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        orderBy: [{ course: "asc" }, { createdAt: "asc" }],
        include: {
          item: { select: { name: true, allergens: true } },
          modifiers: true,
        },
      },
    },
  });

  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (session.user.role !== "SUPER_ADMIN") {
    const access = await prisma.restaurantUser.findUnique({
      where: { userId_restaurantId: { userId: session.user.id, restaurantId: order.restaurantId } },
    });
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    id: order.id,
    orderNumber: order.orderNumber,
    totalAmount: order.totalAmount,
    status: order.status,
    tableAllergens: order.tableAllergens ?? [],
    coversCount: order.coversCount,
    notes: order.notes,
    items: order.items.map(oi => ({
      id: oi.id,
      itemId: oi.itemId,
      itemName: oi.item.name,
      itemAllergens: oi.item.allergens ?? [],
      quantity: oi.quantity,
      price: oi.price,
      notes: oi.notes,
      itemStatus: oi.itemStatus,
      course: oi.course,
      heldUntilFired: oi.heldUntilFired,
      firedAt: oi.firedAt,
      doneAt: oi.doneAt,
      servedAt: oi.servedAt,
      isComped: oi.isComped,
      voidedAt: oi.voidedAt,
      modifiers: oi.modifiers ?? [],
    })),
  });
}
