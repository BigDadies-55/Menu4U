import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

async function ensureColumn() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "tableStatusOverridesJson" TEXT DEFAULT '{}'`
  );
  await prisma.$executeRawUnsafe(`ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "isComped" BOOLEAN NOT NULL DEFAULT false`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMP(3)`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "voidReason" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "compReason" TEXT`);
}

async function checkAccess(userId: string, role: string, restaurantId: string): Promise<boolean> {
  if (role === "SUPER_ADMIN") return true;
  const access = await prisma.restaurantUser.findFirst({ where: { userId, restaurantId } });
  return !!access;
}

// GET /api/admin/waiter-pos/tables?restaurantId=X
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  if (!(await checkAccess(session.user.id, session.user.role, restaurantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ensureColumn();

  const restaurant = await prisma.$queryRawUnsafe<Array<{ tableLayoutJson: string | null; tableStatusOverridesJson: string | null }>>(
    `SELECT "tableLayoutJson", "tableStatusOverridesJson" FROM "Restaurant" WHERE id = $1`,
    restaurantId
  );

  if (!restaurant.length) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });

  const { tableLayoutJson, tableStatusOverridesJson } = restaurant[0];

  let overrides: Record<string, string> = {};
  try { overrides = JSON.parse(tableStatusOverridesJson ?? "{}"); } catch { overrides = {}; }

  let layoutTables: Array<{ num: number | string; seats: number }> = [];
  if (tableLayoutJson) {
    try {
      const parsed = typeof tableLayoutJson === "string" ? JSON.parse(tableLayoutJson) : tableLayoutJson;
      const rooms = parsed?.rooms ?? (Array.isArray(parsed) ? parsed : null);
      if (rooms && Array.isArray(rooms)) {
        for (const room of rooms) {
          for (const t of (room.tables ?? [])) {
            layoutTables.push({ num: t.num ?? t.id, seats: t.seats ?? 4 });
          }
        }
      }
    } catch { layoutTables = []; }
  }

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  // Fetch active orders + recently cancelled/paid (last 2h) for richer insight data
  const allOrders = await prisma.order.findMany({
    where: {
      restaurantId,
      OR: [
        { status: { notIn: ["PAID", "CANCELLED"] } },
        { status: { in: ["PAID", "CANCELLED"] }, updatedAt: { gte: twoHoursAgo } },
      ],
    },
    select: {
      id: true,
      tableNumber: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      coversCount: true,
      totalAmount: true,
      items: { select: { itemStatus: true, voidedAt: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const now = Date.now();

  const tables = layoutTables.map((t) => {
    const tableNum = String(t.num);
    const tableOrders    = allOrders.filter(o => (o.tableNumber ?? "") === tableNum);
    const activeOrders   = tableOrders.filter(o => o.status !== "PAID" && o.status !== "CANCELLED");
    const closedOrders   = tableOrders.filter(o => o.status === "PAID" || o.status === "CANCELLED");

    // availStatus driven by active (non-paid, non-cancelled) orders + manual overrides
    let availStatus: "occupied" | "free" | "reserved" | "inactive" = "free";
    if (overrides[tableNum] === "inactive") {
      availStatus = "inactive";
    } else if (overrides[tableNum] === "reserved") {
      availStatus = "reserved";
    } else if (activeOrders.length > 0) {
      availStatus = "occupied";
    }

    const sittingStart = activeOrders.length > 0
      ? activeOrders.reduce((e, o) => o.createdAt < e ? o.createdAt : e, activeOrders[0].createdAt).toISOString()
      : null;

    const guests = activeOrders.length > 0
      ? Math.max(...activeOrders.map(o => o.coversCount ?? 0), 0)
      : 0;

    const latestActive = activeOrders.length > 0 ? activeOrders[activeOrders.length - 1] : null;

    const minutesSitting = sittingStart
      ? Math.floor((now - new Date(sittingStart).getTime()) / 60000)
      : 0;

    // orderStatus: latest active status; fallback to latest closed status for insight rules
    const latestClosed = closedOrders.length > 0
      ? closedOrders.reduce((a, b) => b.updatedAt > a.updatedAt ? b : a, closedOrders[0])
      : null;
    const orderStatus = latestActive?.status ?? latestClosed?.status ?? null;

    const totalAmount = activeOrders.reduce((s, o) => s + (o.totalAmount ?? 0), 0);
    const orderCount  = tableOrders.length;

    // minutesSinceLastOrder: time since the most recently updated order (any status)
    const latestAny = tableOrders.length > 0
      ? tableOrders.reduce((a, b) => b.updatedAt > a.updatedAt ? b : a, tableOrders[0])
      : null;
    const minutesSinceLastOrder = latestAny
      ? Math.floor((now - new Date(latestAny.updatedAt).getTime()) / 60000)
      : 0;

    return {
      tableNum,
      seats: t.seats,
      availStatus,
      sittingStart,
      guests,
      orderStatus,
      minutesSitting,
      activeOrderIds: activeOrders.map(o => o.id),
      totalAmount,
      orderCount,
      minutesSinceLastOrder,
      readyItemCount: activeOrders.reduce((sum, o) =>
        sum + o.items.filter(i => i.itemStatus === "DONE" && !i.voidedAt).length, 0),
    };
  });

  return NextResponse.json(tables);
}

// PATCH /api/admin/waiter-pos/tables — update overrides
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { restaurantId, tableNum, status } = body as { restaurantId: string; tableNum: string; status: string };

  if (!restaurantId || !tableNum || !status) {
    return NextResponse.json({ error: "restaurantId, tableNum and status required" }, { status: 400 });
  }
  if (!["reserved", "inactive", "free"].includes(status)) {
    return NextResponse.json({ error: "status must be reserved|inactive|free" }, { status: 400 });
  }

  if (!(await checkAccess(session.user.id, session.user.role, restaurantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ensureColumn();

  const rows = await prisma.$queryRawUnsafe<Array<{ tableStatusOverridesJson: string | null }>>(
    `SELECT "tableStatusOverridesJson" FROM "Restaurant" WHERE id = $1`,
    restaurantId
  );

  let overrides: Record<string, string> = {};
  try { overrides = JSON.parse(rows[0]?.tableStatusOverridesJson ?? "{}"); } catch { overrides = {}; }

  if (status === "free") {
    delete overrides[tableNum];
  } else {
    overrides[tableNum] = status;
  }

  await prisma.$executeRawUnsafe(
    `UPDATE "Restaurant" SET "tableStatusOverridesJson" = $1 WHERE id = $2`,
    JSON.stringify(overrides),
    restaurantId
  );

  return NextResponse.json({ ok: true, overrides });
}
