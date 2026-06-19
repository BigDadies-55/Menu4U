import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import KanbanClient from "./KanbanClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "🗂 קנבן מטבח | Menu4U" };

export default async function KitchenKanbanPage() {
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
        <div className="flex items-center justify-center min-h-screen text-slate-400 text-lg" style={{ background: "#0a0a0a" }}>
          לא שויכת לאף מסעדה עדיין.
        </div>
      );
    }
  }

  const restaurants = isSuperAdmin
    ? await prisma.restaurant.findMany({ where: { isActive: true, ordersEnabled: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : await prisma.restaurant.findMany({ where: { id: { in: restaurantIds }, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });

  const defaultRestaurantId = !isSuperAdmin && restaurantIds.length === 1
    ? restaurantIds[0] : (restaurants[0]?.id ?? null);

  return (
    <KanbanClient
      restaurants={restaurants}
      defaultRestaurantId={defaultRestaurantId}
      canUpdate={["SUPER_ADMIN", "ADMIN", "OWNER", "SHIFT_MANAGER", "WAITER", "BARTENDER", "DISPLAY"].includes(role)}
    />
  );
}
