"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/* ── Types ── */
type Modifier = { groupName: string; label: string; priceAdd: number };
type OrderItem = {
  id: string; quantity: number; notes: string | null;
  itemStatus: string;
  item: { name: string; prepTime: number | null };
  modifiers?: Modifier[];
};
type Order = {
  id: string; tableNumber: string | null; customerName: string | null;
  status: string; totalAmount: number; notes: string | null;
  createdAt: string; items: OrderItem[];
};
type Restaurant = { id: string; name: string };

/* ── Helpers ── */
function elapsed(d: string) { return Math.floor((Date.now() - new Date(d).getTime()) / 60000); }
function fmtElapsed(m: number) {
  if (m < 1) return "< 1 דק'";
  if (m < 60) return `${m} דק'`;
  return `${Math.floor(m / 60)}ש' ${m % 60}דק'`;
}
function timerColor(mins: number) {
  if (mins < 10) return "#22c55e";
  if (mins < 20) return "#f59e0b";
  return "#ef4444";
}

/* ── Status config ── */
const STATUS_DOT: Record<string, string> = {
  PENDING:   "#f59e0b",
  PREPARING: "#38bdf8",
  DONE:      "#22c55e",
  CANCELLED: "#4b5563",
};
const STATUS_LABEL: Record<string, string> = {
  PENDING:   "ממתין",
  PREPARING: "בהכנה",
  DONE:      "מוכן ✓",
  CANCELLED: "בוטל",
};
const NEXT_LABEL: Record<string, string> = {
  PENDING:   "התחל →",
  PREPARING: "הוכן ✓",
};

