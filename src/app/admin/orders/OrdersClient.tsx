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
  CANCELLED: "בוטל",
};

const ITEM_STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  PREPARING: "bg-blue-100 text-blue-700",
  DONE: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-500 line-through",
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
  PAID: "bg-purple-100 text-purple-800",
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
  onItemAdvance,
  onItemCancel,
  onOrderCancel,
  onConfirmOrder,
  onCloseTable,
}: {
  tableNumber: string;
  orders: Order[];
  isSuperAdmin: boolean;
  onItemAdvance: (orderId: string, itemId: string) => Promise<void>;
  onItemCancel: (orderId: string, itemId: string) => Promise<void>;
  onOrderCancel: (orderId: string) => Promise<void>;
  onConfirmOrder: (orderId: string) => Promise<void>;
  onCloseTable: (tableNumber: string) => void;
}) {
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [confirmingOrder, setConfirmingOrder] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  const nonCancelledOrders = orders.filter(o => o.status !== "CANCELLED" && o.status !== "PAID" && o.status !== "DELIVERED");
  const allItems = nonCancelledOrders.flatMap(o => o.items);
  const doneCount = allItems.filter(i => i.itemStatus === "DONE").length;
  const totalCount = allItems.length;
  const oldestOrder = orders.reduce((a, b) =>
    new Date(a.createdAt) < new Date(b.createdAt) ? a : b
  );
  const ageMin = Math.floor((Date.now() - new Date(oldestOrder.createdAt).getTime()) / 60000);
  const hasActive = nonCancelledOrders.some(o => o.status !== "DELIVERED");
  const isUrgent = ageMin > 20 && hasActive;
  const totalAmount = nonCancelledOrders.reduce((s, o) => s + o.totalAmount, 0);

  async function advanceItem(orderId: string, itemId: string) {
    setBusy(prev => new Set(prev).add(itemId));
    await onItemAdvance(orderId, itemId);
    setBusy(prev => { const n = new Set(prev); n.delete(itemId); return n; });
  }

  async function cancelItem(orderId: string, itemId: string) {
    setBusy(prev => new Set(prev).add(itemId + "-cancel"));
    await onItemCancel(orderId, itemId);
    setBusy(prev => { const n = new Set(prev); n.delete(itemId + "-cancel"); return n; });
  }

  async function confirmOrder(orderId: string) {
    setConfirmingOrder(orderId);
    await onConfirmOrder(orderId);
    setConfirmingOrder(null);
  }

  function closeTable() {
    onCloseTable(tableNumber);
  }

  return (
    <div
      className="bg-white rounded-2xl border overflow-hidden shadow-sm"
      style={{ borderColor: isUrgent ? "#ef4444" : "#e5e7eb" }}
    >
      {/* Table header */}
      <div
        className="px-3 pt-2 pb-1.5"
        style={{ background: isUrgent ? "#fef2f2" : "#f9fafb", borderBottom: "1px solid #e5e7eb" }}
      >
        {/* Row 1: icon + name | price */}
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-8 rounded-lg bg-amber-100 border-2 border-amber-300 flex items-center justify-center font-black text-amber-800 text-xs shrink-0">
            {tableNumber === "–" ? "?" : tableNumber}
          </div>
          <span className="font-bold text-gray-900 text-sm flex-1">שולחן {tableNumber}</span>
          <span className="font-black text-gray-900 text-lg shrink-0">₪{totalAmount.toFixed(0)}</span>
        </div>
        {/* Row 2: time + dishes | order count */}
        <div className={`flex justify-between mt-0.5 text-xs ${isUrgent ? "text-red-500 font-semibold" : "text-gray-400"}`}>
          <span>⏱ {timeSince(oldestOrder.createdAt)} · {totalCount} מנות</span>
          <span>{nonCancelledOrders.length} הזמנות</span>
        </div>
        {/* Row 3: progress dots */}
        <div className="flex gap-1 mt-1.5">
          {allItems.map(i => (
            <div key={i.id} className="w-2 h-2 rounded-full"
              style={{ background: i.itemStatus === "DONE" ? "#22c55e" : i.itemStatus === "PREPARING" ? "#38bdf8" : "#d1d5db" }}
            />
          ))}
        </div>
      </div>

      {/* Orders — newest first */}
      {[...nonCancelledOrders].reverse().map((order, idx, arr) => {
        const isPending = order.status === "PENDING";
        const isDelivered = order.status === "DELIVERED";
        const orderNum = arr.length - idx;

        return (
          <div key={order.id} style={{ borderTop: idx > 0 ? "1px solid #f3f4f6" : undefined }}>
            {/* Order sub-header */}
            <div
              className="flex items-center justify-between px-2 py-1"
              style={{ background: isPending ? "#fefce8" : isDelivered ? "#f0fdf4" : "#fafafa" }}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`text-xs font-bold shrink-0 ${isPending ? "text-yellow-700" : isDelivered ? "text-green-700" : "text-gray-500"}`}>
                  {isPending ? "🕐 ממתין" : isDelivered ? "✓ הושלם" : `הזמנה ${orderNum}`}
                </span>
                <span className="text-xs text-gray-400 shrink-0">
                  {order.items.length} מנות · ₪{order.totalAmount.toFixed(0)} · {timeSince(order.createdAt)}
                </span>
                {order.notes && (
                  <span className="text-xs text-gray-400 italic truncate">· 💬 {order.notes}</span>
                )}
              </div>
              {isPending && (
                <button
                  onClick={() => confirmOrder(order.id)}
                  disabled={confirmingOrder === order.id}
                  className="shrink-0 px-3 py-1 rounded-xl text-xs font-bold text-white disabled:opacity-50 transition-all"
                  style={{ background: "linear-gradient(135deg,#16a34a,#22c55e)" }}
                >
                  {confirmingOrder === order.id ? "..." : "✓ אשר"}
                </button>
              )}
              {!isPending && !isDelivered && (
                <button
                  onClick={() => onOrderCancel(order.id)}
                  className="shrink-0 text-xs text-red-500 hover:text-red-700 px-2 py-0.5 rounded-lg hover:bg-red-50 transition-colors"
                >
                  ✕ בטל
                </button>
              )}
            </div>

            {/* Items */}
            <div className="divide-y divide-gray-50" style={{ opacity: isPending ? 0.6 : 1 }}>
              {order.items.map(({ id: itemId, quantity, notes, itemStatus, item }) => {
                const isCancelled = itemStatus === "CANCELLED";
                const nextLabel = !isPending && !isDelivered && !isCancelled ? ITEM_NEXT_LABEL[itemStatus] : undefined;
                const isBusy = busy.has(itemId);
                const isCancelBusy = busy.has(itemId + "-cancel");
                const isDone = itemStatus === "DONE" || isDelivered;
                const canCancel = !isPending && !isDelivered && !isCancelled && !isDone;

                return (
                  <div
                    key={itemId}
                    className={`flex items-center gap-1.5 px-2 py-1 transition-colors ${isDone || isCancelled ? "opacity-50" : ""}`}
                  >
                    <span className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold shrink-0 ${isCancelled ? "bg-red-50 text-red-400" : "bg-gray-100 text-gray-600"}`}>
                      {quantity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium truncate ${isDone || isCancelled ? "line-through text-gray-400" : "text-gray-800"}`}>
                        {item.name}
                      </div>
                      {notes && !isDone && !isCancelled && (
                        <div className="text-xs text-gray-400 italic truncate">{notes}</div>
                      )}
                    </div>
                    {!isDelivered && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${ITEM_STATUS_COLOR[itemStatus] ?? ""}`}>
                        {ITEM_STATUS_LABEL[itemStatus] ?? itemStatus}
                      </span>
                    )}
                    {nextLabel && !isDone ? (
                      <button
                        onClick={() => advanceItem(order.id, itemId)}
                        disabled={isBusy}
                        className="shrink-0 px-2 py-0.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40 transition-all"
                        style={{ background: itemStatus === "PREPARING" ? "#22c55e" : "linear-gradient(135deg,#8B6914,#C9A84C)" }}
                      >
                        {isBusy ? "..." : nextLabel}
                      </button>
                    ) : isDone && !isCancelled ? (
                      <span className="shrink-0 text-green-500 text-sm">✓</span>
                    ) : null}
                    {canCancel && (
                      <button
                        onClick={() => cancelItem(order.id, itemId)}
                        disabled={isCancelBusy}
                        title="בטל פריט"
                        className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-red-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors text-xs"
                      >
                        {isCancelBusy ? "·" : "✕"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Footer: close table */}
      {nonCancelledOrders.length > 0 && (
        <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/50">
          {confirmClose ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 flex-1">סגור שולחן לצמיתות?</span>
              <button
                onClick={() => setConfirmClose(false)}
                className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                ביטול
              </button>
              <button
                onClick={() => onCloseTable(tableNumber)}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all"
                style={{ background: "#16a34a" }}
              >
                ✓ אשר סגירה
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClose(true)}
              className="w-full py-2 rounded-xl text-sm font-bold text-white transition-all"
              style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}
            >
              💳 סגור שולחן ותשלום
            </button>
          )}
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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchOrders = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    const params = new URLSearchParams();
    if (restaurantId) params.set("restaurantId", restaurantId);
    if (filter === "active") params.set("activeOnly", "1");
    if (dateFrom) params.set("from", new Date(dateFrom).toISOString());
    if (dateTo) params.set("to", new Date(dateTo).toISOString());
    try {
      const res = await fetch(`/api/admin/orders?${params}`);
      if (res.ok) { setOrders(await res.json()); setLastRefresh(new Date()); }
    } catch { /* ignore */ }
    if (showSpinner) setRefreshing(false);
  }, [restaurantId, filter, dateFrom, dateTo]);

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
      return { ...o, status: orderDelivered ? "DELIVERED" : o.status, items: updatedItems };
    }));
  }

  async function cancelItem(orderId: string, itemId: string) {
    const res = await fetch(`/api/admin/orders/${orderId}/items/${itemId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cancel: true }),
    });
    if (!res.ok) return;
    const { newTotal } = await res.json();
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      const updatedItems = o.items.map(i => i.id === itemId ? { ...i, itemStatus: "CANCELLED" } : i);
      return { ...o, items: updatedItems, ...(newTotal !== undefined ? { totalAmount: newTotal } : {}) };
    }));
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

  function closeTable(tableNumber: string) {
    const tableOrders = orders.filter(o => (o.tableNumber ?? "–") === tableNumber);
    const rid = tableOrders[0]?.restaurant?.id || restaurantId;
    // Optimistic remove — API marks orders DELIVERED so they won't come back in activeOnly
    setOrders(prev => prev.filter(o => (o.tableNumber ?? "–") !== tableNumber));
    fetch("/api/admin/orders/close-table", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableNumber, restaurantId: rid }),
    }).catch(() => {/* ignore */});
  }

  const activeOrders = filter === "active"
    ? orders.filter(o => o.status !== "CANCELLED" && o.status !== "PAID")
    : orders;

  // Group by table — always exclude PAID/DELIVERED from table cards regardless of filter mode
  const byTable = new Map<string, Order[]>();
  [...activeOrders]
    .filter(order =>
      order.tableNumber && order.tableNumber.trim() !== "" &&
      order.status !== "PAID" && order.status !== "DELIVERED"
    )
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .forEach(order => {
      const key = order.tableNumber!;
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
        {/* Date range filter */}
        <div className="flex items-center gap-2 flex-wrap mt-3">
          <span className="text-xs text-gray-500 font-medium">סינון תאריך:</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400">מ-</span>
            <input
              type="datetime-local"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400">עד-</span>
            <input
              type="datetime-local"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              ✕ נקה
            </button>
          )}
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 items-start">
          {Array.from(byTable.entries()).map(([table, tableOrders]) => (
            <TableCard
              key={table}
              tableNumber={table}
              orders={tableOrders}
              isSuperAdmin={isSuperAdmin}
              onItemAdvance={advanceItem}
              onItemCancel={cancelItem}
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
