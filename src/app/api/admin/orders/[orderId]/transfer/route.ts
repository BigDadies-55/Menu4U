import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sseNotify } from "@/lib/sse";
import { logAudit, getIp } from "@/lib/audit";
import { NextResponse } from "next/server";

// POST — transfer order to another table
// Body: { toTable: string }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId } = await params;
  const { toTable } = await req.json();
  if (!toTable) return NextResponse.json({ error: "toTable required" }, { status: 400 });

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.json({ error: "הזמנה לא נמצאה" }, { status: 404 });

  if (session.user.role !== "SUPER_ADMIN") {
    const access = await prisma.restaurantUser.findUnique({
      where: { userId_restaurantId: { userId: session.user.id, restaurantId: order.restaurantId } },
    });
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const fromTable = order.tableNumber;
  await prisma.order.update({ where: { id: orderId }, data: { tableNumber: toTable } });

  await logAudit({
    userId: session.user.id, userEmail: session.user.email,
    action: "TRANSFER_TABLE", entity: "order", entityId: orderId,
    entityName: `הזמנה #${order.orderNumber} — שולחן ${fromTable} → ${toTable}`,
    ip: getIp(req),
  });

  sseNotify(order.restaurantId);
  return NextResponse.json({ ok: true });
}
