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
    const { memberId, type, value, description, expiresAt } = body;
    const code = `C${Date.now().toString(36).toUpperCase()}`;
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
      },
    });
    return NextResponse.json(coupon);
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
