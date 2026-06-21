import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { isEditor } from "@/lib/permissions";
import { logAudit, getIp } from "@/lib/audit";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !isEditor(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { name, description, menuId, image, sortOrder, kitchenStationId } = await req.json();
  if (!name || !menuId) {
    return NextResponse.json({ error: "Name and menuId are required" }, { status: 400 });
  }

  const menu = await prisma.menu.findUnique({ where: { id: menuId }, select: { restaurantId: true } });
  if (!menu) return NextResponse.json({ error: "Menu not found" }, { status: 404 });

  if (session.user.role !== "SUPER_ADMIN") {
    const access = await prisma.restaurantUser.findUnique({
      where: { userId_restaurantId: { userId: session.user.id, restaurantId: menu.restaurantId } },
    });
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Resolve kitchen station: explicit, else default to the restaurant's MAIN station
  let stationId: string | null = typeof kitchenStationId === "string" && kitchenStationId ? kitchenStationId : null;
  if (!stationId) {
    const main = await prisma.kitchenStation.findFirst({
      where: { restaurantId: menu.restaurantId, code: "M" },
      select: { id: true },
    });
    stationId = main?.id ?? null;
  }
  const station = stationId
    ? await prisma.kitchenStation.findUnique({ where: { id: stationId }, select: { skipKitchen: true } })
    : null;

  const category = await prisma.category.create({
    data: {
      name, description: description || null, menuId, image: image || null, sortOrder: sortOrder ?? 0,
      kitchenStationId: stationId,
      autoReady: station?.skipKitchen ?? false,
    },
  });
  await logAudit({ userId: session.user.id, userEmail: session.user.email, action: "CREATE_CATEGORY", entity: "category", entityId: category.id, entityName: category.name, meta: { menuId }, ip: getIp(req) });
  return NextResponse.json(category, { status: 201 });
}
