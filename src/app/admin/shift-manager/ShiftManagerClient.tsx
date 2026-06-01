"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ── Types ──────────────────────────────────────────────────────────
type TableShape = "round" | "rect" | "square" | "oval" | "long" | "banquet";
type FreeTable  = { id: string; num: number; name: string; shape: TableShape; x: number; y: number; w: number; h: number; seats: number; rot: number };
type Room       = { id: string; name: string; tables: FreeTable[] };
type LayoutV2   = { version: 2; rooms: Room[] };
type OrderItem  = { id: string; quantity: number; price: number; itemStatus: string; firedAt: string | null; item: { name: string } };
type Order      = { id: string; tableNumber: string | null; status: string; totalAmount: number; createdAt: string; coversCount: number | null; items: OrderItem[] };
type MenuItem   = { id: string; name: string; price: number; isActive: boolean };
type MenuCat    = { id: string; name: string; menuName: string; items: MenuItem[] };
type Restaurant = { id: string; name: string };
type WaitParty  = { id: string; name: string; guests: number; since: number };

// ── Design tokens ──────────────────────────────────────────────────
const C = {
  bg:     "#0a0402",
  card:   "#160805",
  panel:  "#1a0c06",
  border: "rgba(212,160,23,0.18)",
  gold:   "#d4a017",
  text:   "#f0e6d3",
  sub:    "#c4a882",
  muted:  "#7a6050",
  green:  "#22c55e",
  orange: "#f97316",
  red:    "#ef4444",
  blue:   "#3b82f6",
  inp:    "#2a1408",
  inpBd:  "rgba(212,160,23,0.25)",
};

const INP: React.CSSProperties = {
  background: C.inp, border: `1px solid ${C.inpBd}`, borderRadius: 8,
  color: C.text, fontSize: 13, padding: "7px 10px", width: "100%", outline: "none",
};
const BTN = (bg: string, light = false): React.CSSProperties => ({
  background: light ? "transparent" : bg,
  color: light ? bg : "#fff",
  border: light ? `1px solid ${bg}` : "none",
  borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer",
});

