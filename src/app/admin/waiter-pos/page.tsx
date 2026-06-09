import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import WaiterPosWrapper from "./WaiterPosWrapper";

export const dynamic = "force-dynamic";

export default async function WaiterPosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "DISPLAY") redirect("/admin");

  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  const restaurants = isSuperAdmin
    ? await prisma.restaurant.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
    : await prisma.restaurantUser.findMany({
        where: { userId: session.user.id },
        include: { restaurant: { select: { id: true, name: true } } },
      }).then(rs => rs.map(r => r.restaurant));

  if (restaurants.length === 0) redirect("/admin");

  return (
    <WaiterPosWrapper
      restaurants={restaurants}
      waiterName={session.user.name ?? session.user.email ?? "מלצר"}
      waiterId={session.user.id}
    />
  );
}
