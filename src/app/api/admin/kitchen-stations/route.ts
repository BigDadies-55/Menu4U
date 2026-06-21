import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { isOwner } from "@/lib/permissions";
import { logAudit, getIp } from "@/lib/audit";
import { ensureStationsForRestaurant } from "@/lib/kitchen-stations";

async function hasRestaurantAccess(userId: string, role: string, restaurantId: string) {
  if (role === "SUPER_ADMIN") return true;
  const link = await prisma.restaurantUser.findUnique({
    where: { userId_restaurantId: { userId, restaurantId } },
  });
  return !!link;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || !isOwner(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const restaurantId = new URL(req.url).searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  if (!(await hasRestaurantAccess(session.user.id, session.user.role, restaurantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ensureStationsForRestaurant(restaurantId);
  const stations = await prisma.kitchenStation.findMany({
    where: { restaurantId },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ stations });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !isOwner(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { restaurantId, code, label, skipKitchen } = await req.json();
  if (!restaurantId || !code || !label) {
    return NextResponse.json({ error: "restaurantId, code and label are required" }, { status: 400 });
  }
  if (!(await hasRestaurantAccess(session.user.id, session.user.role, restaurantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ensureStationsForRestaurant(restaurantId);

  const normalizedCode = String(code).trim().toUpperCase();
  const dup = await prisma.kitchenStation.findFirst({ where: { restaurantId, code: normalizedCode } });
  if (dup) return NextResponse.json({ error: "קוד תחנה כבר קיים" }, { status: 409 });

  const max = await prisma.kitchenStation.aggregate({ where: { restaurantId }, _max: { sortOrder: true } });
  const station = await prisma.kitchenStation.create({
    data: {
      restaurantId,
      code: normalizedCode,
      label: String(label).trim(),
      skipKitchen: !!skipKitchen,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
  });
  await logAudit({ userId: session.user.id, userEmail: session.user.email, action: "CREATE_KITCHEN_STATION", entity: "kitchenStation", entityId: station.id, entityName: station.label, meta: { restaurantId }, ip: getIp(req) });
  return NextResponse.json(station, { status: 201 });
}
