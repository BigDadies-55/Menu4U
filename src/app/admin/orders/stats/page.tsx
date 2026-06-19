import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import StatsClient from "./StatsClient";

export const dynamic = "force-dynamic";

export default async function OrderStatsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (["DISPLAY", "WAITER", "BARTENDER", "EDITOR", "VIEWER"].includes(session.user.role)) redirect("/admin/orders");

  const role = session.user.role;
  const isSuperAdmin = role === "SUPER_ADMIN";

  const restaurants = isSuperAdmin
    ? await prisma.restaurant.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
    : await (async () => {
        const links = await prisma.restaurantUser.findMany({
          where: { userId: session.user.id },
          select: { restaurantId: true },
        });
        return prisma.restaurant.findMany({
          where: { id: { in: links.map(l => l.restaurantId) } },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        });
      })();

  return <StatsClient restaurants={restaurants} isSuperAdmin={isSuperAdmin} />;
}
