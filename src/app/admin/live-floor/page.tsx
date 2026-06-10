import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import LiveFloorClient from "./LiveFloorClient";

export const dynamic = "force-dynamic";

export default async function LiveFloorPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role as string;
  if (!["SUPER_ADMIN", "ADMIN", "OWNER", "SHIFT_MANAGER"].includes(role)) {
    redirect("/admin");
  }

  const restaurants =
    role === "SUPER_ADMIN" || role === "ADMIN"
      ? await prisma.restaurant.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
      : await prisma.restaurantUser
          .findMany({ where: { userId: session.user.id }, include: { restaurant: { select: { id: true, name: true } } } })
          .then(rs => rs.map(r => r.restaurant));

  if (restaurants.length === 0) redirect("/admin");

  return <LiveFloorClient restaurants={restaurants} />;
}
