import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import MenusClient from "./MenusClient";

export default async function MenusPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  let restaurants;
  if (session.user.role === "SUPER_ADMIN") {
    restaurants = await prisma.restaurant.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: {
        menus: {
          include: {
            categories: { include: { items: true } },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
  } else {
    const userRestaurants = await prisma.restaurantUser.findMany({
      where: { userId: session.user.id },
      include: {
        restaurant: {
          include: {
            menus: {
              include: { categories: { include: { items: true } } },
              orderBy: { sortOrder: "asc" },
            },
          },
        },
      },
    });
    restaurants = userRestaurants.map((ur) => ur.restaurant);
  }

  return (
    <MenusClient
      restaurants={restaurants}
      canEdit={session.user.role !== "VIEWER"}
    />
  );
}
