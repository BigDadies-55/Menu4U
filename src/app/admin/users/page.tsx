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
  // employeeNo is a raw column (not in the Prisma schema) — fetch and merge it.
  let empMap: Record<string, string | null> = {};
  try {
    const empRows = await prisma.$queryRawUnsafe<{ id: string; employeeNo: string | null }[]>(
      `SELECT id, "employeeNo" FROM "User"`
    );
    empMap = Object.fromEntries(empRows.map(r => [r.id, r.employeeNo]));
  } catch { /* column may not exist before migration */ }
  const users = rawUsers.map(u => ({ ...u, employeeNo: empMap[u.id] ?? null }));

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
