import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/permissions";
import UsersClient from "./UsersClient";

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isAdmin(session.user.role)) redirect("/admin");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      restaurantUsers: { include: { restaurant: { select: { id: true, name: true } } } },
    },
  });

  const restaurants = await prisma.restaurant.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <UsersClient
      users={users}
      restaurants={restaurants}
      currentUserRole={session.user.role}
    />
  );
}
