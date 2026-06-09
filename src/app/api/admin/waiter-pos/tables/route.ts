import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Ensure the tableStatusOverridesJson column exists
async function ensureColumn() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "tableStatusOverridesJson" TEXT DEFAULT '{}'`
  );
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

  // Fetch restaurant layout + overrides
  const restaurant = await prisma.$queryRawUnsafe<Array<{ tableLayoutJson: string | null; tableStatusOverridesJson: string | null }>>(
    `SELECT "tableLayoutJson", "tableStatusOverridesJson" FROM "Restaurant" WHERE id = $1`,
    restaurantId
  );

  if (!restaurant.length) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });

  const { tableLayoutJson, tableStatusOverridesJson } = restaurant[0];

  // Parse overrides
  let overrides: Record<string, string> = {};
  try { overrides = JSON.parse(tableStatusOverridesJson ?? "{}"); } catch { overrides = {}; }

  // Parse layout
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

  // Fetch active orders (not PAID, not CANCELLED)
  const activeOrders = await prisma.order.findMany({
    where: {
      restaurantId,
      status: { notIn: ["PAID", "CANCELLED"] },
    },
    select: {
      id: true,
      tableNumber: true,
      status: true,
      createdAt: true,
      coversCount: true,
      totalAmount: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const now = Date.now();

  const tables = layoutTables.map((t) => {
    const tableNum = String(t.num);
    const tableOrders = activeOrders.filter(o => (o.tableNumber ?? "") === tableNum);

    // Determine status
    let availStatus: "occupied" | "free" | "reserved" | "inactive" = "free";
    if (overrides[tableNum] === "inactive") {
      availStatus = "inactive";
    } else if (overrides[tableNum] === "reserved") {
      availStatus = "reserved";
    } else if (tableOrders.length > 0) {
      availStatus = "occupied";
    }

    const sittingStart = tableOrders.length > 0
      ? tableOrders.reduce((earliest, o) => o.createdAt < earliest ? o.createdAt : earliest, tableOrders[0].createdAt).toISOString()
      : null;

    const guests = tableOrders.length > 0
      ? Math.max(...tableOrders.map(o => o.coversCount ?? 0), 0)
      : 0;

    const latestOrder = tableOrders.length > 0
      ? tableOrders[tableOrders.length - 1]
      : null;

    const minutesSitting = sittingStart
      ? Math.floor((now - new Date(sittingStart).getTime()) / 60000)
      : 0;

    const totalAmount = tableOrders.reduce((s, o) => s + (o.totalAmount ?? 0), 0);

    return {
      tableNum,
      seats: t.seats,
      availStatus,
      sittingStart,
      guests,
      orderStatus: latestOrder?.status ?? null,
      minutesSitting,
      activeOrderIds: tableOrders.map(o => o.id),
      totalAmount,
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
