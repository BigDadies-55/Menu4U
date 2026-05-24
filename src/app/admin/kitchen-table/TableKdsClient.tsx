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
function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("he-IL", { day: "2-digit", month: "short" });
}

/* ── Header color by urgency ── */
function headerColor(mins: number, allDone: boolean): string {
  if (allDone) return "#16a34a";
  if (mins >= 20) return "#dc2626";
  if (mins >= 10) return "#d97706";
  return "#0891b2";
}

/* ── Item status square color ── */
function itemSquareColor(status: string): string {
  if (status === "DONE") return "#16a34a";
  if (status === "PREPARING") return "#f59e0b";
  if (status === "CANCELLED") return "#6b7280";
  return "#dc2626"; // PENDING
}

/* ── KOT Card ── */
function KotCard({
  order, kotIndex, canUpdate, tick,
  onConfirm, onAdvance, onGoBack,
}: {
  order: Order; kotIndex: number; canUpdate: boolean; tick: number;
  onConfirm: (id: string) => void;
  onAdvance: (orderId: string, itemId: string) => void;
  onGoBack: (orderId: string, itemId: string) => void;
}) {
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const validItems = order.items.filter(i => i.itemStatus !== "CANCELLED");
  const doneCount  = validItems.filter(i => i.itemStatus === "DONE").length;
  const allDone    = validItems.length > 0 && doneCount === validItems.length;
  const mins       = elapsed(order.createdAt);
  const isPending  = order.status === "PENDING";
  const hColor     = headerColor(mins, allDone);

  async function adv(itemId: string) {
    setBusy(p => new Set(p).add(itemId));
    await onAdvance(order.id, itemId);
    setBusy(p => { const n = new Set(p); n.delete(itemId); return n; });
  }
  async function back(itemId: string) {
    setBusy(p => new Set(p).add(itemId + "-b"));
    await onGoBack(order.id, itemId);
    setBusy(p => { const n = new Set(p); n.delete(itemId + "-b"); return n; });
  }

  return (
    <div style={{
      background: "#fff",
      borderRadius: 12,
      overflow: "hidden",
      boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
      display: "flex", flexDirection: "column",
      minWidth: 220,
    }}>
      {/* ── Colored Header ── */}
      <div style={{ background: hColor, padding: "10px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>
              🍽 {order.tableNumber ? `שולחן ${order.tableNumber}` : order.customerName ?? "–"}
            </div>
            <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>
              📋 KOT #{kotIndex}
            </div>
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{
              background: "rgba(255,255,255,0.2)",
              borderRadius: 20, padding: "3px 10px",
              color: "#fff", fontWeight: 800, fontSize: 13,
              display: "flex", alignItems: "center", gap: 4,
            }}>
              ⏳ {mins < 1 ? "< 1" : mins} דק'
            </div>
          </div>
        </div>
        <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 10, marginTop: 4 }}>
          ⏰ {fmtDate(order.createdAt)} &nbsp;{fmtTime(order.createdAt)}
        </div>
      </div>

      {/* ── Pending banner ── */}
      {isPending && (
        <div style={{ background: "#fef3c7", borderBottom: "1px solid #fde68a", padding: "5px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#92400e", fontWeight: 700 }}>🕐 ממתין לאישור</span>
          {canUpdate && (
            <button
              type="button"
              onClick={() => onConfirm(order.id)}
              style={{ background: "#f59e0b", color: "#fff", border: "none", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}
            >✓ אשר</button>
          )}
        </div>
      )}

      {/* ── Items ── */}
      <div style={{ flex: 1, padding: "8px 0" }}>
        {order.items.map(({ id: iid, quantity, notes, itemStatus, item, modifiers }) => {
          const isCancelled = itemStatus === "CANCELLED";
          const isDone = itemStatus === "DONE";
          const sqColor = itemSquareColor(itemStatus);
          const busyAdv = busy.has(iid);
          const busyBack = busy.has(iid + "-b");
          const canAdv = canUpdate && !isPending && !isCancelled && itemStatus !== "DONE";
          const canBack = canUpdate && !isPending && !isCancelled && (itemStatus === "PREPARING" || itemStatus === "DONE");

          return (
            <div key={`${iid}-${tick}`} style={{
              display: "flex", alignItems: "flex-start", gap: 8,
              padding: "6px 14px",
              borderBottom: "1px solid #f1f5f9",
              opacity: isCancelled ? 0.4 : 1,
            }}>
              {/* Status square */}
              <div style={{
                width: 12, height: 12, borderRadius: 3,
                background: sqColor,
                marginTop: 3, flexShrink: 0,
              }}/>

              {/* Item info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  display: "flex", justifyContent: "space-between", gap: 6,
                  color: isCancelled ? "#9ca3af" : isDone ? "#6b7280" : "#111827",
                  textDecoration: isCancelled ? "line-through" : undefined,
                  fontSize: 13, fontWeight: 600, lineHeight: 1.3,
                }}>
                  <span style={{ flex: 1 }}>{item.name}</span>
                  <span style={{ flexShrink: 0, color: "#374151", fontWeight: 700 }}>× {quantity}</span>
                </div>
                {modifiers && modifiers.length > 0 && (
                  <div style={{ fontSize: 11, color: "#6b7280", fontStyle: "italic", marginTop: 1 }}>
                    {modifiers.map(m => m.label).join(", ")}
                  </div>
                )}
                {notes && (
                  <div style={{ fontSize: 11, color: "#f59e0b", fontStyle: "italic", marginTop: 1 }}>💬 {notes}</div>
                )}
              </div>

              {/* Buttons */}
              {canUpdate && !isCancelled && (
                <div style={{ display: "flex", flexDirection: "column", gap: 3, flexShrink: 0 }}>
                  {canAdv && (
                    <button type="button" onClick={() => adv(iid)} disabled={busyAdv} style={{
                      background: itemStatus === "PREPARING" ? "#16a34a" : "#0891b2",
                      color: "#fff", border: "none", borderRadius: 5,
                      padding: "3px 8px", fontSize: 10, fontWeight: 700, cursor: "pointer",
                      opacity: busyAdv ? 0.5 : 1,
                    }}>
                      {busyAdv ? "..." : itemStatus === "PREPARING" ? "מוכן ✓" : "התחל →"}
                    </button>
                  )}
                  {canBack && (
                    <button type="button" onClick={() => back(iid)} disabled={busyBack} style={{
                      background: "#f1f5f9", color: "#64748b",
                      border: "1px solid #e2e8f0", borderRadius: 5,
                      padding: "2px 6px", fontSize: 10, cursor: "pointer",
                      opacity: busyBack ? 0.5 : 1,
                    }}>← חזור</button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Footer: progress + notes ── */}
      <div style={{ padding: "8px 14px", borderTop: "1px solid #f1f5f9", background: "#f8fafc" }}>
        {order.notes && (
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>
            <span style={{ fontWeight: 700 }}>הערה: </span>{order.notes}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {validItems.map((i, idx) => (
            <div key={idx} style={{
              width: 8, height: 8, borderRadius: "50%",
              background: itemSquareColor(i.itemStatus),
            }}/>
          ))}
          <span style={{ fontSize: 10, color: "#94a3b8", marginRight: "auto" }}>
            {doneCount}/{validItems.length}
          </span>
          <span style={{ fontSize: 11, color: "#374151", fontWeight: 700 }}>
            ₪{order.totalAmount.toFixed(0)}
          </span>
        </div>
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
      setCountdown(c => { if (c <= 1) { fetchOrders(); return 15; } return c - 1; });
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  function toggleFullscreen() {
    if (!document.fullscreenElement) { containerRef.current?.requestFullscreen?.(); setFullscreen(true); }
    else { document.exitFullscreen?.(); setFullscreen(false); }
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
      else {
        setOrders(prev => prev.map(o => o.id !== orderId ? o : {
          ...o,
          items: o.items.map(i => {
            if (i.id !== itemId) return i;
            return { ...i, itemStatus: i.itemStatus === "PENDING" ? "PREPARING" : "DONE" };
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
      items: o.items.map(i => {
        if (i.id !== itemId) return i;
        return { ...i, itemStatus: i.itemStatus === "DONE" ? "PREPARING" : "PENDING" };
      }),
    }));
    setTick(t => t + 1);
  }

  /* ── Stats ── */
  const newOrders        = orders.filter(o => o.status === "PENDING").length;
  const processingOrders = orders.filter(o => o.status === "PREPARING" && o.items.some(i => i.itemStatus === "PREPARING")).length;
  const readyOrders      = orders.filter(o => o.items.every(i => i.itemStatus === "DONE" || i.itemStatus === "CANCELLED") && o.status !== "DELIVERED").length;

  const restName = restaurants.find(r => r.id === restaurantId)?.name ?? "";

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
        display: "flex", alignItems: "center", gap: 16,
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: "linear-gradient(135deg,#8B6914,#C9A84C)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: 15, color: "#fff",
          }}>M</div>
          <span style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 14 }}>
            📺 תצוגת שולחן
            {restName && <span style={{ color: "#64748b", fontWeight: 400 }}> · {restName}</span>}
          </span>
        </div>

        {/* Restaurant selector */}
        {restaurants.length > 1 && (
          <select value={restaurantId} onChange={e => setRestaurantId(e.target.value)}
            style={{ background: "#0f172a", color: "#f1f5f9", border: "1px solid #334155", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>
            {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}

        <div style={{ flex: 1 }} />

        {/* ── Status counters ── */}
        {[
          { label: "הזמנות חדשות", count: newOrders,        color: "#dc2626", bg: "#fee2e2" },
          { label: "בהכנה",        count: processingOrders, color: "#d97706", bg: "#fef3c7" },
          { label: "מוכן",         count: readyOrders,       color: "#16a34a", bg: "#dcfce7" },
          { label: "סה\"כ פעיל",   count: orders.length,     color: "#0891b2", bg: "#e0f2fe" },
        ].map(s => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: s.color, color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 900, fontSize: 13,
            }}>{s.count}</div>
            <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{s.label}</span>
          </div>
        ))}

        <div style={{ width: 1, height: 24, background: "#334155" }}/>

        {/* Alert */}
        {newAlert && (
          <div style={{
            background: "#facc15", color: "#000",
            padding: "5px 12px", borderRadius: 20,
            fontWeight: 800, fontSize: 12,
          }}>🔔 הזמנה חדשה!</div>
        )}

        {/* Clock + countdown */}
        <span style={{ fontSize: 12, color: "#64748b" }}>
          {now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })} · ↻ {countdown}s
        </span>

        {/* Buttons */}
        <button type="button" onClick={fetchOrders} style={{
          background: "#0f172a", color: "#94a3b8",
          border: "1px solid #334155", borderRadius: 7,
          padding: "5px 11px", fontSize: 11, cursor: "pointer",
        }}>↻ רענן</button>
        <button type="button" onClick={toggleFullscreen} style={{
          background: "#0f172a", color: "#94a3b8",
          border: "1px solid #334155", borderRadius: 7,
          padding: "5px 11px", fontSize: 11, cursor: "pointer",
        }}>{fullscreen ? "⊠ צא" : "⛶ מסך מלא"}</button>
      </div>

      {/* ── Status legend strip ── */}
      <div style={{
        background: "#1a2540",
        borderBottom: "1px solid #1e293b",
        padding: "6px 20px",
        display: "flex", gap: 20, alignItems: "center",
      }}>
        {[
          { color: "#dc2626", label: "דחוף (20+ דק')" },
          { color: "#d97706", label: "בינוני (10-20 דק')" },
          { color: "#0891b2", label: "חדש (< 10 דק')" },
          { color: "#16a34a", label: "הושלם" },
        ].map(l => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: l.color }}/>
            <span style={{ fontSize: 10, color: "#64748b" }}>{l.label}</span>
          </div>
        ))}
        <div style={{ marginRight: "auto", display: "flex", gap: 16 }}>
          {[
            { color: "#dc2626", label: "ממתין" },
            { color: "#f59e0b", label: "בהכנה" },
            { color: "#16a34a", label: "מוכן" },
          ].map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }}/>
              <span style={{ fontSize: 10, color: "#64748b" }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Cards ── */}
      <div style={{
        flex: 1,
        padding: "20px 24px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        gap: 16,
        alignContent: "start",
        overflowY: "auto",
      }}>
        {orders.length === 0 ? (
          <div style={{
            gridColumn: "1 / -1",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            minHeight: 300, gap: 12, color: "#334155",
          }}>
            <div style={{ fontSize: 64 }}>✅</div>
            <div style={{ color: "#475569", fontWeight: 700, fontSize: 18 }}>אין הזמנות פעילות</div>
            <div style={{ color: "#334155", fontSize: 13 }}>המטבח פנוי · {now.toLocaleTimeString("he-IL")}</div>
          </div>
        ) : (
          orders.map((order, idx) => (
            <KotCard
              key={order.id}
              order={order}
              kotIndex={idx + 1}
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
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>
    </div>
  );
}