/* ── Table card ── */
function TableCard({
  tableNumber, orders, canUpdate, tick,
  onConfirm, onAdvance, onGoBack,
}: {
  tableNumber: string; orders: Order[]; canUpdate: boolean; tick: number;
  onConfirm: (id: string) => void;
  onAdvance: (orderId: string, itemId: string) => void;
  onGoBack:  (orderId: string, itemId: string) => void;
}) {
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const active = orders.filter(o => o.status !== "CANCELLED");
  const allItems = active.flatMap(o => o.items.filter(i => i.itemStatus !== "CANCELLED"));
  const doneCount = allItems.filter(i => i.itemStatus === "DONE").length;
  const totalCount = allItems.length;
  const pct = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;
  const oldest = orders.reduce((a, b) => new Date(a.createdAt) < new Date(b.createdAt) ? a : b);
  const mins = elapsed(oldest.createdAt);
  const isUrgent = mins > 20 && doneCount < totalCount;
  const totalAmt = active.reduce((s, o) => s + o.totalAmount, 0);

  async function adv(orderId: string, itemId: string) {
    setBusy(p => new Set(p).add(itemId));
    await onAdvance(orderId, itemId);
    setBusy(p => { const n = new Set(p); n.delete(itemId); return n; });
  }
  async function back(orderId: string, itemId: string) {
    setBusy(p => new Set(p).add(itemId + "-b"));
    await onGoBack(orderId, itemId);
    setBusy(p => { const n = new Set(p); n.delete(itemId + "-b"); return n; });
  }

  const tColor = timerColor(mins);

  return (
    <div style={{
      background: "#0f172a",
      border: `2px solid ${isUrgent ? "#ef4444" : "#1e3a5f"}`,
      borderRadius: 20,
      display: "flex", flexDirection: "column",
      overflow: "hidden",
      boxShadow: isUrgent
        ? "0 0 0 3px #ef444430, 0 8px 32px rgba(0,0,0,0.6)"
        : "0 4px 24px rgba(0,0,0,0.5)",
    }}>
      {/* ── Header ── */}
      <div style={{
        background: "#1e293b",
        padding: "14px 24px 12px",
        borderBottom: "1px solid #1e3a5f",
        display: "flex", alignItems: "center", gap: 16,
      }}>
        {/* Table number badge */}
        <div style={{
          background: isUrgent ? "#ef4444" : "#facc15",
          color: "#000",
          borderRadius: 12,
          minWidth: 64, height: 64,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 900, fontSize: 28, flexShrink: 0,
          boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        }}>
          {tableNumber === "–" ? "?" : tableNumber}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
            <span style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 15 }}>שולחן {tableNumber}</span>
            <span style={{
              color: tColor, fontWeight: 800, fontSize: 17,
              animation: isUrgent ? "pulse 1s infinite" : undefined,
            }}>
              ⏱ {fmtElapsed(mins)}
            </span>
          </div>
          {/* Progress bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, height: 8, borderRadius: 4, background: "#0f172a", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 4,
                width: `${pct}%`,
                background: pct === 100 ? "#22c55e" : "#38bdf8",
                transition: "width 0.4s ease",
              }}/>
            </div>
            <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
              {doneCount}/{totalCount}
            </span>
          </div>
        </div>

        <div style={{ textAlign: "left", flexShrink: 0 }}>
          <div style={{ color: "#facc15", fontWeight: 800, fontSize: 18 }}>₪{totalAmt.toFixed(0)}</div>
        </div>
      </div>

      {/* ── Orders ── */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {active.map((order, oidx) => {
          const isPending   = order.status === "PENDING";
          const isDelivered = order.status === "DELIVERED";

          return (
            <div key={order.id}>
              {/* Order sub-header */}
              {(active.length > 1 || order.notes || isPending) && (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "6px 20px",
                  background: isPending ? "#292008" : isDelivered ? "#052e16" : "#111827",
                  borderBottom: "1px solid #1e293b",
                }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: isPending ? "#fbbf24" : isDelivered ? "#4ade80" : "#64748b",
                  }}>
                    {isPending ? "🕐 ממתין לאישור" : isDelivered ? "✅ הושלם" : `הזמנה ${oidx + 1}`}
                    {order.notes ? ` · 💬 ${order.notes}` : ""}
                  </span>
                  {canUpdate && isPending && (
                    <button
                      onClick={() => onConfirm(order.id)}
                      style={{
                        background: "#facc15", color: "#000",
                        border: "none", borderRadius: 8,
                        padding: "6px 14px", fontWeight: 900, fontSize: 12,
                        cursor: "pointer",
                      }}
                    >✓ אשר</button>
                  )}
                </div>
              )}

              {/* Items */}
              {order.items.map(({ id: iid, quantity, notes, itemStatus, item, modifiers }) => {
                const dot       = STATUS_DOT[itemStatus]   ?? "#64748b";
                const isDone    = itemStatus === "DONE" || isDelivered;
                const isCancelled = itemStatus === "CANCELLED";
                const nextLabel = !isPending && !isDelivered && !isCancelled ? NEXT_LABEL[itemStatus] : undefined;
                const busyAdv   = busy.has(iid);
                const busyBack  = busy.has(iid + "-b");

                return (
                  <div
                    key={`${iid}-${tick}`}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 20px",
                      background: isDone && !isDelivered
                        ? "#052e16"
                        : isCancelled ? "#1a0000" : "transparent",
                      borderBottom: "1px solid #1e293b",
                      opacity: isCancelled ? 0.5 : isPending ? 0.65 : 1,
                    }}
                  >
                    {/* Status dot */}
                    <div style={{
                      width: 14, height: 14, borderRadius: "50%",
                      background: isDelivered ? "#22c55e" : dot,
                      flexShrink: 0,
                      boxShadow: `0 0 6px ${isDelivered ? "#22c55e" : dot}88`,
                    }}/>

                    {/* Qty badge */}
                    <span style={{
                      background: (isDelivered ? "#22c55e" : dot) + "25",
                      color: isDelivered ? "#22c55e" : dot,
                      borderRadius: 8, padding: "3px 8px",
                      fontWeight: 800, fontSize: 14, flexShrink: 0,
                    }}>×{quantity}</span>

                    {/* Name + modifiers */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        color: isCancelled ? "#4b5563" : isDelivered ? "#94a3b8" : "#f1f5f9",
                        fontWeight: 600, fontSize: 15,
                        textDecoration: isCancelled ? "line-through" : undefined,
                        lineHeight: 1.3,
                      }}>
                        {item.name}
                      </div>
                      {modifiers && modifiers.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 3 }}>
                          {modifiers.map((m, i) => (
                            <span key={i} style={{
                              background: "#1e3a2e", color: "#4ade80",
                              fontSize: 11, padding: "1px 6px", borderRadius: 20,
                            }}>
                              {m.label}{m.priceAdd > 0 ? ` +₪${m.priceAdd}` : ""}
                            </span>
                          ))}
                        </div>
                      )}
                      {notes && (
                        <div style={{ color: "#64748b", fontSize: 11, fontStyle: "italic", marginTop: 2 }}>
                          💬 {notes}
                        </div>
                      )}
                    </div>

                    {/* Status label (no button when done) */}
                    {!isDelivered && !isCancelled && (
                      <span style={{
                        background: dot + "25", color: dot,
                        fontSize: 11, fontWeight: 700,
                        padding: "3px 8px", borderRadius: 20,
                        flexShrink: 0,
                        animation: isDone ? "pulse 1.5s infinite" : undefined,
                      }}>
                        {STATUS_LABEL[itemStatus]}
                      </span>
                    )}

                    {/* Go-back button */}
                    {canUpdate && !isDelivered && !isCancelled && (itemStatus === "PREPARING" || itemStatus === "DONE") && (
                      <button
                        onClick={() => back(order.id, iid)}
                        disabled={busyBack}
                        style={{
                          background: "#1e293b", color: "#64748b",
                          border: "1px solid #334155",
                          borderRadius: 8, width: 32, height: 32,
                          fontSize: 14, cursor: "pointer", flexShrink: 0,
                          opacity: busyBack ? 0.4 : 1,
                        }}
                      >←</button>
                    )}

                    {/* Advance button */}
                    {canUpdate && nextLabel && !isDone && !isCancelled && (
                      <button
                        onClick={() => adv(order.id, iid)}
                        disabled={busyAdv}
                        style={{
                          background: itemStatus === "PREPARING" ? "#16a34a" : "#0284c7",
                          color: "#fff", border: "none",
                          borderRadius: 10,
                          padding: "10px 16px",
                          minHeight: 44, minWidth: 88,
                          fontWeight: 800, fontSize: 13,
                          cursor: busyAdv ? "wait" : "pointer",
                          flexShrink: 0,
                          opacity: busyAdv ? 0.5 : 1,
                          boxShadow: itemStatus === "PREPARING"
                            ? "0 2px 8px #16a34a50"
                            : "0 2px 8px #0284c750",
                        }}
                      >
                        {busyAdv ? "..." : nextLabel}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Main component ── */
export default function KitchenClient({
  restaurants, defaultRestaurantId, canUpdate,
}: {
  restaurants: Restaurant[];
  defaultRestaurantId: string | null;
  canUpdate: boolean;
}) {
  const [restaurantId, setRestaurantId] = useState(defaultRestaurantId ?? "");
  const [orders, setOrders]             = useState<Order[]>([]);
  const [tick, setTick]                 = useState(0);
  const [lastCount, setLastCount]       = useState(0);
  const [newAlert, setNewAlert]         = useState(false);
  const [fullscreen, setFullscreen]     = useState(false);
  const [countdown, setCountdown]       = useState(15);
  const [now, setNow]                   = useState(new Date());
  const audioCtx = useRef<AudioContext | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchOrders = useCallback(async () => {
    const params = new URLSearchParams({ activeOnly: "1" });
    if (restaurantId) params.set("restaurantId", restaurantId);
    const res = await fetch(`/api/admin/orders?${params}`);
    if (!res.ok) return;
    const data: Order[] = await res.json();
    const active = data.filter(o => o.status !== "DELIVERED" && o.status !== "CANCELLED");
    if (active.length > lastCount && lastCount > 0) {
      setNewAlert(true);
      setTimeout(() => setNewAlert(false), 4000);
      try {
        audioCtx.current ??= new AudioContext();
        const osc = audioCtx.current.createOscillator();
        const gain = audioCtx.current.createGain();
        osc.connect(gain); gain.connect(audioCtx.current.destination);
        osc.frequency.value = 880; gain.gain.setValueAtTime(0.4, audioCtx.current.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.current.currentTime + 0.5);
        osc.start(); osc.stop(audioCtx.current.currentTime + 0.5);
      } catch { /* audio blocked */ }
    }
    setLastCount(active.length);
    setOrders(active);
    setTick(t => t + 1);
    setCountdown(15);
  }, [restaurantId, lastCount]);

  useEffect(() => { if (restaurantId) fetchOrders(); }, [restaurantId]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { fetchOrders(); return 15; }
        return c - 1;
      });
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setFullscreen(false);
    }
  }

  /* Group by table */
  const byTable = new Map<string, Order[]>();
  for (const o of orders) {
    const key = o.tableNumber ?? o.customerName ?? "–";
    if (!byTable.has(key)) byTable.set(key, []);
    byTable.get(key)!.push(o);
  }

  async function handleConfirm(orderId: string) {
    await fetch(`/api/admin/orders/${orderId}/status`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PREPARING" }),
    });
    fetchOrders();
  }

  async function handleAdvance(orderId: string, itemId: string) {
    const res = await fetch(`/api/admin/orders/${orderId}/items/${itemId}/status`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const { orderDelivered } = await res.json();
      if (orderDelivered) fetchOrders();
      else setOrders(prev => prev.map(o => o.id !== orderId ? o : {
        ...o,
        items: o.items.map(i => {
          if (i.id !== itemId) return i;
          const next = i.itemStatus === "PENDING" ? "PREPARING" : "DONE";
          return { ...i, itemStatus: next };
        }),
      }));
      setTick(t => t + 1);
    }
  }

  async function handleGoBack(orderId: string, itemId: string) {
    await fetch(`/api/admin/orders/${orderId}/items/${itemId}/status`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goBack: true }),
    });
    setOrders(prev => prev.map(o => o.id !== orderId ? o : {
      ...o,
      items: o.items.map(i => {
        if (i.id !== itemId) return i;
        const prev2 = i.itemStatus === "DONE" ? "PREPARING" : "PENDING";
        return { ...i, itemStatus: prev2 };
      }),
    }));
    setTick(t => t + 1);
  }

  const restName = restaurants.find(r => r.id === restaurantId)?.name ?? "";

  return (
    <div ref={containerRef} style={{
      minHeight: "100vh",
      background: "#030712",
      display: "flex", flexDirection: "column",
      fontFamily: "'Heebo', 'Segoe UI', sans-serif",
      direction: "rtl",
    }}>
      {/* ── Top bar ── */}
      <div style={{
        background: "#0a0f1e",
        borderBottom: "1px solid #1e293b",
        padding: "10px 20px",
        display: "flex", alignItems: "center", gap: 16,
        flexShrink: 0,
      }}>
        {/* Logo / title */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg,#8B6914,#C9A84C)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: 16, color: "#fff",
          }}>M</div>
          <span style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 15 }}>
            🍳 תצוגת מטבח
            {restName && <span style={{ color: "#64748b", fontWeight: 400 }}> · {restName}</span>}
          </span>
        </div>

        {/* Restaurant selector */}
        {restaurants.length > 1 && (
          <select
            value={restaurantId}
            onChange={e => setRestaurantId(e.target.value)}
            style={{
              background: "#1e293b", color: "#f1f5f9",
              border: "1px solid #334155", borderRadius: 8,
              padding: "6px 12px", fontSize: 13, cursor: "pointer",
            }}
          >
            {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* New order alert */}
        {newAlert && (
          <div style={{
            background: "#facc15", color: "#000",
            padding: "6px 14px", borderRadius: 20,
            fontWeight: 800, fontSize: 13,
            animation: "pulse 0.5s infinite",
          }}>🔔 הזמנה חדשה!</div>
        )}

        {/* Stats */}
        <div style={{
          display: "flex", gap: 16, alignItems: "center",
          color: "#64748b", fontSize: 12,
        }}>
          <span style={{ color: "#38bdf8", fontWeight: 700 }}>{byTable.size} שולחנות</span>
          <span>{now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</span>
          <span>↻ {countdown}s</span>
        </div>

        {/* Refresh + Fullscreen */}
        <button
          onClick={fetchOrders}
          style={{
            background: "#1e293b", color: "#94a3b8",
            border: "1px solid #334155", borderRadius: 8,
            padding: "6px 12px", fontSize: 12, cursor: "pointer",
          }}
        >↻ רענן</button>
        <button
          onClick={toggleFullscreen}
          style={{
            background: "#1e293b", color: "#94a3b8",
            border: "1px solid #334155", borderRadius: 8,
            padding: "6px 12px", fontSize: 12, cursor: "pointer",
          }}
        >{fullscreen ? "⊠ צא" : "⛶ מסך מלא"}</button>
      </div>

      {/* ── Cards grid ── */}
      <div style={{
        flex: 1,
        padding: "24px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
        gap: 20,
        alignContent: "start",
        overflowY: "auto",
      }}>
        {byTable.size === 0 ? (
          <div style={{
            gridColumn: "1 / -1",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            minHeight: 300, gap: 16, color: "#1e293b",
          }}>
            <div style={{ fontSize: 72 }}>✅</div>
            <div style={{ color: "#334155", fontWeight: 700, fontSize: 20 }}>אין הזמנות פעילות</div>
            <div style={{ color: "#1e3a5f", fontSize: 14 }}>המטבח פנוי · {now.toLocaleTimeString("he-IL")}</div>
          </div>
        ) : (
          Array.from(byTable.entries()).map(([tableNumber, tableOrders]) => (
            <TableCard
              key={tableNumber}
              tableNumber={tableNumber}
              orders={tableOrders}
              canUpdate={canUpdate}
              tick={tick}
              onConfirm={handleConfirm}
              onAdvance={handleAdvance}
              onGoBack={handleGoBack}
            />
          ))
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
