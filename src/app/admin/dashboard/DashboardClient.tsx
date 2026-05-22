"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type OrderItem = {
  id: string;
  quantity: number;
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

const COLUMNS = [
  { status: "PENDING",   label: "ממתין לאישור", icon: "🕐", color: "#facc15", bg: "#18160a", border: "#3d3208" },
  { status: "CONFIRMED", label: "אושר — מחכה",  icon: "✓",  color: "#38bdf8", bg: "#091520", border: "#0c3050" },
  { status: "PREPARING", label: "בהכנה",         icon: "👨‍🍳", color: "#fb923c", bg: "#1a0f06", border: "#3d2008" },
  { status: "READY",     label: "מוכן למסירה",  icon: "🔔", color: "#4ade80", bg: "#081a0f", border: "#0e3d1e" },
];

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

function elapsed(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
}

function fmtElapsed(mins: number): string {
  if (mins < 1) return "< 1 דק'";
  if (mins < 60) return `${mins} דק'`;
  return `${Math.floor(mins / 60)}ש' ${mins % 60}דק'`;
}

function urgencyColor(mins: number, status: string): string {
  if (status === "READY") return mins > 8 ? "#ef4444" : "#22c55e";
  if (mins > 25) return "#ef4444";
  if (mins > 15) return "#f59e0b";
  return "#6b7280";
}

