import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "RestaurantModule" (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "restaurantId" TEXT,
        "groupId" TEXT,
        "moduleKey" TEXT NOT NULL,
        "isEnabled" BOOLEAN NOT NULL DEFAULT true,
        "enabledFrom" TIMESTAMPTZ,
        "enabledTo" TIMESTAMPTZ,
        "enabledBy" TEXT,
        "note" TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "RestaurantModule_restaurantId_idx" ON "RestaurantModule"("restaurantId")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "RestaurantModule_moduleKey_idx" ON "RestaurantModule"("moduleKey")
    `);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
