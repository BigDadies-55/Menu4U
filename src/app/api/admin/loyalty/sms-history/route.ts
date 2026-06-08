import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

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

  // Fetch member phone so we can match against audit log phones array
  const member = await prisma.loyaltyMember.findUnique({
    where: { id: memberId },
    select: { phone: true },
  });
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  // Query AuditLog entries where this member's phone is in meta.phones
  // Uses PostgreSQL JSONB containment: meta @> '{"phones":["050..."]}'
  type LogRow = {
    id: string;
    userEmail: string | null;
    meta: { message: string; phones: string[]; sent: number; failed: number; total: number } | null;
    createdAt: Date;
  };

  const logs = await prisma.$queryRaw<LogRow[]>`
    SELECT "id", "userEmail", "meta", "createdAt"
    FROM "AuditLog"
    WHERE "action" = 'LOYALTY_SEND_SMS'
      AND "entityId" = ${restaurantId}
      AND "meta" @> jsonb_build_object('phones', jsonb_build_array(${member.phone}::text))
    ORDER BY "createdAt" DESC
    LIMIT 50
  `;

  return NextResponse.json(logs.map(l => ({
    id:       l.id,
    sentAt:   l.createdAt,
    sentBy:   l.userEmail ?? "מערכת",
    message:  (l.meta as { message?: string })?.message ?? "",
    sent:     (l.meta as { sent?: number })?.sent    ?? 0,
    failed:   (l.meta as { failed?: number })?.failed  ?? 0,
    total:    (l.meta as { total?: number })?.total   ?? 0,
  })));
}
