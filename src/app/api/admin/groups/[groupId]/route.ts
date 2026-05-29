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
  const { name, logo, description } = await req.json();

  await prisma.$executeRawUnsafe(
    `ALTER TABLE "RestaurantGroup" ADD COLUMN IF NOT EXISTS "description" TEXT`
  );

  await prisma.$executeRawUnsafe(
    `UPDATE "RestaurantGroup"
     SET "name" = COALESCE($1, "name"),
         "logo" = COALESCE($2, "logo"),
         "description" = $3
     WHERE "id" = $4`,
    name ?? null, logo ?? null, description ?? null, groupId
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
