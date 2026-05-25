"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/* ── Types ── */
type Modifier  = { groupName: string; label: string; priceAdd: number };
type OrderItem = {
  id: string; quantity: number; notes: string | null; itemStatus: string;
  item: { name: string; prepTime: number | null; category?: { name: string } };
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
  if (m < 1) return "< 1′";
  if (m < 60) return `${m}′`;
  return `${Math.floor(m / 60)}h${m % 60}′`;
}

function urgencyColor(mins: number, allDone: boolean) {
  if (allDone) return "#22c55e";
  if (mins >= 20) return "#ef4444";
  if (mins >= 10) return "#f59e0b";
  return "#e2e8f0";
}

const LS_STATION = "menu4u_kds_station_tickets";

/* ── Ticket card ── */
function Ticket({
  tableNumber, orders, canUpdate, tick, stationFilter,
  onAdvance, onGoBack,
}: {
  tableNumber: string;
  orders: Order[];
  canUpdate: boolean;
  tick: number;
  stationFilter: string;
  onAdvance: (orderId: string, itemId: string) => void;
  onGoBack:  (orderId: string, itemId: string) => void;
}) {
  const [busy, setBusy] = useState<Set<string>>(new Set());

  function itemMatchesStation(item: OrderItem) {
    if (!stationFilter) return true;
    const f = stationFilter.toLowerCase();
    return (item.item.category?.name?.toLowerCase() ?? "").includes(f) ||
           item.item.name.toLowerCase().includes(f);
  }

  const active   = orders.filter(o => o.status !== "CANCELLED");
  const allItems = active.flatMap(o => o.items.filter(i => i.itemStatus !== "CANCELLED" && itemMatchesStation(i)));
  const doneCount = allItems.filter(i => i.itemStatus === "DONE").length;
  const totalCount = allItems.length;
  const allDone  = totalCount > 0 && doneCount === totalCount;
  const oldest   = orders.reduce((a, b) => new Date(a.createdAt) < new Date(b.createdAt) ? a : b);
  const mins     = elapsed(oldest.createdAt);
  const isUrgent = mins >= 20 && !allDone;
  const accentColor = urgencyColor(mins, allDone);

  // Skip if nothing matches station filter
  if (stationFilter && allItems.length === 0) return null;

  async function adv(orderId: string, itemId: string) {
    setBusy(p => new Set(p).add(itemId));
    await onAdvance(orderId, itemId);
    setBusy(p => { const n = new Set(p); n.delete(itemId); return n; });
  }
  async function back(orderId: string, itemId: string) {
    setBusy(p => new Set(p).add(itemId + "b"));
    await onGoBack(orderId, itemId);
    setBusy(p => { const n = new Set(p); n.delete(itemId + "b"); return n; });
  }

  return (
    <div style={{
      background: "#141414",
      border: `1px solid ${isUrgent ? "#ef444460" : allDone ? "#22c55e40" : "#2a2a2a"}`,
      borderTop: `4px solid ${accentColor}`,
      borderRadius: 4,
      fontFamily: "'Courier New', 'Courier', monospace",
      boxShadow: allDone
        ? `0 0 0 1px #22c55e30, 0 4px 24px rgba(0,0,0,0.7)`
        : isUrgent
        ? `0 0 0 1px #ef444430, 0 4px 24px rgba(0,0,0,0.7)`
        : `0 4px 16px rgba(0,0,0,0.5)`,
      display: "flex", flexDirection: "column",
      position: "relative",
      animation: isUrgent ? "ticketPulse 2s ease-in-out infinite" : undefined,
    }}>

      {/* ── Ticket header ── */}
      <div style={{
        padding: "10px 14px 8px",
        borderBottom: "1px dashed #2a2a2a",
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        gap: 10,
      }}>
        {/* Left: table number */}
        <div>
          <div style={{ color: "#666", fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 2 }}>
            TABLE
          </div>
          <div style={{
            color: accentColor, fontWeight: 900,
            fontSize: tableNumber.length <= 2 ? 42 : tableNumber.length <= 4 ? 32 : 22,
            lineHeight: 1, letterSpacing: -1,
          }}>
            {tableNumber === "–" ? "?" : tableNumber}
          </div>
        </div>

        {/* Right: time + progress */}
        <div style={{ textAlign: "left", flexShrink: 0 }}>
          <div style={{
            color: accentColor,
            fontSize: 16, fontWeight: 900, letterSpacing: 1,
            animation: isUrgent ? "ticketPulse 1s ease-in-out infinite" : undefined,
          }}>
            ⏱ {fmtElapsed(mins)}
          </div>
          <div style={{ color: "#555", fontSize: 11, marginTop: 2 }}>
            {doneCount}/{totalCount} פריטים
          </div>
        </div>
      </div>

      {/* ── Items ── */}
      <div style={{ flex: 1 }}>
        {active.map((order, oidx) => {
          const isDelivered = order.status === "DELIVERED";

          return (
            <div key={order.id}>
              {/* Order divider */}
              {active.length > 1 && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "5px 14px",
                  borderBottom: "1px dashed #222",
                  background: isDelivered ? "#0a1a0a" : "#111",
                }}>
                  <span style={{ color: "#444", fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>
                    ORDER {oidx + 1}
                  </span>
                </div>
              )}

              {/* Item rows */}
              {order.items.map(({ id: iid, quantity, notes, itemStatus, item, modifiers }) => {
                // Station filter
                if (!itemMatchesStation({ id: iid, quantity, notes, itemStatus, item, modifiers })) return null;

                const isDone      = itemStatus === "DONE" || isDelivered;
                const isCancelled = itemStatus === "CANCELLED";
                const isPreparing = itemStatus === "PREPARING";
                const isBusy      = busy.has(iid);
                const isBusyBack  = busy.has(iid + "b");

                const checkbox = isDone
                  ? <span style={{ color: "#22c55e", fontSize: 14 }}>☑</span>
                  : isCancelled
                    ? <span style={{ color: "#333", fontSize: 14 }}>☒</span>
                    : isPreparing
                      ? <span style={{ color: "#38bdf8", fontSize: 14 }}>◈</span>
                      : <span style={{ color: "#444", fontSize: 14 }}>☐</span>;

                return (
                  <div key={`${iid}-${tick}`} style={{
                    display: "flex", alignItems: "flex-start", gap: 8,
                    padding: "8px 14px",
                    borderBottom: "1px solid #1a1a1a",
                    background: isDone && !isDelivered ? "#081208" : "transparent",
                    opacity: isCancelled ? 0.35 : 1,
                  }}>
                    {/* Checkbox */}
                    <div style={{ flexShrink: 0, marginTop: 1 }}>{checkbox}</div>

                    {/* Quantity */}
                    <span style={{
                      color: isDone ? "#22c55e" : isPreparing ? "#38bdf8" : "#888",
                      fontWeight: 900, fontSize: 13, flexShrink: 0, minWidth: 22,
                    }}>×{quantity}</span>

                    {/* Name + modifiers + notes */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        color: isCancelled ? "#333"
                          : isDone ? "#6ee7a0"
                          : isPreparing ? "#7dd3fc"
                          : "#e2e8f0",
                        fontWeight: isDone || isPreparing ? 700 : 400,
                        fontSize: 14,
                        textDecoration: isCancelled ? "line-through" : undefined,
                        letterSpacing: 0.3,
                      }}>
                        {item.name}
                      </div>
                      {item.category?.name && (
                        <div style={{ color: "#444", fontSize: 9, letterSpacing: 1, marginTop: 1 }}>
                          {item.category.name.toUpperCase()}
                        </div>
                      )}
                      {modifiers && modifiers.length > 0 && (
                        <div style={{ marginTop: 3, display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {modifiers.map((m, i) => (
                            <span key={i} style={{
                              color: "#4ade80", fontSize: 10,
                              border: "1px solid #1e3a2e",
                              borderRadius: 2, padding: "1px 5px",
                              fontFamily: "inherit",
                            }}>
                              {m.label}
                            </span>
                          ))}
                        </div>
                      )}
                      {notes && (
                        <div style={{ color: "#555", fontSize: 10, marginTop: 2, fontStyle: "italic" }}>
                          » {notes}
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    {canUpdate && !isDelivered && !isCancelled && (
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        {(isPreparing || isDone) && (
                          <button
                            onClick={() => back(order.id, iid)}
                            disabled={isBusyBack}
                            title="חזור סטטוס"
                            style={{
                              background: "none", color: "#444",
                              border: "1px solid #333", borderRadius: 3,
                              width: 26, height: 26, fontSize: 12,
                              cursor: isBusyBack ? "wait" : "pointer",
                              opacity: isBusyBack ? 0.4 : 1,
                              fontFamily: "inherit",
                            }}>←</button>
                        )}
                        {!isDone && (
                          <button
                            onClick={() => adv(order.id, iid)}
                            disabled={isBusy}
                            style={{
                              background: isPreparing ? "#15803d" : "#1d4ed8",
                              color: "#fff", border: "none", borderRadius: 3,
                              padding: "4px 10px", fontWeight: 700, fontSize: 11,
                              cursor: isBusy ? "wait" : "pointer",
                              opacity: isBusy ? 0.5 : 1,
                              fontFamily: "inherit",
                              letterSpacing: 1,
                            }}>
                            {isBusy ? "..." : isPreparing ? "DONE ✓" : "START →"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Notes row */}
              {order.notes && (
                <div style={{ padding: "5px 14px 5px 36px", color: "#555", fontSize: 10, fontStyle: "italic", borderBottom: "1px dashed #1e1e1e" }}>
                  NOTE: {order.notes}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Ticket footer ── */}
      <div style={{
        padding: "8px 14px",
        borderTop: "1px dashed #2a2a2a",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 8,
      }}>
        {/* Progress dots */}
        <div style={{ display: "flex", gap: 3 }}>
          {allItems.map((it, i) => {
            const c = it.itemStatus === "DONE" ? "#22c55e"
              : it.itemStatus === "PREPARING" ? "#38bdf8"
              : "#333";
            return <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />;
          })}
        </div>

        {allDone && (
          <span style={{ color: "#22c55e", fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>
            ● READY TO SERVE
          </span>
        )}
      </div>

      {/* Urgency flame emoji */}
      {isUrgent && (
        <div style={{
          position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
          fontSize: 20, lineHeight: 1,
        }}>🔥</div>
      )}
    </div>
  );
}

/* ── Main ── */
export default function TicketsClient({
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
  const [allReadyAlert, setAllReadyAlert] = useState(false);
  const [countdown, setCountdown]       = useState(60);
  const [now, setNow]                   = useState(new Date());
  const [fullscreen, setFullscreen]     = useState(false);
  const [stationFilter, setStationFilter] = useState("");
  const prevAllDone = useRef(false);
  const audioCtx     = useRef<AudioContext | null>(null);
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
    es.onerror = () => { es.close(); };
    return () => es.close();
  }, [restaurantId, fetchOrders]);

  useEffect(() => {
    const iv = setInterval(() => {
      setCountdown(c => { if (c <= 1) { fetchOrders(); return 60; } return c - 1; });
      setNow(new Date());
    }, 1000);
    return () => clearInterval(iv);
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

  /* Group by table — sorted oldest-first */
  const sortedOrders = [...orders].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const byTable = new Map<string, Order[]>();
  for (const o of sortedOrders) {
    const key = o.tableNumber ?? o.customerName ?? "–";
    if (!byTable.has(key)) byTable.set(key, []);
    byTable.get(key)!.push(o);
  }

  const restName = restaurants.find(r => r.id === restaurantId)?.name ?? "";

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
          ...i, itemStatus: i.itemStatus === "PREPARING" ? "DONE" : i.itemStatus,
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
        ...i, itemStatus: i.itemStatus === "DONE" ? "PREPARING" : i.itemStatus,
      }),
    }));
    setTick(t => t + 1);
  }

  return (
    <div ref={containerRef} style={{
      minHeight: "100vh",
      background: "#0d0d0d",
      backgroundImage: "radial-gradient(circle at 50% 0%, #111 0%, #0d0d0d 60%)",
      display: "flex", flexDirection: "column",
      fontFamily: "'Courier New', monospace",
      direction: "rtl",
    }}>
      {/* ── Top bar ── */}
      <div style={{
        background: "#0a0a0a",
        borderBottom: "1px solid #1e1e1e",
        padding: "8px 20px",
        display: "flex", alignItems: "center", gap: 14, flexShrink: 0, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 6,
            background: "linear-gradient(135deg,#8B6914,#C9A84C)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, color: "#fff", fontSize: 14,
          }}>M</div>
          <span style={{ color: "#ccc", fontWeight: 700, fontSize: 13, fontFamily: "'Courier New', monospace", letterSpacing: 1 }}>
            🎫 TICKET BOARD
            {restName && <span style={{ color: "#444" }}> · {restName}</span>}
          </span>
        </div>

        {restaurants.length > 1 && (
          <select value={restaurantId} onChange={e => setRestaurantId(e.target.value)}
            style={{ background: "#1a1a1a", color: "#ccc", border: "1px solid #333", borderRadius: 4, padding: "4px 10px", fontSize: 12, fontFamily: "inherit" }}>
            {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}

        {/* Station filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "#555", fontSize: 11, fontFamily: "inherit" }}>STATION:</span>
          <input
            type="text"
            value={stationFilter}
            onChange={e => saveStationFilter(e.target.value)}
            placeholder="filter..."
            style={{
              background: "#1a1a1a", color: "#ccc",
              border: stationFilter ? "1px solid #c9a84c" : "1px solid #2a2a2a",
              borderRadius: 3, padding: "3px 8px", fontSize: 11,
              width: 120, outline: "none", fontFamily: "inherit",
            }}
          />
          {stationFilter && (
            <button onClick={() => saveStationFilter("")}
              style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>
              ×
            </button>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {allReadyAlert && (
          <div style={{
            background: "#22c55e", color: "#000",
            padding: "4px 12px", borderRadius: 3, fontWeight: 900, fontSize: 12,
            fontFamily: "inherit", letterSpacing: 1,
          }}>!! ALL READY !!</div>
        )}

        {newAlert && (
          <div style={{
            background: "#facc15", color: "#000",
            padding: "4px 12px", borderRadius: 3, fontWeight: 900, fontSize: 12,
            fontFamily: "inherit", letterSpacing: 1,
          }}>!! NEW ORDER !!</div>
        )}

        <span style={{ color: "#444", fontSize: 11, fontFamily: "inherit" }}>
          TICKETS: {byTable.size} · {now.toLocaleTimeString("he-IL", { hour:"2-digit", minute:"2-digit", second:"2-digit" })} · ↻{countdown}s
        </span>

        <button onClick={fetchOrders}
          title="R to refresh"
          style={{ background: "#1a1a1a", color: "#666", border: "1px solid #2a2a2a", borderRadius: 3, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
          REFRESH
        </button>
        <button onClick={toggleFullscreen}
          title="F for fullscreen"
          style={{ background: "#1a1a1a", color: "#666", border: "1px solid #2a2a2a", borderRadius: 3, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
          {fullscreen ? "EXIT FS" : "FULLSCREEN"}
        </button>
      </div>

      {/* ── Tickets grid ── */}
      <div style={{
        flex: 1, padding: 20, overflowY: "auto",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 20,
        alignContent: "start",
      }}>
        {byTable.size === 0 ? (
          <div style={{
            gridColumn: "1 / -1",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            minHeight: 320, gap: 16, color: "#2a2a2a",
            fontFamily: "inherit",
          }}>
            <div style={{ fontSize: 64 }}>■</div>
            <div style={{ color: "#333", fontWeight: 700, fontSize: 18, letterSpacing: 4 }}>
              {stationFilter ? `NO ITEMS FOR "${stationFilter.toUpperCase()}"` : "NO OPEN TICKETS"}
            </div>
            <div style={{ color: "#2a2a2a", fontSize: 12, letterSpacing: 2 }}>
              {now.toLocaleTimeString("he-IL")}
            </div>
          </div>
        ) : (
          Array.from(byTable.entries()).map(([tableNumber, tableOrders]) => (
            <Ticket
              key={tableNumber}
              tableNumber={tableNumber}
              orders={tableOrders}
              canUpdate={canUpdate}
              tick={tick}
              stationFilter={stationFilter}
              onAdvance={handleAdvance}
              onGoBack={handleGoBack}
            />
          ))
        )}
      </div>

      <style>{`
        @keyframes ticketPulse {
          0%, 100% { box-shadow: 0 0 0 1px #ef444430, 0 4px 24px rgba(0,0,0,.7); }
          50%       { box-shadow: 0 0 0 2px #ef444460, 0 4px 32px rgba(239,68,68,.15); }
        }
      `}</style>
    </div>
  );
}
