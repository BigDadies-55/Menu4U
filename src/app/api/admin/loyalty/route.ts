import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getGroupId, getScopeRestaurantIds, scopeWhere,
  checkLoyaltyPermission, ensureLoyaltyPermissionColumns,
} from "@/lib/loyalty-scope";
import { logAudit, getIp } from "@/lib/audit";
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

  // Ensure analytics + permission columns exist (idempotent)
  await Promise.allSettled([
    prisma.$executeRawUnsafe(`ALTER TABLE "LoyaltyMember" ADD COLUMN IF NOT EXISTS "lastVisitAt" TIMESTAMP`),
    ensureLoyaltyPermissionColumns(),
  ]);

  // Chain scope: a grouped restaurant shares its member pool with sibling branches
  const scopeGroupId = await getGroupId(restaurantId);
  const scopeIds = await getScopeRestaurantIds(restaurantId, scopeGroupId);

  const [members, settings] = await Promise.all([
    prisma.loyaltyMember.findMany({
      where: scopeWhere(restaurantId, scopeGroupId),
      orderBy: { createdAt: "desc" },
      include: {
        transactions: { orderBy: { createdAt: "desc" }, take: 5 },
        coupons: { orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM "LoyaltySettings" WHERE "restaurantId" = $1 LIMIT 1`,
      restaurantId
    ).then(r => r[0] ?? null).catch(() => null),
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
        WHERE "restaurantId" = ANY($1::text[]) AND "status" <> 'CANCELLED'
          AND ("customerPhone" IS NOT NULL OR "loyaltyMemberId" IS NOT NULL)
        GROUP BY "loyaltyMemberId", "customerPhone"`,
      scopeIds
    ).catch(() => [] as OrderAgg[]),
    prisma.$queryRawUnsafe<ItemAgg[]>(
      `SELECT o."loyaltyMemberId" AS member_id, o."customerPhone" AS phone,
              i."name" AS item_name, SUM(oi."quantity")::int AS qty
         FROM "OrderItem" oi
         JOIN "Order" o ON o."id" = oi."orderId"
         JOIN "Item" i ON i."id" = oi."itemId"
        WHERE o."restaurantId" = ANY($1::text[]) AND o."status" <> 'CANCELLED'
          AND (o."customerPhone" IS NOT NULL OR o."loyaltyMemberId" IS NOT NULL)
        GROUP BY o."loyaltyMemberId", o."customerPhone", i."name"`,
      scopeIds
    ).catch(() => [] as ItemAgg[]),
    prisma.$queryRawUnsafe<CouponAgg[]>(
      `SELECT "memberId", COUNT(*)::int AS issued, COUNT("usedAt")::int AS used
         FROM "LoyaltyCoupon"
        WHERE "restaurantId" = ANY($1::text[])
        GROUP BY "memberId"`,
      scopeIds
    ).catch(() => [] as CouponAgg[]),
  ]);

  const byId = new Map(members.map(m => [m.id, m]));
  const byPhone = new Map(members.map(m => [normalizePhone(m.phone), m]));
  const matchMember = (memberId: string | null, phone: string | null) =>
    (memberId && byId.get(memberId)) || (phone && byPhone.get(normalizePhone(phone))) || null;

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
  const ip = getIp(req);

  if (action === "updateSettings") {
    // Only OWNER and above can update loyalty settings
    if (session.user.role !== "SUPER_ADMIN") {
      const access = await prisma.restaurantUser.findFirst({
        where: { userId: session.user.id, restaurantId },
        select: { role: true },
      });
      const { ROLE_HIERARCHY } = await import("@/lib/permissions");
      const userLevel = ROLE_HIERARCHY[(access?.role ?? "VIEWER") as keyof typeof ROLE_HIERARCHY] ?? 0;
      const ownerLevel = ROLE_HIERARCHY["OWNER"];
      if (userLevel < ownerLevel) {
        return NextResponse.json({ error: "נדרש תפקיד בעל מסעדה לעדכון הגדרות" }, { status: 403 });
      }
    }
    // Use raw upsert to include new permission columns Prisma client might not know yet
    await prisma.$executeRawUnsafe(
      `INSERT INTO "LoyaltySettings"
         ("restaurantId","pointsPerShekel","shekelPerPoint","minRedeemPoints",
          "welcomeBonus","birthdayBonus","isActive",
          "minRoleAdjustPoints","minRoleIssueCoupon","minRoleRedeemCoupon",
          "minRoleUpdateMember","minRoleSendSms","maxDailyPointsAdjust")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT ("restaurantId") DO UPDATE SET
         "pointsPerShekel"     = EXCLUDED."pointsPerShekel",
         "shekelPerPoint"      = EXCLUDED."shekelPerPoint",
         "minRedeemPoints"     = EXCLUDED."minRedeemPoints",
         "welcomeBonus"        = EXCLUDED."welcomeBonus",
         "birthdayBonus"       = EXCLUDED."birthdayBonus",
         "isActive"            = EXCLUDED."isActive",
         "minRoleAdjustPoints" = EXCLUDED."minRoleAdjustPoints",
         "minRoleIssueCoupon"  = EXCLUDED."minRoleIssueCoupon",
         "minRoleRedeemCoupon" = EXCLUDED."minRoleRedeemCoupon",
         "minRoleUpdateMember" = EXCLUDED."minRoleUpdateMember",
         "minRoleSendSms"      = EXCLUDED."minRoleSendSms",
         "maxDailyPointsAdjust" = EXCLUDED."maxDailyPointsAdjust"`,
      restaurantId,
      body.pointsPerShekel ?? 1,
      body.shekelPerPoint ?? 0.1,
      body.minRedeemPoints ?? 100,
      body.welcomeBonus ?? 50,
      body.birthdayBonus ?? 100,
      body.isActive ?? true,
      body.minRoleAdjustPoints ?? "SHIFT_MANAGER",
      body.minRoleIssueCoupon ?? "OWNER",
      body.minRoleRedeemCoupon ?? "SHIFT_MANAGER",
      body.minRoleUpdateMember ?? "SHIFT_MANAGER",
      body.minRoleSendSms ?? "OWNER",
      body.maxDailyPointsAdjust ?? 0,
    );
    await logAudit({
      userId: session.user.id, userEmail: session.user.email,
      action: "LOYALTY_UPDATE_SETTINGS", entity: "LoyaltySettings", entityId: restaurantId, ip,
      meta: { pointsPerShekel: body.pointsPerShekel, shekelPerPoint: body.shekelPerPoint, isActive: body.isActive },
    });
    const updated = await prisma.$queryRawUnsafe(
      `SELECT * FROM "LoyaltySettings" WHERE "restaurantId" = $1 LIMIT 1`, restaurantId
    ).then((r: unknown) => (r as unknown[])[0] ?? null);
    return NextResponse.json(updated);
  }

  if (action === "adjustPoints") {
    const { memberId, points, note } = body;
    const memberRecord = await prisma.loyaltyMember.findUnique({ where: { id: memberId }, select: { restaurantId: true, name: true, phone: true } });
    if (!memberRecord) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    const perm = await checkLoyaltyPermission(session.user.id, session.user.role, memberRecord.restaurantId, "adjustPoints", points);
    if (!perm.allowed) return NextResponse.json({ error: perm.reason }, { status: 403 });
    const member = await prisma.loyaltyMember.update({
      where: { id: memberId },
      data: { points: { increment: points } },
    });
    // Embed operator id in note so daily-cap query can filter by it
    const fullNote = `${note || "התאמה ידנית"} [uid:${session.user.id}]`;
    await prisma.loyaltyTransaction.create({
      data: { id: `lt-${Date.now()}`, memberId, type: "MANUAL", points, note: fullNote },
    });
    await logAudit({
      userId: session.user.id, userEmail: session.user.email,
      action: "LOYALTY_ADJUST_POINTS", entity: "LoyaltyMember",
      entityId: memberId, entityName: memberRecord.name, ip,
      meta: { points, note: note || null, newTotal: member.points },
    });
    return NextResponse.json(member);
  }

  if (action === "issueCoupon") {
    const { memberId, type, value, description, expiresAt, validForGroup } = body;
    const memberRecord2 = await prisma.loyaltyMember.findUnique({ where: { id: memberId }, select: { restaurantId: true, name: true } });
    if (!memberRecord2) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    const perm = await checkLoyaltyPermission(session.user.id, session.user.role, memberRecord2.restaurantId, "issueCoupon");
    if (!perm.allowed) return NextResponse.json({ error: perm.reason }, { status: 403 });
    const code = `C${Date.now().toString(36).toUpperCase()}`;
    let validForGroupId: string | null = null;
    if (validForGroup) {
      try {
        type GRow = { groupId: string | null };
        const rows = await prisma.$queryRawUnsafe<GRow[]>(`SELECT "groupId" FROM "Restaurant" WHERE "id" = $1 LIMIT 1`, restaurantId);
        validForGroupId = rows[0]?.groupId ?? null;
      } catch { /* ignore */ }
    }
    const coupon = await prisma.loyaltyCoupon.create({
      data: {
        id: `lc-${Date.now()}`,
        memberId, restaurantId, code, type, value, description,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        ...(validForGroupId ? { validForGroupId } : {}),
      },
    });
    await logAudit({
      userId: session.user.id, userEmail: session.user.email,
      action: "LOYALTY_ISSUE_COUPON", entity: "LoyaltyMember",
      entityId: memberId, entityName: memberRecord2.name, ip,
      meta: { couponId: coupon.id, code, type, value, description, expiresAt: expiresAt ?? null },
    });
    return NextResponse.json(coupon);
  }

  if (action === "redeemCoupon") {
    const { couponId } = body;
    const couponRecord = await prisma.loyaltyCoupon.findUnique({
      where: { id: couponId },
      select: { restaurantId: true, usedAt: true, memberId: true, code: true },
    });
    if (!couponRecord) return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    if (couponRecord.usedAt) return NextResponse.json({ error: "כבר מומש" }, { status: 409 });
    const perm = await checkLoyaltyPermission(session.user.id, session.user.role, couponRecord.restaurantId, "redeemCoupon");
    if (!perm.allowed) return NextResponse.json({ error: perm.reason }, { status: 403 });
    await prisma.$executeRawUnsafe(
      `UPDATE "LoyaltyCoupon" SET "usedAt" = NOW(), "usedAtRestaurantId" = $1 WHERE "id" = $2 AND "usedAt" IS NULL`,
      couponRecord.restaurantId, couponId
    );
    const member = await prisma.loyaltyMember.findUnique({ where: { id: couponRecord.memberId }, select: { name: true } });
    await logAudit({
      userId: session.user.id, userEmail: session.user.email,
      action: "LOYALTY_REDEEM_COUPON", entity: "LoyaltyMember",
      entityId: couponRecord.memberId, entityName: member?.name ?? undefined, ip,
      meta: { couponId, code: couponRecord.code },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "updateMember") {
    const { memberId, name, phone, email, birthDate } = body;
    if (!memberId) return NextResponse.json({ error: "memberId required" }, { status: 400 });
    const memberRecord = await prisma.loyaltyMember.findUnique({ where: { id: memberId }, select: { restaurantId: true, name: true, phone: true } });
    if (!memberRecord) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    const perm = await checkLoyaltyPermission(session.user.id, session.user.role, memberRecord.restaurantId, "updateMember");
    if (!perm.allowed) return NextResponse.json({ error: perm.reason }, { status: 403 });
    if (phone) {
      const memberGroupId = await getGroupId(memberRecord.restaurantId);
      const conflict = await prisma.loyaltyMember.findFirst({
        where: { phone, ...scopeWhere(memberRecord.restaurantId, memberGroupId), NOT: { id: memberId } },
      });
      if (conflict) return NextResponse.json({ error: "מספר הטלפון כבר קיים אצל חבר אחר" }, { status: 409 });
    }
    const updated = await prisma.loyaltyMember.update({
      where: { id: memberId },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email: email || null }),
        ...(birthDate !== undefined && { birthDate: birthDate ? new Date(birthDate) : null }),
      },
    });
    await logAudit({
      userId: session.user.id, userEmail: session.user.email,
      action: "LOYALTY_UPDATE_MEMBER", entity: "LoyaltyMember",
      entityId: memberId, entityName: memberRecord.name, ip,
      meta: {
        changes: {
          ...(name !== undefined && name !== memberRecord.name && { name: { from: memberRecord.name, to: name } }),
          ...(phone !== undefined && phone !== memberRecord.phone && { phone: { from: memberRecord.phone, to: phone } }),
          ...(email !== undefined && { email }),
          ...(birthDate !== undefined && { birthDate }),
        },
      },
    });
    return NextResponse.json(updated);
  }

  if (action === "createMember") {
    const { name, phone, email, birthDate } = body;
    if (!name || !phone || !restaurantId) return NextResponse.json({ error: "שם וטלפון הם שדות חובה" }, { status: 400 });
    const perm = await checkLoyaltyPermission(session.user.id, session.user.role, restaurantId, "createMember");
    if (!perm.allowed) return NextResponse.json({ error: perm.reason }, { status: 403 });
    const createGroupId = await getGroupId(restaurantId);
    const existing = await prisma.loyaltyMember.findFirst({ where: { phone, ...scopeWhere(restaurantId, createGroupId) } });
    if (existing) return NextResponse.json({ error: "חבר עם מספר טלפון זה כבר קיים" }, { status: 409 });
    const count = await prisma.loyaltyMember.count({ where: scopeWhere(restaurantId, createGroupId) });
    const memberNumber = String(count + 1).padStart(4, "0");
    const loyaltySettings = await prisma.loyaltySettings.findUnique({ where: { restaurantId } });
    const welcomeBonus = loyaltySettings?.welcomeBonus ?? 0;
    const member = await prisma.loyaltyMember.create({
      data: {
        id: `lm-${Date.now()}`,
        restaurantId, groupId: createGroupId,
        phone, name, email: email || null,
        birthDate: birthDate ? new Date(birthDate) : null,
        memberNumber, points: welcomeBonus,
      },
    });
    if (welcomeBonus > 0) {
      await prisma.loyaltyTransaction.create({
        data: { id: `lt-${Date.now()}`, memberId: member.id, type: "BONUS", points: welcomeBonus, note: "בונוס הצטרפות" },
      });
    }
    await logAudit({
      userId: session.user.id, userEmail: session.user.email,
      action: "LOYALTY_CREATE_MEMBER", entity: "LoyaltyMember",
      entityId: member.id, entityName: name, ip,
      meta: { phone, memberNumber, welcomeBonus },
    });
    return NextResponse.json(member);
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
