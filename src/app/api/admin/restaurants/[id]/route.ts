import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { logAudit, getIp } from "@/lib/audit";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  const {
    name, email, phone, phone2, orderPhone, address, locationUrl,
    isActive, ordersEnabled, menuTheme, menuPalette, menuPaletteData,
    kdsView, tableLayoutJson, groupId,
    subscriptionFrom, subscriptionTo,
  } = body;
  const data = Object.fromEntries(
    Object.entries({ name, email, phone, phone2, orderPhone, address, locationUrl,
      isActive, ordersEnabled, menuTheme, menuPalette, menuPaletteData,
      kdsView, tableLayoutJson, groupId, subscriptionFrom, subscriptionTo })
    .filter(([, v]) => v !== undefined)
  );
  const restaurant = await prisma.restaurant.update({ where: { id }, data });
  await logAudit({ userId: session.user.id, userEmail: session.user.email, action: "UPDATE_RESTAURANT", entity: "restaurant", entityId: id, entityName: restaurant.name, meta: { changed: Object.keys(body) }, ip: getIp(req) });
  return NextResponse.json(restaurant);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const restaurant = await prisma.restaurant.findUnique({ where: { id }, select: { name: true } });
  await prisma.restaurant.delete({ where: { id } });
  await logAudit({ userId: session.user.id, userEmail: session.user.email, action: "DELETE_RESTAURANT", entity: "restaurant", entityId: id, entityName: restaurant?.name, ip: getIp(req) });
  return NextResponse.json({ success: true });
}
