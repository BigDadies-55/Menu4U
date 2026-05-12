import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import RestaurantsClient from "./RestaurantsClient";

export default async function RestaurantsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "SUPER_ADMIN") redirect("/admin");

  const restaurants = await prisma.restaurant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { menus: true, orders: true, restaurantUsers: true } },
    },
  });

  return <RestaurantsClient restaurants={restaurants} />;
}
