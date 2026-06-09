import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import TableTimelineClient from "./TableTimelineClient";

export default async function TableTimelinePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role as string;
  const allowedRoles = ["SUPER_ADMIN", "ADMIN", "OWNER", "SHIFT_MANAGER"];
  if (!allowedRoles.includes(role)) redirect("/admin");

  // Fetch restaurants this user can access
  let restaurants: { id: string; name: string }[] = [];
  if (role === "SUPER_ADMIN") {
    restaurants = await prisma.restaurant.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  } else {
    const links = await prisma.restaurantUser.findMany({
      where: { userId: session.user.id },
      include: { restaurant: { select: { id: true, name: true } } },
    });
    restaurants = links.map(l => l.restaurant);
  }

  return <TableTimelineClient restaurants={restaurants} />;
}
