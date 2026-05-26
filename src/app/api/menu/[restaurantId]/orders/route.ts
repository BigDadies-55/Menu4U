import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const { restaurantId } = await params;
  const { searchParams } = new URL(req.url);
  const tableNumber = searchParams.get("table");
  const phone = searchParams.get("phone");

  if (!tableNumber) {
    return NextResponse.json({ error: "Missing table" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orders = await (prisma.order.findMany as any)({
    where: {
      restaurantId,
      tableNumber,
      status: { notIn: ["CANCELLED"] },
      ...(phone ? { customerPhone: phone } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      orderNumber: true,
      totalAmount: true,
      createdAt: true,
      notes: true,
      customerName: true,
      customerPhone: true,
      items: {
        select: {
          id: true,
          quantity: true,
          price: true,
          notes: true,
          itemStatus: true,
          item: { select: { name: true } },
        },
      },
    },
  });

  return NextResponse.json(orders);
}
