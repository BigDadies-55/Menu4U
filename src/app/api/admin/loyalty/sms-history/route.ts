import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getScopeRestaurantIds } from "@/lib/loyalty-scope";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const memberId     = searchParams.get("memberId");
  const restaurantId = searchParams.get("restaurantId");

  if (!memberId || !restaurantId) {
    return NextResponse.json({ error: "memberId and restaurantId required" }, { status: 400 });
  }

  // Verify access
  if (session.user.role !== "SUPER_ADMIN") {
    const access = await prisma.restaurantUser.findUnique({
      where: { userId_restaurantId: { userId: session.user.id, restaurantId } },
    });
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const member = await prisma.loyaltyMember.findUnique({
    where: { id: memberId },
    select: { phone: true },
  });
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  // Scope: include chain restaurants so chain-wide SMS shows up too
  const scopeIds = await getScopeRestaurantIds(restaurantId);

  type LogRow = {
    id: string;
    userEmail: string | null;
    meta: unknown;
    createdAt: Date;
  };

  const logs = await prisma.$queryRaw<LogRow[]>`
    SELECT "id", "userEmail", "meta", "createdAt"
    FROM "AuditLog"
    WHERE "action" = 'LOYALTY_SEND_SMS'
      AND "entityId" = ANY(${scopeIds}::text[])
      AND "meta" @> jsonb_build_object('phones', jsonb_build_array(${member.phone}::text))
    ORDER BY "createdAt" DESC
    LIMIT 50
  `;

  return NextResponse.json(logs.map(l => {
    const m = l.meta as Record<string, unknown> | null ?? {};
    return {
      id:      l.id,
      sentAt:  l.createdAt,
      sentBy:  l.userEmail ?? "מערכת",
      message: (m.message as string) ?? "",
      sent:    (m.sent    as number) ?? 0,
      failed:  (m.failed  as number) ?? 0,
      total:   (m.total   as number) ?? 0,
    };
  }));
}
