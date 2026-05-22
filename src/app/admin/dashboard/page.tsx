import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  const isSuperAdmin = role === "SUPER_ADMIN";

  let restaurantIds: string[] = [];
  if (!isSuperAdmin) {
    const links = await prisma.restaurantUser.findMany({
      where: { userId: session.user.id },
      select: { restaurantId: true },
    });
    restaurantIds = links.map(l => l.restaurantId);
    if (restaurantIds.length === 0) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-950 text-gray-400 text-lg">
          לא שויכת לאף מסעדה עדיין.
        </div>
      );
    }
  }

  const restaurants = isSuperAdmin
    ? await prisma.restaurant.findMany({
        where: { isActive: true, ordersEnabled: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : await prisma.restaurant.findMany({
        where: { id: { in: restaurantIds }, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });

  const defaultRestaurantId = !isSuperAdmin && restaurantIds.length === 1
    ? restaurantIds[0]
    : (restaurants[0]?.id ?? null);

  return (
    <DashboardClient
      restaurants={restaurants}
      defaultRestaurantId={defaultRestaurantId}
      isSuperAdmin={isSuperAdmin}
      canUpdateStatus={["SUPER_ADMIN", "ADMIN", "OWNER", "WAITER", "DISPLAY"].includes(role)}
    />
  );
}
