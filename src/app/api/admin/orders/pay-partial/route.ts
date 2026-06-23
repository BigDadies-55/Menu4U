import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { logAudit, getIp } from "@/lib/audit";
import { finalizeTablePayment, tableWhere, type CloseableOrder } from "@/lib/closeTable";

const round2 = (n: number) => Math.round(n * 100) / 100;

async function ensureAccess(restaurantId: string, userId: string, role: string) {
  if (role === "SUPER_ADMIN") return true;
  const link = await prisma.restaurantUser.findFirst({ where: { userId, restaurantId } });
  return !!link;
}

function openOrdersFor(restaurantId: string, tableNumber: string | null) {
  return prisma.order.findMany({
    where: { restaurantId, ...tableWhere(tableNumber), status: { notIn: ["CANCELLED", "PAID"] } },
    select: {
      id: true, status: true, totalAmount: true, createdAt: true,
      customerPhone: true, loyaltyMemberId: true, loyaltyMemberName: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

// GET /api/admin/orders/pay-partial?restaurantId=..&tableNumber=..
// Returns the partial payments already recorded against this table's open orders.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId") ?? "";
  const tableNumber = url.searchParams.get("tableNumber");
  if (!restaurantId) return NextResponse.json({ error: "Missing restaurantId" }, { status: 400 });
  if (!(await ensureAccess(restaurantId, session.user.id!, session.user.role)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const openOrders = await openOrdersFor(restaurantId, tableNumber || null);
  const openIds = openOrders.map(o => o.id);
  const payments = openIds.length
    ? await prisma.payment.findMany({
        where: { restaurantId, orderIds: { hasSome: openIds } },
        orderBy: { createdAt: "asc" },
        select: { id: true, amount: true, method: true, createdByName: true, createdAt: true },
      })
    : [];

  const paid = round2(payments.reduce((s, p) => s + p.amount, 0));
  const itemsTotal = round2(openOrders.reduce((s, o) => s + o.totalAmount, 0));
  return NextResponse.json({ payments, paid, itemsTotal });
}

// POST /api/admin/orders/pay-partial
// Body: { restaurantId, tableNumber, amount, method, tipAmount }
// Records one partial payment. When cumulative paid >= itemsTotal + tip, finalizes the table.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { restaurantId, amount, method = "cash", tipAmount = 0 } = body as {
    restaurantId: string; amount: number; method?: string; tipAmount?: number;
  };
  const tableNumber: string | null = body.tableNumber !== undefined ? (body.tableNumber || null) : null;

  if (!restaurantId) return NextResponse.json({ error: "Missing restaurantId" }, { status: 400 });
  const payAmount = round2(Number(amount));
  if (!(payAmount > 0)) return NextResponse.json({ error: "סכום תשלום לא תקין" }, { status: 400 });
  if (!(await ensureAccess(restaurantId, session.user.id!, session.user.role)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const openOrders = await openOrdersFor(restaurantId, tableNumber || null);
  if (openOrders.length === 0) return NextResponse.json({ error: "אין הזמנות פתוחות לשולחן" }, { status: 400 });

  const openIds = openOrders.map(o => o.id);
  const itemsTotal = round2(openOrders.reduce((s, o) => s + o.totalAmount, 0));
  const payable = round2(itemsTotal + Number(tipAmount));

  const prior = await prisma.payment.findMany({
    where: { restaurantId, orderIds: { hasSome: openIds } },
    select: { amount: true },
  });
  const paidBefore = round2(prior.reduce((s, p) => s + p.amount, 0));

  await prisma.payment.create({
    data: {
      restaurantId,
      tableNumber,
      amount: payAmount,
      method,
      orderIds: openIds,
      createdByUserId: session.user.id,
      createdByName: session.user.name ?? session.user.email ?? null,
    },
  });

  const paid = round2(paidBefore + payAmount);
  const balance = round2(Math.max(0, payable - paid));

  await logAudit({
    userId: session.user.id, userEmail: session.user.email,
    action: "PARTIAL_PAYMENT", entity: "order", entityId: restaurantId,
    entityName: `שולחן ${tableNumber ?? "ללא שולחן"} · תשלום ₪${payAmount.toFixed(2)} (${method}) · שולם ₪${paid.toFixed(2)}/₪${payable.toFixed(2)}`,
    meta: { restaurantId, tableNumber, amount: payAmount, method, paid, payable, balance },
    ip: getIp(req),
  });

  // Fully covered → finalize the table (mark PAID + side effects).
  if (paid + 0.01 >= payable) {
    const result = await finalizeTablePayment({
      userId: session.user.id,
      userEmail: session.user.email,
      restaurantId,
      tableNumber,
      openOrders: openOrders as CloseableOrder[],
      tipAmount: Number(tipAmount),
      payMethod: method,
      req,
    });
    return NextResponse.json({ ok: true, paid, payable, balance: 0, totalAmount: result.totalAmount, closed: true });
  }

  return NextResponse.json({ ok: true, paid, payable, balance, closed: false });
}