// ── Table helpers (same as WaiterFloor) ───────────────────────────
function tableStatus(num: string, orders: Order[]): "free" | "occupied" | "bill-requested" {
  const t = orders.filter(o => (o.tableNumber ?? "") === num);
  if (!t.length) return "free";
  if (t.every(o => o.status === "DELIVERED")) return "bill-requested";
  return "occupied";
}
function timerStart(num: string, orders: Order[]): Date | null {
  const firedAts = orders
    .filter(o => (o.tableNumber ?? "") === num)
    .flatMap(o => o.items).map(i => i.firedAt).filter(Boolean).map(f => new Date(f!));
  return firedAts.length ? new Date(Math.min(...firedAts.map(d => d.getTime()))) : null;
}
function fmtTimer(start: Date): string {
  const s = Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
function timerMinutes(start: Date): number {
  return Math.floor((Date.now() - start.getTime()) / 60000);
}
function shapeBR(shape: TableShape): string {
  if (shape === "round" || shape === "oval") return "50%";
  if (shape === "banquet") return "12px";
  return "6px";
}
function statusColor(s: "free" | "occupied" | "bill-requested"): string {
  if (s === "free") return C.green;
  if (s === "occupied") return C.orange;
  return C.red;
}
function fmtNis(n: number): string { return `₪${n.toFixed(0)}`; }
function fmtMin(min: number): string {
  if (min < 60) return `${min} דק'`;
  return `${Math.floor(min / 60)}ש' ${min % 60 > 0 ? `${min % 60}ד'` : ""}`;
}

// ── Main component ─────────────────────────────────────────────────
export default function ShiftManagerClient({ restaurants, managerName }: { restaurants: Restaurant[]; managerName: string }) {
  const [restaurantId, setRestaurantId] = useState(restaurants[0]?.id ?? "");
  const [layout,       setLayout]       = useState<LayoutV2 | null>(null);
  const [orders,       setOrders]       = useState<Order[]>([]);
  const [menuCats,     setMenuCats]     = useState<MenuCat[]>([]);
  const [tick,         setTick]         = useState(0);
  const [now,          setNow]          = useState(() => new Date());
  const [toast,        setToast]        = useState("");

  // Tab
  const [tab,          setTab]          = useState<"floor" | "86" | "waitlist" | "summary">("floor");

  // Floor map
  const [roomIdx,      setRoomIdx]      = useState(0);
  const floorRef                        = useRef<HTMLDivElement>(null);
  const [floorScale,   setFloorScale]   = useState(1);
  const [slaMin,       setSlaMin]       = useState(45);

  // Waitlist
  const [waitlist,     setWaitlist]     = useState<WaitParty[]>([]);
  const [wName,        setWName]        = useState("");
  const [wGuests,      setWGuests]      = useState(2);
  const prevFreeTables                  = useRef<Set<string>>(new Set());
  const [seatSuggest,  setSeatSuggest]  = useState<{ party: WaitParty; table: FreeTable } | null>(null);

  // 86 panel
  const [itemSearch,   setItemSearch]   = useState("");
  const [togglingId,   setTogglingId]   = useState<string | null>(null);

  // Shift summary modal
  const [summaryOpen,  setSummaryOpen]  = useState(false);
  const [shiftStart]                    = useState(() => new Date());

  const ridRef = useRef(restaurantId);
  useEffect(() => { ridRef.current = restaurantId; }, [restaurantId]);

  // ── Fetch layout ─────────────────────────────────────────────────
  const fetchLayout = useCallback(async (rid: string) => {
    try {
      const res = await fetch(`/api/admin/restaurants/${rid}/layout`);
      if (!res.ok) return;
      const data = await res.json();
      setLayout(data?.version === 2 ? data : null);
      setRoomIdx(0);
    } catch { /* ignore */ }
  }, []);

  // ── Fetch orders ──────────────────────────────────────────────────
  const fetchOrders = useCallback(async (rid: string) => {
    try {
      const res = await fetch(`/api/admin/orders?restaurantId=${rid}&activeOnly=1`);
      if (!res.ok) return;
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  }, []);

  // ── Fetch menu items ──────────────────────────────────────────────
  const fetchItems = useCallback(async (rid: string) => {
    try {
      const res = await fetch(`/api/admin/shift-manager/items?restaurantId=${rid}`);
      if (!res.ok) return;
      const data = await res.json();
      setMenuCats(data.categories ?? []);
    } catch { /* ignore */ }
  }, []);

  // ── Initial load + SSE ────────────────────────────────────────────
  useEffect(() => {
    const rid = restaurantId;
    if (!rid) return;
    fetchLayout(rid);
    fetchOrders(rid);
    fetchItems(rid);
  }, [restaurantId, fetchLayout, fetchOrders, fetchItems]);

  useEffect(() => {
    if (!restaurantId) return;
    const es = new EventSource(`/api/admin/orders/stream?restaurantId=${restaurantId}`);
    es.onmessage = () => fetchOrders(ridRef.current);
    return () => es.close();
  }, [restaurantId, fetchOrders]);

  // ── 1-second tick ────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => { setTick(t => t + 1); setNow(new Date()); }, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Floor scale via ResizeObserver ────────────────────────────────
  useEffect(() => {
    if (!floorRef.current) return;
    const obs = new ResizeObserver(() => {
      if (!floorRef.current || !layout) return;
      const room = layout.rooms[roomIdx];
      if (!room?.tables.length) return;
      const maxX = Math.max(...room.tables.map(t => t.x + t.w)) + 20;
      const maxY = Math.max(...room.tables.map(t => t.y + t.h)) + 20;
      const cw = floorRef.current.clientWidth;
      const ch = floorRef.current.clientHeight;
      setFloorScale(Math.min(cw / maxX, ch / maxY, 1));
    });
    obs.observe(floorRef.current);
    return () => obs.disconnect();
  }, [layout, roomIdx]);

  // ── Auto-suggest waitlist when a table frees ──────────────────────
  useEffect(() => {
    const room = layout?.rooms[roomIdx];
    if (!room || !waitlist.length || seatSuggest) return;
    const nowFree = new Set(
      room.tables.filter(t => tableStatus(String(t.num), orders) === "free").map(t => t.id)
    );
    const newlyFree = room.tables.filter(t => nowFree.has(t.id) && !prevFreeTables.current.has(t.id));
    if (newlyFree.length) {
      const candidate = newlyFree[0];
      const party     = waitlist[0];
      if (candidate.seats >= party.guests) {
        setSeatSuggest({ party, table: candidate });
      }
    }
    prevFreeTables.current = nowFree;
  }, [orders, layout, roomIdx, waitlist, seatSuggest, tick]);

  // ── Toast helper ──────────────────────────────────────────────────
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  // ── Waitlist actions ──────────────────────────────────────────────
  function addToWaitlist() {
    if (!wName.trim()) return;
    setWaitlist(w => [...w, { id: crypto.randomUUID(), name: wName.trim(), guests: wGuests, since: Date.now() }]);
    setWName(""); setWGuests(2);
    showToast(`✓ ${wName} נוסף להמתנה`);
  }
  function removeFromWaitlist(id: string) {
    setWaitlist(w => w.filter(p => p.id !== id));
  }
  function seatFromWaitlist(party: WaitParty) {
    removeFromWaitlist(party.id);
    setSeatSuggest(null);
    showToast(`✓ ${party.name} הושבו`);
  }

  // ── 86 toggle ─────────────────────────────────────────────────────
  async function toggle86(itemId: string, current: boolean) {
    setTogglingId(itemId);
    try {
      const res = await fetch(`/api/admin/shift-manager/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, isActive: !current }),
      });
      if (res.ok) {
        setMenuCats(cats => cats.map(c => ({
          ...c,
          items: c.items.map(i => i.id === itemId ? { ...i, isActive: !current } : i),
        })));
        showToast(current ? `✓ פריט הוסר מהתפריט (86)` : `✓ פריט הוחזר לתפריט`);
      }
    } finally { setTogglingId(null); }
  }

  // ── KPIs ──────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayOrders = orders.filter(o => new Date(o.createdAt) >= todayStart);
    const paidToday  = todayOrders.filter(o => o.status === "PAID");
    const revenue    = paidToday.reduce((s, o) => s + o.totalAmount, 0);
    const activeCount = orders.filter(o => !["PAID", "CANCELLED"].includes(o.status)).length;
    const room = layout?.rooms[roomIdx];
    const totalTables = room?.tables.length ?? 0;
    const freeTables  = room?.tables.filter(t => tableStatus(String(t.num), orders) === "free").length ?? 0;
    const slaBreached = room?.tables.filter(t => {
      const start = timerStart(String(t.num), orders);
      return start && timerMinutes(start) >= slaMin;
    }) ?? [];

    // avg service time (minutes) for PAID orders today that have firedAt
    let avgServiceMin = 0;
    const serviceTimes = paidToday.map(o => {
      const fired = o.items.map(i => i.firedAt).filter(Boolean);
      if (!fired.length) return null;
      const earliest = Math.min(...fired.map(f => new Date(f!).getTime()));
      return (new Date(o.createdAt).getTime() - earliest) / 60000; // can be negative if misorder
    }).filter((v): v is number => v !== null && v > 0);
    if (serviceTimes.length) avgServiceMin = serviceTimes.reduce((a, b) => a + b, 0) / serviceTimes.length;

    return { revenue, activeCount, paidCount: paidToday.length, totalTables, freeTables, slaBreached, avgServiceMin };
  }, [orders, layout, roomIdx, slaMin, tick]);

  // ── Shift summary data ────────────────────────────────────────────
  const shiftOrders = useMemo(() => {
    return orders.filter(o => new Date(o.createdAt) >= shiftStart);
  }, [orders, shiftStart]);

  // ── Floor map render ──────────────────────────────────────────────
  const activeRoom = layout?.rooms[roomIdx];
  const mapMaxX = activeRoom?.tables.length ? Math.max(...activeRoom.tables.map(t => t.x + t.w)) + 20 : 600;
  const mapMaxY = activeRoom?.tables.length ? Math.max(...activeRoom.tables.map(t => t.y + t.h)) + 20 : 400;

  // ── 86 filtered items ─────────────────────────────────────────────
  const filtered86 = useMemo(() => {
    const q = itemSearch.toLowerCase();
    return menuCats.map(c => ({
      ...c,
      items: c.items.filter(i => i.name.toLowerCase().includes(q)),
    })).filter(c => c.items.length);
  }, [menuCats, itemSearch]);

  const clockStr = now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "Arial, sans-serif", direction: "rtl", display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-20px)} to{opacity:1;transform:translateY(0)} }
        .sla-blink { animation: blink 1s infinite; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ background: "linear-gradient(135deg,#1a1208,#3d2b00)", padding: "14px 24px", display: "flex", alignItems: "center", gap: 16, borderBottom: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 22, fontWeight: 900, color: C.gold, letterSpacing: 2 }}>Menu4U</span>
        <span style={{ fontSize: 13, color: C.sub }}>מנהל משמרת</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 13, color: C.muted }}>{managerName}</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: C.gold, fontVariantNumeric: "tabular-nums" }}>{clockStr}</span>
        {restaurants.length > 1 && (
          <select value={restaurantId} onChange={e => setRestaurantId(e.target.value)} style={{ ...INP, width: "auto" }}>
            {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}
      </div>

      {/* ── SLA alert banner ── */}
      {kpis.slaBreached.length > 0 && (
        <div className="sla-blink" style={{ background: "rgba(239,68,68,0.15)", borderBottom: `1px solid ${C.red}`, padding: "8px 24px", display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ color: C.red, fontWeight: 700 }}>⚠️ SLA</span>
          <span style={{ color: C.red, fontSize: 13 }}>
            שולחנות מעל {slaMin} דקות: {kpis.slaBreached.map(t => `#${t.num}`).join(" · ")}
          </span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: C.muted }}>ספ: </span>
          <input type="number" value={slaMin} onChange={e => setSlaMin(Number(e.target.value))} min={10} max={120}
            style={{ ...INP, width: 52, padding: "4px 6px", fontSize: 12 }} />
          <span style={{ fontSize: 12, color: C.muted }}>דק'</span>
        </div>
      )}

      {/* ── KPI bar ── */}
      <div style={{ display: "flex", gap: 2, padding: "12px 20px", background: C.card, borderBottom: `1px solid ${C.border}`, flexWrap: "wrap" }}>
        {[
          { label: "הכנסה היום", value: fmtNis(kpis.revenue), color: C.gold },
          { label: "הזמנות פתוחות", value: kpis.activeCount, color: C.orange },
          { label: "שולחנות פנויים", value: `${kpis.freeTables}/${kpis.totalTables}`, color: C.green },
          { label: "ממוצע שירות", value: kpis.avgServiceMin > 0 ? fmtMin(Math.round(kpis.avgServiceMin)) : "—", color: C.blue },
          { label: "SLA חריגות", value: kpis.slaBreached.length, color: kpis.slaBreached.length ? C.red : C.green },
          { label: "ממתינים", value: waitlist.length, color: waitlist.length ? C.orange : C.muted },
        ].map(k => (
          <div key={k.label} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 18px", minWidth: 110, textAlign: "center", flex: "1 1 110px" }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: "auto" }}>
          <button onClick={() => setSummaryOpen(true)} style={BTN(C.gold)}>📊 סכום משמרת</button>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div style={{ display: "flex", gap: 4, padding: "10px 20px 0", borderBottom: `1px solid ${C.border}`, background: C.card }}>
        {(["floor", "waitlist", "86", "summary"] as const).map(t => {
          const label = { floor: "🗺️ מפת רצפה", waitlist: `⏳ המתנה (${waitlist.length})`, "86": "🚫 86 תפריט", summary: "📋 סטטוס" }[t];
          return (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer",
              background: tab === t ? C.gold : "transparent",
              color: tab === t ? "#1a0c06" : C.sub,
              border: "none", borderRadius: "8px 8px 0 0",
            }}>{label}</button>
          );
        })}
      </div>

      {/* ── Tab content ── */}
      <div style={{ flex: 1, overflow: "auto" }}>

        {/* ── FLOOR MAP TAB ── */}
        {tab === "floor" && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: 16, gap: 12 }}>
            {/* Room tabs */}
            {layout && layout.rooms.length > 1 && (
              <div style={{ display: "flex", gap: 6 }}>
                {layout.rooms.map((r, i) => (
                  <button key={r.id} onClick={() => setRoomIdx(i)} style={{
                    padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                    background: i === roomIdx ? C.gold : C.panel,
                    color: i === roomIdx ? "#1a0c06" : C.sub,
                    border: `1px solid ${C.border}`, borderRadius: 8,
                  }}>{r.name}</button>
                ))}
              </div>
            )}

            {/* SLA threshold control (when no banner) */}
            {!kpis.slaBreached.length && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.muted }}>
                <span>SLA:</span>
                <input type="number" value={slaMin} onChange={e => setSlaMin(Number(e.target.value))} min={10} max={120}
                  style={{ ...INP, width: 52, padding: "4px 6px", fontSize: 12 }} />
                <span>דקות</span>
              </div>
            )}

            {/* Floor canvas */}
            <div ref={floorRef} style={{ flex: 1, position: "relative", overflow: "hidden", background: "rgba(10,4,2,0.4)", borderRadius: 12, border: `1px solid ${C.border}` }}>
              {activeRoom?.tables.map(t => {
                const tNum   = String(t.num);
                const status = tableStatus(tNum, orders);
                const start  = timerStart(tNum, orders);
                const mins   = start ? timerMinutes(start) : 0;
                const breached = start && mins >= slaMin;
                const color  = statusColor(status);
                return (
                  <div key={t.id} style={{
                    position: "absolute",
                    left: t.x * floorScale, top: t.y * floorScale,
                    width: t.w * floorScale, height: t.h * floorScale,
                    background: `${color}22`,
                    border: `2px solid ${breached ? C.red : color}`,
                    borderRadius: shapeBR(t.shape),
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    transition: "border-color 0.3s",
                    animation: breached ? "blink 1s infinite" : undefined,
                  }}>
                    <span style={{ fontSize: Math.max(9, 13 * floorScale), fontWeight: 700, color }}>{t.num}</span>
                    {t.name && <span style={{ fontSize: Math.max(7, 9 * floorScale), color: C.muted }}>{t.name}</span>}
                    {start && <span style={{ fontSize: Math.max(7, 10 * floorScale), color: breached ? C.red : C.sub, fontVariantNumeric: "tabular-nums" }}>{fmtTimer(start)}</span>}
                  </div>
                );
              })}
              {!activeRoom?.tables.length && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>
                  אין שולחנות בחדר זה
                </div>
              )}
            </div>

            {/* Legend */}
            <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
              {[["פנוי", C.green], ["תפוס", C.orange], ["ביקש חשבון", C.red]].map(([l, c]) => (
                <span key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: c as string, display: "inline-block" }} />
                  <span style={{ color: C.muted }}>{l}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── WAITLIST TAB ── */}
        {tab === "waitlist" && (
          <div style={{ padding: 20, maxWidth: 600, margin: "0 auto" }}>
            <h2 style={{ color: C.gold, fontSize: 16, fontWeight: 700, marginBottom: 16 }}>רשימת המתנה</h2>

            {/* Add party form */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 20, display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: 2, minWidth: 150 }}>
                <label style={{ fontSize: 12, color: C.sub, display: "block", marginBottom: 4 }}>שם / מספר</label>
                <input value={wName} onChange={e => setWName(e.target.value)} placeholder="שם קבוצה..." style={INP}
                  onKeyDown={e => e.key === "Enter" && addToWaitlist()} />
              </div>
              <div style={{ flex: 1, minWidth: 80 }}>
                <label style={{ fontSize: 12, color: C.sub, display: "block", marginBottom: 4 }}>אורחים</label>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => setWGuests(g => Math.max(1, g - 1))} style={{ ...BTN(C.panel), padding: "7px 10px", border: `1px solid ${C.border}` }}>−</button>
                  <input type="number" value={wGuests} min={1} max={20} readOnly style={{ ...INP, width: 50, textAlign: "center" }} />
                  <button onClick={() => setWGuests(g => Math.min(20, g + 1))} style={{ ...BTN(C.panel), padding: "7px 10px", border: `1px solid ${C.border}` }}>+</button>
                </div>
              </div>
              <button onClick={addToWaitlist} style={BTN(C.gold)}>+ הוסף</button>
            </div>

            {/* Waitlist */}
            {waitlist.length === 0 ? (
              <div style={{ color: C.muted, textAlign: "center", padding: 40, fontSize: 14 }}>אין ממתינים כרגע</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {waitlist.map((p, idx) => {
                  const waitedMin = Math.floor((Date.now() - p.since) / 60000);
                  const urgent    = waitedMin >= 20;
                  return (
                    <div key={p.id} style={{ background: C.card, border: `1px solid ${urgent ? C.red : C.border}`, borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 14, color: C.muted, fontWeight: 700, minWidth: 20 }}>#{idx + 1}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: C.sub }}>👤 {p.guests} · ⏱ {fmtMin(waitedMin)}{urgent ? " ⚠️" : ""}</div>
                      </div>
                      <button onClick={() => seatFromWaitlist(p)} style={BTN(C.green)}>הושב</button>
                      <button onClick={() => removeFromWaitlist(p.id)} style={BTN(C.red, true)}>✕</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── 86 MENU TAB ── */}
        {tab === "86" && (
          <div style={{ padding: 20, maxWidth: 700, margin: "0 auto" }}>
            <h2 style={{ color: C.gold, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>86 — ניהול זמינות תפריט</h2>
            <p style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>פריטים מסומנים כ-86 לא יוצגו לאורחים ולמלצרים.</p>
            <div style={{ marginBottom: 16 }}>
              <input value={itemSearch} onChange={e => setItemSearch(e.target.value)} placeholder="🔍 חפש פריט..." style={INP} />
            </div>
            {filtered86.map(cat => (
              <div key={cat.id} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.gold, marginBottom: 8, borderBottom: `1px solid ${C.border}`, paddingBottom: 4 }}>
                  {cat.name} <span style={{ color: C.muted, fontWeight: 400, fontSize: 11 }}>· {cat.menuName}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {cat.items.map(item => {
                    const is86 = !item.isActive;
                    return (
                      <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, background: C.card, border: `1px solid ${is86 ? C.red + "44" : C.border}`, borderRadius: 8, padding: "10px 14px", opacity: togglingId === item.id ? 0.6 : 1 }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 600, fontSize: 14, textDecoration: is86 ? "line-through" : "none", color: is86 ? C.muted : C.text }}>
                            {item.name}
                          </span>
                          {is86 && <span style={{ marginRight: 8, fontSize: 11, color: C.red, fontWeight: 700 }}>86</span>}
                        </div>
                        <span style={{ color: C.sub, fontSize: 13 }}>₪{item.price.toFixed(0)}</span>
                        <button
                          onClick={() => toggle86(item.id, item.isActive)}
                          disabled={togglingId === item.id}
                          style={BTN(is86 ? C.green : C.red, !is86)}
                        >
                          {is86 ? "החזר" : "86"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {!filtered86.length && (
              <div style={{ color: C.muted, textAlign: "center", padding: 40 }}>אין פריטים תואמים</div>
            )}
          </div>
        )}

        {/* ── STATUS TAB ── */}
        {tab === "summary" && (
          <div style={{ padding: 20, maxWidth: 700, margin: "0 auto" }}>
            <h2 style={{ color: C.gold, fontSize: 16, fontWeight: 700, marginBottom: 16 }}>סטטוס שולחנות</h2>
            {activeRoom?.tables.map(t => {
              const tNum   = String(t.num);
              const status = tableStatus(tNum, orders);
              const start  = timerStart(tNum, orders);
              const mins   = start ? timerMinutes(start) : 0;
              const tOrds  = orders.filter(o => (o.tableNumber ?? "") === tNum);
              const total  = tOrds.reduce((s, o) => s + o.totalAmount, 0);
              const guests = Math.max(0, ...tOrds.map(o => o.coversCount ?? 0));
              const color  = statusColor(status);
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, background: C.card, border: `1px solid ${color}33`, borderRadius: 10, padding: "12px 16px", marginBottom: 8 }}>
                  <span style={{ width: 36, height: 36, borderRadius: shapeBR(t.shape), background: `${color}22`, border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color }}>{t.num}</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{t.name || `שולחן ${t.num}`}</span>
                    {status !== "free" && <span style={{ fontSize: 12, color: C.sub, marginRight: 8 }}>👤 {guests}</span>}
                  </div>
                  {start && <span style={{ fontSize: 13, color: mins >= slaMin ? C.red : C.sub, fontVariantNumeric: "tabular-nums" }}>{fmtTimer(start)}</span>}
                  {total > 0 && <span style={{ fontSize: 13, color: C.gold, fontWeight: 700 }}>{fmtNis(total)}</span>}
                  <span style={{ fontSize: 12, fontWeight: 700, color }}>{status === "free" ? "פנוי" : status === "occupied" ? "תפוס" : "ביקש חשבון"}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: C.gold, color: "#1a0c06", padding: "10px 24px", borderRadius: 24, fontWeight: 700, fontSize: 14, zIndex: 9999, animation: "slideDown 0.2s ease" }}>
          {toast}
        </div>
      )}

      {/* ── Waitlist seat suggestion modal ── */}
      {seatSuggest && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9000 }}>
          <div style={{ background: C.panel, border: `1px solid ${C.gold}`, borderRadius: 16, padding: 32, maxWidth: 380, width: "90%", textAlign: "center", animation: "slideDown 0.2s ease" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🎉</div>
            <h3 style={{ color: C.gold, fontSize: 18, fontWeight: 700, marginBottom: 8 }}>שולחן התפנה!</h3>
            <p style={{ color: C.text, fontSize: 14, marginBottom: 20 }}>
              שולחן <strong style={{ color: C.gold }}>#{seatSuggest.table.num}</strong> ({seatSuggest.table.seats} מקומות) פנוי.<br />
              <strong>{seatSuggest.party.name}</strong> ({seatSuggest.party.guests} אורחים) ממתין{" "}
              {fmtMin(Math.floor((Date.now() - seatSuggest.party.since) / 60000))}.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => seatFromWaitlist(seatSuggest.party)} style={BTN(C.green)}>✓ הושב</button>
              <button onClick={() => setSeatSuggest(null)} style={BTN(C.red, true)}>דחה</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Shift summary modal ── */}
      {summaryOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9000 }} onClick={() => setSummaryOpen(false)}>
          <div style={{ background: C.panel, border: `1px solid ${C.gold}`, borderRadius: 16, padding: 32, maxWidth: 440, width: "90%", animation: "slideDown 0.2s ease" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: C.gold, fontSize: 18, fontWeight: 700, marginBottom: 20, textAlign: "center" }}>📊 סיכום משמרת</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
              {[
                ["התחלה", shiftStart.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })],
                ["הזמנות", shiftOrders.length],
                ["הכנסה כוללת", fmtNis(shiftOrders.filter(o => o.status === "PAID").reduce((s, o) => s + o.totalAmount, 0))],
                ["הזמנות פתוחות", shiftOrders.filter(o => !["PAID", "CANCELLED"].includes(o.status)).length],
                ["SLA חריגות עכשיו", kpis.slaBreached.length],
                ["ממתינים בתור", waitlist.length],
              ].map(([l, v]) => (
                <div key={String(l)} style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
                  <span style={{ color: C.sub, fontSize: 14 }}>{l}</span>
                  <span style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{v}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setSummaryOpen(false)} style={{ ...BTN(C.gold), width: "100%" }}>סגור</button>
          </div>
        </div>
      )}
    </div>
  );
}
