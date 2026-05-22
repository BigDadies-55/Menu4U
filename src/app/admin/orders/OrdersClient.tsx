"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type OrderItem = {
  id: string;
  quantity: number;
  price: number;
  notes: string | null;
  item: { name: string };
};

type Order = {
  id: string;
  restaurantId: string;
  tableNumber: string | null;
  customerName: string | null;
  customerPhone: string | null;
  status: string;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
  restaurant: { name: string };
  items: OrderItem[];
};

type Restaurant = { id: string; name: string };

const STATUS_LABELS: Record<string, string> = {
  PENDING: "ממתין",
  CONFIRMED: "אושר",
  PREPARING: "בהכנה",
  READY: "מוכן",
  DELIVERED: "נמסר",
  CANCELLED: "בוטל",
};

const STATUS_BG: Record<string, string> = {
  PENDING: "bg-yellow-50 border-yellow-200",
  CONFIRMED: "bg-blue-50 border-blue-200",
  PREPARING: "bg-amber-50 border-amber-200",
  READY: "bg-green-50 border-green-200",
  DELIVERED: "bg-gray-50 border-gray-200",
  CANCELLED: "bg-red-50 border-red-200",
};

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  PREPARING: "bg-amber-100 text-amber-800",
  READY: "bg-green-100 text-green-800",
  DELIVERED: "bg-gray-100 text-gray-800",
  CANCELLED: "bg-red-100 text-red-800",
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: "#f59e0b",
  CONFIRMED: "#38bdf8",
  PREPARING: "#fb923c",
  READY: "#4ade80",
  DELIVERED: "#9ca3af",
  CANCELLED: "#f87171",
};

const NEXT_STATUS: Record<string, string | undefined> = {
  PENDING: "CONFIRMED",
  CONFIRMED: "PREPARING",
  PREPARING: "READY",
  READY: "DELIVERED",
};

const NEXT_LABEL: Record<string, string> = {
  PENDING: "אשר",
  CONFIRMED: "להכנה",
  PREPARING: "מוכן",
  READY: "נמסר ✓",
};

const STATUS_ICON: Record<string, string> = {
  PENDING: "🕐",
  CONFIRMED: "✓",
  PREPARING: "👨‍🍳",
  READY: "🔔",
  DELIVERED: "✅",
  CANCELLED: "✕",
};

function timeSince(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return "עכשיו";
  if (diff < 60) return `${diff} דק'`;
  return `${Math.floor(diff / 60)}ש'`;
}

