import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendSmsBulk } from "@/lib/sms";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { restaurantId, message, memberIds } = await req.json();
  if (!restaurantId || !message?.trim())
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  if (message.trim().length > 70)
    return NextResponse.json({ error: "message too long (max 70)" }, { status: 400 });

  if (session.user.role !== "SUPER_ADMIN") {
    const access = await prisma.restaurantUser.findUnique({
      where: { userId_restaurantId: { userId: session.user.id, restaurantId } },
    });
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  type MemberRow = { phone: string };
  const isFiltered = Array.isArray(memberIds) && memberIds.length > 0;
  const members: MemberRow[] = isFiltered
    ? await prisma.$queryRawUnsafe<MemberRow[]>(
        `SELECT "phone" FROM "LoyaltyMember" WHERE "restaurantId" = $1 AND "id" = ANY($2::text[])`,
        restaurantId, memberIds
      )
    : await prisma.$queryRawUnsafe<MemberRow[]>(
        `SELECT "phone" FROM "LoyaltyMember" WHERE "restaurantId" = $1`,
        restaurantId
      );

  if (members.length === 0) return NextResponse.json({ sent: 0, failed: 0 });

  const { sent, failed } = await sendSmsBulk(members.map(m => m.phone), message.trim());

  await prisma.$executeRawUnsafe(
    `INSERT INTO "SmsLog" ("id","restaurantId","message","sentCount","failedCount","sentAt")
     VALUES ($1,$2,$3,$4,$5,NOW())`,
    `log-${Date.now()}`, restaurantId, message.trim(), sent, failed
  );

  return NextResponse.json({ sent, failed, total: members.length });
}
