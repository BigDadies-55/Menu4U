import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { logAudit, getIp } from "@/lib/audit";
import { verifyManagerToken } from "@/lib/verifyManagerToken";
import { sseNotify } from "@/lib/sse";
import { tableWhere } from "@/lib/closeTable";

const round2 = (n: number) => Math.round(n * 100) / 100;

type AdjustType = "DISCOUNT_AMOUNT" | "DISCOUNT_PERCENT" | "ON_HOUSE" | "PRICE_OVERRIDE";

// POST /api/admin/orders/adjust
// Body: { restaurantId, tableNumber, type, value, reason, itemId?, managerToken }
// All variants require a valid manager PIN token and are written to the audit log.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { restaurantId, type, value = 0, reason, itemId, managerToken } = body as {
    restaurantId: string; type: AdjustType; value?: number; reason?: string; itemId?: string; managerToken?: string;
  };
  const tableNumber: string | null = body.tableNumber !== undefined ? (body.tableNumber || null) : null;

  if (!restaurantId) return NextResponse.json({ error: "Missing restaurantId" }, { status: 400 });

  const claims = await verifyManagerToken(managerToken ?? "");
  if (!claims) return NextResponse.json({ error: "נדרש אישור מנהל — PIN פג תוקף או שגוי" }, { status: 403 });

  // ── Price override targets a single item ──
  if (type === "PRICE_OVERRIDE") {
    if (!itemId) return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
    const newPrice = round2(Number(value));
    if (!(newPrice >= 0)) return NextResponse.json({ error: "מחיר לא תקין" }, { status: 400 });

    const orderItem = await prisma.orderItem.findUnique({
      where: { id: itemId },
      include: { order: { select: { id: true, restaurantId: true } }, item: { select: { name: true } } },
    });
    if (!orderItem || orderItem.order.restaurantId !== restaurantId)
      return NextResponse.json({ error: "פריט לא נמצא" }, { status: 404 });

    const oldPrice = orderItem.price;
    const lineDelta = round2((newPrice - oldPrice) * orderItem.quantity);

    await prisma.$transaction([
      prisma.orderItem.update({ where: { id: itemId }, data: { price: newPrice } }),
      prisma.order.update({ where: { id: orderItem.order.id }, data: { totalAmount: { increment: lineDelta } } }),
    ]);

    await logAudit({
      userId: session.user.id, userEmail: session.user.email,
      action: "PRICE_OVERRIDE", entity: "orderItem", entityId: itemId,
      entityName: `${orderItem.item.name} × ${orderItem.quantity}: ₪${oldPrice.toFixed(2)} → ₪${newPrice.toFixed(2)} — אושר ע"י ${claims.managerName}${reason ? ` (${reason})` : ""}`,
      meta: { restaurantId, tableNumber, oldPrice, newPrice, quantity: orderItem.quantity, manager: claims.managerName, reason: reason ?? null },
      ip: getIp(req),
    });

    sseNotify(restaurantId);
    return NextResponse.json({ ok: true, amount: -lineDelta });
  }

  // ── Bill-level adjustments (discount / on the house) ──
  const openOrders = await prisma.order.findMany({
    where: { restaurantId, ...tableWhere(tableNumber), status: { notIn: ["CANCELLED", "PAID"] } },
    select: { id: true, totalAmount: true },
    orderBy: { createdAt: "asc" },
  });
  if (openOrders.length === 0) return NextResponse.json({ error: "אין הזמנות פתוחות לשולחן" }, { status: 400 });

  const itemsTotal = round2(openOrders.reduce((s, o) => s + o.totalAmount, 0));

  let discount: number;
  let actionLabel: string;
  if (type === "ON_HOUSE") {
    discount = itemsTotal;
    actionLabel = `על חשבון הבית · ₪${itemsTotal.toFixed(2)}`;
  } else if (type === "DISCOUNT_PERCENT") {
    const pct = Math.max(0, Math.min(100, Number(value)));
    discount = round2(itemsTotal * pct / 100);
    actionLabel = `הנחה ${pct}% · ₪${discount.toFixed(2)}`;
  } else if (type === "DISCOUNT_AMOUNT") {
    discount = round2(Math.max(0, Math.min(Number(value), itemsTotal)));
    actionLabel = `הנחה ₪${discount.toFixed(2)}`;
  } else {
    return NextResponse.json({ error: "סוג התאמה לא נתמך" }, { status: 400 });
  }

  if (discount <= 0) return NextResponse.json({ error: "סכום הנחה לא תקין" }, { status: 400 });

  // Cascade the discount across the table's orders so none goes negative.
  let remaining = discount;
  const updates = [];
  for (const o of openOrders) {
    if (remaining <= 0) break;
    const d = round2(Math.min(remaining, o.totalAmount));
    if (d > 0) {
      updates.push(prisma.order.update({ where: { id: o.id }, data: { totalAmount: { decrement: d } } }));
      remaining = round2(remaining - d);
    }
  }
  if (updates.length > 0) await prisma.$transaction(updates);

  await logAudit({
    userId: session.user.id, userEmail: session.user.email,
    action: type === "ON_HOUSE" ? "ORDER_ON_HOUSE" : "ORDER_DISCOUNT",
    entity: "order", entityId: restaurantId,
    entityName: `שולחן ${tableNumber ?? "ללא שולחן"} · ${actionLabel} — אושר ע"י ${claims.managerName}${reason ? ` (${reason})` : ""}`,
    meta: { restaurantId, tableNumber, type, value, discount, itemsTotal, manager: claims.managerName, reason: reason ?? null, orderIds: openOrders.map(o => o.id) },
    ip: getIp(req),
  });

  sseNotify(restaurantId);
  return NextResponse.json({ ok: true, amount: discount });
}
