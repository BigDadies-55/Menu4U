"use client";

import { T } from "@/lib/ui";
import { useState, useEffect, useCallback, useRef } from "react";

/* ── Types ── */
type Modifier = { groupName: string; label: string; priceAdd: number };
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

/* ── Helpers ── */
function elapsed(d: string) { return Math.floor((Date.now() - new Date(d).getTime()) / 60000); }
function fmtElapsed(m: number) {
  if (m < 1) return "< 1 דק'";
  if (m < 60) return `${m} דק'`;
  return `${Math.floor(m / 60)}ש' ${m % 60}דק'`;
}
function timerColor(mins: number) {
  if (mins < 10) return T.green;
  if (mins < 20) return T.orange;
  return T.red;
}

/* ── Status config ── */
const STATUS_DOT: Record<string, string> = {
  PREPARING: T.cyan,
  DONE:      T.green,
  CANCELLED: T.overlay,
};
const STATUS_LABEL: Record<string, string> = {
  PREPARING: "בהכנה",
  DONE:      "מוכן ✓",
  CANCELLED: "בוטל",
};
const NEXT_LABEL: Record<string, string> = {
  PREPARING: "הוכן ✓",
};

const LS_STATION = "menu4u_kds_station_kitchen";

/* ── Table card ── */
function TableCard({
  tableNumber, orders, canUpdate, tick, stationFilter,
  onAdvance, onGoBack, onFireCourse,
}: {
  tableNumber: string; orders: Order[]; canUpdate: boolean; tick: number; stationFilter: string;
  onAdvance: (orderId: string, itemId: string) => void;
  onGoBack:  (orderId: string, itemId: string) => void;
  onFireCourse: (orderId: string, course: number) => void;
}) {
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const active = orders.filter(o => o.status !== "CANCELLED");

  // Apply station filter to items
  function itemMatchesStation(item: OrderItem) {
    if (!stationFilter) return true;
    const f = stationFilter.toLowerCase();
    const cat = item.item.category?.name?.toLowerCase() ?? "";
    const nm  = item.item.name.toLowerCase();
    return cat.includes(f) || nm.includes(f);
  }

  const allItems = active.flatMap(o => o.items.filter(i =>
    i.itemStatus !== "CANCELLED" && !i.heldUntilFired && !i.item.category?.autoReady && itemMatchesStation(i)
  ));
  const doneCount = allItems.filter(i => i.itemStatus === "DONE").length;
  const totalCount = allItems.length;
  const pct = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;
  const oldest = orders.reduce((a, b) => new Date(a.createdAt) < new Date(b.createdAt) ? a : b);
  const mins = elapsed(oldest.createdAt);
  const isUrgent = mins > 20 && doneCount < totalCount;
  const allDone = totalCount > 0 && doneCount === totalCount;

  // Skip card if station filter matches nothing
  if (stationFilter && allItems.length === 0) return null;

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
      background: allDone ? T.bg : T.bg,
      border: `2px solid ${allDone ? T.green : isUrgent ? T.red : T.bg}`,
      borderRadius: 20,
      display: "flex", flexDirection: "column",
      overflow: "hidden",
      boxShadow: allDone
        ? "0 0 0 3px #22c55e30, 0 8px 32px rgba(0,0,0,0.6)"
        : isUrgent
        ? "0 0 0 3px #ef444430, 0 8px 32px rgba(0,0,0,0.6)"
        : "0 4px 24px rgba(0,0,0,0.5)",
    }}>
      {/* ── Header ── */}
      <div style={{
        background: allDone ? T.bg : T.surface,
        padding: "14px 24px 12px",
        borderBottom: `1px solid ${allDone ? T.green : T.bg}`,
        display: "flex", alignItems: "center", gap: 16,
      }}>
        {/* Table number badge */}
        <div style={{
          background: allDone ? T.green : isUrgent ? T.red : T.yellow,
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
            <span style={{ color: allDone ? T.green : T.text, fontWeight: 700, fontSize: 15 }}>
              שולחן {tableNumber}
            </span>
            <span style={{
              color: allDone ? T.green : tColor, fontWeight: 800, fontSize: 17,
              animation: isUrgent ? "pulse 1s infinite" : undefined,
            }}>
              ⏱ {fmtElapsed(mins)}
            </span>
          </div>
          {/* Progress bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, height: 8, borderRadius: 4, background: T.bg, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 4,
                width: `${pct}%`,
                background: pct === 100 ? T.green : T.cyan,
                transition: "width 0.4s ease",
              }}/>
            </div>
            <span style={{ color: T.sub, fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
              {doneCount}/{totalCount}
            </span>
          </div>
        </div>

        {/* All done badge */}
        {allDone && (
          <div style={{
            background: T.green, color: "#000",
            borderRadius: 10, padding: "6px 14px",
            fontWeight: 900, fontSize: 13, flexShrink: 0,
          }}>✓ מוכן!</div>
        )}

        {/* Fire course buttons — show when there are held items */}
        {canUpdate && (() => {
          const heldByCourse = new Map<number, { orderId: string; count: number }>();
          for (const o of active) {
            for (const item of o.items) {
              if (item.heldUntilFired) {
                const existing = heldByCourse.get(item.course);
                if (existing) existing.count++;
                else heldByCourse.set(item.course, { orderId: o.id, count: 1 });
              }
            }
          }
          if (heldByCourse.size === 0) return null;
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
              {Array.from(heldByCourse.entries()).map(([course, { orderId, count }]) => (
                <button
                  key={course}
                  onClick={() => onFireCourse(orderId, course)}
                  style={{
                    background: "linear-gradient(135deg,#7c3aed,#a78bfa)",
                    color: "#fff", border: "none",
                    borderRadius: 8, padding: "6px 12px",
                    fontWeight: 800, fontSize: 12, cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  🔥 הצת {course === 2 ? "עיקרי" : "קינוח"} ({count})
                </button>
              ))}
            </div>
          );
        })()}
      </div>

      {/* ── Orders ── */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {active.map((order, oidx) => {
          const isDelivered = order.status === "DELIVERED";

          return (
            <div key={order.id}>
              {/* Order sub-header */}
              {(active.length > 1 || order.notes) && (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "6px 20px",
                  background: isDelivered ? T.bg : T.bg,
                  borderBottom: "1px solid #1e293b",
                }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: isDelivered ? T.green : T.muted,
                  }}>
                    {isDelivered ? "✅ הושלם" : `הזמנה ${oidx + 1}`}
                    {order.notes ? ` · 💬 ${order.notes}` : ""}
                  </span>
                </div>
              )}

              {/* Items */}
              {order.items.map(({ id: iid, quantity, notes, itemStatus, item, modifiers, course, heldUntilFired, firedAt, doneAt }) => {
                // Skip held items (not yet fired to kitchen)
                if (heldUntilFired) return null;
                // Skip items marked as no-kitchen (autoReady)
                if (item.category?.autoReady) return null;
                // Apply station filter
                if (!itemMatchesStation({ id: iid, quantity, notes, itemStatus, item, modifiers, course, heldUntilFired, firedAt, doneAt })) return null;

                const dot       = STATUS_DOT[itemStatus]   ?? T.muted;
                const isDone    = itemStatus === "DONE" || isDelivered;
                const isCancelled = itemStatus === "CANCELLED";
                const nextLabel = !isDelivered && !isCancelled ? NEXT_LABEL[itemStatus] : undefined;
                const busyAdv   = busy.has(iid);
                const busyBack  = busy.has(iid + "-b");

                return (
                  <div
                    key={`${iid}-${tick}`}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 20px",
                      background: isDone && !isDelivered
                        ? T.bg
                        : isCancelled ? T.bg : "transparent",
                      borderBottom: "1px solid #1e293b",
                      opacity: isCancelled ? 0.5 : 1,
                    }}
                  >
                    {/* Status dot */}
                    <div style={{
                      width: 14, height: 14, borderRadius: "50%",
                      background: isDelivered ? T.green : dot,
                      flexShrink: 0,
                      boxShadow: `0 0 6px ${isDelivered ? T.green : dot}88`,
                    }}/>

                    {/* Qty badge */}
                    <span style={{
                      background: (isDelivered ? T.green : dot) + "25",
                      color: isDelivered ? T.green : dot,
                      borderRadius: 8, padding: "3px 8px",
                      fontWeight: 800, fontSize: 14, flexShrink: 0,
                    }}>×{quantity}</span>

                    {/* Name + modifiers */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        color: isCancelled ? T.overlay : isDelivered ? T.sub : T.text,
                        fontWeight: 600, fontSize: 15,
                        textDecoration: isCancelled ? "line-through" : undefined,
                        lineHeight: 1.3,
                      }}>
                        {item.name}
                      </div>
                      {/* Course + category + timing */}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                        {course > 1 && (
                          <span style={{
                            background: course === 2 ? "#7c3aed22" : T.orange, color: course === 2 ? T.purple : "#000",
                            fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 20,
                          }}>
                            {course === 2 ? "🍖 עיקרי" : "🍮 קינוח"}
                          </span>
                        )}
                        {item.category?.name && (
                          <span style={{ color: T.sub, fontSize: 10, fontWeight: 600 }}>
                            {item.category.name}
                          </span>
                        )}
                        {firedAt && doneAt && (
                          <span style={{ color: T.green, fontSize: 10 }}>
                            ⏱ {Math.round((new Date(doneAt).getTime() - new Date(firedAt).getTime()) / 60000)} דק'
                          </span>
                        )}
                        {firedAt && !doneAt && (
                          <span style={{ color: T.cyan, fontSize: 10 }}>
                            🔥 {Math.round((Date.now() - new Date(firedAt).getTime()) / 60000)} דק' בהכנה
                          </span>
                        )}
                      </div>
                      {/* Modifiers — no prices */}
                      {modifiers && modifiers.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 3 }}>
                          {modifiers.map((m, i) => (
                            <span key={i} style={{
                              background: T.bg, color: T.green,
                              fontSize: 11, padding: "1px 6px", borderRadius: 20,
                            }}>
                              {m.label}
                            </span>
                          ))}
                        </div>
                      )}
                      {notes && (
                        <div style={{ color: T.muted, fontSize: 11, fontStyle: "italic", marginTop: 2 }}>
                          💬 {notes}
                        </div>
                      )}
                    </div>

                    {/* Status label */}
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
                        disabled={busy.has(iid + "-b")}
                        style={{
                          background: T.surface, color: T.muted,
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
                          background: itemStatus === "PREPARING" ? T.green : T.blue,
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
  const lastCountRef                    = useRef(0);
  const [newAlert, setNewAlert]         = useState(false);
  const [allReadyAlert, setAllReadyAlert] = useState(false);
  const [fullscreen, setFullscreen]     = useState(false);
  const [countdown, setCountdown]       = useState(60);
  const [now, setNow]                   = useState(new Date());
  const [stationFilter, setStationFilter] = useState("");
  const prevAllDone = useRef(false);
  const audioCtx = useRef<AudioContext | null>(null);
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
    // KDS shows only CONFIRMED+ orders
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
        osc.frequency.value = 880; gain.gain.setValueAtTime(0.4, audioCtx.current.currentTime);
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
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { fetchOrders(); return 60; }
        return c - 1;
      });
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // "All ready" notification
  useEffect(() => {
    const allItems = orders.flatMap(o => o.items.filter(i => i.itemStatus !== "CANCELLED"));
    const isAllDone = allItems.length > 0 && allItems.every(i => i.itemStatus === "DONE");
    if (isAllDone && !prevAllDone.current && orders.length > 0) {
      setAllReadyAlert(true);
      setTimeout(() => setAllReadyAlert(false), 6000);
    }
    prevAllDone.current = isAllDone;
  }, [orders]);

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

  /* Group by table — sort by oldest order */
  const byTable = new Map<string, Order[]>();
  const sortedOrders = [...orders].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  for (const o of sortedOrders) {
    const key = o.tableNumber ?? o.customerName ?? "–";
    if (!byTable.has(key)) byTable.set(key, []);
    byTable.get(key)!.push(o);
  }

  async function handleFireCourse(orderId: string, course: number) {
    await fetch(`/api/admin/orders/${orderId}/fire-course`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course }),
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
          const next = i.itemStatus === "PREPARING" ? "DONE" : i.itemStatus;
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
        const prev2 = i.itemStatus === "DONE" ? "PREPARING" : i.itemStatus;
        return { ...i, itemStatus: prev2 };
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
        background: T.bg,
        borderBottom: "1px solid #1e293b",
        padding: "10px 20px",
        display: "flex", alignItems: "center", gap: 16,
        flexShrink: 0, flexWrap: "wrap",
      }}>
        {/* Logo / title */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg,#8B6914,#C9A84C)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: 16, color: "#fff",
          }}>M</div>
          <span style={{ color: T.text, fontWeight: 700, fontSize: 15 }}>
            🍳 תצוגת מטבח
            {restName && <span style={{ color: T.muted, fontWeight: 400 }}> · {restName}</span>}
          </span>
        </div>

        {/* Restaurant selector */}
        {restaurants.length > 1 && (
          <select
            value={restaurantId}
            onChange={e => setRestaurantId(e.target.value)}
            style={{
              background: T.surface, color: T.text,
              border: "1px solid #334155", borderRadius: 8,
              padding: "6px 12px", fontSize: 13, cursor: "pointer",
            }}
          >
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

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* All ready alert */}
        {allReadyAlert && (
          <div style={{
            background: T.green, color: "#000",
            padding: "6px 16px", borderRadius: 20,
            fontWeight: 900, fontSize: 13,
            animation: "pulse 1s infinite",
          }}>🎉 כל ההזמנות מוכנות!</div>
        )}

        {/* New order alert */}
        {newAlert && (
          <div style={{
            background: T.yellow, color: "#000",
            padding: "6px 14px", borderRadius: 20,
            fontWeight: 800, fontSize: 13,
            animation: "pulse 0.5s infinite",
          }}>🔔 הזמנה חדשה!</div>
        )}

        {/* Stats */}
        <div style={{
          display: "flex", gap: 16, alignItems: "center",
          color: T.muted, fontSize: 12,
        }}>
          <span style={{ color: T.cyan, fontWeight: 700 }}>{byTable.size} שולחנות</span>
          <span>{now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</span>
          <span>↻ {countdown}s</span>
        </div>

        {/* Refresh + Fullscreen */}
        <button
          onClick={fetchOrders}
          title="רענן (R)"
          style={{
            background: T.surface, color: T.sub,
            border: "1px solid #334155", borderRadius: 8,
            padding: "6px 12px", fontSize: 12, cursor: "pointer",
          }}
        >↻ רענן</button>
        <button
          onClick={toggleFullscreen}
          title="מסך מלא (F)"
          style={{
            background: T.surface, color: T.sub,
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
            minHeight: 300, gap: 16, color: T.surface,
          }}>
            <div style={{ fontSize: 72 }}>✅</div>
            <div style={{ color: T.muted, fontWeight: 700, fontSize: 20 }}>
              {stationFilter ? `אין פריטים לעמדה "${stationFilter}"` : "אין הזמנות פעילות"}
            </div>
            <div style={{ color: T.bg, fontSize: 14 }}>המטבח פנוי · {now.toLocaleTimeString("he-IL")}</div>
          </div>
        ) : (
          Array.from(byTable.entries()).map(([tableNumber, tableOrders]) => (
            <TableCard
              key={tableNumber}
              tableNumber={tableNumber}
              orders={tableOrders}
              canUpdate={canUpdate}
              tick={tick}
              stationFilter={stationFilter}
              onAdvance={handleAdvance}
              onGoBack={handleGoBack}
              onFireCourse={handleFireCourse}
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
