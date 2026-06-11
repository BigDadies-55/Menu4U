import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ShiftsClient from "./ShiftsClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "📅 ניהול משמרות | Menu4U" };

export default async function ShiftsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  const isSuperAdmin = role === "SUPER_ADMIN";

  let restaurants: { id: string; name: string }[] = [];

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

  const currentUserName =
    session.user.name ?? session.user.email ?? "";

  return (
    <ShiftsClient
      restaurants={restaurants}
      currentUserId={session.user.id}
      currentUserRole={role}
      currentUserName={currentUserName}
    />
  );
}
