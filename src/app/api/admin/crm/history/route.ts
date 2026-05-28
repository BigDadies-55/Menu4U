import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  if (session.user.role !== "SUPER_ADMIN") {
    const access = await prisma.restaurantUser.findUnique({
      where: { userId_restaurantId: { userId: session.user.id, restaurantId } },
    });
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  type LogRow = {
    id: string; restaurantId: string; campaignId: string | null;
    campaignName: string | null; message: string;
    sentCount: number; failedCount: number; sentAt: Date;
  };
  const logs = await prisma.$queryRawUnsafe<LogRow[]>(
    `SELECT * FROM "SmsLog" WHERE "restaurantId" = $1 ORDER BY "sentAt" DESC LIMIT 100`,
    restaurantId
  );

  return NextResponse.json(logs);
}
