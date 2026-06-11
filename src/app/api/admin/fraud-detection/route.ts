import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");
  const days = Math.min(30, Math.max(1, parseInt(searchParams.get("days") ?? "7", 10)));

  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  if (session.user.role !== "SUPER_ADMIN") {
    const access = await prisma.restaurantUser.findUnique({
      where: { userId_restaurantId: { userId: session.user.id, restaurantId } },
    });
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const since = new Date(Date.now() - days * 86_400_000);

  // Fetch all orders with items (void/comp columns added via ensureColumns pattern)
  type ItemRow = {
    id: string;
    itemName: string;
    quantity: number;
    price: number;
    itemStatus: string;
    isComped: boolean;
    voidedAt: Date | null;
    voidReason: string | null;
    compReason: string | null;
    orderId: string;
    tableNumber: string | null;
    orderCreatedAt: Date;
    createdByUserId: string | null;
  };

  const rows = await prisma.$queryRawUnsafe<ItemRow[]>(
    `SELECT
       oi.id, i.name AS "itemName", oi.quantity, oi.price,
       oi."itemStatus",
       COALESCE(oi."isComped", false) AS "isComped",
       oi."voidedAt", oi."voidReason", oi."compReason",
       o.id AS "orderId", o."tableNumber", o."createdAt" AS "orderCreatedAt",
       o."createdByUserId"
     FROM "OrderItem" oi
     JOIN "Order" o ON o.id = oi."orderId"
     WHERE o."restaurantId" = $1
       AND o."createdAt" >= $2
       AND (oi."voidedAt" IS NOT NULL OR COALESCE(oi."isComped", false) = true)
     ORDER BY o."createdAt" DESC`,
    restaurantId, since
  );

  // Collect user IDs and fetch names
  const userIds = new Set(rows.map(r => r.createdByUserId).filter(Boolean) as string[]);
  const users = userIds.size > 0
    ? await prisma.user.findMany({
        where: { id: { in: [...userIds] } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const userMap = new Map(users.map(u => [u.id, u.name ?? u.email ?? u.id]));

  // Also fetch total orders/revenue per waiter for context
  type TotalRow = { createdByUserId: string | null; orderCount: bigint; totalRevenue: number };
  const totals = await prisma.$queryRawUnsafe<TotalRow[]>(
    `SELECT "createdByUserId", COUNT(*) AS "orderCount", COALESCE(SUM("totalAmount"),0) AS "totalRevenue"
     FROM "Order"
     WHERE "restaurantId" = $1 AND "createdAt" >= $2
       AND "status" NOT IN ('CANCELLED')
     GROUP BY "createdByUserId"`,
    restaurantId, since
  );

  // Build per-waiter stats
  type WaiterFraud = {
    id: string; name: string;
    totalOrders: number; totalRevenue: number;
    voidCount: number; voidAmount: number;
    compCount: number; compAmount: number;
    riskScore: number;
  };

  const statsMap = new Map<string, WaiterFraud>();
  const UNKNOWN = "__unknown__";

  function getWaiter(uid: string | null): WaiterFraud {
    const key = uid ?? UNKNOWN;
    if (!statsMap.has(key)) {
      statsMap.set(key, {
        id: key,
        name: uid ? (userMap.get(uid) ?? uid) : "לא ידוע",
        totalOrders: 0, totalRevenue: 0,
        voidCount: 0, voidAmount: 0,
        compCount: 0, compAmount: 0,
        riskScore: 0,
      });
    }
    return statsMap.get(key)!;
  }

  // Seed totals
  for (const t of totals) {
    const w = getWaiter(t.createdByUserId);
    w.totalOrders = Number(t.orderCount);
    w.totalRevenue = Number(t.totalRevenue);
  }

  // Build events + accumulate stats
  type FraudEvent = {
    type: "VOID" | "COMP";
    at: string;
    waiterId: string;
    waiterName: string;
    itemName: string;
    quantity: number;
    amount: number;
    reason: string | null;
    tableNumber: string | null;
    orderId: string;
  };

  const events: FraudEvent[] = [];

  for (const row of rows) {
    const w = getWaiter(row.createdByUserId);
    const amount = row.price * row.quantity;

    if (row.voidedAt) {
      w.voidCount++;
      w.voidAmount += amount;
      events.push({
        type: "VOID",
        at: row.voidedAt.toISOString(),
        waiterId: w.id,
        waiterName: w.name,
        itemName: row.itemName,
        quantity: row.quantity,
        amount,
        reason: row.voidReason,
        tableNumber: row.tableNumber,
        orderId: row.orderId,
      });
    } else if (row.isComped) {
      w.compCount++;
      w.compAmount += amount;
      events.push({
        type: "COMP",
        at: row.orderCreatedAt.toISOString(),
        waiterId: w.id,
        waiterName: w.name,
        itemName: row.itemName,
        quantity: row.quantity,
        amount,
        reason: row.compReason,
        tableNumber: row.tableNumber,
        orderId: row.orderId,
      });
    }
  }

  // Compute risk score: weighted sum of void rate + comp rate (as % of revenue)
  for (const w of statsMap.values()) {
    const base = Math.max(w.totalRevenue, 1);
    const voidRate = (w.voidAmount / base) * 100;
    const compRate = (w.compAmount / base) * 100;
    w.riskScore = Math.round((voidRate * 2.5 + compRate * 1) * 10) / 10;
  }

  // Sort waiter stats by risk score desc, exclude unknown with 0 activity
  const waiterStats = [...statsMap.values()]
    .filter(w => w.id !== UNKNOWN || w.voidCount + w.compCount > 0)
    .sort((a, b) => b.riskScore - a.riskScore);

  // Sort events newest first
  events.sort((a, b) => b.at.localeCompare(a.at));

  return NextResponse.json({ waiterStats, events });
}
