import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/** Strip a phone to comparable digits (drops +972 / leading-zero differences). */
function normalizePhone(p: string | null | undefined): string {
  if (!p) return "";
  let d = p.replace(/\D/g, "");
  if (d.startsWith("972")) d = "0" + d.slice(3);
  if (d && !d.startsWith("0")) d = "0" + d;
  return d;
}

/** Activity classification from days-since-last-visit. */
function activityStatus(lastVisit: Date | null): "new" | "active" | "at_risk" | "inactive" {
  if (!lastVisit) return "new";
  const days = (Date.now() - lastVisit.getTime()) / 86400000;
  if (days <= 30) return "active";
  if (days <= 90) return "at_risk";
  return "inactive";
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  // Ensure analytics column exists (idempotent — schema may predate it on older DBs)
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "LoyaltyMember" ADD COLUMN IF NOT EXISTS "lastVisitAt" TIMESTAMP`
  ).catch(() => {});

  const [members, settings] = await Promise.all([
    prisma.loyaltyMember.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "desc" },
      include: { transactions: { orderBy: { createdAt: "desc" }, take: 5 } },
    }),
    prisma.loyaltySettings.findUnique({ where: { restaurantId } }),
  ]);

  // ── Aggregate visit/spend stats from orders ──
  type OrderAgg = { member_id: string | null; phone: string | null; visits: number; spent: number; last_visit: Date | null };
  type ItemAgg = { member_id: string | null; phone: string | null; item_name: string; qty: number };
  type CouponAgg = { memberId: string; issued: number; used: number };

  const [orderRows, itemRows, couponRows] = await Promise.all([
    prisma.$queryRawUnsafe<OrderAgg[]>(
      `SELECT "loyaltyMemberId" AS member_id, "customerPhone" AS phone,
              COUNT(*)::int AS visits, COALESCE(SUM("totalAmount"),0)::float AS spent,
              MAX("createdAt") AS last_visit
         FROM "Order"
        WHERE "restaurantId" = $1 AND "status" <> 'CANCELLED'
          AND ("customerPhone" IS NOT NULL OR "loyaltyMemberId" IS NOT NULL)
        GROUP BY "loyaltyMemberId", "customerPhone"`,
      restaurantId
    ).catch(() => [] as OrderAgg[]),
    prisma.$queryRawUnsafe<ItemAgg[]>(
      `SELECT o."loyaltyMemberId" AS member_id, o."customerPhone" AS phone,
              i."name" AS item_name, SUM(oi."quantity")::int AS qty
         FROM "OrderItem" oi
         JOIN "Order" o ON o."id" = oi."orderId"
         JOIN "Item" i ON i."id" = oi."itemId"
        WHERE o."restaurantId" = $1 AND o."status" <> 'CANCELLED'
          AND (o."customerPhone" IS NOT NULL OR o."loyaltyMemberId" IS NOT NULL)
        GROUP BY o."loyaltyMemberId", o."customerPhone", i."name"`,
      restaurantId
    ).catch(() => [] as ItemAgg[]),
    prisma.$queryRawUnsafe<CouponAgg[]>(
      `SELECT "memberId", COUNT(*)::int AS issued, COUNT("usedAt")::int AS used
         FROM "LoyaltyCoupon"
        WHERE "restaurantId" = $1
        GROUP BY "memberId"`,
      restaurantId
    ).catch(() => [] as CouponAgg[]),
  ]);

  // Index members for matching: by id and by normalized phone
  const byId = new Map(members.map(m => [m.id, m]));
  const byPhone = new Map(members.map(m => [normalizePhone(m.phone), m]));
  const matchMember = (memberId: string | null, phone: string | null) =>
    (memberId && byId.get(memberId)) || (phone && byPhone.get(normalizePhone(phone))) || null;

  // Accumulate per-member visit aggregates (each order row maps to one member)
  const stats = new Map<string, { visits: number; spent: number; last: Date | null }>();
  for (const r of orderRows) {
    const m = matchMember(r.member_id, r.phone);
    if (!m) continue;
    const cur = stats.get(m.id) ?? { visits: 0, spent: 0, last: null };
    cur.visits += Number(r.visits) || 0;
    cur.spent += Number(r.spent) || 0;
    const last = r.last_visit ? new Date(r.last_visit) : null;
    if (last && (!cur.last || last > cur.last)) cur.last = last;
    stats.set(m.id, cur);
  }

  // Favorite item per member (highest total quantity)
  const favTracker = new Map<string, { name: string; qty: number }>();
  for (const r of itemRows) {
    const m = matchMember(r.member_id, r.phone);
    if (!m) continue;
    const qty = Number(r.qty) || 0;
    const cur = favTracker.get(m.id);
    if (!cur || qty > cur.qty) favTracker.set(m.id, { name: r.item_name, qty });
  }

  const coupons = new Map(couponRows.map(c => [c.memberId, { issued: Number(c.issued) || 0, used: Number(c.used) || 0 }]));

  const enriched = members.map(m => {
    const s = stats.get(m.id);
    // Prefer the stored lastVisitAt; fall back to the max order date we computed
    const storedLast = (m as { lastVisitAt?: Date | null }).lastVisitAt ?? null;
    const computedLast = s?.last ?? null;
    const lastVisitAt =
      storedLast && computedLast ? (storedLast > computedLast ? storedLast : computedLast)
      : storedLast ?? computedLast;
    const visitCount = s?.visits ?? 0;
    const orderSpent = s?.spent ?? 0;
    const avgSpend = visitCount > 0 ? orderSpent / visitCount : 0;
    const fav = favTracker.get(m.id);
    const cp = coupons.get(m.id) ?? { issued: 0, used: 0 };
    return {
      ...m,
      analytics: {
        lastVisitAt,
        visitCount,
        avgSpend,
        orderSpent,
        favoriteItem: fav?.name ?? null,
        couponsIssued: cp.issued,
        couponsUsed: cp.used,
        status: activityStatus(lastVisitAt),
      },
    };
  });

  return NextResponse.json({ members: enriched, settings });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action, restaurantId } = body;

  if (action === "updateSettings") {
    const settings = await prisma.loyaltySettings.upsert({
      where: { restaurantId },
      update: {
        pointsPerShekel: body.pointsPerShekel,
        shekelPerPoint: body.shekelPerPoint,
        minRedeemPoints: body.minRedeemPoints,
        welcomeBonus: body.welcomeBonus,
        birthdayBonus: body.birthdayBonus,
        isActive: body.isActive,
      },
      create: {
        restaurantId,
        pointsPerShekel: body.pointsPerShekel ?? 1,
        shekelPerPoint: body.shekelPerPoint ?? 0.1,
        minRedeemPoints: body.minRedeemPoints ?? 100,
        welcomeBonus: body.welcomeBonus ?? 50,
        birthdayBonus: body.birthdayBonus ?? 100,
        isActive: body.isActive ?? true,
      },
    });
    return NextResponse.json(settings);
  }

  if (action === "adjustPoints") {
    const { memberId, points, note } = body;
    // Verify caller has access to the member's restaurant
    const memberRecord = await prisma.loyaltyMember.findUnique({ where: { id: memberId }, select: { restaurantId: true } });
    if (!memberRecord) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    if (session.user.role !== "SUPER_ADMIN") {
      const access = await prisma.restaurantUser.findFirst({ where: { userId: session.user.id, restaurantId: memberRecord.restaurantId } });
      if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const member = await prisma.loyaltyMember.update({
      where: { id: memberId },
      data: { points: { increment: points } },
    });
    await prisma.loyaltyTransaction.create({
      data: {
        id: `lt-${Date.now()}`,
        memberId,
        type: "MANUAL",
        points,
        note: note || "התאמה ידנית",
      },
    });
    return NextResponse.json(member);
  }

  if (action === "issueCoupon") {
    const { memberId, type, value, description, expiresAt, validForGroup } = body;
    // Verify caller has access to the coupon's restaurant
    const memberRecord2 = await prisma.loyaltyMember.findUnique({ where: { id: memberId }, select: { restaurantId: true } });
    if (!memberRecord2) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    if (session.user.role !== "SUPER_ADMIN") {
      const access = await prisma.restaurantUser.findFirst({ where: { userId: session.user.id, restaurantId: memberRecord2.restaurantId } });
      if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const code = `C${Date.now().toString(36).toUpperCase()}`;

    // Resolve group if coupon should be valid chain-wide
    let validForGroupId: string | null = null;
    if (validForGroup) {
      try {
        type GRow = { groupId: string | null };
        const rows = await prisma.$queryRawUnsafe<GRow[]>(
          `SELECT "groupId" FROM "Restaurant" WHERE "id" = $1 LIMIT 1`,
          restaurantId
        );
        validForGroupId = rows[0]?.groupId ?? null;
      } catch { /* ignore */ }
    }

    const coupon = await prisma.loyaltyCoupon.create({
      data: {
        id: `lc-${Date.now()}`,
        memberId,
        restaurantId,
        code,
        type,
        value,
        description,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        ...(validForGroupId ? { validForGroupId } : {}),
      },
    });
    return NextResponse.json(coupon);
  }

  if (action === "createMember") {
    const { name, phone, email, birthDate } = body;
    if (!name || !phone || !restaurantId) {
      return NextResponse.json({ error: "שם וטלפון הם שדות חובה" }, { status: 400 });
    }
    if (session.user.role !== "SUPER_ADMIN") {
      const access = await prisma.restaurantUser.findFirst({ where: { userId: session.user.id, restaurantId } });
      if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // Unique phone per restaurant
    const existing = await prisma.loyaltyMember.findFirst({ where: { restaurantId, phone } });
    if (existing) return NextResponse.json({ error: "חבר עם מספר טלפון זה כבר קיים" }, { status: 409 });

    // Auto-generate member number
    const count = await prisma.loyaltyMember.count({ where: { restaurantId } });
    const memberNumber = String(count + 1).padStart(4, "0");

    // Welcome bonus
    const loyaltySettings = await prisma.loyaltySettings.findUnique({ where: { restaurantId } });
    const welcomeBonus = loyaltySettings?.welcomeBonus ?? 0;

    const member = await prisma.loyaltyMember.create({
      data: {
        id: `lm-${Date.now()}`,
        restaurantId,
        phone,
        name,
        email: email || null,
        birthDate: birthDate ? new Date(birthDate) : null,
        memberNumber,
        points: welcomeBonus,
      },
    });

    if (welcomeBonus > 0) {
      await prisma.loyaltyTransaction.create({
        data: {
          id: `lt-${Date.now()}`,
          memberId: member.id,
          type: "BONUS",
          points: welcomeBonus,
          note: "בונוס הצטרפות",
        },
      });
    }

    return NextResponse.json(member);
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
