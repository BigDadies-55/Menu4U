import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  const [members, settings] = await Promise.all([
    prisma.loyaltyMember.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "desc" },
      include: { transactions: { orderBy: { createdAt: "desc" }, take: 5 } },
    }),
    prisma.loyaltySettings.findUnique({ where: { restaurantId } }),
  ]);

  return NextResponse.json({ members, settings });
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
