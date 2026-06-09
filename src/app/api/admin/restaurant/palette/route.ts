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

  const body = await req.json();
  const { restaurantId, palette } = body as { restaurantId?: string; palette?: string };

  if (!restaurantId || !palette) {
    return NextResponse.json({ error: "restaurantId and palette are required" }, { status: 400 });
  }

  if (!Object.keys(ADMIN_PALETTES).includes(palette)) {
    return NextResponse.json({ error: "Invalid palette" }, { status: 400 });
  }

  // SUPER_ADMIN and ADMIN can update any restaurant
  if (!["SUPER_ADMIN", "ADMIN"].includes(role)) {
    const link = await prisma.restaurantUser.findFirst({
      where: { userId: session.user.id, restaurantId },
    });
    if (!link) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { adminPalette: palette },
  });

  return NextResponse.json({ ok: true });
}
