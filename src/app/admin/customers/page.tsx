import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CustomersClient from "./CustomersClient";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isSuperAdmin = session.user.role === "SUPER_ADMIN";

  // Get restaurants this user has access to
  let restaurants: { id: string; name: string }[] = [];
  if (isSuperAdmin) {
    restaurants = await prisma.restaurant.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  } else {
    const links = await prisma.restaurantUser.findMany({
      where: { userId: session.user.id },
      include: { restaurant: { select: { id: true, name: true, isActive: true } } },
    });
    restaurants = links
      .filter(l => l.restaurant.isActive)
      .map(l => ({ id: l.restaurant.id, name: l.restaurant.name }));
    if (restaurants.length === 0) redirect("/admin");
  }

  return <CustomersClient restaurants={restaurants} isSuperAdmin={isSuperAdmin} />;
}
