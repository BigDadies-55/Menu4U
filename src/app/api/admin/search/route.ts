import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json([]);

  const role   = session.user.role;
  const userId = session.user.id;

  // Resolve accessible restaurant IDs
  let allowedIds: string[] | null = null;
  if (role !== "SUPER_ADMIN") {
    const links = await prisma.restaurantUser.findMany({
      where: { userId },
      select: { restaurantId: true },
    });
    allowedIds = links.map(l => l.restaurantId);
  }

  const restaurantWhere = allowedIds
    ? { id: { in: allowedIds }, name: { contains: q, mode: "insensitive" as const } }
    : { name: { contains: q, mode: "insensitive" as const } };

  const [restaurants, menus, items, users] = await Promise.all([
    // Restaurants
    prisma.restaurant.findMany({
      where: restaurantWhere,
      select: { id: true, name: true },
      take: 4,
    }),

    // Menus
    prisma.menu.findMany({
      where: {
        name: { contains: q, mode: "insensitive" },
        ...(allowedIds ? { restaurantId: { in: allowedIds } } : {}),
      },
      select: { id: true, name: true, restaurant: { select: { id: true, name: true } } },
      take: 4,
    }),

    // Items
    prisma.item.findMany({
      where: {
        name: { contains: q, mode: "insensitive" },
        ...(allowedIds ? { category: { menu: { restaurantId: { in: allowedIds } } } } : {}),
      },
      select: {
        id: true, name: true,
        category: { select: { menu: { select: { restaurant: { select: { id: true, name: true } } } } } },
      },
      take: 5,
    }),

    // Users — only for admins
    ["SUPER_ADMIN", "ADMIN"].includes(role)
      ? prisma.user.findMany({
          where: {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
          select: { id: true, name: true, email: true },
          take: 3,
        })
      : Promise.resolve([]),
  ]);

  type Result = { type: string; id: string; label: string; sub: string; href: string };
  const results: Result[] = [
    ...restaurants.map(r => ({
      type: "restaurant", id: r.id, label: r.name, sub: "מסעדה", href: "/admin/restaurants",
    })),
    ...menus.map(m => ({
      type: "menu", id: m.id, label: m.name, sub: `תפריט · ${m.restaurant.name}`,
      href: `/admin/menus?restaurantId=${m.restaurant.id}`,
    })),
    ...items.map(i => ({
      type: "item", id: i.id, label: i.name,
      sub: `פריט · ${i.category.menu.restaurant.name}`,
      href: `/admin/menus?restaurantId=${i.category.menu.restaurant.id}`,
    })),
    ...(users as { id: string; name: string | null; email: string }[]).map(u => ({
      type: "user", id: u.id, label: u.name ?? u.email, sub: `משתמש · ${u.email}`,
      href: "/admin/users",
    })),
  ];

  return NextResponse.json(results.slice(0, 12));
}
