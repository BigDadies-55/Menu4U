import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import PageShell from "@/components/admin/PageShell";
import InsightRulesClient from "./InsightRulesClient";
export const dynamic = "force-dynamic";

export default async function InsightRulesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { role, id: userId } = session.user;
  if (role === "WAITER" || role === "DISPLAY") redirect("/admin");

  let restaurants: { id: string; name: string }[];
  if (role === "SUPER_ADMIN") {
    restaurants = await prisma.restaurant.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  } else {
    const links = await prisma.restaurantUser.findMany({ where: { userId }, select: { restaurantId: true } });
    restaurants = await prisma.restaurant.findMany({
      where: { id: { in: links.map(l => l.restaurantId) } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  }

  return (
    <PageShell>
      <InsightRulesClient restaurants={restaurants} isSuperAdmin={role === "SUPER_ADMIN"} />
    </PageShell>
  );
}
