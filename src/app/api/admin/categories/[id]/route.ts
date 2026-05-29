import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { isEditor } from "@/lib/permissions";
import { logAudit, getIp } from "@/lib/audit";

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

  // Ensure autoReady column exists (idempotent migration)
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "autoReady" BOOLEAN NOT NULL DEFAULT false`);
  } catch { /* ignore — column already exists */ }

  const body = await req.json();
  const category = await prisma.category.update({ where: { id }, data: body });
  await logAudit({ userId: session.user.id, userEmail: session.user.email, action: "UPDATE_CATEGORY", entity: "category", entityId: id, entityName: category.name, meta: { changed: Object.keys(body) }, ip: getIp(req) });
  return NextResponse.json(category);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isEditor(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  if (session.user.role !== "SUPER_ADMIN") {
    const allowed = await checkCategoryAccess(session.user.id, id);
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const catToDelete = await prisma.category.findUnique({ where: { id }, select: { name: true } });
  await prisma.category.delete({ where: { id } });
  await logAudit({ userId: session.user.id, userEmail: session.user.email, action: "DELETE_CATEGORY", entity: "category", entityId: id, entityName: catToDelete?.name, ip: getIp(req) });
  return NextResponse.json({ success: true });
}
