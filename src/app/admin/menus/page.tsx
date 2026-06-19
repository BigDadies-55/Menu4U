import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import MenusClient from "./MenusClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "🍽 תפריטים | Menu4U" };

const ITEM_SELECT = {
  id: true, name: true, description: true, price: true, image: true,
  isActive: true, isVegetarian: true, isVegan: true, isGlutenFree: true,
  tags: true, prepTime: true, sortOrder: true,
} as const;

const CATEGORY_SELECT = {
  id: true, name: true, image: true, isActive: true, autoReady: true, sortOrder: true,
  items: { select: ITEM_SELECT, orderBy: { sortOrder: "asc" as const } },
} as const;

const MENU_SELECT = {
  id: true, name: true, isActive: true, isPrimary: true,
  scheduleDays: true, scheduleFrom: true, scheduleTo: true,
  categories: { select: CATEGORY_SELECT, orderBy: { sortOrder: "asc" as const } },
} as const;

const RESTAURANT_SELECT = {
  id: true,
  name: true,
  menus: { select: MENU_SELECT, orderBy: { sortOrder: "asc" as const } },
} as const;

export default async function MenusPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "WAITER" || session.user.role === "BARTENDER") redirect("/admin/orders");
  if (session.user.role === "DISPLAY") redirect("/admin/dashboard");

  // Ensure autoReady column exists before querying
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "autoReady" BOOLEAN NOT NULL DEFAULT false`);
  } catch { /* ignore — column already exists */ }

  let restaurants;
  if (session.user.role === "SUPER_ADMIN") {
    restaurants = await prisma.restaurant.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: RESTAURANT_SELECT,
    });
  } else {
    const userRestaurants = await prisma.restaurantUser.findMany({
      where: { userId: session.user.id },
      select: {
        restaurant: { select: RESTAURANT_SELECT },
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
