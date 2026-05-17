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
  const { name, description, restaurantId } = await req.json();
  if (!name || !restaurantId) {
    return NextResponse.json({ error: "Name and restaurantId are required" }, { status: 400 });
  }

  if (session.user.role !== "SUPER_ADMIN") {
    const access = await prisma.restaurantUser.findUnique({
      where: { userId_restaurantId: { userId: session.user.id, restaurantId } },
    });
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const menu = await prisma.menu.create({ data: { name, description: description || null, restaurantId } });
  await logAudit({ userId: session.user.id, userEmail: session.user.email, action: "CREATE_MENU", entity: "menu", entityId: menu.id, entityName: menu.name, meta: { restaurantId }, ip: getIp(req) });
  return NextResponse.json(menu, { status: 201 });
}
