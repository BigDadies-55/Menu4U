import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

async function ensureTables() {
  await Promise.allSettled([
    prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "RestaurantGroup" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "logo" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "RestaurantGroup_pkey" PRIMARY KEY ("id")
      )
    `),
    prisma.$executeRawUnsafe(`ALTER TABLE "RestaurantGroup" ADD COLUMN IF NOT EXISTS "description" TEXT`),
    prisma.$executeRawUnsafe(`ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "groupId" TEXT`),
    prisma.$executeRawUnsafe(`ALTER TABLE "LoyaltyMember" ADD COLUMN IF NOT EXISTS "groupId" TEXT`),
    prisma.$executeRawUnsafe(`ALTER TABLE "LoyaltyCoupon" ADD COLUMN IF NOT EXISTS "validForGroupId" TEXT`),
    prisma.$executeRawUnsafe(`ALTER TABLE "LoyaltyCoupon" ADD COLUMN IF NOT EXISTS "usedAtRestaurantId" TEXT`),
  ]);
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ensureTables();

  type GroupRow = { id: string; name: string; logo: string | null; createdAt: Date };
  type RestaurantRow = { id: string; name: string; logo: string | null; groupId: string | null };

  const [groups, restaurants] = await Promise.all([
    prisma.$queryRawUnsafe<GroupRow[]>(`SELECT * FROM "RestaurantGroup" ORDER BY "createdAt" DESC`),
    prisma.$queryRawUnsafe<RestaurantRow[]>(`SELECT id, name, logo, "groupId" FROM "Restaurant" ORDER BY name`),
  ]);

  const enriched = groups.map(g => ({
    ...g,
    restaurants: restaurants.filter(r => r.groupId === g.id),
  }));

  return NextResponse.json({ groups: enriched, allRestaurants: restaurants });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ensureTables();
  await prisma.$executeRawUnsafe(`ALTER TABLE "RestaurantGroup" ADD COLUMN IF NOT EXISTS "businessType" TEXT`).catch(() => {});

  const { name, logo, businessType } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  const id = `grp-${Date.now()}`;
  await prisma.$executeRawUnsafe(
    `INSERT INTO "RestaurantGroup" ("id", "name", "logo", "businessType") VALUES ($1, $2, $3, $4)`,
    id, name.trim(), logo ?? null, businessType ?? null
  );

  return NextResponse.json({ id, name: name.trim(), logo: logo ?? null, businessType: businessType ?? null }, { status: 201 });
}
