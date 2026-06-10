import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { isShiftManager } from "@/lib/permissions";
import { logAudit, getIp } from "@/lib/audit";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || !isShiftManager(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  if (session.user.role !== "SUPER_ADMIN") {
    const access = await prisma.restaurantUser.findUnique({
      where: { userId_restaurantId: { userId: session.user.id, restaurantId } },
    });
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const menus = await prisma.menu.findMany({
    where: { restaurantId, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      categories: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          items: {
            orderBy: { sortOrder: "asc" },
            select: { id: true, name: true, price: true, isActive: true, image: true },
          },
        },
      },
    },
  });

  const categories = menus.flatMap(m =>
    m.categories.map(c => ({ ...c, menuName: m.name }))
  );
  return NextResponse.json({ categories });
}

/* ── PATCH: 86 toggle (set item availability) ── */
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user || !isShiftManager(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { itemId, isActive } = (await req.json()) as { itemId: string; isActive: boolean };
  if (!itemId || typeof isActive !== "boolean") {
    return NextResponse.json({ error: "itemId and isActive required" }, { status: 400 });
  }

  // Resolve item's restaurant for access check
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { name: true, category: { select: { menu: { select: { restaurantId: true } } } } },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const restaurantId = item.category.menu.restaurantId;

  if (session.user.role !== "SUPER_ADMIN") {
    const access = await prisma.restaurantUser.findUnique({
      where: { userId_restaurantId: { userId: session.user.id, restaurantId } },
    });
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.item.update({ where: { id: itemId }, data: { isActive } });

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email,
    action: isActive ? "ITEM_86_RESTORE" : "ITEM_86_MARK",
    entity: "item",
    entityId: itemId,
    entityName: item.name,
    meta: { restaurantId, isActive },
    ip: getIp(req),
  });

  return NextResponse.json({ id: updated.id, isActive: updated.isActive });
}
