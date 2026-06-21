import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { isOwner } from "@/lib/permissions";
import { ensureStationsForRestaurant } from "@/lib/kitchen-stations";
import KitchenManagementClient from "./KitchenManagementClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "🍳 ניהול מטבח | Menu4U" };

export default async function KitchenManagementPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isOwner(session.user.role)) redirect("/admin");

  let restaurants: { id: string; name: string }[];
  if (session.user.role === "SUPER_ADMIN") {
    restaurants = await prisma.restaurant.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  } else {
    const links = await prisma.restaurantUser.findMany({
      where: { userId: session.user.id },
      select: { restaurant: { select: { id: true, name: true } } },
    });
    restaurants = links.map(l => l.restaurant);
  }

  // Seed default stations + backfill for each restaurant
  await Promise.allSettled(restaurants.map(r => ensureStationsForRestaurant(r.id)));

  const stations = await prisma.kitchenStation.findMany({
    where: { restaurantId: { in: restaurants.map(r => r.id) } },
    orderBy: { sortOrder: "asc" },
  });

  // attach assigned-category counts so the client can block deletes early
  const counts = await prisma.category.groupBy({
    by: ["kitchenStationId"],
    where: { kitchenStationId: { in: stations.map(s => s.id) } },
    _count: { _all: true },
  });
  const countMap = Object.fromEntries(counts.map(c => [c.kitchenStationId, c._count._all]));

  const initialStations = stations.map(s => ({
    id: s.id,
    restaurantId: s.restaurantId,
    code: s.code,
    label: s.label,
    isActive: s.isActive,
    skipKitchen: s.skipKitchen,
    sortOrder: s.sortOrder,
    categoryCount: countMap[s.id] ?? 0,
  }));

  return <KitchenManagementClient restaurants={restaurants} initialStations={initialStations} />;
}
