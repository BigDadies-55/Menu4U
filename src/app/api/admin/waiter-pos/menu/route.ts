import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  if (session.user.role !== "SUPER_ADMIN") {
    const access = await prisma.restaurantUser.findUnique({
      where: { userId_restaurantId: { userId: session.user.id, restaurantId } },
    });
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Ensure allergens column exists (may be missing on older DBs)
  await prisma.$executeRawUnsafe(`ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "allergens" TEXT[] NOT NULL DEFAULT '{}'`);

  // Ensure columns exist (idempotent migration)
  await prisma.$executeRawUnsafe(`ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "course" INTEGER NOT NULL DEFAULT 1`);

  try {
    // Kitchen stations define the course classification: a category's station
    // (its rank by sortOrder) is the course, and the station code is the badge.
    const stations = await prisma.kitchenStation.findMany({
      where: { restaurantId, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, code: true },
    });
    const stationRank = new Map(stations.map((s, i) => [s.id, i + 1]));
    const stationCode = new Map(stations.map(s => [s.id, s.code]));

    const menus = await prisma.menu.findMany({
      where: { restaurantId, isActive: true },
      select: {
        categories: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            course: true,
            kitchenStationId: true,
            items: {
              where: { isActive: true },
              orderBy: { sortOrder: "asc" },
              select: {
                id: true, name: true, description: true, price: true,
                image: true, allergens: true, isVegetarian: true,
                isVegan: true, isGlutenFree: true,
                modifierGroups: {
                  orderBy: { order: "asc" },
                  select: {
                    id: true, name: true, required: true, maxSelect: true,
                    options: { orderBy: { order: "asc" }, select: { id: true, label: true, priceAdd: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    const seen = new Set<string>();
    const categories = menus
      .flatMap(m => m.categories)
      .filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });

    // Normalize: allergens → array, and derive course/courseCode from the
    // category's kitchen station (falling back to the legacy course field).
    const normalized = categories.map(c => {
      const rank = c.kitchenStationId ? (stationRank.get(c.kitchenStationId) ?? c.course ?? 1) : (c.course ?? 1);
      const code = c.kitchenStationId ? (stationCode.get(c.kitchenStationId) ?? null) : null;
      return {
        ...c,
        course: rank,
        courseCode: code,
        items: c.items.map(i => ({ ...i, allergens: i.allergens ?? [], price: Number(i.price ?? 0), course: rank, courseCode: code })),
      };
    });
    return NextResponse.json({ categories: normalized });
  } catch (e) {
    console.error("[waiter-pos/menu]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
