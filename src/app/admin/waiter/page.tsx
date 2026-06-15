import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function WaiterPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  if (role === "DISPLAY") redirect("/admin");

  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "waiterScreen" INTEGER`
  ).catch(() => {});

  // Get the first restaurant accessible to this user
  const restaurantId =
    role === "SUPER_ADMIN"
      ? (await prisma.restaurant.findFirst({ orderBy: { name: "asc" }, select: { id: true } }))?.id
      : (await prisma.restaurantUser.findFirst({
          where: { userId: session.user.id },
          include: { restaurant: { select: { id: true } } },
        }))?.restaurant.id;

  if (!restaurantId) redirect("/admin");

  const rows = await prisma.$queryRawUnsafe<Array<{ waiterScreen: number | null }>>(
    `SELECT "waiterScreen" FROM "Restaurant" WHERE id = $1`,
    restaurantId
  ).catch(() => [] as Array<{ waiterScreen: number | null }>);

  const screen = rows[0]?.waiterScreen ?? 2;
  redirect(screen === 1 ? "/admin/waiter-pos" : "/admin/waiter-pos-2");
}
