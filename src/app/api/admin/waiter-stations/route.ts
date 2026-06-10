import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/admin/waiter-stations?restaurantId=X
// Returns all stations for a restaurant (with user info)
// Also works for a specific user: ?restaurantId=X&userId=Y
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");
  const userId       = searchParams.get("userId") ?? undefined;

  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  if (session.user.role !== "SUPER_ADMIN") {
    const access = await prisma.restaurantUser.findFirst({
      where: { userId: session.user.id, restaurantId },
    });
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const stations = await prisma.waiterStation.findMany({
    where: { restaurantId, ...(userId ? { userId } : {}) },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(stations);
}

// POST /api/admin/waiter-stations
// Body: { restaurantId, userId, tableNumbers, label? }
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { restaurantId, userId, tableNumbers, label } = await req.json();
  if (!restaurantId || !userId) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  if (session.user.role !== "SUPER_ADMIN") {
    const access = await prisma.restaurantUser.findFirst({
      where: { userId: session.user.id, restaurantId },
    });
    if (!access || !["ADMIN", "OWNER", "SHIFT_MANAGER"].includes(access.role))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const station = await prisma.waiterStation.upsert({
    where: { restaurantId_userId: { restaurantId, userId } },
    update: { tableNumbers: tableNumbers ?? [], label: label ?? null, updatedAt: new Date() },
    create: { restaurantId, userId, tableNumbers: tableNumbers ?? [], label: label ?? null },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json(station);
}

// DELETE /api/admin/waiter-stations?restaurantId=X&userId=Y
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");
  const userId       = searchParams.get("userId");

  if (!restaurantId || !userId) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  if (session.user.role !== "SUPER_ADMIN") {
    const access = await prisma.restaurantUser.findFirst({
      where: { userId: session.user.id, restaurantId },
    });
    if (!access || !["ADMIN", "OWNER", "SHIFT_MANAGER"].includes(access.role))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.waiterStation.deleteMany({ where: { restaurantId, userId } });
  return NextResponse.json({ ok: true });
}
