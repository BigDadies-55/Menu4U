import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { isEditor } from "@/lib/permissions";

async function checkCategoryAccess(userId: string, categoryId: string) {
  const cat = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { menu: { select: { restaurantId: true } } },
  });
  if (!cat) return null;
  const access = await prisma.restaurantUser.findUnique({
    where: { userId_restaurantId: { userId, restaurantId: cat.menu.restaurantId } },
  });
  return access ? cat : null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isEditor(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  if (session.user.role !== "SUPER_ADMIN") {
    const allowed = await checkCategoryAccess(session.user.id, id);
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const category = await prisma.category.update({ where: { id }, data: body });
  return NextResponse.json(category);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isEditor(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  if (session.user.role !== "SUPER_ADMIN") {
    const allowed = await checkCategoryAccess(session.user.id, id);
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.category.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
