import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import LayoutClient from "./LayoutClient";

export const dynamic = "force-dynamic";

export default async function LayoutBuilderPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  if (["VIEWER", "WAITER", "EDITOR", "DISPLAY"].includes(role)) redirect("/admin/menus");

  const isSuperAdmin = role === "SUPER_ADMIN";

  const restaurants = isSuperAdmin
    ? await prisma.restaurant.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
    : await (async () => {
        const links = await prisma.restaurantUser.findMany({
          where: { userId: session.user.id },
          select: { restaurantId: true },
        });
        const ids = links.map(l => l.restaurantId);
        return prisma.restaurant.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        });
      })();

  if (restaurants.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>אין מסעדות זמינות.</p>
      </div>
    );
  }

  return <LayoutClient restaurants={restaurants} />;
}
