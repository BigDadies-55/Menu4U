import { prisma } from "@/lib/prisma";
import { checkRateLimit, getIpKey } from "@/lib/rateLimit";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const { restaurantId } = await params;
  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone");

  if (!phone) return NextResponse.json({ error: "phone required" }, { status: 400 });

  // Rate limit: 30 per IP per 5 min (called on page load + loyalty member change)
  const ip = getIpKey(req);
  const allowed = await checkRateLimit(`top-items:${ip}:${restaurantId}`, 30, 5 * 60 * 1000);
  if (!allowed) return NextResponse.json([], { status: 429 });

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
