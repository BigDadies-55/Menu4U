import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import RestaurantsClient from "./RestaurantsClient";

export const dynamic = "force-dynamic";

export default async function RestaurantsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "SUPER_ADMIN") redirect("/admin");

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
      createdAt: true,
      _count: { select: { menus: true, orders: true, restaurantUsers: true } },
    },
  });

  // Convert Date fields to ISO strings for client component serialization
  const restaurants = rows.map(r => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    subscriptionFrom: r.subscriptionFrom ? r.subscriptionFrom.toISOString() : null,
    subscriptionTo: r.subscriptionTo ? r.subscriptionTo.toISOString() : null,
  }));

  return <RestaurantsClient restaurants={restaurants} />;
}
