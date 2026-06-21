import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AttendanceManagerClient from "./AttendanceManagerClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "נוכחות | Menu4U" };

export default async function AttendanceManagerPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  // OPS: floor staff + managers (waiters/bartenders view their own attendance). No editor/viewer/display.
  if (!["SUPER_ADMIN","ADMIN","OWNER","SHIFT_MANAGER","WAITER","BARTENDER"].includes(role)) redirect("/admin");
  const isSuperAdmin = role === "SUPER_ADMIN";

  let restaurants: { id: string; name: string; openingHours?: string | null }[] = [];

  if (isSuperAdmin) {
    restaurants = await prisma.restaurant.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  } else {
    const links = await prisma.restaurantUser.findMany({
      where: { userId: session.user.id },
      select: { restaurantId: true },
    });
    const ids = links.map((l) => l.restaurantId);
    if (ids.length === 0) {
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            fontSize: 18,
            direction: "rtl",
          }}
        >
          לא שויכת לאף מסעדה עדיין.
        </div>
      );
    }
    restaurants = await prisma.restaurant.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  // Fetch openingHours via raw SQL (column not in Prisma schema)
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "openingHours" TEXT`);
    const ohRows = await prisma.$queryRawUnsafe<{ id: string; openingHours: string | null }[]>(
      `SELECT id, "openingHours" FROM "Restaurant" WHERE id = ANY($1::text[])`,
      restaurants.map(r => r.id)
    );
    const ohMap = Object.fromEntries(ohRows.map(r => [r.id, r.openingHours]));
    restaurants = restaurants.map(r => ({ ...r, openingHours: ohMap[r.id] ?? null }));
  } catch { /* ignore */ }

  const currentUserName =
    session.user.name ?? session.user.email ?? "";

  return (
    <AttendanceManagerClient
      restaurants={restaurants}
      currentUserId={session.user.id}
      currentUserRole={role}
      currentUserName={currentUserName}
    />
  );
}
