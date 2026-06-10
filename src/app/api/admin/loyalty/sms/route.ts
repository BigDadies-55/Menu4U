import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendSmsBulkPersonalized, SmsConfigError } from "@/lib/sms";
import { getScopeRestaurantIds, checkLoyaltyPermission } from "@/lib/loyalty-scope";
import { logAudit, getIp } from "@/lib/audit";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { restaurantId, message, memberIds } = await req.json();
  if (!restaurantId || !message?.trim()) {
    return NextResponse.json({ error: "restaurantId and message required" }, { status: 400 });
  }
  if (message.trim().length > 160) {
    return NextResponse.json({ error: "message too long (max 160 chars)" }, { status: 400 });
  }

  // Permission check with role-based guard
  const perm = await checkLoyaltyPermission(session.user.id, session.user.role, restaurantId, "sendSms");
  if (!perm.allowed) return NextResponse.json({ error: perm.reason }, { status: 403 });

  const scopeIds = await getScopeRestaurantIds(restaurantId);

  type MemberRow = { id: string; phone: string; name: string; points: number; memberNumber: string };
  const cols = `"id", "phone", "name", "points", "memberNumber"`;
  const isFiltered = Array.isArray(memberIds) && memberIds.length > 0;
  const members: MemberRow[] = isFiltered
    ? await prisma.$queryRawUnsafe<MemberRow[]>(
        `SELECT ${cols} FROM "LoyaltyMember"
         WHERE "restaurantId" = ANY($1::text[]) AND "id" = ANY($2::text[])`,
        scopeIds, memberIds
      )
    : await prisma.$queryRawUnsafe<MemberRow[]>(
        `SELECT ${cols} FROM "LoyaltyMember" WHERE "restaurantId" = ANY($1::text[])`,
        scopeIds
      );

  if (members.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, total: 0 });
  }

  const recipients = members.map(m => ({
    phone: m.phone,
    fields: {
      Name: m.name,
      FirstName: (m.name ?? "").trim().split(/\s+/)[0] ?? "",
      Points: m.points,
      MemberNumber: m.memberNumber,
    },
  }));

  let result: { sent: number; failed: number };
  try {
    result = await sendSmsBulkPersonalized(recipients, message.trim());
  } catch (e) {
    if (e instanceof SmsConfigError) {
      return NextResponse.json(
        { error: "שירות ה-SMS אינו מוגדר בשרת (חסרים פרטי INFORU_USERNAME / INFORU_API_TOKEN)" },
        { status: 503 }
      );
    }
    throw e;
  }

  // Stamp lastSmsSentAt on every recipient member
  await prisma.loyaltyMember.updateMany({
    where: { id: { in: members.map(m => m.id) } },
    data:  { lastSmsSentAt: new Date() },
  });

  await logAudit({
    userId: session.user.id, userEmail: session.user.email,
    action: "LOYALTY_SEND_SMS", entity: "Restaurant", entityId: restaurantId, ip: getIp(req),
    meta: {
      message: message.trim(),
      phones: members.map(m => m.phone),
      memberIds: members.map(m => m.id),
      sent: result.sent,
      failed: result.failed,
      total: members.length,
    },
  });

  return NextResponse.json({ ...result, total: recipients.length });
}
