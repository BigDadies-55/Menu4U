import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { isEditor } from "@/lib/permissions";

async function checkMenuAccess(userId: string, menuId: string) {
  const menu = await prisma.menu.findUnique({ where: { id: menuId }, select: { restaurantId: true } });
  if (!menu) return null;
  const access = await prisma.restaurantUser.findUnique({
    where: { userId_restaurantId: { userId, restaurantId: menu.restaurantId } },
  });
  return access ? menu : null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isEditor(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();

  let menu;
  if (session.user.role !== "SUPER_ADMIN") {
    const allowed = await checkMenuAccess(session.user.id, id);
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    menu = allowed;
  } else {
    menu = await prisma.menu.findUnique({ where: { id }, select: { restaurantId: true } });
    if (!menu) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // When setting as primary, unset all other primary menus for this restaurant first
  if (body.isPrimary === true) {
    await prisma.$transaction([
      prisma.menu.updateMany({
        where: { restaurantId: menu.restaurantId, id: { not: id } },
        data: { isPrimary: false },
      }),
      prisma.menu.update({ where: { id }, data: body }),
    ]);
  } else {
    await prisma.menu.update({ where: { id }, data: body });
  }

  const updated = await prisma.menu.findUnique({ where: { id } });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isEditor(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  if (session.user.role !== "SUPER_ADMIN") {
    const allowed = await checkMenuAccess(session.user.id, id);
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.menu.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
