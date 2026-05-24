import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ restaurantId: string; itemId: string }> }
) {
  const { restaurantId, itemId } = await params;
  // Verify item belongs to this restaurant
  const item = await prisma.item.findFirst({
    where: { id: itemId, category: { menu: { restaurantId } } },
  });
  if (!item) return NextResponse.json([], { status: 200 });

  const groups = await prisma.itemModifierGroup.findMany({
    where: { itemId },
    include: { options: { orderBy: { order: "asc" } } },
    orderBy: { order: "asc" },
  });
  return NextResponse.json(groups);
}
