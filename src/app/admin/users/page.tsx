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
      name: true,
      email: true,
      role: true,
      emailVerified: true,
      mustChangePassword: true,
      createdAt: true,
      lastLoginAt: true,
      restaurantUsers: { include: { restaurant: { select: { id: true, name: true } } } },
    },
  });
  // phone column may not exist in older DBs — fail-safe
  let phoneMap: Record<string, string | null> = {};
  try {
    const phones = await prisma.$queryRawUnsafe<{ id: string; phone: string | null }[]>(
      `SELECT id, phone FROM "User"`
    );
    phoneMap = Object.fromEntries(phones.map(p => [p.id, p.phone]));
  } catch { /* column doesn't exist yet */ }
  const users = rawUsers.map(u => ({ ...u, phone: phoneMap[u.id] ?? null }));

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
