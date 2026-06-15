import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { groupId } = await params;
  const { name, logo, description, businessType } = await req.json();

  await Promise.allSettled([
    prisma.$executeRawUnsafe(`ALTER TABLE "RestaurantGroup" ADD COLUMN IF NOT EXISTS "description" TEXT`),
    prisma.$executeRawUnsafe(`ALTER TABLE "RestaurantGroup" ADD COLUMN IF NOT EXISTS "businessType" TEXT`),
  ]);

  await prisma.$executeRawUnsafe(
    `UPDATE "RestaurantGroup"
     SET "name" = COALESCE($1, "name"),
         "logo" = COALESCE($2, "logo"),
         "description" = $3,
         "businessType" = $4
     WHERE "id" = $5`,
    name ?? null, logo ?? null, description ?? null, businessType ?? null, groupId
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { groupId } = await params;

  // Detach all restaurants from the group before deleting
  await prisma.$executeRawUnsafe(
    `UPDATE "Restaurant" SET "groupId" = NULL WHERE "groupId" = $1`,
    groupId
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM "RestaurantGroup" WHERE "id" = $1`,
    groupId
  );

  return NextResponse.json({ ok: true });
}
