"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/* ── Types ── */
type Modifier  = { groupName: string; label: string; priceAdd: number };
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

/* Flat item + order context — one card in the kanban */
type KanbanCard = {
  orderId:     string;
  orderStatus: string;
  tableLabel:  string;
  createdAt:   string;
  orderNotes:  string | null;
} & OrderItem;

/* ── Helpers ── */
function elapsed(d: string) { return Math.floor((Date.now() - new Date(d).getTime()) / 60000); }
function fmtElapsed(m: number) {
  if (m < 1) return "< 1′";
  if (m < 60) return `${m}′`;
  return `${Math.floor(m / 60)}ש'${m % 60}′`;
}
function timerColor(mins: number, urgent: boolean) {
  if (urgent || mins >= 20) return "#ef4444";
  if (mins >= 10)           return "#f59e0b";
  return "#22c55e";
}

/* ── Column config ── */
const COLS: { status: string; label: string; icon: string; accent: string; bg: string; border: string }[] = [
  { status: "PENDING",   label: "ממתין",  icon: "🕐", accent: "#f59e0b", bg: "#1c1500", border: "#78350f" },
  { status: "PREPARING", label: "בהכנה",  icon: "🔵", accent: "#38bdf8", bg: "#001a2e", border: "#0369a1" },
  { status: "DONE",      label: "מוכן",   icon: "✅", accent: "#22c55e", bg: "#002211", border: "#166534" },
];

