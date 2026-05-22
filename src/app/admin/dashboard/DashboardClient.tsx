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

const ITEM_BG: Record<string, string> = {
  PENDING: "#2a2200",
  PREPARING: "#061520",
  DONE: "#061a0c",
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
  onItemAdvance,
  onCancel,
}: {
  tableNumber: string;
  orders: Order[];
  canUpdate: boolean;
  tick: number;
  onItemAdvance: (orderId: string, itemId: string) => void;
  onCancel: (orderId: string) => void;
}) {
  const allItems = orders.flatMap(o => o.items.map(i => ({ ...i, order: o })));
  const doneCount = allItems.filter(i => i.itemStatus === "DONE").length;
  const totalCount = allItems.length;
  const oldest = orders.reduce((a, b) =>
    new Date(a.createdAt) < new Date(b.createdAt) ? a : b
  );
  const mins = elapsed(oldest.createdAt);
  const isUrgent = mins > 20 && doneCount < totalCount;
  const progressPct = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  return (
    <div
      className="rounded-2xl flex flex-col overflow-hidden"
      style={{
        background: "#111",
        border: `2px solid ${isUrgent ? "#ef4444" : "#ffffff18"}`,
        boxShadow: isUrgent ? "0 0 0 1px #ef444433" : "none",
      }}
    >
      {/* Table header */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: "#1a1a1a", borderBottom: "1px solid #ffffff12" }}>
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-black text-xl shrink-0"
          style={{ background: isUrgent ? "#ef4444" : "#facc15" }}
        >
          {tableNumber === "–" ? "?" : tableNumber}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-sm">שולחן {tableNumber}</span>
            <span className={`text-xs font-semibold ${isUrgent ? "text-red-400 animate-pulse" : "text-gray-500"}`}>
              ⏱ {fmtElapsed(mins)}
            </span>
          </div>
          {/* Progress bar */}
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%`, background: progressPct === 100 ? "#4ade80" : "#38bdf8" }}
              />
            </div>
            <span className="text-xs text-gray-500 shrink-0">{doneCount}/{totalCount}</span>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="flex flex-col divide-y divide-white/5">
        {allItems.map(({ id: itemId, quantity, notes, itemStatus, item, order }) => {
          const color = ITEM_COLOR[itemStatus] ?? "#9ca3af";
          const nextLabel = ITEM_NEXT_LABEL[itemStatus];
          const isDone = itemStatus === "DONE";

          return (
            <div
              key={`${itemId}-${tick}`}
              className="flex items-center gap-3 px-4 py-2.5 transition-all"
              style={{
                background: isDone ? "transparent" : ITEM_BG[itemStatus],
                opacity: isDone ? 0.45 : 1,
              }}
            >
              {/* Qty */}
              <span
                className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-black shrink-0"
                style={{ background: color + "33", color }}
              >
                {quantity}
              </span>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <div
                  className="text-sm font-semibold truncate"
                  style={{ color: isDone ? "#4b5563" : "#e5e7eb", textDecoration: isDone ? "line-through" : "none" }}
                >
                  {item.name}
                </div>
                {notes && !isDone && (
                  <div className="text-xs text-gray-600 italic truncate">{notes}</div>
                )}
              </div>

              {/* Status badge */}
              <span
                className="text-xs px-2 py-0.5 rounded-full font-semibold shrink-0"
                style={{ background: color + "22", color }}
              >
                {ITEM_LABEL[itemStatus]}
              </span>

              {/* Action button */}
              {canUpdate && nextLabel && !isDone && (
                <button
                  onClick={() => onItemAdvance(order.id, itemId)}
                  className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold text-black transition-all active:scale-95 hover:opacity-90"
                  style={{ background: itemStatus === "PREPARING" ? "#4ade80" : "#38bdf8" }}
                >
                  {nextLabel}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Order notes + cancel */}
      {orders.map(order => (
        <div key={order.id}>
          {order.notes && (
            <div className="px-4 py-2 text-xs text-gray-500 italic border-t border-white/5">
              💬 {order.notes}
            </div>
          )}
          {canUpdate && order.status !== "DELIVERED" && order.status !== "CANCELLED" && (
            <div className="px-4 py-2 border-t border-white/5 flex justify-end">
              <button
                onClick={() => onCancel(order.id)}
                className="text-xs text-red-500/70 hover:text-red-400 transition-colors"
              >
                ✕ בטל הזמנה
              </button>
            </div>
          )}
        </div>
      ))}
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
    const pending = data.filter(o => o.status === "PENDING").length;
    setOrders(data);
    setLastCount(prev => {
      if (pending > prev) {
        setNewAlert(true);
        playBeep();
        setTimeout(() => setNewAlert(false), 3000);
      }
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
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
    } catch { /* silent fail */ }
  }

  async function handleItemAdvance(orderId: string, itemId: string) {
    // Optimistic update
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      const NEXT: Record<string, string> = { PENDING: "PREPARING", PREPARING: "DONE" };
      const updatedItems = o.items.map(i =>
        i.id === itemId ? { ...i, itemStatus: NEXT[i.itemStatus] ?? i.itemStatus } : i
      );
      const allDone = updatedItems.every(i => i.itemStatus === "DONE");
      return allDone ? { ...o, status: "DELIVERED", items: updatedItems } : { ...o, items: updatedItems };
    }).filter(o => o.status !== "DELIVERED"));

    await fetch(`/api/admin/orders/${orderId}/items/${itemId}/status`, { method: "PATCH" });
  }

  async function handleCancel(orderId: string) {
    if (!confirm("לבטל הזמנה זו?")) return;
    setOrders(prev => prev.filter(o => o.id !== orderId));
    await fetch(`/api/admin/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
  }

  function toggleFullscreen() {
    if (!fullscreen) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
    setFullscreen(f => !f);
  }

  // Group by table
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
  const pendingItems = orders.reduce((s, o) => s + o.items.filter(i => i.itemStatus === "PENDING").length, 0);
  const preparingItems = orders.reduce((s, o) => s + o.items.filter(i => i.itemStatus === "PREPARING").length, 0);
  const restaurantName = restaurants.find(r => r.id === restaurantId)?.name ?? "כל המסעדות";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0a0a0a", color: "#fff" }}>
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0 transition-all"
        style={{ background: newAlert ? "#2a1f00" : "#111" }}
      >
        <div className="flex items-center gap-4">
          <div className="text-lg font-black tracking-wide">📺 {restaurantName}</div>
          <div className="flex items-center gap-1.5 text-sm text-gray-400">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            {byTable.size} שולחנות
          </div>
          {newAlert && (
            <div className="text-yellow-400 font-bold text-sm animate-pulse">🔔 הזמנה חדשה!</div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isSuperAdmin && restaurants.length > 1 && (
            <select value={restaurantId} onChange={e => setRestaurantId(e.target.value)}
              className="text-sm bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white focus:outline-none">
              {restaurants.map(r => <option key={r.id} value={r.id} style={{ background: "#222" }}>{r.name}</option>)}
            </select>
          )}
          <div className="text-xs text-gray-500">רענון בעוד {countdown}s</div>
          <button onClick={fetchOrders}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 transition-colors text-sm" title="רענן">
            🔄
          </button>
          <button onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 transition-colors text-sm" title="מסך מלא">
            {fullscreen ? "⊡" : "⊞"}
          </button>
        </div>
      </div>

      {/* Tables grid */}
      <div className="flex-1 overflow-auto p-4">
        {byTable.size === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-600 gap-3">
            <div className="text-5xl">🍽</div>
            <div className="text-lg font-medium">אין הזמנות פעילות כרגע</div>
            <div className="text-sm">הדף מתרענן אוטומטית כל 15 שניות</div>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from(byTable.entries()).map(([table, tableOrders]) => (
              <TableCard
                key={table}
                tableNumber={table}
                orders={tableOrders}
                canUpdate={canUpdateStatus}
                tick={tick}
                onItemAdvance={handleItemAdvance}
                onCancel={handleCancel}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 px-5 py-2 border-t border-white/10 flex items-center justify-between text-xs" style={{ background: "#080808" }}>
        <div className="flex gap-5">
          <span style={{ color: pendingItems > 0 ? "#facc15" : "#333" }}>🕐 {pendingItems} ממתינות</span>
          <span style={{ color: preparingItems > 0 ? "#38bdf8" : "#333" }}>👨‍🍳 {preparingItems} בהכנה</span>
          <span style={{ color: doneItems > 0 ? "#4ade80" : "#333" }}>✓ {doneItems}/{totalItems} הושלמו</span>
        </div>
        <div className="text-gray-600">{new Date().toLocaleTimeString("he-IL")}</div>
      </div>
    </div>
  );
}
