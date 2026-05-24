import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import RestaurantsClient from "./RestaurantsClient";

export const dynamic = "force-dynamic";

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

  // Serialize Date fields — Next.js RSC requires plain JSON-serializable props for client components
  const serialized = restaurants.map(r => ({
    ...r,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
    subscriptionFrom: r.subscriptionFrom instanceof Date ? r.subscriptionFrom.toISOString() : r.subscriptionFrom,
    subscriptionTo: r.subscriptionTo instanceof Date ? r.subscriptionTo.toISOString() : r.subscriptionTo,
  }));

  return <RestaurantsClient restaurants={serialized as Parameters<typeof RestaurantsClient>[0]["restaurants"]} />;
}
