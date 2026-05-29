import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sseNotify } from "@/lib/sse";
import { NextResponse } from "next/server";

/**
 * POST /api/admin/orders/[orderId]/fire-course
 * Body: { course: 2 }
 *
 * Fires all held items for the given course number:
 * - Sets heldUntilFired = false
 * - Sets firedAt = now()
 * - Sets itemStatus = "PENDING" (so they appear in KDS)
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId } = await params;
  const { course } = await req.json();

  if (!course || typeof course !== "number") {
    return NextResponse.json({ error: "course number required" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Access check
  if (session.user.role !== "SUPER_ADMIN") {
    const access = await prisma.restaurantUser.findUnique({
      where: { userId_restaurantId: { userId: session.user.id, restaurantId: order.restaurantId } },
    });
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const heldItems = order.items.filter(i => i.course === course && i.heldUntilFired);

  if (heldItems.length === 0) {
    return NextResponse.json({ fired: 0, message: "No held items for this course" });
  }

  // Fire all held items in this course
  await prisma.orderItem.updateMany({
    where: {
      orderId,
      course,
      heldUntilFired: true,
    },
    data: {
      heldUntilFired: false,
      firedAt: now,
      itemStatus: "PENDING",
    },
  });

  sseNotify(order.restaurantId);

  return NextResponse.json({
    fired: heldItems.length,
    course,
    firedAt: now,
    itemNames: heldItems.map(i => i.id),
  });
}
