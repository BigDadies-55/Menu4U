import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const { restaurantId } = await params;
  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone");

  if (!phone) return NextResponse.json({ error: "phone required" }, { status: 400 });

  type TopItemRow = { itemId: string; name: string; total: bigint };

  const rows = await prisma.$queryRawUnsafe<TopItemRow[]>(
    `SELECT oi."itemId", i."name", SUM(oi."quantity") as total
     FROM "OrderItem" oi
     JOIN "Order" o ON o."id" = oi."orderId"
     JOIN "Item" i ON i."id" = oi."itemId"
     WHERE o."restaurantId" = $1
       AND o."customerPhone" = $2
       AND o."status" NOT IN ('CANCELLED')
     GROUP BY oi."itemId", i."name"
     ORDER BY total DESC
     LIMIT 5`,
    restaurantId,
    phone
  );

  return NextResponse.json(
    rows.map(r => ({ itemId: r.itemId, name: r.name, total: Number(r.total) }))
  );
}
