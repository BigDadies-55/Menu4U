import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import MyBusinessClient from "./MyBusinessClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "📈 העסק שלי | Menu4U" };

// Owner-level business intelligence. Hidden from operational / read-only roles.
const OWNER_ROLES = ["SUPER_ADMIN", "ADMIN", "OWNER"];

export default async function MyBusinessPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!OWNER_ROLES.includes(session.user.role)) redirect("/admin");

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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontSize: 18, direction: "rtl" }}>
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

  return <MyBusinessClient restaurants={restaurants} />;
}
