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
