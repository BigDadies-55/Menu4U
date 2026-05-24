import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { name, phone, email, notes } = await req.json();

  // Verify access
  const rows = await prisma.$queryRaw<{ restaurantId: string }[]>`
    SELECT "restaurantId" FROM "Customer" WHERE id = ${id} LIMIT 1
  `;
  if (!rows[0]) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });

  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  if (!isSuperAdmin) {
    const link = await prisma.restaurantUser.findFirst({ where: { userId: session.user.id, restaurantId: rows[0].restaurantId } });
    if (!link) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.$executeRawUnsafe(
    `UPDATE "Customer" SET name=$1, phone=$2, email=$3, notes=$4, "updatedAt"=NOW() WHERE id=$5`,
    name?.trim() ?? "", phone?.trim() || null, email?.trim() || null, notes?.trim() || null, id
  );
  return NextResponse.json({ success: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const rows = await prisma.$queryRaw<{ restaurantId: string }[]>`
    SELECT "restaurantId" FROM "Customer" WHERE id = ${id} LIMIT 1
  `;
  if (!rows[0]) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });

  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  if (!isSuperAdmin) {
    const link = await prisma.restaurantUser.findFirst({ where: { userId: session.user.id, restaurantId: rows[0].restaurantId } });
    if (!link) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.$executeRawUnsafe(`DELETE FROM "Customer" WHERE id=$1`, id);
  return NextResponse.json({ success: true });
}
