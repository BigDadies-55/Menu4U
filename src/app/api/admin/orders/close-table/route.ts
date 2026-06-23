import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { finalizeTablePayment, tableWhere } from "@/lib/closeTable";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { restaurantId, tipAmount = 0, payMethod = "card" } = body;
  // tableNumber may be null (orders placed without a table number)
  const tableNumber: string | null = body.tableNumber !== undefined ? (body.tableNumber || null) : null;

  if (!restaurantId) {
    return NextResponse.json({ error: "Missing restaurantId" }, { status: 400 });
  }

  // Auth: non-superadmin must belong to this restaurant
  const role = session.user.role;
  if (role !== "SUPER_ADMIN") {
    const link = await prisma.restaurantUser.findFirst({
      where: { userId: session.user.id, restaurantId },
    });
    if (!link) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const openOrders = await prisma.order.findMany({
    where: {
      restaurantId,
      ...tableWhere(tableNumber),
      status: { notIn: ["CANCELLED", "PAID"] },
    },
    select: {
      id: true, status: true, totalAmount: true, createdAt: true,
      customerPhone: true, loyaltyMemberId: true, loyaltyMemberName: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (openOrders.length === 0) {
    return NextResponse.json({ closed: 0, totalAmount: 0 });
  }

  const result = await finalizeTablePayment({
    userId: session.user.id,
    userEmail: session.user.email,
    restaurantId,
    tableNumber,
    openOrders,
    tipAmount,
    payMethod,
    req,
  });

  return NextResponse.json(result);
}
