import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { logAudit, getIp } from "@/lib/audit";

const VALID_STATUSES = ["PENDING","CONFIRMED","PREPARING","READY","DELIVERED","CANCELLED"];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId } = await params;
  const { status } = await req.json();

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { restaurantId: true },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Check access
  if (session.user.role !== "SUPER_ADMIN") {
    const access = await prisma.restaurantUser.findUnique({
      where: { userId_restaurantId: { userId: session.user.id, restaurantId: order.restaurantId } },
    });
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { status },
  });

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email,
    action: "UPDATE_ORDER_STATUS",
    entity: "order",
    entityId: orderId,
    entityName: `Order ${orderId.slice(-6)} → ${status}`,
    ip: getIp(req),
  });

  return NextResponse.json(updated);
}