function OrderCard({
  order,
  colColor,
  canUpdate,
  onStatusChange,
  onCancel,
}: {
  order: Order;
  colColor: string;
  canUpdate: boolean;
  onStatusChange: (id: string, status: string) => void;
  onCancel: (id: string) => void;
}) {
  const mins = elapsed(order.createdAt);
  const urgency = urgencyColor(mins, order.status);
  const next = NEXT_STATUS[order.status];
  const maxPrepTime = Math.max(...order.items.map(i => i.item.prepTime ?? 0), 0);

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3 transition-all duration-300"
      style={{
        background: "#111",
        border: `2px solid ${colColor}33`,
        boxShadow: `0 0 0 1px ${colColor}22`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black text-white shrink-0"
            style={{ background: colColor, fontSize: "1.4rem", lineHeight: 1 }}
          >
            {order.tableNumber ?? "?"}
          </div>
          <div>
            {order.customerName && (
              <div className="text-white font-semibold text-sm leading-tight">{order.customerName}</div>
            )}
            <div className="text-xs font-medium" style={{ color: urgency }}>
              ⏱ {fmtElapsed(mins)}
              {maxPrepTime > 0 && (
                <span className="text-gray-500 mr-1"> · צפוי: {maxPrepTime}&apos;</span>
              )}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-white font-bold text-lg">₪{order.totalAmount.toFixed(0)}</div>
          <div className="text-gray-500 text-xs">{order.items.reduce((s, i) => s + i.quantity, 0)} פריטים</div>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-1 border-t border-white/10 pt-2">
        {order.items.map(oi => (
          <div key={oi.id} className="flex items-center gap-2 text-sm">
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: colColor, color: "#000" }}
            >
              {oi.quantity}
            </span>
            <span className="text-gray-200 truncate">{oi.item.name}</span>
          </div>
        ))}
      </div>

      {order.notes && (
        <div className="text-xs text-gray-400 italic bg-white/5 rounded-lg px-2 py-1.5">
          💬 {order.notes}
        </div>
      )}

      {/* Actions */}
      {canUpdate && next && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onStatusChange(order.id, next)}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm text-black transition-all hover:opacity-90 active:scale-95"
            style={{ background: colColor }}
          >
            {NEXT_LABEL[order.status]}
          </button>
          <button
            onClick={() => onCancel(order.id)}
            className="px-3 py-2.5 rounded-xl text-xs text-red-400 bg-red-950/50 border border-red-900 hover:bg-red-900/50 transition-colors"
          >
            ✕
          </button>
        </div>
      )}
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
    const iv = setInterval(() => {
      fetchOrders();
      setTick(t => t + 1);
    }, 15000);
    const cd = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => { clearInterval(iv); clearInterval(cd); };
  }, [fetchOrders]);

  // Update elapsed display every 30s
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
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch { /* silent fail */ }
  }

  async function handleStatusChange(orderId: string, status: string) {
    setOrders(prev => prev.filter(o => !(o.id === orderId && (status === "DELIVERED" || status === "CANCELLED")))
      .map(o => o.id === orderId ? { ...o, status } : o));
    await fetch(`/api/admin/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  async function handleCancel(orderId: string) {
    if (!confirm("לבטל הזמנה זו?")) return;
    await handleStatusChange(orderId, "CANCELLED");
  }

  function toggleFullscreen() {
    if (!fullscreen) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
    setFullscreen(f => !f);
  }

  const restaurantName = restaurants.find(r => r.id === restaurantId)?.name ?? "כל המסעדות";
  const totalActive = orders.filter(o => !["DELIVERED", "CANCELLED"].includes(o.status)).length;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0a0a0a", color: "#fff" }}>
      {/* Top bar */}
      <div
        className={`flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0 transition-all ${newAlert ? "bg-yellow-500/20" : ""}`}
        style={{ background: newAlert ? "#2a1f00" : "#111" }}
      >
        <div className="flex items-center gap-4">
          <div className="text-lg font-black tracking-wide">📺 {restaurantName}</div>
          <div className="flex items-center gap-1.5 text-sm text-gray-400">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            {totalActive} הזמנות פעילות
          </div>
          {newAlert && (
            <div className="text-yellow-400 font-bold text-sm animate-pulse">
              🔔 הזמנה חדשה!
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isSuperAdmin && restaurants.length > 1 && (
            <select
              value={restaurantId}
              onChange={e => setRestaurantId(e.target.value)}
              className="text-sm bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-amber-400"
            >
              {restaurants.map(r => <option key={r.id} value={r.id} style={{ background: "#222" }}>{r.name}</option>)}
            </select>
          )}
          <div className="text-xs text-gray-500">
            רענון בעוד {countdown}s
          </div>
          <button
            onClick={() => { fetchOrders(); }}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 transition-colors text-sm"
            title="רענן עכשיו"
          >
            🔄
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 transition-colors text-sm"
            title="מסך מלא"
          >
            {fullscreen ? "⊡" : "⊞"}
          </button>
        </div>
      </div>

      {/* Kanban */}
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 min-h-full">
          {COLUMNS.map(col => {
            const colOrders = orders
              .filter(o => o.status === col.status)
              .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

            return (
              <div key={col.status} className="flex flex-col gap-3">
                {/* Column header */}
                <div
                  className="flex items-center justify-between px-4 py-3 rounded-xl sticky top-0 z-10"
                  style={{ background: col.bg, border: `1px solid ${col.border}` }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{col.icon}</span>
                    <span className="font-bold text-sm" style={{ color: col.color }}>{col.label}</span>
                  </div>
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center font-black text-sm text-black"
                    style={{ background: colOrders.length > 0 ? col.color : "#333", color: colOrders.length > 0 ? "#000" : "#666" }}
                  >
                    {colOrders.length}
                  </div>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-3">
                  {colOrders.length === 0 ? (
                    <div
                      className="rounded-xl py-10 text-center text-sm border border-dashed"
                      style={{ color: col.color + "44", borderColor: col.border }}
                    >
                      אין הזמנות
                    </div>
                  ) : (
                    colOrders.map(order => (
                      <OrderCard
                        key={`${order.id}-${tick}`}
                        order={order}
                        colColor={col.color}
                        canUpdate={canUpdateStatus}
                        onStatusChange={handleStatusChange}
                        onCancel={handleCancel}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {totalActive === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-600 gap-3">
            <div className="text-5xl">🍽</div>
            <div className="text-lg font-medium">אין הזמנות פעילות כרגע</div>
            <div className="text-sm">הדף מתרענן אוטומטית כל 15 שניות</div>
          </div>
        )}
      </div>

      {/* Bottom status bar */}
      <div className="shrink-0 px-5 py-2 border-t border-white/10 flex items-center justify-between text-xs text-gray-600" style={{ background: "#080808" }}>
        <div className="flex gap-4">
          {COLUMNS.map(col => {
            const count = orders.filter(o => o.status === col.status).length;
            return (
              <span key={col.status} style={{ color: count > 0 ? col.color : "#333" }}>
                {col.icon} {count}
              </span>
            );
          })}
        </div>
        <div>
          {new Date().toLocaleTimeString("he-IL")}
        </div>
      </div>
    </div>
  );
}
