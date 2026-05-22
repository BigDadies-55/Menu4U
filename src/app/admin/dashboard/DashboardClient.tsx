"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type OrderItem = {
  id: string;
  quantity: number;
  notes: string | null;
  itemStatus: string;
  item: { name: string; prepTime: number | null };
};

type Order = {
  id: string;
  tableNumber: string | null;
  customerName: string | null;
  status: string;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
  items: OrderItem[];
};

type Restaurant = { id: string; name: string };

const ITEM_COLOR: Record<string, string> = {
  PENDING: "#facc15",
  PREPARING: "#38bdf8",
  DONE: "#4ade80",
};

const ITEM_LABEL: Record<string, string> = {
  PENDING: "ממתין",
  PREPARING: "בהכנה",
  DONE: "הוכן ✓",
};

const ITEM_NEXT_LABEL: Record<string, string> = {
  PENDING: "הכנה →",
  PREPARING: "הוכן ✓",
};

function elapsed(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
}

function fmtElapsed(mins: number): string {
  if (mins < 1) return "< 1 דק'";
  if (mins < 60) return `${mins} דק'`;
  return `${Math.floor(mins / 60)}ש' ${mins % 60}דק'`;
}

function TableCard({
  tableNumber,
  orders,
  canUpdate,
  tick,
  onConfirmOrder,
  onItemAdvance,
  onCancel,
}: {
  tableNumber: string;
  orders: Order[];
  canUpdate: boolean;
  tick: number;
  onConfirmOrder: (orderId: string) => void;
  onItemAdvance: (orderId: string, itemId: string) => void;
  onCancel: (orderId: string) => void;
}) {
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const nonCancelledOrders = orders.filter(o => o.status !== "CANCELLED");
  const allItems = nonCancelledOrders.flatMap(o => o.items);
  const doneCount = allItems.filter(i => i.itemStatus === "DONE").length;
  const totalCount = allItems.length;
  const oldest = orders.reduce((a, b) =>
    new Date(a.createdAt) < new Date(b.createdAt) ? a : b
  );
  const mins = elapsed(oldest.createdAt);
  const isUrgent = mins > 20 && doneCount < totalCount;
  const progressPct = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;
  const totalAmount = nonCancelledOrders.reduce((s, o) => s + o.totalAmount, 0);

  async function handleItemAdvance(orderId: string, itemId: string) {
    setBusy(prev => new Set(prev).add(itemId));
    await onItemAdvance(orderId, itemId);
    setBusy(prev => { const n = new Set(prev); n.delete(itemId); return n; });
  }

  return (
    <div
      className="rounded-2xl flex flex-col overflow-hidden"
      style={{
        background: "#111",
        border: `2px solid ${isUrgent ? "#ef4444" : "#ffffff18"}`,
        boxShadow: isUrgent ? "0 0 20px #ef444422" : "none",
      }}
    >
      {/* Table header */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: "#1a1a1a", borderBottom: "1px solid #ffffff12" }}>
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center font-black text-black text-2xl shrink-0"
          style={{ background: isUrgent ? "#ef4444" : "#facc15" }}
        >
          {tableNumber === "–" ? "?" : tableNumber}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white font-bold">שולחן {tableNumber}</span>
            <span className={`text-sm font-semibold ${isUrgent ? "text-red-400 animate-pulse" : "text-gray-500"}`}>
              ⏱ {fmtElapsed(mins)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%`, background: progressPct === 100 ? "#4ade80" : "#38bdf8" }}
              />
            </div>
            <span className="text-xs text-gray-500 shrink-0">{doneCount}/{totalCount}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-white font-bold text-lg">₪{totalAmount.toFixed(0)}</div>
        </div>
      </div>

      {/* Orders in chronological order */}
      {nonCancelledOrders.map((order, idx) => {
        const isPending = order.status === "PENDING";
        const isDelivered = order.status === "DELIVERED";

        return (
          <div key={order.id} style={{ borderTop: idx > 0 ? "1px solid #ffffff14" : undefined }}>
            {/* Order sub-header */}
            <div
              className="flex items-center justify-between px-4 py-2.5"
              style={{ background: isPending ? "#2a1f00" : isDelivered ? "#0d1a0d" : "#161616" }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold shrink-0" style={{ color: isPending ? "#facc15" : isDelivered ? "#4ade80" : "#9ca3af" }}>
                  {isPending ? "🕐 ממתין לאישור" : isDelivered ? "✓ הושלם" : `הזמנה ${idx + 1}`}
                </span>
                <span className="text-xs text-gray-600 shrink-0">{order.items.length} מנות · ₪{order.totalAmount.toFixed(0)}</span>
                {order.notes && (
                  <span className="text-xs text-gray-600 italic truncate">· 💬 {order.notes}</span>
                )}
              </div>
              {canUpdate && isPending && (
                <button
                  onClick={() => onConfirmOrder(order.id)}
                  className="shrink-0 px-4 py-2 rounded-xl font-black text-black text-sm transition-all active:scale-95 hover:opacity-90"
                  style={{ background: "#facc15", minHeight: 44, minWidth: 72 }}
                >
                  ✓ אשר
                </button>
              )}
              {canUpdate && !isPending && !isDelivered && (
                <button
                  onClick={() => onCancel(order.id)}
                  className="shrink-0 text-xs text-red-500/60 hover:text-red-400 px-3 py-2 rounded-lg hover:bg-red-950/50 transition-colors"
                  style={{ minHeight: 40 }}
                >
                  ✕ בטל
                </button>
              )}
            </div>

            {/* Items */}
            <div className="divide-y divide-white/5" style={{ opacity: isPending ? 0.5 : 1 }}>
              {order.items.map(({ id: itemId, quantity, notes, itemStatus, item }) => {
                const color = isDelivered ? "#4b5563" : (ITEM_COLOR[itemStatus] ?? "#9ca3af");
                const nextLabel = !isPending && !isDelivered ? ITEM_NEXT_LABEL[itemStatus] : undefined;
                const isDone = itemStatus === "DONE" || isDelivered;
                const isBusy = busy.has(itemId);

                return (
                  <div
                    key={`${itemId}-${tick}`}
                    className="flex items-center gap-3 px-4 py-3 transition-all"
                    style={{ opacity: isDone ? 0.45 : 1 }}
                  >
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0"
                      style={{ background: color + "30", color, minWidth: 32 }}
                    >
                      {quantity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-base font-semibold truncate"
                        style={{ color: isDone ? "#4b5563" : "#f3f4f6", textDecoration: isDone ? "line-through" : "none" }}
                      >
                        {item.name}
                      </div>
                      {notes && !isDone && (
                        <div className="text-xs text-gray-600 italic truncate mt-0.5">{notes}</div>
                      )}
                    </div>
                    {!isDelivered && (
                      <span
                        className="text-xs px-2.5 py-1 rounded-full font-semibold shrink-0"
                        style={{ background: color + "22", color }}
                      >
                        {ITEM_LABEL[itemStatus]}
                      </span>
                    )}
                    {canUpdate && nextLabel && !isDone && (
                      <button
                        onClick={() => handleItemAdvance(order.id, itemId)}
                        disabled={isBusy}
                        className="shrink-0 rounded-xl font-bold text-black transition-all active:scale-95 hover:opacity-90 disabled:opacity-40"
                        style={{
                          background: itemStatus === "PREPARING" ? "#4ade80" : "#38bdf8",
                          padding: "10px 14px",
                          minHeight: 44,
                          minWidth: 80,
                          fontSize: 13,
                        }}
                      >
                        {isBusy ? "..." : nextLabel}
                      </button>
                    )}
                    {isDone && <span className="text-green-400 text-lg shrink-0">✓</span>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

    </div>
  );
}

export default function DashboardClient({
  restaurants,
  defaultRestaurantId,
  isSuperAdmin,
  canUpdateStatus,
}: {
  restaurants: Restaurant[];
  defaultRestaurantId: string | null;
  isSuperAdmin: boolean;
  canUpdateStatus: boolean;
}) {
  const [restaurantId, setRestaurantId] = useState(defaultRestaurantId ?? "");
  const [orders, setOrders] = useState<Order[]>([]);
  const [tick, setTick] = useState(0);
  const [lastCount, setLastCount] = useState(0);
  const [newAlert, setNewAlert] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const audioCtx = useRef<AudioContext | null>(null);

  const fetchOrders = useCallback(async () => {
    const params = new URLSearchParams({ activeOnly: "1" });
    if (restaurantId) params.set("restaurantId", restaurantId);
    const res = await fetch(`/api/admin/orders?${params}`);
    if (!res.ok) return;
    const data: Order[] = await res.json();
    // Kitchen only shows actionable orders (not DELIVERED — those go to orders management)
    const active = data.filter(o => o.status !== "DELIVERED" && o.status !== "CANCELLED");
    const pending = active.filter(o => o.status === "PENDING").length;
    setOrders(active);
    setLastCount(prev => {
      if (pending > prev) { setNewAlert(true); playBeep(); setTimeout(() => setNewAlert(false), 3000); }
      return pending;
    });
    setCountdown(15);
  }, [restaurantId]);

  useEffect(() => {
    fetchOrders();
    const iv = setInterval(() => { fetchOrders(); setTick(t => t + 1); }, 15000);
    const cd = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => { clearInterval(iv); clearInterval(cd); };
  }, [fetchOrders]);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(iv);
  }, []);

  function playBeep() {
    try {
      if (!audioCtx.current) audioCtx.current = new AudioContext();
      const ctx = audioCtx.current;
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
    } catch { /* silent */ }
  }

  async function handleConfirmOrder(orderId: string) {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: "CONFIRMED" } : o));
    await fetch(`/api/admin/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CONFIRMED" }),
    });
  }

  async function handleItemAdvance(orderId: string, itemId: string) {
    const NEXT: Record<string, string> = { PENDING: "PREPARING", PREPARING: "DONE" };
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      const updatedItems = o.items.map(i =>
        i.id === itemId ? { ...i, itemStatus: NEXT[i.itemStatus] ?? i.itemStatus } : i
      );
      const allDone = updatedItems.every(i => i.itemStatus === "DONE");
      return { ...o, status: allDone ? "DELIVERED" : o.status, items: updatedItems };
    // Kitchen removes order once DELIVERED — closing is handled in orders management
    }).filter(o => o.status !== "DELIVERED"));

    await fetch(`/api/admin/orders/${orderId}/items/${itemId}/status`, { method: "PATCH" });
  }

  async function handleCancel(orderId: string) {
    if (!confirm("לבטל הזמנה זו?")) return;
    setOrders(prev => prev.filter(o => o.id !== orderId));
    await fetch(`/api/admin/orders/${orderId}/status`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
  }

  function toggleFullscreen() {
    if (!fullscreen) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
    setFullscreen(f => !f);
  }

  const byTable = new Map<string, Order[]>();
  [...orders]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .forEach(order => {
      const key = order.tableNumber ?? "–";
      if (!byTable.has(key)) byTable.set(key, []);
      byTable.get(key)!.push(order);
    });

  const totalItems = orders.reduce((s, o) => s + o.items.length, 0);
  const doneItems = orders.reduce((s, o) => s + o.items.filter(i => i.itemStatus === "DONE").length, 0);
  const pendingOrderCount = orders.filter(o => o.status === "PENDING").length;
  const restaurantName = restaurants.find(r => r.id === restaurantId)?.name ?? "כל המסעדות";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0a0a0a", color: "#fff" }}>
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0"
        style={{ background: newAlert ? "#2a1f00" : "#111" }}
      >
        <div className="flex items-center gap-4">
          <div className="text-xl font-black tracking-wide">📺 {restaurantName}</div>
          <div className="flex items-center gap-1.5 text-sm text-gray-400">
            <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
            {byTable.size} שולחנות
          </div>
          {pendingOrderCount > 0 && (
            <div className="text-yellow-400 font-bold animate-pulse">🔔 {pendingOrderCount} ממתינות לאישור!</div>
          )}
          {newAlert && !pendingOrderCount && (
            <div className="text-yellow-400 font-bold text-sm animate-pulse">🔔 הזמנה חדשה!</div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isSuperAdmin && restaurants.length > 1 && (
            <select value={restaurantId} onChange={e => setRestaurantId(e.target.value)}
              className="text-sm bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white">
              {restaurants.map(r => <option key={r.id} value={r.id} style={{ background: "#222" }}>{r.name}</option>)}
            </select>
          )}
          <div className="text-xs text-gray-500">רענון בעוד {countdown}s</div>
          <button onClick={fetchOrders} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 text-base" title="רענן">🔄</button>
          <button onClick={toggleFullscreen} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 text-base" title="מסך מלא">
            {fullscreen ? "⊡" : "⊞"}
          </button>
        </div>
      </div>

      {/* Tables grid */}
      <div className="flex-1 overflow-auto p-4">
        {byTable.size === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-600 gap-3">
            <div className="text-6xl">🍽</div>
            <div className="text-xl font-medium">אין הזמנות פעילות כרגע</div>
            <div className="text-sm">הדף מתרענן אוטומטית כל 15 שניות</div>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from(byTable.entries()).map(([table, tableOrders]) => (
              <TableCard
                key={table}
                tableNumber={table}
                orders={tableOrders}
                canUpdate={canUpdateStatus}
                tick={tick}
                onConfirmOrder={handleConfirmOrder}
                onItemAdvance={handleItemAdvance}
                onCancel={handleCancel}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 px-5 py-2.5 border-t border-white/10 flex items-center justify-between text-sm" style={{ background: "#080808" }}>
        <div className="flex gap-6">
          <span style={{ color: pendingOrderCount > 0 ? "#facc15" : "#333" }}>🕐 {pendingOrderCount} לאישור</span>
          <span style={{ color: doneItems < totalItems && totalItems > 0 ? "#38bdf8" : "#333" }}>
            👨‍🍳 {totalItems - doneItems} בטיפול
          </span>
          <span style={{ color: doneItems > 0 ? "#4ade80" : "#333" }}>✓ {doneItems}/{totalItems} הושלמו</span>
        </div>
        <div className="text-gray-600">{new Date().toLocaleTimeString("he-IL")}</div>
      </div>
    </div>
  );
}
