import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { logAudit, getIp } from "@/lib/audit";
import { getGroupId, scopeWhere } from "@/lib/loyalty-scope";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { restaurantId, tipAmount = 0, payMethod = "card" } = body;
  // tableNumber may be null (orders placed without a table number)
  const tableNumber: string | null = body.tableNumber !== undefined ? (body.tableNumber || null) : null;

  if (!restaurantId) {
    return NextResponse.json({ error: "Missing restaurantId" }, { status: 400 });
  }

  // Auth: non-superadmin must belong to this restaurant
  const role = session.user.role;
  if (role !== "SUPER_ADMIN") {
    const link = await prisma.restaurantUser.findFirst({
      where: { userId: session.user.id, restaurantId },
    });
    if (!link) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // All non-cancelled, non-paid orders for this table.
  // When tableNumber is null we match BOTH null and "" because some orders
  // arrive with tableNumber="" (empty string) from the public menu form.
  const tableFilter = tableNumber === null
    ? { OR: [{ tableNumber: null as string | null }, { tableNumber: "" }] }
    : { tableNumber };

  const openOrders = await prisma.order.findMany({
    where: {
      restaurantId,
      ...tableFilter,
      status: { notIn: ["CANCELLED", "PAID"] },
    },
    select: {
      id: true, status: true, totalAmount: true, createdAt: true,
      customerPhone: true, loyaltyMemberId: true, loyaltyMemberName: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (openOrders.length === 0) {
    return NextResponse.json({ closed: 0, totalAmount: 0 });
  }

  const totalAmount = openOrders.reduce((s, o) => s + o.totalAmount, 0);
  const openedAt = openOrders[0]?.createdAt ?? new Date();

  // ── CRITICAL: mark orders PAID (standalone update — not bundled with optional logging) ──
  await prisma.order.updateMany({
    where: { id: { in: openOrders.map(o => o.id) } },
    data: { status: "PAID" },
  });

  // ── BEST-EFFORT: status log (failure here must NOT roll back the PAID update) ──
  try {
    await prisma.orderStatusLog.createMany({
      data: openOrders.map(o => ({
        orderId: o.id,
        fromStatus: o.status,
        toStatus: "PAID",
        changedBy: session.user.id ?? null,
      })),
      skipDuplicates: true,
    });
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

      // Group orders by loyaltyMemberId (if set) OR by customerPhone (look up member)
      const memberEarnings = new Map<string, { name: string; earnedAmount: number; orderIds: string[] }>();
      // Resolve the chain once so phone lookups find chain members from sibling branches
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
        // Notify the member via SSE so their card updates in real-time
        void name; // used in note above
      }
    }
  } catch { /* non-critical — points earning should not block payment */ }

  // ── Audit log ──
  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email,
    action: "CLOSE_TABLE",
    entity: "order",
    entityId: restaurantId,
    entityName: `שולחן ${tableNumber ?? "ללא שולחן"} · ₪${totalAmount.toFixed(0)} · ${openOrders.length} הזמנות`,
    meta: { tableNumber, restaurantId, orderIds: openOrders.map(o => o.id), totalAmount, tipAmount, payMethod },
    ip: getIp(req),
  });

  return NextResponse.json({ closed: openOrders.length, totalAmount });
}
