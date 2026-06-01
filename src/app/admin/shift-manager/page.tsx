import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";

const ShiftManagerClient = dynamic(() => import("./ShiftManagerClient"), { ssr: false });

export default async function ShiftManagerPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  if (role === "DISPLAY" || role === "WAITER") redirect("/admin");

  const restaurants =
    role === "SUPER_ADMIN"
      ? await prisma.restaurant.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
      : await prisma.restaurantUser
          .findMany({ where: { userId: session.user.id }, include: { restaurant: { select: { id: true, name: true } } } })
          .then(rs => rs.map(r => r.restaurant));

  if (restaurants.length === 0) redirect("/admin");

  return (
    <ShiftManagerClient
      restaurants={restaurants}
      managerName={session.user.name ?? session.user.email ?? "מנהל"}
    />
  );
}
