import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isOwner } from "@/lib/permissions";
import { logAudit, getIp } from "@/lib/audit";
import { NextResponse } from "next/server";
import type { Role } from "@/generated/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role as Role;
  if (!isOwner(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId") ?? undefined;

  // Determine which restaurants this user can back up
  let allowedIds: string[];
  if (role === "SUPER_ADMIN") {
    if (restaurantId) {
      allowedIds = [restaurantId];
    } else {
      const all = await prisma.restaurant.findMany({ select: { id: true } });
      allowedIds = all.map(r => r.id);
    }
  } else {
    const links = await prisma.restaurantUser.findMany({
      where: { userId: session.user.id },
      select: { restaurantId: true },
    });
    allowedIds = links.map(l => l.restaurantId);
    if (restaurantId) {
      if (!allowedIds.includes(restaurantId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      allowedIds = [restaurantId];
    }
  }

  // ── Fetch everything ──────────────────────────────────────────────
  const [
    restaurants,
    restaurantUsers,
    users,
    menus,
    categories,
    items,
    modifierGroups,
    modifiers,
    orders,
    orderItems,
    orderItemModifiers,
    orderStatusLogs,
    customers,
    tableSessions,
    auditLogs,
    menuViews,
  ] = await Promise.all([
    prisma.restaurant.findMany({ where: { id: { in: allowedIds } } }),

    prisma.restaurantUser.findMany({ where: { restaurantId: { in: allowedIds } } }),

    // Users linked to these restaurants
    prisma.user.findMany({
      where: {
        restaurantUsers: { some: { restaurantId: { in: allowedIds } } },
      },
      select: {
        id: true, email: true, name: true, role: true,
        emailVerified: true, termsAccepted: true, createdAt: true,
        // Never include password hash in backup
      },
    }),

    prisma.menu.findMany({ where: { restaurantId: { in: allowedIds } } }),

    prisma.category.findMany({
      where: { menu: { restaurantId: { in: allowedIds } } },
    }),

    prisma.item.findMany({
      where: { category: { menu: { restaurantId: { in: allowedIds } } } },
    }),

    prisma.itemModifierGroup.findMany({
      where: { item: { category: { menu: { restaurantId: { in: allowedIds } } } } },
    }),

    prisma.itemModifier.findMany({
      where: { group: { item: { category: { menu: { restaurantId: { in: allowedIds } } } } } },
    }),

    prisma.order.findMany({ where: { restaurantId: { in: allowedIds } }, orderBy: { createdAt: "asc" } }),

    prisma.orderItem.findMany({
      where: { order: { restaurantId: { in: allowedIds } } },
    }),

    prisma.orderItemModifier.findMany({
      where: { orderItem: { order: { restaurantId: { in: allowedIds } } } },
    }),

    prisma.orderStatusLog.findMany({
      where: { order: { restaurantId: { in: allowedIds } } },
      orderBy: { changedAt: "asc" },
    }),

    prisma.customer.findMany({ where: { restaurantId: { in: allowedIds } } }),

    prisma.tableSession.findMany({
      where: { restaurantId: { in: allowedIds } },
      orderBy: { closedAt: "asc" },
    }),

    prisma.auditLog.findMany({
      where: {
        OR: [
          { meta: { path: ["restaurantId"], array_contains: allowedIds } },
          // Also include logs without restaurantId for SUPER_ADMIN
          ...(role === "SUPER_ADMIN" ? [{}] : []),
        ],
      },
      orderBy: { createdAt: "asc" },
      take: 50000,
    }).catch(() => [] as Awaited<ReturnType<typeof prisma.auditLog.findMany>>),

    prisma.menuView.findMany({ where: { restaurantId: { in: allowedIds } } }).catch(() => []),
  ]);

  const backup = {
    _meta: {
      version: 2,
      exportedAt: new Date().toISOString(),
      exportedBy: session.user.email,
      restaurantIds: allowedIds,
      counts: {
        restaurants: restaurants.length,
        users: users.length,
        menus: menus.length,
        categories: categories.length,
        items: items.length,
        modifierGroups: modifierGroups.length,
        modifiers: modifiers.length,
        orders: orders.length,
        orderItems: orderItems.length,
        customers: customers.length,
        auditLogs: auditLogs.length,
        tableSessions: tableSessions.length,
        menuViews: menuViews.length,
      },
    },
    restaurants,
    restaurantUsers,
    users,
    menus,
    categories,
    items,
    modifierGroups,
    modifiers,
    orders,
    orderItems,
    orderItemModifiers,
    orderStatusLogs,
    customers,
    tableSessions,
    auditLogs,
    menuViews,
  };

  const json = JSON.stringify(backup, null, 2);
  const filename = `menu4u-backup-${new Date().toISOString().slice(0, 10)}.json`;

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email,
    action: "EXPORT_BACKUP",
    entity: "backup",
    entityName: `גיבוי ידני · ${allowedIds.length} מסעדות`,
    meta: {
      restaurantIds: allowedIds,
      counts: backup._meta.counts,
      trigger: "manual",
    },
    ip: getIp(req),
  });

  return new Response(json, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
