import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// POST — add a restaurant to the group
export async function POST(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { groupId } = await params;
  const { restaurantId } = await req.json();
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  // Set groupId on restaurant
  await prisma.$executeRawUnsafe(
    `UPDATE "Restaurant" SET "groupId" = $1 WHERE "id" = $2`,
    groupId, restaurantId
  );

  // Backfill existing loyalty members of this restaurant so they belong to the group
  await prisma.$executeRawUnsafe(
    `UPDATE "LoyaltyMember" SET "groupId" = $1 WHERE "restaurantId" = $2 AND "groupId" IS NULL`,
    groupId, restaurantId
  );

  return NextResponse.json({ ok: true });
}

// DELETE — remove a restaurant from the group
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { groupId } = await params;
  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  await prisma.$executeRawUnsafe(
    `UPDATE "Restaurant" SET "groupId" = NULL WHERE "id" = $1 AND "groupId" = $2`,
    restaurantId, groupId
  );

  return NextResponse.json({ ok: true });
}
