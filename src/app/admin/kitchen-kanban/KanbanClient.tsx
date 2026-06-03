"use client";

import { T } from "@/lib/ui";
import { useState, useEffect, useCallback, useRef } from "react";

/* ── Types ── */
type Modifier  = { groupName: string; label: string; priceAdd: number };
type OrderItem = {
  id: string; quantity: number; notes: string | null;
  itemStatus: string;
  course: number;
  heldUntilFired: boolean;
  firedAt: string | null;
  doneAt: string | null;
  item: { name: string; prepTime: number | null; category?: { name: string; autoReady?: boolean } };
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
  if (urgent || mins >= 20) return T.red;
  if (mins >= 10)           return T.orange;
  return T.green;
}

/* ── Column config ── */
const COLS: { status: string; label: string; icon: string; accent: string; bg: string; border: string }[] = [
  { status: "PREPARING", label: "בהכנה",  icon: "🔵", accent: T.cyan, bg: T.bg, border: T.blue },
  { status: "DONE",      label: "מוכן",   icon: "✅", accent: T.green, bg: T.bg, border: T.green },
];

const LS_STATION = "menu4u_kds_station_kanban";

/* ── Item card ── */
function KanbanCard({
  card, canUpdate, tick,
  onAdvance, onGoBack,
}: {
  card: KanbanCard;
  canUpdate: boolean;
  tick: number;
  onAdvance: (orderId: string, itemId: string) => void;
  onGoBack:  (orderId: string, itemId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [busyBack, setBusyBack] = useState(false);

  const mins        = elapsed(card.createdAt);
  const col         = COLS.find(c => c.status === card.itemStatus) ?? COLS[0];
  const isCancelled = card.itemStatus === "CANCELLED";
  const isDone      = card.itemStatus === "DONE";
  const tColor      = timerColor(mins, mins >= 20);

  const canAdvance  = canUpdate && !isDone && !isCancelled;
  const canGoBack   = canUpdate && (card.itemStatus === "PREPARING" || card.itemStatus === "DONE");

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
          color: card.itemStatus === "PREPARING" ? "#fff" : "#fff",
          borderRadius: 8,
          minWidth: 40, height: 40,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 900, fontSize: 18, flexShrink: 0,
        }}>
          {card.tableLabel === "–" ? "?" : card.tableLabel}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: T.text, fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>
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
        {/* Category tag */}
        {card.item.category?.name && (
          <div style={{
            display: "inline-block",
            background: T.surface, color: T.muted,
            fontSize: 10, padding: "2px 7px", borderRadius: 20,
            marginBottom: 6, fontWeight: 600, letterSpacing: 0.5,
          }}>
            {card.item.category.name}
          </div>
        )}

        {/* Item name */}
        <div style={{
          color: isDone ? T.green : T.text,
          fontWeight: 700, fontSize: 16, lineHeight: 1.3,
          marginBottom: 4,
          textDecoration: isCancelled ? "line-through" : undefined,
        }}>
          {card.item.name}
        </div>

        {/* Modifiers — no prices */}
        {card.modifiers && card.modifiers.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
            {card.modifiers.map((m, i) => (
              <span key={i} style={{
                background: T.bg, color: T.green,
                fontSize: 11, padding: "2px 7px", borderRadius: 20,
              }}>
                {m.label}
              </span>
            ))}
          </div>
        )}

        {/* Notes */}
        {(card.notes || card.orderNotes) && (
          <div style={{ color: T.muted, fontSize: 11, fontStyle: "italic", marginBottom: 6 }}>
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
                  background: T.surface, color: T.sub,
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
                {busy ? "..." : "הוכן ✓"}
              </button>
            )}

            {isDone && (
              <div style={{
                flex: 1, textAlign: "center",
                color: T.green, fontWeight: 800, fontSize: 14,
                padding: "10px 0",
                background: T.bg, borderRadius: 10,
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
  const lastCountRef                    = useRef(0);
  const [newAlert, setNewAlert]         = useState(false);
  const [countdown, setCountdown]       = useState(60);
  const [now, setNow]                   = useState(new Date());
  const [fullscreen, setFullscreen]     = useState(false);
  const [stationFilter, setStationFilter] = useState("");
  const [allReadyAlert, setAllReadyAlert] = useState(false);
  const prevAllDone = useRef(false);
  const audioCtx  = useRef<AudioContext | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load station filter from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(LS_STATION);
    if (saved) setStationFilter(saved);
  }, []);

  function saveStationFilter(val: string) {
    setStationFilter(val);
    if (val) localStorage.setItem(LS_STATION, val);
    else localStorage.removeItem(LS_STATION);
  }

  const fetchOrders = useCallback(async () => {
    const params = new URLSearchParams({ activeOnly: "1" });
    if (restaurantId) params.set("restaurantId", restaurantId);
    const res = await fetch(`/api/admin/orders?${params}`);
    if (!res.ok) return;
    const data: Order[] = await res.json();
    // KDS shows only CONFIRMED+ orders (not PENDING, not DELIVERED, not CANCELLED)
    const active = data.filter(o =>
      o.status !== "DELIVERED" && o.status !== "CANCELLED" && o.status !== "PENDING"
    );
    if (active.length > lastCountRef.current && lastCountRef.current > 0) {
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
    lastCountRef.current = active.length;
    setOrders(active);
    setTick(t => t + 1);
    setCountdown(60);
  }, [restaurantId]);    // ← stable, no lastCount dependency

  useEffect(() => { if (restaurantId) fetchOrders(); }, [restaurantId, fetchOrders]);

  // SSE real-time updates — auto-reconnect on error
  useEffect(() => {
    if (!restaurantId) return;
    let es: EventSource;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    function connect() {
      es = new EventSource(`/api/admin/orders/stream?restaurantId=${restaurantId}`);
      es.onmessage = () => { fetchOrders(); };
      es.onerror = () => { es.close(); reconnectTimer = setTimeout(connect, 5000); };
    }
    connect();
    return () => { es?.close(); clearTimeout(reconnectTimer); };
  }, [restaurantId, fetchOrders]);

  useEffect(() => {
    const iv = setInterval(() => {
      setCountdown(c => { if (c <= 1) { fetchOrders(); return 60; } return c - 1; });
      setNow(new Date());
    }, 1000);
    return () => clearInterval(iv);
  }, [fetchOrders]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "r" || e.key === "R") fetchOrders();
      if (e.key === "f" || e.key === "F") toggleFullscreen();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
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

  /* Flatten orders → KanbanCard[] per status, skip CANCELLED & PENDING items */
  const lanesPreparing: KanbanCard[] = [];
  const lanesDone: KanbanCard[]      = [];

  // Sort orders oldest-first so oldest float to top
  const sortedOrders = [...orders].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  for (const order of sortedOrders) {
    const tableLabel = order.tableNumber ?? order.customerName ?? "–";
    for (const item of order.items) {
      if (item.itemStatus === "CANCELLED" || item.itemStatus === "PENDING") continue;
      // Hide items held for firing (courses not yet fired)
      if (item.heldUntilFired) continue;
      // Skip items marked as no-kitchen (autoReady / ללא מטבח)
      if (item.item.category?.autoReady) continue;
      // Station filter: match against category name or item name
      if (stationFilter) {
        const f = stationFilter.toLowerCase();
        const cat = item.item.category?.name?.toLowerCase() ?? "";
        const nm  = item.item.name.toLowerCase();
        if (!cat.includes(f) && !nm.includes(f)) continue;
      }
      const card: KanbanCard = {
        ...item,
        orderId: order.id,
        orderStatus: order.status,
        tableLabel,
        createdAt: order.createdAt,
        orderNotes: order.notes,
      };
      if (item.itemStatus === "PREPARING") lanesPreparing.push(card);
      else if (item.itemStatus === "DONE")  lanesDone.push(card);
    }
  }

  const lanes: Record<string, KanbanCard[]> = { PREPARING: lanesPreparing, DONE: lanesDone };
  const totalItems = lanesPreparing.length + lanesDone.length;

  // "All ready" notification: when all items are DONE
  useEffect(() => {
    const allItems = [...lanesPreparing, ...lanesDone];
    const isAllDone = allItems.length > 0 && lanesPreparing.length === 0;
    if (isAllDone && !prevAllDone.current) {
      setAllReadyAlert(true);
      setTimeout(() => setAllReadyAlert(false), 6000);
    }
    prevAllDone.current = isAllDone;
  }, [lanesPreparing.length, lanesDone.length]);

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
          itemStatus: i.itemStatus === "PREPARING" ? "DONE" : i.itemStatus,
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
        itemStatus: i.itemStatus === "DONE" ? "PREPARING" : i.itemStatus,
      }),
    }));
    setTick(t => t + 1);
  }

  const restName = restaurants.find(r => r.id === restaurantId)?.name ?? "";

  return (
    <div ref={containerRef} style={{
      minHeight: "100vh",
      background: T.bg,
      display: "flex", flexDirection: "column",
      fontFamily: "'Heebo', 'Segoe UI', sans-serif",
      direction: "rtl",
    }}>
      {/* ── Top bar ── */}
      <div style={{
        background: "#111",
        borderBottom: "1px solid #222",
        padding: "10px 20px",
        display: "flex", alignItems: "center", gap: 14, flexShrink: 0, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: "linear-gradient(135deg,#8B6914,#C9A84C)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, color: "#fff", fontSize: 15,
          }}>M</div>
          <span style={{ color: T.text, fontWeight: 700, fontSize: 14 }}>
            📋 Kanban מטבח
            {restName && <span style={{ color: "#555", fontWeight: 400 }}> · {restName}</span>}
          </span>
        </div>

        {restaurants.length > 1 && (
          <select value={restaurantId} onChange={e => setRestaurantId(e.target.value)}
            style={{ background: "#222", color: T.text, border: "1px solid #333", borderRadius: 8, padding: "5px 10px", fontSize: 13 }}>
            {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}

        {/* Station filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: T.muted, fontSize: 12 }}>🔧 עמדה:</span>
          <input
            type="text"
            value={stationFilter}
            onChange={e => saveStationFilter(e.target.value)}
            placeholder="סנן לפי קטגוריה..."
            style={{
              background: T.surface, color: T.text,
              border: stationFilter ? "1px solid #c9a84c" : "1px solid #334155",
              borderRadius: 8, padding: "4px 10px", fontSize: 12,
              width: 160, outline: "none",
            }}
          />
          {stationFilter && (
            <button onClick={() => saveStationFilter("")}
              style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 16, padding: "0 4px" }}>
              ×
            </button>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {allReadyAlert && (
          <div style={{
            background: T.green, color: "#000",
            padding: "6px 16px", borderRadius: 20,
            fontWeight: 900, fontSize: 13,
            animation: "pulse 1s infinite",
          }}>🎉 כל ההזמנות מוכנות!</div>
        )}

        {newAlert && (
          <div style={{
            background: T.yellow, color: "#000",
            padding: "5px 14px", borderRadius: 20,
            fontWeight: 800, fontSize: 13,
          }}>🔔 הזמנה חדשה!</div>
        )}

        {/* Lane counters */}
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
          title="רענן (R)"
          style={{ background: T.surface, color: T.sub, border: "1px solid #334155", borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer" }}>
          ↻
        </button>
        <button onClick={toggleFullscreen}
          title="מסך מלא (F)"
          style={{ background: T.surface, color: T.sub, border: "1px solid #334155", borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer" }}>
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
          <div style={{ color: "#333", fontWeight: 700, fontSize: 22 }}>
            {stationFilter ? `אין פריטים לעמדה "${stationFilter}"` : "אין הזמנות פעילות"}
          </div>
          <div style={{ color: T.surface, fontSize: 14 }}>המטבח פנוי · {now.toLocaleTimeString("he-IL")}</div>
        </div>
      ) : (
        <div style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 0,
          overflow: "hidden",
        }}>
          {COLS.map((col, ci) => {
            const isAllDoneCol = col.status === "DONE" && lanesPreparing.length === 0 && lanesDone.length > 0;
            return (
              <div key={col.status} style={{
                display: "flex", flexDirection: "column",
                borderRight: ci < COLS.length - 1 ? "1px solid #1a1a1a" : undefined,
                overflow: "hidden",
              }}>
                {/* Column header */}
                <div style={{
                  padding: "12px 16px",
                  background: isAllDoneCol ? T.bg : `${col.accent}10`,
                  borderBottom: `2px solid ${isAllDoneCol ? T.green : col.accent}`,
                  display: "flex", alignItems: "center", gap: 10,
                  flexShrink: 0,
                  transition: "background 0.5s",
                }}>
                  <span style={{ fontSize: 20 }}>{isAllDoneCol ? "🎉" : col.icon}</span>
                  <span style={{ color: isAllDoneCol ? T.green : col.accent, fontWeight: 800, fontSize: 16 }}>
                    {isAllDoneCol ? "הכל מוכן!" : col.label}
                  </span>
                  <span style={{
                    background: isAllDoneCol ? T.green : col.accent,
                    color: "#fff",
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
                        onAdvance={handleAdvance}
                        onGoBack={handleGoBack}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>
    </div>
  );
}
