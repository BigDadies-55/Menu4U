import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LoyaltyClient from "./LoyaltyClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "⭐ מועדון לקוחות | Menu4U" };

export default async function LoyaltyPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isSuperAdmin = session.user.role === "SUPER_ADMIN";

  // Ensure loyalty tables exist
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "LoyaltyMember" (
        "id" TEXT PRIMARY KEY,
        "restaurantId" TEXT NOT NULL,
        "phone" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "email" TEXT,
        "birthDate" TIMESTAMP,
        "memberNumber" TEXT NOT NULL,
        "points" INTEGER NOT NULL DEFAULT 0,
        "totalSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE("restaurantId", "phone"),
        UNIQUE("restaurantId", "memberNumber")
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "LoyaltyTransaction" (
        "id" TEXT PRIMARY KEY,
        "memberId" TEXT NOT NULL,
        "orderId" TEXT,
        "type" TEXT NOT NULL,
        "points" INTEGER NOT NULL,
        "note" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "LoyaltyCoupon" (
        "id" TEXT PRIMARY KEY,
        "memberId" TEXT NOT NULL,
        "restaurantId" TEXT NOT NULL,
        "code" TEXT NOT NULL UNIQUE,
        "type" TEXT NOT NULL,
        "value" DOUBLE PRECISION NOT NULL,
        "description" TEXT,
        "usedAt" TIMESTAMP,
        "expiresAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "LoyaltySettings" (
        "restaurantId" TEXT PRIMARY KEY,
        "pointsPerShekel" DOUBLE PRECISION NOT NULL DEFAULT 1,
        "shekelPerPoint" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
        "minRedeemPoints" INTEGER NOT NULL DEFAULT 100,
        "welcomeBonus" INTEGER NOT NULL DEFAULT 50,
        "birthdayBonus" INTEGER NOT NULL DEFAULT 100,
        "isActive" BOOLEAN NOT NULL DEFAULT true
      )
    `);
  } catch { /* tables already exist */ }

  // Get restaurants this user has access to
  let restaurants: { id: string; name: string }[] = [];
  if (isSuperAdmin) {
    restaurants = await prisma.restaurant.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  } else {
    const links = await prisma.restaurantUser.findMany({
      where: { userId: session.user.id },
      include: { restaurant: { select: { id: true, name: true, isActive: true } } },
    });
    restaurants = links
      .filter(l => l.restaurant.isActive)
      .map(l => ({ id: l.restaurant.id, name: l.restaurant.name }));
    if (restaurants.length === 0) redirect("/admin");
  }

  return <LoyaltyClient restaurants={restaurants} isSuperAdmin={isSuperAdmin} />;
}
