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

  const orders = await prisma.order.findMany({
    where: {
      restaurantId,
      tableNumber,
      status: { notIn: ["DELIVERED", "CANCELLED", "PAID"] },
      ...(phone ? { customerPhone: phone } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
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
