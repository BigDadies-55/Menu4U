import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import WaiterPosWrapper from "./WaiterPosWrapper";

export const dynamic = "force-dynamic";

export default async function WaiterPosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  if (role === "DISPLAY") redirect("/admin");

  await prisma.$executeRawUnsafe(`ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "waiterBg" TEXT`).catch(() => {});

  const baseRestaurants =
    role === "SUPER_ADMIN"
      ? await prisma.restaurant.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
      : await prisma.restaurantUser
          .findMany({ where: { userId: session.user.id }, include: { restaurant: { select: { id: true, name: true } } } })
          .then(rs => rs.map(r => r.restaurant));

  const bgRows = await prisma.$queryRawUnsafe<Array<{ id: string; waiterBg: string | null }>>(
    `SELECT id, "waiterBg" FROM "Restaurant" WHERE id = ANY($1::text[])`,
    baseRestaurants.map(r => r.id)
  ).catch(() => [] as Array<{ id: string; waiterBg: string | null }>);

  const bgMap = Object.fromEntries(bgRows.map(r => [r.id, r.waiterBg]));
  const restaurants = baseRestaurants.map(r => ({ ...r, waiterBg: bgMap[r.id] ?? null }));

  if (restaurants.length === 0) redirect("/admin");

  return (
    <WaiterPosWrapper
      restaurants={restaurants}
      waiterName={session.user.name ?? session.user.email ?? "מלצר"}
      isWaiter={role === "WAITER"}
    />
  );
}
