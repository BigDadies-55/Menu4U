import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ModulesClient from "./ModulesClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "⚙️ מודולים | Menu4U" };

export default async function ModulesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "SUPER_ADMIN") redirect("/admin");

  // Ensure table exists
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
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "RestaurantModule_restaurantId_idx" ON "RestaurantModule"("restaurantId")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "RestaurantModule_moduleKey_idx" ON "RestaurantModule"("moduleKey")`
    );
  } catch { /* ignore — table already exists */ }

  const rows = await prisma.restaurant.findMany({
    where: { isActive: true },
    select: { id: true, name: true, subscriptionFrom: true, subscriptionTo: true },
    orderBy: { name: "asc" },
  });

  const restaurants = rows.map(r => ({
    ...r,
    subscriptionFrom: r.subscriptionFrom ? r.subscriptionFrom.toISOString() : null,
    subscriptionTo:   r.subscriptionTo   ? r.subscriptionTo.toISOString()   : null,
  }));

  return (
    <ModulesClient
      restaurants={restaurants}
    />
  );
}
