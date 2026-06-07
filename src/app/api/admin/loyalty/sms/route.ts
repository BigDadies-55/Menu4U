import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendSmsBulk, SmsConfigError } from "@/lib/sms";
import { NextResponse } from "next/server";

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

  // Fetch members — specific list or all
  type MemberRow = { phone: string };
  const isFiltered = Array.isArray(memberIds) && memberIds.length > 0;
  const members: MemberRow[] = isFiltered
    ? await prisma.$queryRawUnsafe<MemberRow[]>(
        `SELECT "phone" FROM "LoyaltyMember"
         WHERE "restaurantId" = $1 AND "id" = ANY($2::text[])`,
        restaurantId, memberIds
      )
    : await prisma.$queryRawUnsafe<MemberRow[]>(
        `SELECT "phone" FROM "LoyaltyMember" WHERE "restaurantId" = $1`,
        restaurantId
      );

  if (members.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, total: 0 });
  }

  const phones = members.map(m => m.phone);
  try {
    const result = await sendSmsBulk(phones, message.trim());
    return NextResponse.json({ ...result, total: phones.length });
  } catch (e) {
    if (e instanceof SmsConfigError) {
      return NextResponse.json(
        { error: "שירות ה-SMS אינו מוגדר בשרת (חסרים פרטי INFORU_USERNAME / INFORU_API_TOKEN)" },
        { status: 503 }
      );
    }
    throw e;
  }
}
