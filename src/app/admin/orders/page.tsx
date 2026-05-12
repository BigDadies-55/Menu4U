import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatPrice, formatDate } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "ממתין",
  CONFIRMED: "אושר",
  PREPARING: "בהכנה",
  READY: "מוכן",
  DELIVERED: "נמסר",
  CANCELLED: "בוטל",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  PREPARING: "bg-orange-100 text-orange-800",
  READY: "bg-green-100 text-green-800",
  DELIVERED: "bg-gray-100 text-gray-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export default async function OrdersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  let orders;
  if (session.user.role === "SUPER_ADMIN") {
    orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        restaurant: { select: { name: true } },
        items: { include: { item: { select: { name: true } } } },
      },
    });
  } else {
    const userRestaurants = await prisma.restaurantUser.findMany({
      where: { userId: session.user.id },
      select: { restaurantId: true },
    });
    const ids = userRestaurants.map((r) => r.restaurantId);
    orders = await prisma.order.findMany({
      where: { restaurantId: { in: ids } },
      orderBy: { createdAt: "desc" },
      include: {
        restaurant: { select: { name: true } },
        items: { include: { item: { select: { name: true } } } },
      },
    });
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">ניהול הזמנות</h1>
        <p className="text-gray-500 mt-1">{orders.length} הזמנות</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-right">
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">לקוח</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">מסעדה</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">פריטים</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">סכום</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">תאריך</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">סטטוס</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                  אין הזמנות עדיין
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">
                      {order.customerName ?? "אנונימי"}
                    </div>
                    {order.tableNumber && (
                      <div className="text-xs text-gray-400">שולחן {order.tableNumber}</div>
                    )}
                    {order.customerPhone && (
                      <div className="text-xs text-gray-400" dir="ltr">{order.customerPhone}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{order.restaurant.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {order.items.map((oi) => (
                      <div key={oi.id}>
                        {oi.quantity}x {oi.item.name}
                      </div>
                    ))}
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-900">
                    {formatPrice(order.totalAmount)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(order.createdAt)}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[order.status]}`}>
                      {STATUS_LABELS[order.status]}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
