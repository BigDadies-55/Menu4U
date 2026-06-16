import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const MANAGER_ROLES = ["SUPER_ADMIN", "ADMIN", "OWNER", "SHIFT_MANAGER"];

// DELETE /api/admin/shifts/[id]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!MANAGER_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Fetch shift to verify it belongs to the user's restaurant
  const shifts = await prisma.$queryRawUnsafe<{ id: string; restaurantId: string }[]>(
    `SELECT id, "restaurantId" FROM "Shift" WHERE id = $1 LIMIT 1`,
    id
  );

  if (!shifts || shifts.length === 0) {
    return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  }

  const shift = shifts[0];

  // SUPER_ADMIN can delete any shift; others must belong to the restaurant
  if (session.user.role !== "SUPER_ADMIN") {
    const membership = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "RestaurantUser" WHERE "restaurantId" = $1 AND "userId" = $2 LIMIT 1`,
      shift.restaurantId,
      session.user.id
    );
    if (!membership || membership.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  await prisma.$executeRawUnsafe(`DELETE FROM "Shift" WHERE id = $1`, id);

  return NextResponse.json({ ok: true });
}

// PATCH /api/admin/shifts/[id]
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!MANAGER_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { status, notes } = body as { status?: string; notes?: string };

  if (status === undefined && notes === undefined) {
    return NextResponse.json(
      { error: "At least one of status or notes must be provided" },
      { status: 400 }
    );
  }

  // Fetch shift to verify restaurant membership
  const shifts = await prisma.$queryRawUnsafe<{ id: string; restaurantId: string }[]>(
    `SELECT id, "restaurantId" FROM "Shift" WHERE id = $1 LIMIT 1`,
    id
  );

  if (!shifts || shifts.length === 0) {
    return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  }

  const shift = shifts[0];

  if (session.user.role !== "SUPER_ADMIN") {
    const membership = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "RestaurantUser" WHERE "restaurantId" = $1 AND "userId" = $2 LIMIT 1`,
      shift.restaurantId,
      session.user.id
    );
    if (!membership || membership.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Build dynamic SET clause
  const setClauses: string[] = [`"updatedAt" = NOW()`];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (status !== undefined) {
    setClauses.push(`status = $${paramIdx++}`);
    values.push(status);
  }
  if (notes !== undefined) {
    setClauses.push(`notes = $${paramIdx++}`);
    values.push(notes);
  }

  values.push(id); // for WHERE clause
  const whereIdx = paramIdx;

  await prisma.$executeRawUnsafe(
    `UPDATE "Shift" SET ${setClauses.join(", ")} WHERE id = $${whereIdx}`,
    ...values
  );

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT s.*, u.name AS "userName", u.email AS "userEmail"
     FROM "Shift" s
     LEFT JOIN "User" u ON u.id = s."userId"
     WHERE s.id = $1`,
    id
  );

  return NextResponse.json(rows[0]);
}
