import { prisma } from "@/lib/prisma";
import { logAudit, getIp } from "@/lib/audit";
import { getGroupId, scopeWhere } from "@/lib/loyalty-scope";
import { notifyRestaurant } from "@/lib/push";

export type CloseableOrder = {
  id: string;
  status: string;
  totalAmount: number;
  createdAt: Date;
  customerPhone: string | null;
  loyaltyMemberId: string | null;
  loyaltyMemberName: string | null;
};

/** Prisma where-filter matching a table's orders (null table also matches ""). */
export function tableWhere(tableNumber: string | null) {
  return tableNumber === null
    ? { OR: [{ tableNumber: null as string | null }, { tableNumber: "" }] }
    : { tableNumber };
}

/**
 * Marks a table's open orders as PAID and runs the best-effort side effects
 * (status logs, table session, loyalty earning, audit, push). Shared by the
 * close-table route (single payment) and the partial-payment route (split).
 */
export async function finalizeTablePayment(opts: {
  userId?: string | null;
  userEmail?: string | null;
  restaurantId: string;
  tableNumber: string | null;
  openOrders: CloseableOrder[];
  tipAmount?: number;
  payMethod?: string;
  req?: Request;
}): Promise<{ closed: number; totalAmount: number }> {
  const { userId, userEmail, restaurantId, tableNumber, openOrders } = opts;
  const tipAmount = opts.tipAmount ?? 0;
  const payMethod = opts.payMethod ?? "card";

  if (openOrders.length === 0) return { closed: 0, totalAmount: 0 };

  const totalAmount = openOrders.reduce((s, o) => s + o.totalAmount, 0);
  const openedAt = openOrders[0]?.createdAt ?? new Date();

  // ── CRITICAL: mark orders PAID ──
  await prisma.order.updateMany({
    where: { id: { in: openOrders.map(o => o.id) } },
    data: { status: "PAID", closedByUserId: userId ?? undefined },
  });

  // ── BEST-EFFORT: status log ──
  try {
    await prisma.orderStatusLog.createMany({
      data: openOrders.map(o => ({
        orderId: o.id,
        fromStatus: o.status,
        toStatus: "PAID",
        changedBy: userId ?? null,
      })),
      skipDuplicates: true,
    });
  } catch { /* non-critical */ }

  // ── BEST-EFFORT: clear the table's manual status override (bill_requested +
  //    bill_at) so the next sitting doesn't inherit a stale "bill requested"
  //    insight from the session that was just closed. ──
  try {
    if (tableNumber) {
      const rows = await prisma.$queryRawUnsafe<Array<{ tableStatusOverridesJson: string | null }>>(
        `SELECT "tableStatusOverridesJson" FROM "Restaurant" WHERE id = $1`, restaurantId
      );
      let overrides: Record<string, string> = {};
      try { overrides = JSON.parse(rows[0]?.tableStatusOverridesJson ?? "{}"); } catch { overrides = {}; }
      if (overrides[tableNumber] !== undefined || overrides[`${tableNumber}_bill_at`] !== undefined) {
        delete overrides[tableNumber];
        delete overrides[`${tableNumber}_bill_at`];
        await prisma.$executeRawUnsafe(
          `UPDATE "Restaurant" SET "tableStatusOverridesJson" = $1 WHERE id = $2`,
          JSON.stringify(overrides), restaurantId
        );
      }
    }
  } catch { /* non-critical */ }

  // ── BEST-EFFORT: table session record ──
  try {
    if (tableNumber) {
      await prisma.tableSession.create({
        data: {
          restaurantId,
          tableNumber,
          openedAt,
          closedAt: new Date(),
          totalAmount,
          orderCount: openOrders.length,
        },
      });
    }
  } catch { /* migration may not have run yet — ignore */ }

  // ── BEST-EFFORT: earn loyalty points for every member who ordered ──
  try {
    const settings = await prisma.loyaltySettings.findUnique({
      where: { restaurantId },
      select: { pointsPerShekel: true, isActive: true },
    });
    if (settings?.isActive !== false) {
      const pointsPerShekel = (settings as { pointsPerShekel?: number } | null)?.pointsPerShekel ?? 1;

      const memberEarnings = new Map<string, { name: string; earnedAmount: number; orderIds: string[] }>();
      const earnGroupId = await getGroupId(restaurantId);

      for (const ord of openOrders) {
        if (!ord.loyaltyMemberId && !ord.customerPhone) continue;
        let memberId = ord.loyaltyMemberId;
        let memberName = ord.loyaltyMemberName;

        if (!memberId && ord.customerPhone) {
          const m = await prisma.loyaltyMember.findFirst({
            where: { phone: ord.customerPhone, ...scopeWhere(restaurantId, earnGroupId) },
            select: { id: true, name: true },
          });
          if (m) { memberId = m.id; memberName = m.name; }
        }
        if (!memberId) continue;

        const existing = memberEarnings.get(memberId);
        if (existing) {
          existing.earnedAmount += ord.totalAmount;
          existing.orderIds.push(ord.id);
        } else {
          memberEarnings.set(memberId, { name: memberName ?? "", earnedAmount: ord.totalAmount, orderIds: [ord.id] });
        }
      }

      for (const [memberId, { name, earnedAmount, orderIds }] of memberEarnings) {
        const pointsEarned = Math.floor(earnedAmount * pointsPerShekel);
        if (pointsEarned <= 0) continue;
        await prisma.loyaltyMember.update({
          where: { id: memberId },
          data: { points: { increment: pointsEarned }, totalSpent: { increment: earnedAmount }, lastVisitAt: new Date() },
        });
        await prisma.loyaltyTransaction.create({
          data: {
            memberId,
            orderId: orderIds[0],
            type: "EARN",
            points: pointsEarned,
            note: `צבירה — ₪${earnedAmount.toFixed(2)} · ${pointsEarned} נקודות`,
          },
        });
        void name;
      }
    }
  } catch { /* non-critical — points earning should not block payment */ }

  // ── Audit log ──
  await logAudit({
    userId,
    userEmail,
    action: "CLOSE_TABLE",
    entity: "order",
    entityId: restaurantId,
    entityName: `שולחן ${tableNumber ?? "ללא שולחן"} · ₪${totalAmount.toFixed(0)} · ${openOrders.length} הזמנות`,
    meta: { tableNumber, restaurantId, orderIds: openOrders.map(o => o.id), totalAmount, tipAmount, payMethod },
    ip: opts.req ? getIp(opts.req) : null,
  });

  notifyRestaurant(restaurantId, "TABLE_PAYMENT", {
    title: "💳 שולחן שולם",
    body: `שולחן ${tableNumber ?? "—"} · ₪${totalAmount.toFixed(0)}`,
    url: "/admin/orders",
    tag: `payment-${restaurantId}-${tableNumber}`,
  });

  return { closed: openOrders.length, totalAmount };
}
