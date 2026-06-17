import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { canViewUsers } from "@/lib/permissions";
import UsersClient from "./UsersClient";

export const metadata = { title: "👥 משתמשים | Menu4U" };

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canViewUsers(session.user.role)) redirect("/admin");

  const rawUsers = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      emailVerified: true,
      mustChangePassword: true,
      createdAt: true,
      lastLoginAt: true,
      restaurantUsers: { include: { restaurant: { select: { id: true, name: true } } } },
    },
  });
  const users = rawUsers.map(u => ({ ...u }));

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
