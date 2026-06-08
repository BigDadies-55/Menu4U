import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendSmsBulk } from "@/lib/sms";
import { NextResponse } from "next/server";
import { logAudit, getIp } from "@/lib/audit";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { restaurantId, message, memberIds } = await req.json();
  if (!restaurantId || !message?.trim()) {
    return NextResponse.json({ error: "restaurantId and message required" }, { status: 400 });
  }
  if (message.trim().length > 70) {
    return NextResponse.json({ error: "message too long (max 70 chars)" }, { status: 400 });
  }

  // Verify access
  if (session.user.role !== "SUPER_ADMIN") {
    const access = await prisma.restaurantUser.findUnique({
      where: { userId_restaurantId: { userId: session.user.id, restaurantId } },
    });
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch members — specific list or all (include id so we can store memberIds in log)
  type MemberRow = { id: string; phone: string };
  const isFiltered = Array.isArray(memberIds) && memberIds.length > 0;
  const members: MemberRow[] = isFiltered
    ? await prisma.$queryRawUnsafe<MemberRow[]>(
        `SELECT "id", "phone" FROM "LoyaltyMember"
         WHERE "restaurantId" = $1 AND "id" = ANY($2::text[])`,
        restaurantId, memberIds
      )
    : await prisma.$queryRawUnsafe<MemberRow[]>(
        `SELECT "id", "phone" FROM "LoyaltyMember" WHERE "restaurantId" = $1`,
        restaurantId
      );

  if (members.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, total: 0 });
  }

  const phones = members.map(m => m.phone);
  const result = await sendSmsBulk(phones, message.trim());

  // Stamp lastSmsSentAt on all targeted members
  const now = new Date();
  await prisma.loyaltyMember.updateMany({
    where: { id: { in: members.map(m => m.id) } },
    data:  { lastSmsSentAt: now },
  });

  // Audit log with full details for SMS history per member
  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email,
    action: "LOYALTY_SEND_SMS",
    entity: "restaurant",
    entityId: restaurantId,
    meta: {
      message: message.trim(),
      phones,
      memberIds: members.map(m => m.id),
      sent: result.sent,
      failed: result.failed,
      total: phones.length,
    },
    ip: getIp(req),
  });

  return NextResponse.json({ ...result, total: phones.length });
}
