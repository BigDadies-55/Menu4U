"use client";

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
function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

/* ── Header color by urgency ── */
function headerColor(mins: number, allDone: boolean): string {
  if (allDone) return "#bbf7d0";
  if (mins >= 20) return "#fecaca";
  if (mins >= 10) return "#fed7aa";
  return "#bae6fd";
}
function headerTextColor(mins: number, allDone: boolean): string {
  if (allDone) return "#14532d";
  if (mins >= 20) return "#7f1d1d";
  if (mins >= 10) return "#7c2d12";
  return "#0c4a6e";
}
function headerBorderColor(mins: number, allDone: boolean): string {
  if (allDone) return "#16a34a";
  if (mins >= 20) return "#dc2626";
  if (mins >= 10) return "#d97706";
  return "#0891b2";
}

/* ── Item status square color ── */
function itemSquareColor(status: string): string {
  if (status === "DONE")       return "#16a34a";
  if (status === "PREPARING")  return "#f59e0b";
  if (status === "CANCELLED")  return "#d1d5db";
  return "#dc2626";
}

/* ── Segmented progress bar ── */
function ProgressBar({ items }: { items: OrderItem[] }) {
  const valid = items.filter(i => i.itemStatus !== "CANCELLED");
  if (valid.length === 0) return null;
  const pct = valid.filter(i => i.itemStatus === "DONE").length / valid.length * 100;
  const preparingPct = valid.filter(i => i.itemStatus === "PREPARING").length / valid.length * 100;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ position: "relative", height: 10, borderRadius: 6, background: "#e5e7eb", overflow: "hidden" }}>
        <div style={{
          position: "absolute", left: `${pct}%`, top: 0, bottom: 0,
          width: `${preparingPct}%`,
          background: "#f59e0b",
          transition: "width 0.4s ease",
        }}/>
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: `${pct}%`,
          background: "#16a34a",
          transition: "width 0.4s ease",
        }}/>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 10, color: "#6b7280" }}>
          {valid.filter(i => i.itemStatus === "DONE").length}/{valid.length} פריטים הוכנו
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          {valid.filter(i => i.itemStatus === "PREPARING").length > 0 && (
            <span style={{ fontSize: 10, color: "#d97706", fontWeight: 600 }}>
              {valid.filter(i => i.itemStatus === "PREPARING").length} בהכנה
            </span>
          )}
          {valid.filter(i => i.itemStatus === "DONE").length > 0 && (
            <span style={{ fontSize: 10, color: "#16a34a", fontWeight: 600 }}>
              {valid.filter(i => i.itemStatus === "DONE").length} מוכן
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

const LS_STATION = "menu4u_kds_station_table";

/* ── Table Group Card ── */
function TableGroupCard({
  tableKey, orders, kotStartIndex, canUpdate, tick, stationFilter,
  onAdvance, onGoBack,
}: {
  tableKey: string; orders: Order[]; kotStartIndex: number;
  canUpdate: boolean; tick: number; stationFilter: string;
  onAdvance: (orderId: string, itemId: string) => void;
  onGoBack:  (orderId: string, itemId: string) => void;
}) {
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const oldest = orders.reduce((a, b) => new Date(a.createdAt) < new Date(b.createdAt) ? a : b);
  const mins = elapsed(oldest.createdAt);

  function itemMatchesStation(item: OrderItem) {
    if (!stationFilter) return true;
    const f = stationFilter.toLowerCase();
    return (item.item.category?.name?.toLowerCase() ?? "").includes(f) ||
           item.item.name.toLowerCase().includes(f);
  }

  const allItems = orders.flatMap(o => o.items.filter(i =>
    i.itemStatus !== "CANCELLED" && !i.heldUntilFired && itemMatchesStation(i)
  ));
  const allDone  = allItems.length > 0 && allItems.every(i => i.itemStatus === "DONE");

  // Skip card if station filter matches nothing
  if (stationFilter && allItems.length === 0) return null;

  const hColor      = headerColor(mins, allDone);
  const hTextColor  = headerTextColor(mins, allDone);
  const hBorder     = headerBorderColor(mins, allDone);

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

  return (
    <div style={{
      background: "#fff",
      borderRadius: 12,
      overflow: "hidden",
      boxShadow: allDone
        ? "0 0 0 2px #16a34a40, 0 4px 20px rgba(0,0,0,0.2)"
        : "0 4px 20px rgba(0,0,0,0.25)",
      display: "flex", flexDirection: "column",
      borderTop: `4px solid ${hBorder}`,
    }}>
      {/* ── Header ── */}
      <div style={{ background: hColor, padding: "10px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            background: "#fff",
            borderRadius: 8,
            padding: "3px 12px",
            fontFamily: "'Heebo', 'Segoe UI', sans-serif",
            fontWeight: 900,
            fontSize: tableKey.length > 3 ? 13 : tableKey.length > 2 ? 16 : 20,
            color: "#000",
            lineHeight: 1.2,
            flexShrink: 0,
            boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
          }}>
            {tableKey}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: hTextColor, fontWeight: 700, fontSize: 13 }}>
              {allDone ? "✅ הכל מוכן!" : `🍽 ${orders[0].tableNumber ? `שולחן ${tableKey}` : tableKey}`}
            </div>
            <div style={{ color: hTextColor, fontSize: 10, opacity: 0.8 }}>
              {orders.length > 1 ? `${orders.length} הזמנות` : `KOT #${kotStartIndex}`}
            </div>
          </div>

          {/* Timer */}
          <div style={{
            background: "rgba(255,255,255,0.6)",
            borderRadius: 20, padding: "3px 10px",
            color: hTextColor, fontWeight: 800, fontSize: 12,
            display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
          }}>
            ⏳ {mins < 1 ? "< 1" : mins} דק'
          </div>
        </div>
      </div>

      {/* ── Orders ── */}
      <div style={{ flex: 1 }}>
        {orders.map((order, oIdx) => {
          return (
            <div key={order.id}>
              {/* Order sub-header */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "5px 14px",
                background: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
                borderTop: oIdx > 0 ? "2px solid #e2e8f0" : undefined,
              }}>
                <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>
                  KOT #{kotStartIndex + oIdx} · {fmtTime(order.createdAt)}
                  {order.notes ? ` · 💬 ${order.notes}` : ""}
                </span>
              </div>

              {/* Items */}
              {order.items.map(({ id: iid, quantity, notes, itemStatus, item, modifiers, course, heldUntilFired, firedAt, doneAt }) => {
                // Skip held items (waiting to be fired)
                if (heldUntilFired) return null;
                // Apply station filter
                if (!itemMatchesStation({ id: iid, quantity, notes, itemStatus, item, modifiers, course, heldUntilFired, firedAt, doneAt })) return null;

                const isCancelled = itemStatus === "CANCELLED";
                const isDone      = itemStatus === "DONE";
                const sqColor     = itemSquareColor(itemStatus);
                const busyAdv     = busy.has(iid);
                const busyBack    = busy.has(iid + "-b");
                const canAdv      = canUpdate && !isCancelled && itemStatus !== "DONE";
                const canBack     = canUpdate && !isCancelled && (itemStatus === "PREPARING" || itemStatus === "DONE");

                return (
                  <div key={`${iid}-${tick}`} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "6px 14px",
                    borderBottom: "1px solid #f1f5f9",
                    opacity: isCancelled ? 0.4 : 1,
                    background: isDone ? "#f0fdf4" : "transparent",
                    minWidth: 0,
                  }}>
                    {/* Status square */}
                    <div style={{
                      width: 11, height: 11, borderRadius: 3,
                      background: sqColor, flexShrink: 0,
                    }}/>

                    {/* Item name */}
                    <span style={{
                      flex: 1, minWidth: 0,
                      color: isCancelled ? "#9ca3af" : isDone ? "#6b7280" : "#111827",
                      textDecoration: isCancelled ? "line-through" : undefined,
                      fontSize: 12, fontWeight: 600,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {item.name}
                      {modifiers && modifiers.length > 0 && (
                        <span style={{ color: "#9ca3af", fontWeight: 400 }}>
                          {" "}· {modifiers.map(m => m.label).join(", ")}
                        </span>
                      )}
                      {notes && <span style={{ color: "#f59e0b" }}> 💬{notes}</span>}
                      {item.category?.name && (
                        <span style={{ color: "#cbd5e1", fontWeight: 400, fontSize: 10 }}>
                          {" "}·{item.category.name}
                        </span>
                      )}
                    </span>

                    {/* Qty */}
                    <span style={{
                      flexShrink: 0, color: "#374151", fontWeight: 700, fontSize: 12,
                      background: "#f1f5f9", borderRadius: 5, padding: "1px 6px",
                    }}>×{quantity}</span>

                    {/* Buttons */}
                    {canUpdate && !isCancelled && (
                      <>
                        {canBack && (
                          <button type="button" onClick={() => back(order.id, iid)} disabled={busyBack} style={{
                            background: "#f1f5f9", color: "#64748b",
                            border: "1px solid #e2e8f0", borderRadius: 5,
                            padding: "3px 7px", fontSize: 10, cursor: "pointer",
                            flexShrink: 0, opacity: busyBack ? 0.5 : 1,
                          }}>←</button>
                        )}
                        {canAdv && (
                          <button type="button" onClick={() => adv(order.id, iid)} disabled={busyAdv} style={{
                            background: itemStatus === "PREPARING" ? "#16a34a" : "#0891b2",
                            color: "#fff", border: "none", borderRadius: 5,
                            padding: "3px 8px", fontSize: 10, fontWeight: 700,
                            cursor: "pointer", flexShrink: 0,
                            opacity: busyAdv ? 0.5 : 1,
                            whiteSpace: "nowrap",
                          }}>
                            {busyAdv ? "..." : itemStatus === "PREPARING" ? "מוכן ✓" : "התחל →"}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ── Footer: progress bar ── */}
      <div style={{ padding: "10px 14px", borderTop: "2px solid #f1f5f9", background: "#f8fafc" }}>
        <ProgressBar items={allItems} />
      </div>
    </div>
  );
}

/* ── Main ── */
export default function TableKdsClient({
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
    const interval = setInterval(() => {
      setCountdown(c => { if (c <= 1) { fetchOrders(); return 60; } return c - 1; });
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
    if (!document.fullscreenElement) { containerRef.current?.requestFullscreen?.(); setFullscreen(true); }
    else { document.exitFullscreen?.(); setFullscreen(false); }
  }

  async function handleAdvance(orderId: string, itemId: string) {
    const res = await fetch(`/api/admin/orders/${orderId}/items/${itemId}/status`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const { orderDelivered } = await res.json();
      if (orderDelivered) fetchOrders();
      else {
        setOrders(prev => prev.map(o => o.id !== orderId ? o : {
          ...o,
          items: o.items.map(i => i.id !== itemId ? i : {
            ...i, itemStatus: i.itemStatus === "PREPARING" ? "DONE" : i.itemStatus,
          }),
        }));
        setTick(t => t + 1);
      }
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

  /* ── Group orders by table — sorted oldest-first ── */
  const sorted = [...orders].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const byTable = new Map<string, Order[]>();
  for (const o of sorted) {
    const key = o.tableNumber ?? o.customerName ?? "–";
    if (!byTable.has(key)) byTable.set(key, []);
    byTable.get(key)!.push(o);
  }

  // KOT start index per table
  const kotStartByTable = new Map<string, number>();
  let kotCounter = 1;
  for (const [key, tOrders] of byTable) {
    kotStartByTable.set(key, kotCounter);
    kotCounter += tOrders.length;
  }

  /* ── Stats ── */
  const processingOrders = orders.filter(o => o.items.some(i => i.itemStatus === "PREPARING")).length;
  const readyOrders      = orders.filter(o => o.items.every(i => i.itemStatus === "DONE" || i.itemStatus === "CANCELLED") && o.status !== "DELIVERED").length;
  const restName         = restaurants.find(r => r.id === restaurantId)?.name ?? "";

  return (
    <div ref={containerRef} style={{
      minHeight: "100vh",
      background: "#0f172a",
      display: "flex", flexDirection: "column",
      fontFamily: "'Heebo', 'Segoe UI', sans-serif",
      direction: "rtl",
    }}>
      {/* ── Top bar ── */}
      <div style={{
        background: "#1e293b",
        borderBottom: "1px solid #334155",
        padding: "10px 20px",
        display: "flex", alignItems: "center", gap: 14,
        flexShrink: 0, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: "linear-gradient(135deg,#8B6914,#C9A84C)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: 14, color: "#fff",
          }}>M</div>
          <span style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 13 }}>
            📺 תצוגת שולחן
            {restName && <span style={{ color: "#64748b", fontWeight: 400 }}> · {restName}</span>}
          </span>
        </div>

        {restaurants.length > 1 && (
          <select value={restaurantId} onChange={e => setRestaurantId(e.target.value)}
            style={{ background: "#0f172a", color: "#f1f5f9", border: "1px solid #334155", borderRadius: 7, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>
            {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}

        {/* Station filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "#64748b", fontSize: 11 }}>🔧</span>
          <input
            type="text"
            value={stationFilter}
            onChange={e => saveStationFilter(e.target.value)}
            placeholder="סנן עמדה..."
            style={{
              background: "#0f172a", color: "#f1f5f9",
              border: stationFilter ? "1px solid #c9a84c" : "1px solid #334155",
              borderRadius: 7, padding: "3px 8px", fontSize: 11,
              width: 130, outline: "none",
            }}
          />
          {stationFilter && (
            <button onClick={() => saveStationFilter("")}
              style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 14 }}>
              ×
            </button>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {/* Status counters */}
        {[
          { label: "בהכנה",   count: processingOrders, color: "#d97706" },
          { label: "מוכן",    count: readyOrders,      color: "#16a34a" },
          { label: "שולחנות", count: byTable.size,     color: "#0891b2" },
        ].map(s => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{
              width: 26, height: 26, borderRadius: "50%",
              background: s.color, color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 900, fontSize: 12,
            }}>{s.count}</div>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>{s.label}</span>
          </div>
        ))}

        <div style={{ width: 1, height: 20, background: "#334155" }}/>

        {allReadyAlert && (
          <div style={{
            background: "#22c55e", color: "#000",
            padding: "4px 12px", borderRadius: 20,
            fontWeight: 900, fontSize: 11, animation: "pulse 1s infinite",
          }}>🎉 הכל מוכן!</div>
        )}

        {newAlert && (
          <div style={{ background: "#facc15", color: "#000", padding: "4px 10px", borderRadius: 20, fontWeight: 800, fontSize: 11 }}>
            🔔 הזמנה חדשה!
          </div>
        )}

        <span style={{ fontSize: 11, color: "#64748b" }}>
          {now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })} · ↻ {countdown}s
        </span>

        <button type="button" onClick={fetchOrders} title="רענן (R)" style={{
          background: "#0f172a", color: "#94a3b8", border: "1px solid #334155",
          borderRadius: 7, padding: "4px 10px", fontSize: 11, cursor: "pointer",
        }}>↻ רענן</button>
        <button type="button" onClick={toggleFullscreen} title="מסך מלא (F)" style={{
          background: "#0f172a", color: "#94a3b8", border: "1px solid #334155",
          borderRadius: 7, padding: "4px 10px", fontSize: 11, cursor: "pointer",
        }}>{fullscreen ? "⊠ צא" : "⛶ מסך מלא"}</button>
      </div>

      {/* ── Legend ── */}
      <div style={{
        background: "#1a2540", borderBottom: "1px solid #1e293b",
        padding: "5px 20px", display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap",
      }}>
        {[
          { color: "#dc2626", label: "דחוף 20+ דק'" },
          { color: "#d97706", label: "בינוני 10-20 דק'" },
          { color: "#0891b2", label: "חדש < 10 דק'" },
          { color: "#16a34a", label: "הכל מוכן" },
        ].map(l => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }}/>
            <span style={{ fontSize: 10, color: "#64748b" }}>{l.label}</span>
          </div>
        ))}
        <div style={{ marginRight: "auto", display: "flex", gap: 14 }}>
          {[{ color: "#f59e0b", label: "בהכנה" }, { color: "#16a34a", label: "מוכן" }].map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 9, height: 9, borderRadius: 2, background: l.color }}/>
              <span style={{ fontSize: 10, color: "#64748b" }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Cards grid ── */}
      <div style={{
        flex: 1, padding: "20px 24px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
        gap: 16, alignContent: "start", overflowY: "auto",
      }}>
        {byTable.size === 0 ? (
          <div style={{
            gridColumn: "1 / -1", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            minHeight: 300, gap: 12,
          }}>
            <div style={{ fontSize: 64 }}>✅</div>
            <div style={{ color: "#475569", fontWeight: 700, fontSize: 18 }}>
              {stationFilter ? `אין פריטים לעמדה "${stationFilter}"` : "אין הזמנות פעילות"}
            </div>
            <div style={{ color: "#334155", fontSize: 13 }}>המטבח פנוי · {now.toLocaleTimeString("he-IL")}</div>
          </div>
        ) : (
          Array.from(byTable.entries()).map(([tableKey, tableOrders]) => (
            <TableGroupCard
              key={tableKey}
              tableKey={tableKey}
              orders={tableOrders}
              kotStartIndex={kotStartByTable.get(tableKey) ?? 1}
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
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>
    </div>
  );
}
