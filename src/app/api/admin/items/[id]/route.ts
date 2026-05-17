import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { isEditor } from "@/lib/permissions";
import { logAudit, getIp } from "@/lib/audit";

async function checkItemAccess(userId: string, itemId: string) {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { category: { select: { menu: { select: { restaurantId: true } } } } },
  });
  if (!item) return null;
  const access = await prisma.restaurantUser.findUnique({
    where: { userId_restaurantId: { userId, restaurantId: item.category.menu.restaurantId } },
  });
  return access ? item : null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isEditor(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  if (session.user.role !== "SUPER_ADMIN") {
    const allowed = await checkItemAccess(session.user.id, id);
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const item = await prisma.item.update({ where: { id }, data: body });
  await logAudit({ userId: session.user.id, userEmail: session.user.email, action: "UPDATE_ITEM", entity: "item", entityId: id, entityName: item.name, meta: { changed: Object.keys(body), ...(body.price !== undefined ? { oldPrice: null, newPrice: body.price } : {}) }, ip: getIp(req) });
  return NextResponse.json(item);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isEditor(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  if (session.user.role !== "SUPER_ADMIN") {
    const allowed = await checkItemAccess(session.user.id, id);
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const itemToDelete = await prisma.item.findUnique({ where: { id }, select: { name: true, price: true } });
  await prisma.item.delete({ where: { id } });
  await logAudit({ userId: session.user.id, userEmail: session.user.email, action: "DELETE_ITEM", entity: "item", entityId: id, entityName: itemToDelete?.name, meta: { price: itemToDelete?.price }, ip: getIp(req) });
  return NextResponse.json({ success: true });
}
