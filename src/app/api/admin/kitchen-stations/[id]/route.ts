import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { isOwner } from "@/lib/permissions";
import { logAudit, getIp } from "@/lib/audit";

async function loadStationWithAccess(userId: string, role: string, id: string) {
  const station = await prisma.kitchenStation.findUnique({ where: { id } });
  if (!station) return { station: null, allowed: false };
  if (role === "SUPER_ADMIN") return { station, allowed: true };
  const link = await prisma.restaurantUser.findUnique({
    where: { userId_restaurantId: { userId, restaurantId: station.restaurantId } },
  });
  return { station, allowed: !!link };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isOwner(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const { station, allowed } = await loadStationWithAccess(session.user.id, session.user.role, id);
  if (!station) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const data: { isActive?: boolean; label?: string; skipKitchen?: boolean; sortOrder?: number } = {};
  if (typeof body.isActive === "boolean")    data.isActive = body.isActive;
  if (typeof body.label === "string")        data.label = body.label.trim();
  if (typeof body.skipKitchen === "boolean") data.skipKitchen = body.skipKitchen;
  if (typeof body.sortOrder === "number")    data.sortOrder = body.sortOrder;

  const updated = await prisma.kitchenStation.update({ where: { id }, data });

  // If skipKitchen changed, keep assigned categories' autoReady in sync (the KDS/orders contract)
  if (typeof body.skipKitchen === "boolean") {
    await prisma.category.updateMany({
      where: { kitchenStationId: id },
      data: { autoReady: body.skipKitchen },
    });
  }

  await logAudit({ userId: session.user.id, userEmail: session.user.email, action: "UPDATE_KITCHEN_STATION", entity: "kitchenStation", entityId: id, entityName: updated.label, meta: { changed: Object.keys(data) }, ip: getIp(req) });
  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isOwner(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const { station, allowed } = await loadStationWithAccess(session.user.id, session.user.role, id);
  if (!station) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Block deletion while categories are still assigned to this station
  const assigned = await prisma.category.count({ where: { kitchenStationId: id } });
  if (assigned > 0) {
    return NextResponse.json(
      { error: "STATION_IN_USE", assigned, message: `יש להעביר ${assigned} קטגוריות לתחנה אחרת לפני מחיקה` },
      { status: 409 },
    );
  }

  await prisma.kitchenStation.delete({ where: { id } });
  await logAudit({ userId: session.user.id, userEmail: session.user.email, action: "DELETE_KITCHEN_STATION", entity: "kitchenStation", entityId: id, entityName: station.label, ip: getIp(req) });
  return NextResponse.json({ success: true });
}
