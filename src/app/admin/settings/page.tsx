import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SettingsClient from "./SettingsClient";
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role   = session.user.role;
  const userId = session.user.id;

  // Resolve accessible restaurants
  let restaurants;
  if (role === "SUPER_ADMIN") {
    restaurants = await prisma.restaurant.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, logo: true, menuTheme: true,
        menuPalette: true, customDomain: true, copyright: true,
      },
    });
  } else {
    const links = await prisma.restaurantUser.findMany({
      where: { userId },
      select: { restaurantId: true },
    });
    const ids = links.map(l => l.restaurantId);
    restaurants = await prisma.restaurant.findMany({
      where: { id: { in: ids } },
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, logo: true, menuTheme: true,
        menuPalette: true, customDomain: true, copyright: true,
      },
    });
  }

  if (restaurants.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">אין מסעדות לניהול</div>
    );
  }

  return <SettingsClient restaurants={restaurants} isSuperAdmin={role === "SUPER_ADMIN"} />;
}
