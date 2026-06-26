import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/admin/waiter-pos/popular?restaurantId=xxx
// Returns top 8 most-ordered items in last 30 days
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  try {
    const rows = await prisma.orderItem.groupBy({
      by: ["itemId"],
      where: {
        order: { restaurantId, createdAt: { gte: since }, status: { not: "CANCELLED" } },
        voidedAt: null,
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 8,
    });

    if (rows.length === 0) return NextResponse.json({ items: [] });

    // Station rank/code → course classification (same model as the menu route).
    const stations = await prisma.kitchenStation.findMany({
      where: { restaurantId, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, code: true },
    });
    const stationRank = new Map(stations.map((s, i) => [s.id, i + 1]));
    const stationCode = new Map(stations.map(s => [s.id, s.code]));

    const itemIds = rows.map(r => r.itemId);
    const items = await prisma.item.findMany({
      where: { id: { in: itemIds }, isActive: true },
      select: { id: true, name: true, description: true, price: true, image: true, allergens: true, isVegetarian: true, isVegan: true, isGlutenFree: true, category: { select: { course: true, kitchenStationId: true } } },
    });

    // Sort by popularity order
    const sorted = itemIds
      .map(id => items.find(i => i.id === id))
      .filter(Boolean)
      .map(i => {
        const { category, ...rest } = i!;
        const sid = category?.kitchenStationId;
        const course = sid ? (stationRank.get(sid) ?? category?.course ?? 1) : (category?.course ?? 1);
        const courseCode = sid ? (stationCode.get(sid) ?? null) : null;
        return { ...rest, price: Number(i!.price), allergens: i!.allergens ?? [], course, courseCode };
      });

    return NextResponse.json({ items: sorted });
  } catch (e) {
    console.error("[popular]", e);
    return NextResponse.json({ items: [] });
  }
}
