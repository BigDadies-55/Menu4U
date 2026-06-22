import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

async function checkAccess(userId: string, role: string, restaurantId: string): Promise<boolean> {
  if (role === "SUPER_ADMIN") return true;
  const access = await prisma.restaurantUser.findFirst({ where: { userId, restaurantId } });
  return !!access;
}

// GET /api/admin/waiter-pos/shift-stats?restaurantId=X
// Aggregates the current shift (today, from local midnight) for the venue:
// total revenue, total diners (covers), and average spend per diner.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  if (!(await checkAccess(session.user.id, session.user.role, restaurantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const orders = await prisma.order.findMany({
    where: { restaurantId, createdAt: { gte: since }, status: { not: "CANCELLED" } },
    select: { totalAmount: true, coversCount: true },
  });

  const revenue = orders.reduce((s, o) => s + (o.totalAmount ?? 0), 0);
  const diners  = orders.reduce((s, o) => s + (o.coversCount ?? 0), 0);
  const avgPerDiner = diners > 0 ? revenue / diners : 0;

  return NextResponse.json({ revenue, diners, avgPerDiner, orderCount: orders.length });
}
