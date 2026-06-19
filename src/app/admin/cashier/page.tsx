import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import CashierClient from "./CashierClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "💳 קופה | Menu4U" };

export default async function CashierPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "DISPLAY") redirect("/admin/dashboard");

  // Ensure all columns exist (some were added without formal migrations)
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "course" INTEGER NOT NULL DEFAULT 1`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "heldUntilFired" BOOLEAN NOT NULL DEFAULT false`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "firedAt" TIMESTAMP(3)`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "doneAt" TIMESTAMP(3)`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "servedAt" TIMESTAMP(3)`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "isComped" BOOLEAN NOT NULL DEFAULT false`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "compReason" TEXT`);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "OrderItemModifier" (
        "id"          TEXT NOT NULL PRIMARY KEY,
        "orderItemId" TEXT NOT NULL,
        "groupName"   TEXT NOT NULL,
        "label"       TEXT NOT NULL,
        "priceAdd"    DOUBLE PRECISION NOT NULL DEFAULT 0,
        CONSTRAINT "OrderItemModifier_orderItemId_fkey"
          FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE
      )
    `);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "loyaltyMemberId" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "loyaltyMemberName" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "loyaltyDiscountType" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "loyaltyDiscountAmount" DOUBLE PRECISION`);
  } catch { /* ignore */ }

  const role = session.user.role;
  const userId = session.user.id;
  const isSuperAdmin = role === "SUPER_ADMIN";

  let restaurantIds: string[] = [];
  if (!isSuperAdmin) {
    const links = await prisma.restaurantUser.findMany({
      where: { userId },
      select: { restaurantId: true },
    });
    restaurantIds = links.map(l => l.restaurantId);
    if (restaurantIds.length === 0 && (role === "WAITER" || role === "BARTENDER")) {
      return (
        <div className="p-8 text-center text-gray-500">
          <div className="text-4xl mb-3">🍽</div>
          <p>לא שויכת לאף מסעדה עדיין.</p>
        </div>
      );
    }
  }

  const [initialOrders, restaurants] = await Promise.all([
    prisma.order.findMany({
      where: {
        ...(isSuperAdmin ? {} : { restaurantId: { in: restaurantIds } }),
        status: { in: ["DELIVERED", "READY"] },
      },
      orderBy: { createdAt: "asc" },
      include: {
        restaurant: { select: { id: true, name: true } },
        items: {
          where: { itemStatus: { not: "CANCELLED" } },
          include: {
            item: { select: { name: true } },
            modifiers: { select: { groupName: true, label: true, priceAdd: true } },
          },
          orderBy: [{ course: "asc" }, { id: "asc" }],
        },
      },
    }),
    isSuperAdmin
      ? prisma.restaurant.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
      : prisma.restaurant.findMany({
          where: { id: { in: restaurantIds } },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
  ]);

  const defaultRestaurantId =
    !isSuperAdmin && restaurantIds.length === 1 ? restaurantIds[0] : null;

  return (
    <CashierClient
      initialOrders={initialOrders as unknown as Parameters<typeof CashierClient>[0]["initialOrders"]}
      restaurants={restaurants}
      isSuperAdmin={isSuperAdmin}
      defaultRestaurantId={defaultRestaurantId}
    />
  );
}
