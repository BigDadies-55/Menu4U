import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import OrdersClient from "./OrdersClient";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "DISPLAY") redirect("/admin/dashboard");

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
    if (restaurantIds.length === 0 && role === "WAITER") {
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
        status: { notIn: ["DELIVERED", "CANCELLED"] },
      },
      orderBy: { createdAt: "asc" },
      include: {
        restaurant: { select: { id: true, name: true } },
        items: { include: { item: { select: { name: true } } } },
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
    <OrdersClient
      initialOrders={initialOrders as unknown as Parameters<typeof OrdersClient>[0]["initialOrders"]}
      restaurants={restaurants}
      isSuperAdmin={isSuperAdmin}
      defaultRestaurantId={defaultRestaurantId}
    />
  );
}
