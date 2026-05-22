import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");
  const activeOnly = searchParams.get("activeOnly") === "1";

  const role = session.user.role;
  const userId = session.user.id;

  // Build restaurant filter
  let restaurantFilter: { in: string[] } | undefined;
  if (role !== "SUPER_ADMIN") {
    const userRestaurants = await prisma.restaurantUser.findMany({
      where: { userId },
      select: { restaurantId: true },
    });
    const ids = userRestaurants.map(r => r.restaurantId);
    if (restaurantId && !ids.includes(restaurantId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    restaurantFilter = { in: restaurantId ? [restaurantId] : ids };
  } else if (restaurantId) {
    restaurantFilter = { in: [restaurantId] };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const statusFilter: any = activeOnly
    ? { notIn: ["DELIVERED", "CANCELLED"] }
    : undefined;

  const orders = await prisma.order.findMany({
    where: {
      ...(restaurantFilter ? { restaurantId: restaurantFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      restaurant: { select: { id: true, name: true } },
      items: {
        include: { item: { select: { name: true, prepTime: true } } },
        orderBy: { id: "asc" },
      },
    },
  });

  return NextResponse.json(orders);
}
