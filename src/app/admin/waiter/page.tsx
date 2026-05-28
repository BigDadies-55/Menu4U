import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import WaiterClient from "./WaiterClient";

export default async function WaiterPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isSuperAdmin = session.user.role === "SUPER_ADMIN";

  const restaurants = isSuperAdmin
    ? await prisma.restaurant.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
    : await prisma.restaurantUser.findMany({
        where: { userId: session.user.id },
        include: { restaurant: { select: { id: true, name: true } } },
      }).then(rs => rs.map(r => r.restaurant));

  if (restaurants.length === 0) redirect("/admin");

  return (
    <WaiterClient
      restaurants={restaurants}
      waiterName={session.user.name ?? session.user.email ?? "מלצר"}
    />
  );
}
