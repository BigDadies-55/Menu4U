import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope"); // "all" (super admin) or single restaurantId

  type RestaurantRow = { id: string; name: string };
  type StatsRow = {
    restaurantId: string;
    totalSent: bigint;
    totalFailed: bigint;
    sendCount: bigint;
  };

  let restaurants: RestaurantRow[];

  if (session.user.role === "SUPER_ADMIN" && scope === "all") {
    restaurants = await prisma.$queryRawUnsafe<RestaurantRow[]>(
      `SELECT id, name FROM "Restaurant" ORDER BY name ASC`
    );
  } else {
    const restaurantId = scope;
    if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

    if (session.user.role !== "SUPER_ADMIN") {
      const access = await prisma.restaurantUser.findUnique({
        where: { userId_restaurantId: { userId: session.user.id, restaurantId } },
      });
      if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    restaurants = await prisma.$queryRawUnsafe<RestaurantRow[]>(
      `SELECT id, name FROM "Restaurant" WHERE id = $1`, restaurantId
    );
  }

  const restaurantIds = restaurants.map(r => r.id);
  if (restaurantIds.length === 0) return NextResponse.json({ restaurants: [], totals: { sent: 0, failed: 0, sends: 0 } });

  const statsRows = await prisma.$queryRawUnsafe<StatsRow[]>(
    `SELECT "restaurantId",
            SUM("sentCount")   AS "totalSent",
            SUM("failedCount") AS "totalFailed",
            COUNT(*)           AS "sendCount"
     FROM "SmsLog"
     WHERE "restaurantId" = ANY($1::text[])
     GROUP BY "restaurantId"`,
    restaurantIds
  );

  const statsMap = new Map(statsRows.map(r => [r.restaurantId, r]));

  const result = restaurants.map(r => {
    const s = statsMap.get(r.id);
    return {
      restaurantId: r.id,
      name: r.name,
      totalSent: s ? Number(s.totalSent) : 0,
      totalFailed: s ? Number(s.totalFailed) : 0,
      sendCount: s ? Number(s.sendCount) : 0,
    };
  });

  const totals = {
    sent: result.reduce((sum, r) => sum + r.totalSent, 0),
    failed: result.reduce((sum, r) => sum + r.totalFailed, 0),
    sends: result.reduce((sum, r) => sum + r.sendCount, 0),
  };

  return NextResponse.json({ restaurants: result, totals });
}
