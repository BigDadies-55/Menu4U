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

  // Ensure columns exist (idempotent migration)
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "autoReady" BOOLEAN NOT NULL DEFAULT false`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "kitchenStationId" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "course" INTEGER NOT NULL DEFAULT 1`);
  } catch { /* ignore — column already exists */ }

  const body = await req.json();

  // Assigning a kitchen station derives autoReady from the station's skipKitchen flag
  if (typeof body.kitchenStationId === "string" && body.kitchenStationId) {
    const station = await prisma.kitchenStation.findUnique({
      where: { id: body.kitchenStationId },
      select: { skipKitchen: true },
    });
    if (station) body.autoReady = station.skipKitchen;
  }

  try {
    const category = await prisma.category.update({ where: { id }, data: body });
    await logAudit({ userId: session.user.id, userEmail: session.user.email, action: "UPDATE_CATEGORY", entity: "category", entityId: id, entityName: category.name, meta: { changed: Object.keys(body) }, ip: getIp(req) });
    return NextResponse.json(category);
  } catch (err) {
    console.error("[categories PATCH]", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
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