function ItemCard({
  orderItem,
  order,
  isSuperAdmin,
  onStatusChange,
}: {
  orderItem: OrderItem;
  order: Order;
  isSuperAdmin: boolean;
  onStatusChange: (id: string, status: string) => Promise<void>;
}) {
  const [updating, setUpdating] = useState(false);
  const nextStatus = NEXT_STATUS[order.status];
  const elapsed = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);
  const isUrgent = elapsed > 20 && !["DELIVERED", "CANCELLED", "READY"].includes(order.status);
  const accent = STATUS_COLOR[order.status] ?? "#9ca3af";

  async function advance() {
    if (!nextStatus) return;
    setUpdating(true);
    await onStatusChange(order.id, nextStatus);
    setUpdating(false);
  }

  async function cancel() {
    if (!confirm("לבטל הזמנה זו?")) return;
    setUpdating(true);
    await onStatusChange(order.id, "CANCELLED");
    setUpdating(false);
  }

  return (
    <div
      className={`rounded-2xl border flex flex-col transition-all ${STATUS_BG[order.status]}`}
      style={{
        borderColor: isUrgent ? "#ef4444" : undefined,
        boxShadow: isUrgent ? "0 0 0 2px #ef444422" : undefined,
      }}
    >
      {/* Status color strip */}
      <div className="h-1.5 rounded-t-2xl" style={{ background: accent }} />

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Item name + price */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {orderItem.quantity > 1 && (
              <span
                className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-black text-white shrink-0"
                style={{ background: accent }}
              >
                {orderItem.quantity}
              </span>
            )}
            <span className="font-bold text-gray-900 text-base leading-tight">
              {orderItem.item.name}
            </span>
          </div>
          <span className="text-sm font-semibold text-gray-500 shrink-0">
            ₪{(orderItem.price * orderItem.quantity).toFixed(0)}
          </span>
        </div>

        {orderItem.notes && (
          <div className="text-xs text-gray-500 italic bg-white/60 rounded-lg px-2.5 py-1.5">
            💬 {orderItem.notes}
          </div>
        )}

        {/* Order context */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-white/70 border border-gray-200 rounded-lg px-2 py-1">
            <span className="text-xs text-gray-400">שולחן</span>
            <span className="font-bold text-amber-700 text-sm">{order.tableNumber ?? "–"}</span>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_BADGE[order.status]}`}>
            {STATUS_ICON[order.status]} {STATUS_LABELS[order.status]}
          </span>
          <span className={`text-xs font-medium mr-auto ${isUrgent ? "text-red-500 animate-pulse" : "text-gray-400"}`}>
            ⏱ {timeSince(order.createdAt)}
          </span>
        </div>

        {isSuperAdmin && (
          <div className="text-xs text-gray-400">{order.restaurant.name}</div>
        )}

        {order.notes && (
          <div className="text-xs text-gray-400 italic">📋 {order.notes}</div>
        )}
      </div>

      {/* Actions */}
      {order.status !== "DELIVERED" && order.status !== "CANCELLED" && nextStatus && (
        <div className="px-4 pb-4 flex gap-2">
          <button
            onClick={advance}
            disabled={updating}
            className="flex-1 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
            style={{ background: "linear-gradient(135deg,#8B6914,#C9A84C)" }}
          >
            {updating ? "..." : `✓ ${NEXT_LABEL[order.status]}`}
          </button>
          <button
            onClick={cancel}
            disabled={updating}
            className="px-3 py-2 rounded-xl text-sm font-medium text-red-500 bg-white border border-red-200 hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

export default function OrdersClient({
  initialOrders,
  restaurants,
  isSuperAdmin,
  defaultRestaurantId,
}: {
  initialOrders: Order[];
  restaurants: Restaurant[];
  isSuperAdmin: boolean;
  defaultRestaurantId: string | null;
}) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [filter, setFilter] = useState<"active" | "all">("active");
  const [restaurantId, setRestaurantId] = useState(defaultRestaurantId ?? "");
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchOrders = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    const params = new URLSearchParams();
    if (restaurantId) params.set("restaurantId", restaurantId);
    if (filter === "active") params.set("activeOnly", "1");
    try {
      const res = await fetch(`/api/admin/orders?${params}`);
      if (res.ok) {
        setOrders(await res.json());
        setLastRefresh(new Date());
      }
    } catch { /* ignore */ }
    if (showSpinner) setRefreshing(false);
  }, [restaurantId, filter]);

  useEffect(() => {
    fetchOrders();
    const iv = setInterval(() => fetchOrders(), 10000);
    return () => clearInterval(iv);
  }, [fetchOrders]);

  async function updateStatus(orderId: string, status: string) {
    await fetch(`/api/admin/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (filter === "active" && (status === "DELIVERED" || status === "CANCELLED")) {
      setOrders(prev => prev.filter(o => o.id !== orderId));
    } else {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    }
  }

  const grouped = filter === "active"
    ? orders.filter(o => !["DELIVERED", "CANCELLED"].includes(o.status))
    : orders;

  // Flatten all items into individual cards, oldest orders first
  const itemCards = grouped
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .flatMap(order => order.items.map(oi => ({ orderItem: oi, order })));

  const pending = grouped.filter(o => o.status === "PENDING").length;

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            🍽 ניהול הזמנות
            {pending > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold animate-pulse">
                {pending} ממתינות
              </span>
            )}
          </h1>
          <div className="flex gap-4 mt-0.5">
            <Link href="/admin/orders/stats" className="text-xs text-amber-700 hover:text-amber-900 font-medium">
              📊 סטטיסטיקות →
            </Link>
            <Link href="/admin/dashboard" className="text-xs text-cyan-700 hover:text-cyan-900 font-medium">
              📺 תצוגת מטבח →
            </Link>
          </div>
          <p className="text-gray-500 mt-0.5 text-sm">
            {itemCards.length} מנות · {grouped.length} הזמנות · עדכון: {lastRefresh.toLocaleTimeString("he-IL")}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isSuperAdmin && restaurants.length > 0 && (
            <select
              value={restaurantId}
              onChange={e => setRestaurantId(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="">כל המסעדות</option>
              {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}

          <div className="flex rounded-xl overflow-hidden border border-gray-200">
            {(["active", "all"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  filter === f ? "text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
                style={filter === f ? { background: "linear-gradient(135deg,#8B6914,#C9A84C)" } : undefined}
              >
                {f === "active" ? "פעילות" : "הכל"}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchOrders(true)}
            disabled={refreshing}
            className="p-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            title="רענן"
          >
            <svg className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Status summary */}
      {grouped.length > 0 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {["PENDING", "CONFIRMED", "PREPARING", "READY"].map(s => {
            const count = grouped.filter(o => o.status === s).length;
            if (!count) return null;
            return (
              <div key={s} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${STATUS_BADGE[s]}`}>
                {STATUS_ICON[s]} {STATUS_LABELS[s]}: {count}
              </div>
            );
          })}
        </div>
      )}

      {/* Item cards */}
      {itemCards.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center text-gray-400">
          <div className="text-5xl mb-3">🍽</div>
          <div className="font-medium text-lg">אין הזמנות {filter === "active" ? "פעילות" : ""}</div>
          <div className="text-sm mt-1">הדף מתרענן אוטומטית כל 10 שניות</div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {itemCards.map(({ orderItem, order }) => (
            <ItemCard
              key={orderItem.id}
              orderItem={orderItem}
              order={order}
              isSuperAdmin={isSuperAdmin}
              onStatusChange={updateStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}
