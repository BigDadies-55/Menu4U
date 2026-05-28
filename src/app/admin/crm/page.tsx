import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import CrmClient from "./CrmClient";

export default async function CrmPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isSuperAdmin = session.user.role === "SUPER_ADMIN";

  const userRestaurants = isSuperAdmin
    ? await prisma.restaurant.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
    : await prisma.restaurantUser.findMany({
        where: { userId: session.user.id },
        include: { restaurant: { select: { id: true, name: true } } },
      }).then(rs => rs.map(r => r.restaurant));

  return <CrmClient restaurants={userRestaurants} isSuperAdmin={isSuperAdmin} />;
}
