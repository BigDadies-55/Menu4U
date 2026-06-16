import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "Missing restaurantId" }, { status: 400 });

  try {
    await Promise.allSettled([
      prisma.$executeRawUnsafe(`ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "waiterBg" TEXT`),
      prisma.$executeRawUnsafe(`ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "waiterBgOpacity" DOUBLE PRECISION`),
      prisma.$executeRawUnsafe(`ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "waiterScreen" INTEGER`),
    ]);

    const rows = await prisma.$queryRawUnsafe<Array<{ waiterBg: string | null; waiterBgOpacity: number | null; waiterScreen: number | null }>>(
      `SELECT "waiterBg", "waiterBgOpacity", "waiterScreen" FROM "Restaurant" WHERE id = $1`,
      restaurantId
    );

    if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const row = rows[0];
    return NextResponse.json({
      waiterBg: row.waiterBg ?? null,
      waiterBgOpacity: row.waiterBgOpacity != null ? Number(row.waiterBgOpacity) : null,
      waiterScreen: row.waiterScreen != null ? Number(row.waiterScreen) : 2,
    });
  } catch {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
