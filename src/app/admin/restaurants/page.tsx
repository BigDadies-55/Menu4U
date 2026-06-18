import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import RestaurantsClient from "./RestaurantsClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "🏪 מסעדות | Menu4U" };

export default async function RestaurantsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "SUPER_ADMIN") redirect("/admin");

  // Apply pending migrations so new columns exist before querying
  await Promise.allSettled([
    prisma.$executeRawUnsafe(`ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "splashImage" TEXT`),
    prisma.$executeRawUnsafe(`ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "waiterBg" TEXT`),
    prisma.$executeRawUnsafe(`ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "waiterBgOpacity" DOUBLE PRECISION`),
    prisma.$executeRawUnsafe(`ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "autoReady" BOOLEAN NOT NULL DEFAULT false`),
    prisma.$executeRawUnsafe(`ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "instagram" TEXT`),
    prisma.$executeRawUnsafe(`ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "facebook" TEXT`),
    prisma.$executeRawUnsafe(`ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "whatsapp" TEXT`),
    prisma.$executeRawUnsafe(`ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "tripadvisor" TEXT`),
    prisma.$executeRawUnsafe(`ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "googleReview" TEXT`),
    prisma.$executeRawUnsafe(`ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "showPhonePublic" BOOLEAN NOT NULL DEFAULT true`),
    prisma.$executeRawUnsafe(`ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "showAddressPublic" BOOLEAN NOT NULL DEFAULT true`),
    prisma.$executeRawUnsafe(`ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "waiterScreen" INTEGER`),
  ]);

  const rows = await prisma.restaurant.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      logo: true,
      email: true,
      phone: true,
      phone2: true,
      orderPhone: true,
      address: true,
      website: true,
      locationUrl: true,
      isActive: true,
      menuTheme: true,
      menuPalette: true,
      menuPaletteData: true,
      ordersEnabled: true,
      kdsView: true,
      language: true,
      welcomeText: true,
      splashImage: true,
      subscriptionFrom: true,
      subscriptionTo: true,
      instagram: true,
      facebook: true,
      whatsapp: true,
      tripadvisor: true,
      googleReview: true,
      showPhonePublic: true,
      showAddressPublic: true,
      groupId: true,
      createdAt: true,
      _count: { select: { menus: true, orders: true, restaurantUsers: true } },
    },
  });

  const bgRows = await prisma.$queryRawUnsafe<Array<{ id: string; waiterBg: string | null; waiterBgOpacity: number | null; waiterScreen: number | null; openingHours: string | null }>>(
    `SELECT id, "waiterBg", "waiterBgOpacity", "waiterScreen", "openingHours" FROM "Restaurant"`
  ).catch(() => [] as Array<{ id: string; waiterBg: string | null; waiterBgOpacity: number | null; waiterScreen: number | null; openingHours: string | null }>);
  const bgMap = Object.fromEntries(bgRows.map(r => [r.id, { waiterBg: r.waiterBg, waiterBgOpacity: r.waiterBgOpacity, waiterScreen: r.waiterScreen, openingHours: r.openingHours }]));

  // Convert Date fields to ISO strings for client component serialization
  const restaurants = rows.map(r => ({
    ...r,
    waiterBg: bgMap[r.id]?.waiterBg ?? null,
    waiterBgOpacity: bgMap[r.id]?.waiterBgOpacity ?? null,
    waiterScreen: bgMap[r.id]?.waiterScreen ?? null,
    openingHours: bgMap[r.id]?.openingHours ?? null,
    createdAt: r.createdAt.toISOString(),
    subscriptionFrom: r.subscriptionFrom ? r.subscriptionFrom.toISOString() : null,
    subscriptionTo: r.subscriptionTo ? r.subscriptionTo.toISOString() : null,
  }));

  const groupRows = await prisma.$queryRawUnsafe<Array<{ id: string; name: string; description: string | null; logo: string | null }>>(
    `SELECT id, name, NULL::text AS description, logo FROM "RestaurantGroup" ORDER BY name`
  ).catch(() => [] as Array<{ id: string; name: string; description: string | null; logo: string | null }>);

  return <RestaurantsClient restaurants={restaurants} groups={groupRows} role={session.user.role} />;
}
