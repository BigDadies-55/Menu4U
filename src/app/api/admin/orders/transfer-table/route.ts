import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { sseNotify } from "@/lib/sse";

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { restaurantId, fromTable, toTable } = (await req.json()) as {
    restaurantId: string;
    fromTable: string;
    toTable: string;
  };

  if (!restaurantId || !fromTable || !toTable || fromTable === toTable) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  // Permission check for non-super-admin
  if (session.user.role !== "SUPER_ADMIN") {
    const access = await prisma.restaurantUser.findUnique({
      where: { userId_restaurantId: { userId: session.user.id, restaurantId } },
    });
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Update all active (non-paid, non-cancelled) orders for fromTable → toTable
  const result = await prisma.order.updateMany({
    where: {
      restaurantId,
      tableNumber: fromTable,
      status: { notIn: ["PAID", "CANCELLED"] },
    },
    data: { tableNumber: toTable },
  });

  sseNotify(restaurantId);

  return NextResponse.json({ updated: result.count, fromTable, toTable });
}
