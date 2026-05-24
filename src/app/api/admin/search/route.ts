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

  const restaurantFilter = allowedIds ? { restaurantId: { in: allowedIds } } : {};

  // Check if query looks like a table number or order ID fragment
  const isNumeric = /^\d+$/.test(q);

  const [restaurants, menus, items, orders, users] = await Promise.all([
    // Restaurants
    prisma.restaurant.findMany({
      where: {
        ...(allowedIds ? { id: { in: allowedIds } } : {}),
        name: { contains: q, mode: "insensitive" },
      },
      select: { id: true, name: true },
      take: 3,
    }),

    // Menus
    prisma.menu.findMany({
      where: {
        name: { contains: q, mode: "insensitive" },
        ...restaurantFilter,
      },
      select: { id: true, name: true, restaurant: { select: { id: true, name: true } } },
      take: 3,
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
      take: 4,
    }),

    // Orders — search by table number, customer name, or order ID prefix
    prisma.order.findMany({
      where: {
        ...restaurantFilter,
        OR: [
          ...(isNumeric ? [{ tableNumber: { contains: q } }] : []),
          { customerName: { contains: q, mode: "insensitive" as const } },
          { notes: { contains: q, mode: "insensitive" as const } },
          { id: { startsWith: q } },
        ],
      },
      select: {
        id: true,
        tableNumber: true,
        customerName: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        restaurant: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 4,
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

  const STATUS_HE: Record<string, string> = {
    PENDING: "ממתין", CONFIRMED: "אושר", PREPARING: "בהכנה",
    READY: "מוכן", DELIVERED: "הושלם", CANCELLED: "בוטל", PAID: "שולם",
  };

  type Result = { type: string; id: string; label: string; sub: string; href: string };
  const results: Result[] = [
    ...restaurants.map(r => ({
      type: "restaurant", id: r.id, label: r.name, sub: "מסעדה",
      href: "/admin/restaurants",
    })),
    ...menus.map(m => ({
      type: "menu", id: m.id, label: m.name,
      sub: `תפריט · ${m.restaurant.name}`,
      href: `/admin/menus?restaurantId=${m.restaurant.id}`,
    })),
    ...items.map(i => ({
      type: "item", id: i.id, label: i.name,
      sub: `פריט · ${i.category.menu.restaurant.name}`,
      href: `/admin/menus?restaurantId=${i.category.menu.restaurant.id}`,
    })),
    ...orders.map(o => ({
      type: "order", id: o.id,
      label: o.customerName
        ? `${o.customerName}${o.tableNumber ? ` · שולחן ${o.tableNumber}` : ""}`
        : o.tableNumber ? `שולחן ${o.tableNumber}` : `הזמנה`,
      sub: `הזמנה · ${STATUS_HE[o.status] ?? o.status} · ₪${o.totalAmount.toFixed(0)} · ${o.restaurant.name}`,
      href: "/admin/orders",
    })),
    ...(users as { id: string; name: string | null; email: string }[]).map(u => ({
      type: "user", id: u.id, label: u.name ?? u.email,
      sub: `משתמש · ${u.email}`,
      href: "/admin/users",
    })),
  ];

  return NextResponse.json(results.slice(0, 12));
}
