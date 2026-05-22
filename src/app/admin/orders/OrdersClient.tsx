"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type OrderItem = {
  id: string;
  quantity: number;
  price: number;
  notes: string | null;
  itemStatus: string;
  item: { name: string };
};

type Order = {
  id: string;
  tableNumber: string | null;
  status: string;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
  restaurant: { id: string; name: string };
  items: OrderItem[];
};

type Restaurant = { id: string; name: string };

const ITEM_STATUS_LABEL: Record<string, string> = {
  PENDING: "ממתין",
  PREPARING: "בהכנה",
  DONE: "הוכן",
};

const ITEM_STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  PREPARING: "bg-blue-100 text-blue-700",
  DONE: "bg-green-100 text-green-700",
};

const ITEM_NEXT_LABEL: Record<string, string> = {
  PENDING: "הכנה",
  PREPARING: "הוכן ✓",
};

const ORDER_STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  PREPARING: "bg-amber-100 text-amber-800",
  READY: "bg-green-100 text-green-800",
  DELIVERED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-100 text-red-700",
};

function timeSince(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return "עכשיו";
  if (diff < 60) return `${diff} דק'`;
  return `${Math.floor(diff / 60)}ש'`;
}

function TableCard({
  tableNumber,
  orders,
  isSuperAdmin,
  restaurantId,
  onItemAdvance,
  onOrderCancel,
  onConfirmOrder,
  onCloseTable,
}: {
  tableNumber: string;
  orders: Order[];
  isSuperAdmin: boolean;
  restaurantId: string;
  onItemAdvance: (orderId: string, itemId: string) => Promise<void>;
  onOrderCancel: (orderId: string) => Promise<void>;
  onConfirmOrder: (orderId: string) => Promise<void>;
  onCloseTable: (tableNumber: string, restaurantId: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [confirmingOrder, setConfirmingOrder] = useState<string | null>(null);
  const [closingTable, setClosingTable] = useState(false);

  const pendingOrders = orders.filter(o => o.status === "PENDING");
  const activeOrders = orders.filter(o => o.status !== "PENDING");
  const allItems = orders.flatMap(o => o.items.map(i => ({ ...i, order: o })));
  const activeItems = activeOrders.flatMap(o => o.items.map(i => ({ ...i, order: o })));
  const doneCount = activeItems.filter(i => i.itemStatus === "DONE").length;
  const totalCount = allItems.length;
  const allDone = activeItems.length > 0 && doneCount === activeItems.length && pendingOrders.length === 0;
  const oldestOrder = orders.reduce((a, b) =>
    new Date(a.createdAt) < new Date(b.createdAt) ? a : b
  );
  const elapsed = Math.floor((Date.now() - new Date(oldestOrder.createdAt).getTime()) / 60000);
  const isUrgent = elapsed > 20 && !allDone;
  const totalAmount = orders.reduce((s, o) => s + o.totalAmount, 0);

  async function advanceItem(orderId: string, itemId: string) {
    setBusy(prev => new Set(prev).add(itemId));
    await onItemAdvance(orderId, itemId);
    setBusy(prev => { const n = new Set(prev); n.delete(itemId); return n; });
  }

  async function confirmOrder(orderId: string) {
    setConfirmingOrder(orderId);
    await onConfirmOrder(orderId);
    setConfirmingOrder(null);
  }

  async function closeTable() {
    if (!restaurantId) return;
    setClosingTable(true);
    await onCloseTable(tableNumber, restaurantId);
    setClosingTable(false);
  }

  return (
    <div
      className="bg-white rounded-2xl border overflow-hidden shadow-sm"
      style={{ borderColor: isUrgent ? "#ef4444" : "#e5e7eb" }}
    >
      {/* Table header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ background: isUrgent ? "#fef2f2" : "#f9fafb", borderBottom: "1px solid #e5e7eb" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 border-2 border-amber-300 flex items-center justify-center font-black text-amber-800 text-lg">
            {tableNumber === "–" ? "?" : tableNumber}
          </div>
          <div>
            <div className="font-bold text-gray-900 text-sm">שולחן {tableNumber}</div>
            <div className={`text-xs ${isUrgent ? "text-red-500 font-semibold" : "text-gray-400"}`}>
              ⏱ {timeSince(oldestOrder.createdAt)} · {totalCount} מנות · ₪{totalAmount.toFixed(0)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Progress dots */}
          <div className="flex gap-1">
            {allItems.map(i => (
              <div
                key={i.id}
                className="w-2 h-2 rounded-full"
                style={{
                  background: i.itemStatus === "DONE" ? "#22c55e"
                    : i.itemStatus === "PREPARING" ? "#38bdf8"
                    : "#d1d5db"
                }}
              />
            ))}
          </div>
          <span className="text-xs text-gray-400">{doneCount}/{activeItems.length}</span>
        </div>
      </div>

      {/* Pending orders — confirmation banners */}
      {pendingOrders.map(order => (
        <div key={order.id} className="border-b border-yellow-200 bg-yellow-50 px-4 py-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-xs font-bold text-yellow-800">
              🕐 הזמנה חדשה · {timeSince(order.createdAt)} · ₪{order.totalAmount.toFixed(0)}
            </div>
            <button
              onClick={() => confirmOrder(order.id)}
              disabled={confirmingOrder === order.id}
              className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold text-white disabled:opacity-50 transition-all"
              style={{ background: "linear-gradient(135deg,#16a34a,#22c55e)" }}
            >
              {confirmingOrder === order.id ? "..." : "✓ אשר הזמנה"}
            </button>
          </div>
          <div className="space-y-1">
            {order.items.map(i => (
              <div key={i.id} className="flex items-center gap-2 text-xs text-yellow-700 opacity-70">
                <span className="w-5 h-5 rounded bg-yellow-200 flex items-center justify-center font-bold">{i.quantity}</span>
                <span>{i.item.name}</span>
                {i.notes && <span className="italic text-yellow-500">· {i.notes}</span>}
              </div>
            ))}
          </div>
          {order.notes && (
            <div className="mt-1.5 text-xs text-yellow-600 italic">💬 {order.notes}</div>
          )}
        </div>
      ))}

      {/* Active items */}
      <div className="divide-y divide-gray-100">
        {activeItems.map(({ id: itemId, quantity, notes, itemStatus, item, order }) => {
          const nextLabel = ITEM_NEXT_LABEL[itemStatus];
          const isBusy = busy.has(itemId);
          const isDone = itemStatus === "DONE";

          return (
            <div
              key={itemId}
              className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${isDone ? "opacity-50" : ""}`}
            >
              <span className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                {quantity}
              </span>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold truncate ${isDone ? "line-through text-gray-400" : "text-gray-800"}`}>
                  {item.name}
                </div>
                {notes && (
                  <div className="text-xs text-gray-400 italic truncate">{notes}</div>
                )}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${ITEM_STATUS_COLOR[itemStatus]}`}>
                {ITEM_STATUS_LABEL[itemStatus]}
              </span>
              {nextLabel && !isDone ? (
                <button
                  onClick={() => advanceItem(order.id, itemId)}
                  disabled={isBusy}
                  className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold text-white disabled:opacity-40 transition-all"
                  style={{ background: itemStatus === "PREPARING" ? "#22c55e" : "linear-gradient(135deg,#8B6914,#C9A84C)" }}
                >
                  {isBusy ? "..." : nextLabel}
                </button>
              ) : isDone ? (
                <span className="shrink-0 text-green-500 text-base">✓</span>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Footer: per-order cancel + close table */}
      <div className="border-t border-gray-100 bg-gray-50/50">
        {activeOrders.map(order => (
          order.status !== "DELIVERED" && order.status !== "CANCELLED" && (
            <div key={order.id} className="px-4 py-2 flex items-center gap-2">
              {isSuperAdmin && (
                <span className="text-xs text-gray-400">{order.restaurant.name}</span>
              )}
              {order.notes && (
                <span className="text-xs text-gray-400 italic flex-1 truncate">💬 {order.notes}</span>
              )}
              <button
                onClick={() => onOrderCancel(order.id)}
                className="mr-auto shrink-0 text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
              >
                ✕ בטל הזמנה
              </button>
            </div>
          )
        ))}
        {/* Close table */}
        {allDone && restaurantId && (
          <div className="px-4 py-3 border-t border-gray-100">
            <button
              onClick={closeTable}
              disabled={closingTable}
              className="w-full py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all"
              style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}
            >
              {closingTable ? "..." : "💳 סגור שולחן ותשלום"}
            </button>
          </div>
        )}
      </div>
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
      if (res.ok) { setOrders(await res.json()); setLastRefresh(new Date()); }
    } catch { /* ignore */ }
    if (showSpinner) setRefreshing(false);
  }, [restaurantId, filter]);

  useEffect(() => {
    fetchOrders();
    const iv = setInterval(() => fetchOrders(), 10000);
    return () => clearInterval(iv);
  }, [fetchOrders]);

  async function advanceItem(orderId: string, itemId: string) {
    const res = await fetch(`/api/admin/orders/${orderId}/items/${itemId}/status`, {
      method: "PATCH",
    });
    if (!res.ok) return;
    const { itemStatus, orderDelivered } = await res.json();

    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      const updatedItems = o.items.map(i => i.id === itemId ? { ...i, itemStatus } : i);
      if (orderDelivered && filter === "active") return { ...o, status: "DELIVERED", items: updatedItems };
      return { ...o, items: updatedItems };
    }).filter(o => !(filter === "active" && o.status === "DELIVERED")));
  }

  async function cancelOrder(orderId: string) {
    if (!confirm("לבטל הזמנה זו?")) return;
    await fetch(`/api/admin/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    if (filter === "active") {
      setOrders(prev => prev.filter(o => o.id !== orderId));
    } else {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: "CANCELLED" } : o));
    }
  }

  async function confirmOrder(orderId: string) {
    const res = await fetch(`/api/admin/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CONFIRMED" }),
    });
    if (!res.ok) return;
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: "CONFIRMED" } : o));
  }

  async function closeTable(tableNumber: string, rid: string) {
    const res = await fetch("/api/admin/orders/close-table", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableNumber, restaurantId: rid }),
    });
    if (!res.ok) return;
    if (filter === "active") {
      setOrders(prev => prev.filter(o => o.tableNumber !== tableNumber));
    } else {
      setOrders(prev => prev.map(o => o.tableNumber === tableNumber ? { ...o, status: "DELIVERED" } : o));
    }
  }

  const activeOrders = filter === "active"
    ? orders.filter(o => !["DELIVERED", "CANCELLED"].includes(o.status))
    : orders;

  // Group by table, sorted oldest first
  const byTable = new Map<string, Order[]>();
  [...activeOrders]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .forEach(order => {
      const key = order.tableNumber ?? "–";
      if (!byTable.has(key)) byTable.set(key, []);
      byTable.get(key)!.push(order);
    });

  const totalItems = activeOrders.reduce((s, o) => s + o.items.length, 0);
  const pendingOrders = activeOrders.filter(o => o.status === "PENDING").length;

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            🍽 ניהול הזמנות
            {pendingOrders > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold animate-pulse">
                {pendingOrders} ממתינות
              </span>
            )}
          </h1>
          <div className="flex gap-4 mt-0.5">
            <Link href="/admin/orders/stats" className="text-xs text-amber-700 hover:text-amber-900 font-medium">📊 סטטיסטיקות →</Link>
            <Link href="/admin/dashboard" className="text-xs text-cyan-700 hover:text-cyan-900 font-medium">📺 תצוגת מטבח →</Link>
          </div>
          <p className="text-gray-500 mt-0.5 text-sm">
            {byTable.size} שולחנות · {totalItems} מנות · עדכון: {lastRefresh.toLocaleTimeString("he-IL")}
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
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${filter === f ? "text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                style={filter === f ? { background: "linear-gradient(135deg,#8B6914,#C9A84C)" } : undefined}>
                {f === "active" ? "פעילות" : "הכל"}
              </button>
            ))}
          </div>
          <button onClick={() => fetchOrders(true)} disabled={refreshing}
            className="p-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            <svg className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Status summary */}
      {activeOrders.length > 0 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {(["PENDING","CONFIRMED","PREPARING","READY"] as const).map(s => {
            const count = activeOrders.filter(o => o.status === s).length;
            if (!count) return null;
            return (
              <div key={s} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${ORDER_STATUS_BADGE[s]}`}>
                {count} {s === "PENDING" ? "ממתינות" : s === "CONFIRMED" ? "מאושרות" : s === "PREPARING" ? "בהכנה" : "מוכנות"}
              </div>
            );
          })}
        </div>
      )}

      {/* Tables grid */}
      {byTable.size === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center text-gray-400">
          <div className="text-5xl mb-3">🍽</div>
          <div className="font-medium text-lg">אין הזמנות {filter === "active" ? "פעילות" : ""}</div>
          <div className="text-sm mt-1">הדף מתרענן אוטומטית כל 10 שניות</div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from(byTable.entries()).map(([table, tableOrders]) => (
            <TableCard
              key={table}
              tableNumber={table}
              orders={tableOrders}
              isSuperAdmin={isSuperAdmin}
              restaurantId={tableOrders[0]?.restaurant.id ?? restaurantId}
              onItemAdvance={advanceItem}
              onOrderCancel={cancelOrder}
              onConfirmOrder={confirmOrder}
              onCloseTable={closeTable}
            />
          ))}
        </div>
      )}
    </div>
  );
}
