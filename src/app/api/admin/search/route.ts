import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/* ─── Static pages ───────────────────────────────────────────── */
const PAGES = [
  { label: "דשבורד",              sub: "דף",  href: "/admin",                  keywords: ["דשבורד","בית","home","dashboard"] },
  { label: "מסעדות",              sub: "דף",  href: "/admin/restaurants",      keywords: ["מסעדות","מסעדה","restaurant"] },
  { label: "תפריטים",             sub: "דף",  href: "/admin/menus",            keywords: ["תפריטים","תפריט","menu"] },
  { label: "משתמשים",             sub: "דף",  href: "/admin/users",            keywords: ["משתמשים","משתמש","user"] },
  { label: "לוגים",               sub: "דף",  href: "/admin/logs",             keywords: ["לוגים","לוג","log","audit"] },
  { label: "הזמנות",              sub: "דף",  href: "/admin/orders",           keywords: ["הזמנות","הזמנה","order"] },
  { label: "סטטיסטיקות הזמנות",  sub: "דף",  href: "/admin/orders/stats",     keywords: ["סטטיסטיקות","stats","ביצועים"] },
  { label: "פריסת שולחנות",       sub: "דף",  href: "/admin/layout-builder",   keywords: ["שולחנות","פריסה","layout","שולחן"] },
  { label: "KDS — Station Dark",  sub: "דף",  href: "/admin/kitchen",          keywords: ["kds","מטבח","kitchen","station"] },
  { label: "KDS — Kanban",        sub: "דף",  href: "/admin/kitchen-kanban",   keywords: ["kanban","kds","מטבח"] },
  { label: "KDS — Ticket Board",  sub: "דף",  href: "/admin/kitchen-tickets",  keywords: ["ticket","kds","מטבח"] },
  { label: "KDS — תצוגת שולחן",  sub: "דף",  href: "/admin/kitchen-table",    keywords: ["kds","שולחן","תצוגה","table"] },
];

function matchPages(q: string) {
  const lq = q.toLowerCase();
  return PAGES.filter(p =>
    p.label.includes(q) ||
    p.keywords.some(k => k.includes(lq))
  ).slice(0, 3);
}

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
  const isNumeric = /^\d+$/.test(q);

  const STATUS_HE: Record<string, string> = {
    PENDING: "ממתין", CONFIRMED: "אושר", PREPARING: "בהכנה",
    READY: "מוכן", DELIVERED: "הושלם", CANCELLED: "בוטל", PAID: "שולם",
  };

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
      where: { name: { contains: q, mode: "insensitive" }, ...restaurantFilter },
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

    // Orders — broad search: table number, customer name, ID, or recent if query matches status keywords
    prisma.order.findMany({
      where: {
        ...restaurantFilter,
        OR: [
          ...(isNumeric ? [{ tableNumber: q }, { tableNumber: { contains: q } }] : []),
          { customerName: { contains: q, mode: "insensitive" as const } },
          { notes: { contains: q, mode: "insensitive" as const } },
          { id: { contains: q } },
          // also match against item names in the order
          { items: { some: { item: { name: { contains: q, mode: "insensitive" as const } } } } },
        ],
      },
      select: {
        id: true, tableNumber: true, customerName: true,
        status: true, totalAmount: true, createdAt: true,
        restaurant: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),

    // Users — admins only
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

  const pages = matchPages(q);

  const results: Result[] = [
    // Pages first
    ...pages.map(p => ({
      type: "page", id: p.href, label: p.label, sub: "עמוד", href: p.href,
    })),
    // DB content
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
    ...orders.map(o => {
      const table   = o.tableNumber ? `שולחן ${o.tableNumber}` : null;
      const name    = o.customerName ?? null;
      const label   = [name, table].filter(Boolean).join(" · ") || "הזמנה";
      const dateStr = new Date(o.createdAt).toLocaleDateString("he-IL");
      return {
        type: "order", id: o.id, label,
        sub: `הזמנה · ${STATUS_HE[o.status] ?? o.status} · ₪${o.totalAmount.toFixed(0)} · ${dateStr} · ${o.restaurant.name}`,
        href: "/admin/orders",
      };
    }),
    ...(users as { id: string; name: string | null; email: string }[]).map(u => ({
      type: "user", id: u.id, label: u.name ?? u.email,
      sub: `משתמש · ${u.email}`,
      href: "/admin/users",
    })),
  ];

  return NextResponse.json(results.slice(0, 14));
}
