import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AppearanceClient from "./AppearanceClient";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["SUPER_ADMIN", "ADMIN", "OWNER", "SHIFT_MANAGER"];

export default async function AppearancePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role as string;
  if (!ALLOWED_ROLES.includes(role)) redirect("/admin");

  let restaurants: { id: string; name: string; adminPalette: string }[] = [];

  if (role === "SUPER_ADMIN" || role === "ADMIN") {
    restaurants = await prisma.restaurant.findMany({
      select: { id: true, name: true, adminPalette: true },
      orderBy: { name: "asc" },
    });
  } else {
    const links = await prisma.restaurantUser.findMany({
      where: { userId: session.user.id },
      include: { restaurant: { select: { id: true, name: true, adminPalette: true } } },
    });
    restaurants = links.map(l => l.restaurant);
  }

  if (restaurants.length === 0) redirect("/admin");

  return <AppearanceClient restaurants={restaurants} canSave />;
}
