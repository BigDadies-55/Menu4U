import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import WaiterFloorWrapper from "./WaiterFloorWrapper";
export const dynamic = "force-dynamic";

export default async function WaiterFloorPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  if (role === "DISPLAY") redirect("/admin");

  const restaurants =
    role === "SUPER_ADMIN"
      ? await prisma.restaurant.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
      : await prisma.restaurantUser
          .findMany({ where: { userId: session.user.id }, include: { restaurant: { select: { id: true, name: true } } } })
          .then(rs => rs.map(r => r.restaurant));

  if (restaurants.length === 0) redirect("/admin");

  return (
    <WaiterFloorWrapper
      restaurants={restaurants}
      waiterName={session.user.name ?? session.user.email ?? "מלצר"}
      waiterId={session.user.id}
    />
  );
}
