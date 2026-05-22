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

const NEXT_STATUS: Record<string, string | undefined> = {
  PENDING: "CONFIRMED",
  CONFIRMED: "PREPARING",
  PREPARING: "READY",
  READY: "DELIVERED",
};

const NEXT_LABEL: Record<string, string> = {
  PENDING: "אשר הזמנה",
  CONFIRMED: "התחל הכנה",
  PREPARING: "מוכן למסירה",
  READY: "סומן כנמסר",
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
  if (diff < 60) return `לפני ${diff} דק'`;
  const h = Math.floor(diff / 60);
  return `לפני ${h} שעות`;
}

function OrderCard({
  order,
  isSuperAdmin,
  onStatusChange,
}: {
  order: Order;
  isSuperAdmin: boolean;
  onStatusChange: (id: string, status: string) => Promise<void>;
}) {
  const [updating, setUpdating] = useState(false);
  const nextStatus = NEXT_STATUS[order.status];

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
    <div className={`rounded-2xl border p-5 transition-all ${STATUS_BG[order.status]}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        {/* Left: table + time */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white border-2 border-amber-200 flex flex-col items-center justify-center shadow-sm shrink-0">
            <div className="text-xs text-gray-400 leading-none">שולחן</div>
            <div className="text-lg font-bold text-amber-700 leading-tight">
              {order.tableNumber ?? "–"}
            </div>
          </div>
          <div>
            <div className="font-semibold text-gray-900 text-sm">
              {order.customerName ?? "לקוח"}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{timeSince(order.createdAt)}</div>
            {isSuperAdmin && (
              <div className="text-xs text-gray-400">{order.restaurant.name}</div>
            )}
          </div>
        </div>

        {/* Right: status badge + total */}
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_BADGE[order.status]}`}>
            {STATUS_ICON[order.status]} {STATUS_LABELS[order.status]}
          </span>
          <div className="text-base font-bold text-gray-900">
            ₪{order.totalAmount.toFixed(0)}
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="mt-4 space-y-1">
        {order.items.map(oi => (
          <div key={oi.id} className="flex items-center gap-2 text-sm">
            <span className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-xs font-bold text-amber-700 shrink-0">
              {oi.quantity}
            </span>
            <span className="text-gray-700">{oi.item.name}</span>
            {oi.notes && (
              <span className="text-xs text-gray-400 italic">({oi.notes})</span>
            )}
            <span className="mr-auto text-gray-500 text-xs">₪{(oi.price * oi.quantity).toFixed(0)}</span>
          </div>
        ))}
      </div>

      {order.notes && (
        <div className="mt-3 text-xs text-gray-500 bg-white/70 rounded-lg px-3 py-2">
          💬 {order.notes}
        </div>
      )}

      {/* Actions */}
      {order.status !== "DELIVERED" && order.status !== "CANCELLED" && (
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          {nextStatus && (
            <button
              onClick={advance}
              disabled={updating}
              className="flex-1 min-w-[140px] py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
              style={{ background: "linear-gradient(135deg,#8B6914,#C9A84C)" }}
            >
              {updating ? "..." : `✓ ${NEXT_LABEL[order.status]}`}
            </button>
          )}
          <button
            onClick={cancel}
            disabled={updating}
            className="px-4 py-2 rounded-xl text-sm font-medium text-red-600 bg-white border border-red-200 hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            ✕ בטל
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
          <Link href="/admin/orders/stats" className="text-xs text-amber-700 hover:text-amber-900 font-medium mt-0.5 inline-flex items-center gap-1">
            📊 סטטיסטיקות וניתוח →
          </Link>
          <p className="text-gray-500 mt-0.5 text-sm">
            {grouped.length} הזמנות · עדכון: {lastRefresh.toLocaleTimeString("he-IL")}
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
            <svg
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
              fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Status summary bar */}
      {grouped.length > 0 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {["PENDING","CONFIRMED","PREPARING","READY"].map(s => {
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

      {/* Orders */}
      {grouped.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center text-gray-400">
          <div className="text-5xl mb-3">🍽</div>
          <div className="font-medium text-lg">אין הזמנות {filter === "active" ? "פעילות" : ""}</div>
          <div className="text-sm mt-1">הדף מתרענן אוטומטית כל 10 שניות</div>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {grouped.map(order => (
            <OrderCard
              key={order.id}
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
