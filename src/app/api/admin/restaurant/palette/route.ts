import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ADMIN_PALETTES } from "@/lib/ui";

const ALLOWED_ROLES = ["SUPER_ADMIN", "ADMIN", "OWNER", "SHIFT_MANAGER"];

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role as string;
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { restaurantId?: string; palette?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { restaurantId, palette } = body;

  if (!restaurantId || !palette) {
    return NextResponse.json({ error: "restaurantId and palette are required" }, { status: 400 });
  }

  if (!Object.keys(ADMIN_PALETTES).includes(palette)) {
    return NextResponse.json({ error: "Invalid palette" }, { status: 400 });
  }

  // OWNER / SHIFT_MANAGER: verify they belong to this restaurant
  if (!["SUPER_ADMIN", "ADMIN"].includes(role)) {
    const link = await prisma.restaurantUser.findFirst({
      where: { userId: session.user.id, restaurantId },
    });
    if (!link) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Use raw SQL so we degrade gracefully if the column doesn't exist yet
    await prisma.$executeRaw`
      ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "adminPalette" TEXT NOT NULL DEFAULT 'dark'
    `;
    await prisma.$executeRaw`
      UPDATE "Restaurant" SET "adminPalette" = ${palette} WHERE id = ${restaurantId}
    `;
  } catch (err) {
    console.error("[palette] update failed", err);
    return NextResponse.json({ error: "שגיאה בשמירה" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
