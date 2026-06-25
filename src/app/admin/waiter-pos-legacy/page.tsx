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

  await Promise.allSettled([
    prisma.$executeRawUnsafe(`ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "waiterBg" TEXT`),
    prisma.$executeRawUnsafe(`ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "waiterBgOpacity" DOUBLE PRECISION`),
  ]);

  const baseRestaurants =
    role === "SUPER_ADMIN"
      ? await prisma.restaurant.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
      : await prisma.restaurantUser
          .findMany({ where: { userId: session.user.id }, include: { restaurant: { select: { id: true, name: true } } } })
          .then(rs => rs.map(r => r.restaurant));

  const bgRows = await prisma.$queryRawUnsafe<Array<{ id: string; waiterBg: string | null; waiterBgOpacity: number | null }>>(
    `SELECT id, "waiterBg", "waiterBgOpacity" FROM "Restaurant" WHERE id = ANY($1::text[])`,
    baseRestaurants.map(r => r.id)
  ).catch(async () => {
    // Column might not exist yet — fall back to query without it
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string; waiterBg: string | null }>>(
      `SELECT id, "waiterBg" FROM "Restaurant" WHERE id = ANY($1::text[])`,
      baseRestaurants.map(r => r.id)
    ).catch(() => [] as Array<{ id: string; waiterBg: string | null }>);
    return rows.map(r => ({ ...r, waiterBgOpacity: null as null }));
  });

  const bgMap = Object.fromEntries(bgRows.map(r => [r.id, r]));
  const restaurants = baseRestaurants.map(r => ({
    ...r,
    waiterBg: bgMap[r.id]?.waiterBg ?? null,
    waiterBgOpacity: bgMap[r.id]?.waiterBgOpacity ?? null,
  }));

  if (restaurants.length === 0) redirect("/admin");

  return (
    <WaiterPosWrapper
      restaurants={restaurants}
      waiterName={session.user.name ?? session.user.email ?? "מלצר"}
      isWaiter={role === "WAITER" || role === "BARTENDER"}
      waiterId={session.user.id}
    />
  );
}