/* ── Item card ── */
function KanbanCard({
  card, canUpdate, tick,
  onConfirmOrder, onAdvance, onGoBack,
}: {
  card: KanbanCard;
  canUpdate: boolean;
  tick: number;
  onConfirmOrder: (orderId: string) => void;
  onAdvance: (orderId: string, itemId: string) => void;
  onGoBack:  (orderId: string, itemId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [busyBack, setBusyBack] = useState(false);

  const mins        = elapsed(card.createdAt);
  const isOrderPend = card.orderStatus === "PENDING";
  const col         = COLS.find(c => c.status === card.itemStatus) ?? COLS[0];
  const isCancelled = card.itemStatus === "CANCELLED";
  const isDone      = card.itemStatus === "DONE";
  const tColor      = timerColor(mins, mins >= 20);

  const canAdvance  = canUpdate && !isOrderPend && !isDone && !isCancelled;
  const canGoBack   = canUpdate && !isOrderPend && (card.itemStatus === "PREPARING" || card.itemStatus === "DONE");

  async function advance() {
    setBusy(true);
    await onAdvance(card.orderId, card.id);
    setBusy(false);
  }
  async function goBack() {
    setBusyBack(true);
    await onGoBack(card.orderId, card.id);
    setBusyBack(false);
  }

  return (
    <div
      key={`${card.id}-${tick}`}
      style={{
        background: col.bg,
        border: `1.5px solid ${col.border}`,
        borderRadius: 14,
        overflow: "hidden",
        opacity: isCancelled ? 0.4 : 1,
        boxShadow: `0 2px 12px rgba(0,0,0,0.5)`,
        transition: "transform 0.15s",
      }}
    >
      {/* Card header: table + timer */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 12px 8px",
        borderBottom: `1px solid ${col.border}55`,
        background: `${col.accent}12`,
      }}>
        {/* Table badge */}
        <div style={{
          background: col.accent,
          color: card.itemStatus === "PENDING" ? "#000" : "#fff",
          borderRadius: 8,
          minWidth: 40, height: 40,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 900, fontSize: 18, flexShrink: 0,
        }}>
          {card.tableLabel === "–" ? "?" : card.tableLabel}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>
            שולחן {card.tableLabel}
          </div>
          <div style={{ color: tColor, fontWeight: 700, fontSize: 12 }}>
            ⏱ {fmtElapsed(mins)}
          </div>
        </div>

        {/* Quantity badge */}
        <span style={{
          background: `${col.accent}30`, color: col.accent,
          borderRadius: 8, padding: "4px 10px",
          fontWeight: 900, fontSize: 16, flexShrink: 0,
        }}>×{card.quantity}</span>
      </div>

      {/* Item body */}
      <div style={{ padding: "10px 12px" }}>
        {/* Unconfirmed order banner */}
        {isOrderPend && (
          <div style={{
            background: "#f59e0b22", border: "1px solid #f59e0b55",
            borderRadius: 6, padding: "4px 8px", marginBottom: 8,
            color: "#fbbf24", fontSize: 11, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span>⚠️ ממתין לאישור הזמנה</span>
            {canUpdate && (
              <button
                onClick={() => onConfirmOrder(card.orderId)}
                style={{
                  background: "#f59e0b", color: "#000",
                  border: "none", borderRadius: 6,
                  padding: "3px 10px", fontSize: 11, fontWeight: 900, cursor: "pointer",
                }}>אשר</button>
            )}
          </div>
        )}

        {/* Item name */}
        <div style={{
          color: isDone ? "#86efac" : "#f1f5f9",
          fontWeight: 700, fontSize: 16, lineHeight: 1.3,
          marginBottom: 4,
          textDecoration: isCancelled ? "line-through" : undefined,
        }}>
          {card.item.name}
        </div>

        {/* Modifiers */}
        {card.modifiers && card.modifiers.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
            {card.modifiers.map((m, i) => (
              <span key={i} style={{
                background: "#1e3a2e", color: "#4ade80",
                fontSize: 11, padding: "2px 7px", borderRadius: 20,
              }}>
                {m.label}{m.priceAdd > 0 ? ` +₪${m.priceAdd}` : ""}
              </span>
            ))}
          </div>
        )}

        {/* Notes */}
        {(card.notes || card.orderNotes) && (
          <div style={{ color: "#64748b", fontSize: 11, fontStyle: "italic", marginBottom: 6 }}>
            💬 {card.notes ?? card.orderNotes}
          </div>
        )}

        {/* Action buttons */}
        {!isCancelled && (
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            {canGoBack && (
              <button
                onClick={goBack}
                disabled={busyBack}
                style={{
                  background: "#1e293b", color: "#94a3b8",
                  border: "1px solid #334155", borderRadius: 8,
                  width: 36, height: 36, fontSize: 14,
                  cursor: busyBack ? "wait" : "pointer",
                  opacity: busyBack ? 0.4 : 1, flexShrink: 0,
                }}
              >←</button>
            )}

            {canAdvance && (
              <button
                onClick={advance}
                disabled={busy}
                style={{
                  flex: 1,
                  background: card.itemStatus === "PREPARING"
                    ? "linear-gradient(135deg,#15803d,#22c55e)"
                    : "linear-gradient(135deg,#0369a1,#38bdf8)",
                  color: "#fff", border: "none", borderRadius: 10,
                  padding: "10px 0", fontWeight: 800, fontSize: 14,
                  cursor: busy ? "wait" : "pointer",
                  opacity: busy ? 0.5 : 1,
                  boxShadow: card.itemStatus === "PREPARING"
                    ? "0 2px 8px #22c55e50" : "0 2px 8px #38bdf850",
                }}
              >
                {busy ? "..." : card.itemStatus === "PENDING" ? "התחל →" : "הוכן ✓"}
              </button>
            )}

            {isDone && !isOrderPend && (
              <div style={{
                flex: 1, textAlign: "center",
                color: "#22c55e", fontWeight: 800, fontSize: 14,
                padding: "10px 0",
                background: "#052e16", borderRadius: 10,
              }}>✓ מוכן למסירה</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main ── */
export default function KanbanClient({
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
  const [countdown, setCountdown]       = useState(60);
  const [now, setNow]                   = useState(new Date());
  const [fullscreen, setFullscreen]     = useState(false);
  const audioCtx  = useRef<AudioContext | null>(null);
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
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.4, audioCtx.current.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.current.currentTime + 0.5);
        osc.start(); osc.stop(audioCtx.current.currentTime + 0.5);
      } catch { /* audio blocked */ }
    }
    setLastCount(active.length);
    setOrders(active);
    setTick(t => t + 1);
    setCountdown(60);
  }, [restaurantId, lastCount]);

  useEffect(() => { if (restaurantId) fetchOrders(); }, [restaurantId]);

  // SSE real-time updates
  useEffect(() => {
    if (!restaurantId) return;
    const url = `/api/admin/orders/stream?restaurantId=${restaurantId}`;
    const es = new EventSource(url);
    es.onmessage = () => { fetchOrders(); };
    es.onerror = () => { es.close(); }; // Will fall back to polling
    return () => es.close();
  }, [restaurantId, fetchOrders]);

  useEffect(() => {
    const iv = setInterval(() => {
      setCountdown(c => { if (c <= 1) { fetchOrders(); return 60; } return c - 1; });
      setNow(new Date());
    }, 1000);
    return () => clearInterval(iv);
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

  /* Flatten orders → KanbanCard[] per status, skip CANCELLED items */
  const lanes: Record<string, KanbanCard[]> = { PENDING: [], PREPARING: [], DONE: [] };
  for (const order of orders) {
    const tableLabel = order.tableNumber ?? order.customerName ?? "–";
    for (const item of order.items) {
      if (item.itemStatus === "CANCELLED") continue;
      const card: KanbanCard = {
        ...item,
        orderId: order.id,
        orderStatus: order.status,
        tableLabel,
        createdAt: order.createdAt,
        orderNotes: order.notes,
      };
      if (lanes[item.itemStatus]) lanes[item.itemStatus].push(card);
    }
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
      if (orderDelivered) { fetchOrders(); return; }
      setOrders(prev => prev.map(o => o.id !== orderId ? o : {
        ...o,
        items: o.items.map(i => i.id !== itemId ? i : {
          ...i,
          itemStatus: i.itemStatus === "PENDING" ? "PREPARING" : "DONE",
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
      items: o.items.map(i => i.id !== itemId ? i : {
        ...i,
        itemStatus: i.itemStatus === "DONE" ? "PREPARING" : "PENDING",
      }),
    }));
    setTick(t => t + 1);
  }

  const totalItems = Object.values(lanes).reduce((s, l) => s + l.length, 0);
  const restName = restaurants.find(r => r.id === restaurantId)?.name ?? "";

  return (
    <div ref={containerRef} style={{
      minHeight: "100vh",
      background: "#0a0a0a",
      display: "flex", flexDirection: "column",
      fontFamily: "'Heebo', 'Segoe UI', sans-serif",
      direction: "rtl",
    }}>
      {/* ── Top bar ── */}
      <div style={{
        background: "#111",
        borderBottom: "1px solid #222",
        padding: "10px 20px",
        display: "flex", alignItems: "center", gap: 14, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: "linear-gradient(135deg,#8B6914,#C9A84C)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, color: "#fff", fontSize: 15,
          }}>M</div>
          <span style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 14 }}>
            📋 Kanban מטבח
            {restName && <span style={{ color: "#555", fontWeight: 400 }}> · {restName}</span>}
          </span>
        </div>

        {restaurants.length > 1 && (
          <select value={restaurantId} onChange={e => setRestaurantId(e.target.value)}
            style={{ background: "#222", color: "#f1f5f9", border: "1px solid #333", borderRadius: 8, padding: "5px 10px", fontSize: 13 }}>
            {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}

        <div style={{ flex: 1 }} />

        {newAlert && (
          <div style={{
            background: "#facc15", color: "#000",
            padding: "5px 14px", borderRadius: 20,
            fontWeight: 800, fontSize: 13,
          }}>🔔 הזמנה חדשה!</div>
        )}

        {/* Lane counters in top bar */}
        <div style={{ display: "flex", gap: 12 }}>
          {COLS.map(col => (
            <div key={col.status} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 13 }}>{col.icon}</span>
              <span style={{ color: col.accent, fontWeight: 800, fontSize: 14 }}>
                {lanes[col.status].length}
              </span>
              <span style={{ color: "#444", fontSize: 12 }}>{col.label}</span>
            </div>
          ))}
        </div>

        <span style={{ color: "#444", fontSize: 12 }}>
          {now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })} · ↻{countdown}s
        </span>

        <button onClick={fetchOrders}
          style={{ background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer" }}>
          ↻
        </button>
        <button onClick={toggleFullscreen}
          style={{ background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer" }}>
          {fullscreen ? "⊠ צא" : "⛶ מסך מלא"}
        </button>
      </div>

      {/* ── Kanban board ── */}
      {totalItems === 0 ? (
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 14, color: "#222",
        }}>
          <div style={{ fontSize: 80 }}>✅</div>
          <div style={{ color: "#333", fontWeight: 700, fontSize: 22 }}>אין הזמנות פעילות</div>
          <div style={{ color: "#2a2a2a", fontSize: 14 }}>המטבח פנוי · {now.toLocaleTimeString("he-IL")}</div>
        </div>
      ) : (
        <div style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 0,
          overflow: "hidden",
        }}>
          {COLS.map((col, ci) => (
            <div key={col.status} style={{
              display: "flex", flexDirection: "column",
              borderRight: ci < COLS.length - 1 ? "1px solid #1a1a1a" : undefined,
              overflow: "hidden",
            }}>
              {/* Column header */}
              <div style={{
                padding: "12px 16px",
                background: `${col.accent}10`,
                borderBottom: `2px solid ${col.accent}`,
                display: "flex", alignItems: "center", gap: 10,
                flexShrink: 0,
              }}>
                <span style={{ fontSize: 20 }}>{col.icon}</span>
                <span style={{ color: col.accent, fontWeight: 800, fontSize: 16 }}>{col.label}</span>
                <span style={{
                  background: col.accent, color: col.status === "PENDING" ? "#000" : "#fff",
                  borderRadius: 20, padding: "2px 10px",
                  fontWeight: 900, fontSize: 13,
                }}>{lanes[col.status].length}</span>
              </div>

              {/* Cards */}
              <div style={{
                flex: 1, overflowY: "auto",
                padding: 12,
                display: "flex", flexDirection: "column", gap: 10,
              }}>
                {lanes[col.status].length === 0 ? (
                  <div style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#222", fontSize: 28, paddingTop: 40,
                  }}>—</div>
                ) : (
                  lanes[col.status].map(card => (
                    <KanbanCard
                      key={`${card.id}-${tick}`}
                      card={card}
                      canUpdate={canUpdate}
                      tick={tick}
                      onConfirmOrder={handleConfirm}
                      onAdvance={handleAdvance}
                      onGoBack={handleGoBack}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
