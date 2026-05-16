import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PERIODS: Record<string, number> = {
  "7d":  7,
  "30d": 30,
  "1y":  365,
};

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? "7d";
  const days = PERIODS[period] ?? 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Determine accessible restaurant IDs
  let restaurantIds: string[];
  if (session.user.role === "SUPER_ADMIN") {
    const all = await prisma.restaurant.findMany({ select: { id: true } });
    restaurantIds = all.map(r => r.id);
  } else {
    const assigned = await prisma.restaurantUser.findMany({
      where: { userId: session.user.id },
      select: { restaurantId: true },
    });
    restaurantIds = assigned.map(r => r.restaurantId);
  }

  if (restaurantIds.length === 0) return NextResponse.json({});

  const [periodViews, allTimeViews] = await Promise.all([
    prisma.menuView.groupBy({
      by: ["restaurantId", "type", "refName"],
      where: { restaurantId: { in: restaurantIds }, createdAt: { gte: since } },
      _count: true,
    }),
    prisma.menuView.groupBy({
      by: ["restaurantId", "type", "refName"],
      where: { restaurantId: { in: restaurantIds } },
      _count: true,
    }),
  ]);

  const result: Record<string, {
    periodViews: number;
    totalViews: number;
    topCategories: { refName: string; count: number }[];
    topItems: { refName: string; count: number }[];
  }> = {};

  for (const id of restaurantIds) {
    const pv = periodViews.filter(v => v.restaurantId === id && v.type === "page");
    const av = allTimeViews.filter(v => v.restaurantId === id && v.type === "page");
    const cats = periodViews.filter(v => v.restaurantId === id && v.type === "category" && v.refName);
    const items = periodViews.filter(v => v.restaurantId === id && v.type === "item" && v.refName);

    result[id] = {
      periodViews: pv.reduce((s, v) => s + v._count, 0),
      totalViews: av.reduce((s, v) => s + v._count, 0),
      topCategories: cats.sort((a, b) => b._count - a._count).slice(0, 3)
        .map(v => ({ refName: v.refName!, count: v._count })),
      topItems: items.sort((a, b) => b._count - a._count).slice(0, 3)
        .map(v => ({ refName: v.refName!, count: v._count })),
    };
  }

  return NextResponse.json(result);
}
