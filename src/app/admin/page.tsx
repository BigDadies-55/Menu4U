import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import DashboardExtra from "./DashboardExtra";
import PageShell from "@/components/admin/PageShell";
export const dynamic = "force-dynamic";

async function getStats(userId: string, role: string) {
  if (role === "SUPER_ADMIN") {
    const restaurantDetails = await prisma.restaurant.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { menus: true } } },
    });
    return { restaurantDetails };
  }

  const userRestaurants = await prisma.restaurantUser.findMany({
    where: { userId },
    select: { restaurantId: true },
  });
  const restaurantIds = userRestaurants.map(r => r.restaurantId);
  const restaurantDetails = await prisma.restaurant.findMany({
    where: { id: { in: restaurantIds } },
    select: { id: true, name: true, _count: { select: { menus: true } } },
  });

  return { restaurantDetails };
}

export default async function AdminDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  if (role === "WAITER" || role === "BARTENDER")  redirect("/admin/waiter-pos");
  if (role === "DISPLAY") redirect("/admin/kds");

  const stats = await getStats(session.user.id, session.user.role);

  return (
    <PageShell>
      <DashboardExtra
        isSuperAdmin={session.user.role === "SUPER_ADMIN"}
        restaurants={(stats.restaurantDetails ?? []).map(r => ({ id: r.id, name: r.name }))}
      />
    </PageShell>
  );
}
