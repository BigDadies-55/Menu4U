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

  try {
    const menus = await prisma.menu.findMany({
      where: { restaurantId, isActive: true },
      select: {
        categories: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            items: {
              where: { isActive: true },
              orderBy: { sortOrder: "asc" },
              select: {
                id: true, name: true, description: true, price: true,
                image: true, allergens: true, isVegetarian: true,
                isVegan: true, isGlutenFree: true,
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

    return NextResponse.json({ categories });
  } catch (e) {
    console.error("[waiter-pos/menu]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
