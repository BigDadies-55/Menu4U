"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ── Types ──────────────────────────────────────────────────────────
type TableShape  = "round" | "rect" | "square" | "oval" | "long" | "banquet";
type FreeTable   = { id: string; num: number; name: string; shape: TableShape; x: number; y: number; w: number; h: number; seats: number; rot: number; zIdx?: number; customColor?: string };
type Decoration  = { id: string; kind: "line" | "label" | "image"; x: number; y: number; w: number; h: number; rot: number; text: string; color: string; zIdx: number; imgSrc?: string };
type Room        = { id: string; name: string; tables: FreeTable[]; bg?: number; bgImg?: string; bgOpacity?: number; decos?: Decoration[] };
type LayoutV2    = { version: 2; rooms: Room[] };
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
// ── Room background themes (identical to layout-builder) ───────────
const BGS = [
  { body: "#1a0a0a", cw: `repeating-linear-gradient(0deg,rgba(212,160,23,0.04) 0px,rgba(212,160,23,0.04) 1px,transparent 1px,transparent 40px),repeating-linear-gradient(90deg,rgba(212,160,23,0.04) 0px,rgba(212,160,23,0.04) 1px,transparent 1px,transparent 40px),radial-gradient(ellipse at 50% 50%,#2a0e0e 0%,#0d0404 100%)` },
  { body: "#0a150a", cw: `radial-gradient(ellipse at 30% 20%,#1a2a1a,#0a150a)` },
  { body: "#0a0800", cw: `repeating-linear-gradient(0deg,rgba(212,160,23,0.09) 0px,rgba(212,160,23,0.09) 1px,transparent 1px,transparent 40px),repeating-linear-gradient(90deg,rgba(212,160,23,0.09) 0px,rgba(212,160,23,0.09) 1px,transparent 1px,transparent 40px),radial-gradient(ellipse at 60% 40%,#1a1205,#0a0800)` },
  { body: "#050510", cw: `repeating-linear-gradient(60deg,rgba(100,80,220,0.08) 0px,rgba(100,80,220,0.08) 1px,transparent 1px,transparent 40px),radial-gradient(ellipse at 50% 50%,#0a0a20,#050510)` },
  { body: "#0a0502", cw: `repeating-linear-gradient(30deg,rgba(180,80,20,0.09) 0px,rgba(180,80,20,0.09) 1px,transparent 1px,transparent 40px),radial-gradient(ellipse at 40% 60%,#1a0a05,#0a0502)` },
  { body: "#f5f0e8", cw: `linear-gradient(135deg,#f5f0e8 0%,#e8dcc8 50%,#f0e8d8 100%)` },
];
const SHAPE_BR: Record<TableShape, string> = {
  round: "50%", rect: "10px", square: "8px", oval: "50%/40%", long: "12px", banquet: "6px",
};
const ORDER_STATUS_CFG = {
  free:            { bg: "radial-gradient(circle at 40% 35%,#2a5c2a,#0f2e0f)", border: "#2e7d2e", glow: "rgba(34,197,94,0.35)"  },
  seated:          { bg: "radial-gradient(circle at 40% 35%,#3a1a5c,#1a0a2e)", border: "#7c3aed", glow: "rgba(124,58,237,0.45)" },
  occupied:        { bg: "radial-gradient(circle at 40% 35%,#5c3a00,#2e1900)", border: "#b87520", glow: "rgba(249,115,22,0.35)"  },
  "bill-requested":{ bg: "radial-gradient(circle at 40% 35%,#5c1414,#2e0a0a)", border: "#8b1a1a", glow: "rgba(239,68,68,0.45)"  },
};

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

const LS_REST_KEY = "menu4u_active_restaurant";

// ── Main component ─────────────────────────────────────────────────
export default function ShiftManagerClient({ restaurants, managerName }: { restaurants: Restaurant[]; managerName: string }) {
  const [restaurantId, setRestaurantId] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(LS_REST_KEY);
      if (saved && restaurants.some(r => r.id === saved)) return saved;
    }
    return restaurants[0]?.id ?? "";
  });
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

  // Seated tables — local state (party directed to table but no order yet)
  const [seatedTables, setSeatedTables] = useState<Map<string, { partyName: string; guests: number; since: number }>>(new Map());
  // Manual seat modal: pick which waitlist party to seat at a specific table
  const [seatTableModal, setSeatTableModal] = useState<{ tableNum: string; seats: number } | null>(null);

  // Waitlist — persisted to localStorage per restaurant
  const waitlistKey = `menu4u_waitlist_${restaurantId}`;
  const [waitlist, setWaitlist] = useState<WaitParty[]>(() => {
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem(waitlistKey) : null;
      return saved ? (JSON.parse(saved) as WaitParty[]) : [];
    } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem(waitlistKey, JSON.stringify(waitlist)); } catch { /* ignore */ }
  }, [waitlist, waitlistKey]);
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
  // Persist selected restaurant so the screen reopens on the one you worked on
  useEffect(() => {
    if (restaurantId && typeof window !== "undefined") localStorage.setItem(LS_REST_KEY, restaurantId);
  }, [restaurantId]);

  // ── Fetch layout ─────────────────────────────────────────────────
  const fetchLayout = useCallback(async (rid: string) => {
    try {
      const res = await fetch(`/api/admin/restaurants/${rid}/layout`);
      if (!res.ok) return;
      const data = await res.json();
      const raw = data.tableLayoutJson;
      if (!raw) { setLayout(null); return; }
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      const rooms = parsed?.rooms ?? (Array.isArray(parsed) ? parsed : null);
      setLayout(rooms && Array.isArray(rooms) ? { version: 2, rooms } : null);
      setRoomIdx(0);
    } catch { setLayout(null); }
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

  // ── Auto-clear seatedTables once waiter creates a real order ────────
  useEffect(() => {
    setSeatedTables(prev => {
      if (prev.size === 0) return prev;
      const next = new Map(prev);
      for (const tableNum of next.keys()) {
        if (tableStatus(tableNum, orders) !== "free") next.delete(tableNum);
      }
      return next.size !== prev.size ? next : prev;
    });
  }, [orders]);

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
  function seatPartyAtTable(party: WaitParty, tableNum: string) {
    removeFromWaitlist(party.id);
    setSeatSuggest(null);
    setSeatTableModal(null);
    setSeatedTables(prev => {
      const next = new Map(prev);
      next.set(tableNum, { partyName: party.name, guests: party.guests, since: Date.now() });
      return next;
    });
    showToast(`✓ ${party.name} הושבו לשולחן ${tableNum}`);
  }
  function seatFromWaitlist(party: WaitParty) {
    const tableNum = seatSuggest?.table ? String(seatSuggest.table.num) : null;
    if (tableNum) {
      seatPartyAtTable(party, tableNum);
    } else {
      removeFromWaitlist(party.id);
      setSeatSuggest(null);
      showToast(`✓ ${party.name} הושבו`);
    }
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
    <div style={{ height: "calc(100vh - 64px)", background: C.bg, color: C.text, fontFamily: "Arial, sans-serif", direction: "rtl", display: "flex", flexDirection: "column", overflow: "hidden" }}>
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
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

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
            <div ref={floorRef} style={{ flex: 1, position: "relative", overflow: "hidden", borderRadius: 12, border: `1px solid ${C.border}` }}>
              {!activeRoom && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 13 }}>
                  {layout ? "אין שולחנות בחדר זה" : "לא נשמרה פריסת שולחנות"}
                </div>
              )}
              {activeRoom && (() => {
                const bgCfg = BGS[activeRoom.bg ?? 0] ?? BGS[0];
                return (
                  <>
                    {/* Room background */}
                    <div style={{
                      position: "absolute", top: 0, left: 0,
                      width: mapMaxX * floorScale, height: mapMaxY * floorScale,
                      ...(activeRoom.bgImg
                        ? { backgroundImage: `url(${activeRoom.bgImg})`, backgroundSize: "cover", backgroundPosition: "center", opacity: activeRoom.bgOpacity ?? 1 }
                        : { background: bgCfg.cw, backgroundSize: `${40 * floorScale}px ${40 * floorScale}px` }
                      ),
                    }} />

                    {/* Decorations */}
                    {(activeRoom.decos ?? []).slice().sort((a, b) => a.zIdx - b.zIdx).map(deco => {
                      const isLine = deco.kind === "line";
                      const isImage = deco.kind === "image";
                      const c = deco.color || "#d4a017";
                      return (
                        <div key={deco.id} style={{
                          position: "absolute",
                          left: deco.x * floorScale, top: deco.y * floorScale,
                          width: deco.w * floorScale, height: Math.max(isLine ? 2 : 20, deco.h * floorScale),
                          transform: `rotate(${deco.rot}deg)`, transformOrigin: "center",
                          zIndex: deco.zIdx, pointerEvents: "none",
                        }}>
                          {isLine ? (
                            <div style={{ position: "absolute", inset: 0, background: c, borderRadius: 2 }} />
                          ) : isImage ? (
                            <div style={{ position: "absolute", inset: 0, borderRadius: 6 * floorScale, overflow: "hidden" }}>
                              {deco.imgSrc && <img src={deco.imgSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />}
                            </div>
                          ) : (
                            <div style={{ position: "absolute", inset: 0, background: `${c}20`, border: `1px solid ${c}60`, borderRadius: 6 * floorScale, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <span style={{ fontSize: Math.max(9, 13 * floorScale), color: c, fontWeight: 700, textAlign: "center", padding: "0 4px" }}>{deco.text}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Tables */}
                    {activeRoom.tables.slice().sort((a, b) => (a.zIdx ?? 0) - (b.zIdx ?? 0)).map(t => {
                      const tNum      = String(t.num);
                      const orderSt   = tableStatus(tNum, orders);
                      const seated    = seatedTables.get(tNum);
                      const effectSt  = seated && orderSt === "free" ? "seated" : orderSt;
                      const start     = timerStart(tNum, orders);
                      const mins      = start ? timerMinutes(start) : 0;
                      const breached  = start && mins >= slaMin;
                      const cfg       = ORDER_STATUS_CFG[effectSt];
                      const bg        = t.customColor
                        ? `radial-gradient(circle at 40% 35%,${t.customColor}cc,${t.customColor}44)`
                        : cfg.bg;
                      const brd       = t.customColor || (breached ? C.red : cfg.border);
                      const br        = SHAPE_BR[t.shape];
                      const fSz       = Math.max(9, Math.min(t.w, t.h) * floorScale * 0.22);
                      const w         = t.w * floorScale;
                      const h         = t.h * floorScale;
                      const canSeat   = effectSt === "free" && waitlist.length > 0;
                      return (
                        <div
                          key={t.id}
                          onClick={() => canSeat && setSeatTableModal({ tableNum: tNum, seats: t.seats })}
                          style={{
                            position: "absolute",
                            left: t.x * floorScale, top: t.y * floorScale,
                            width: w, height: h,
                            transform: t.rot ? `rotate(${t.rot}deg)` : undefined, transformOrigin: "center",
                            zIndex: t.zIdx ?? 1,
                            cursor: canSeat ? "pointer" : "default",
                          }}
                        >
                          <div style={{
                            position: "absolute", inset: 0, borderRadius: br,
                            background: bg,
                            border: `${Math.max(1, 2 * floorScale)}px solid ${brd}`,
                            boxShadow: breached
                              ? `0 0 0 ${2 * floorScale}px ${C.red}66, 0 0 ${10 * floorScale}px rgba(239,68,68,0.5)`
                              : `0 0 ${6 * floorScale}px ${cfg.glow}, 0 ${2 * floorScale}px ${6 * floorScale}px rgba(0,0,0,0.4)`,
                            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                            overflow: "hidden", transition: "border-color 0.3s",
                            animation: breached ? "blink 1s infinite" : undefined,
                          }}>
                            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "45%", background: "linear-gradient(180deg,rgba(255,255,255,0.07) 0%,transparent 100%)", pointerEvents: "none" }} />
                            <div style={{ display: "flex", alignItems: "baseline", gap: Math.max(1, 3 * floorScale), zIndex: 1 }}>
                              <span style={{ fontSize: fSz, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{t.num}</span>
                              {t.seats > 0 && <span style={{ fontSize: Math.max(7, fSz * 0.65), color: "rgba(255,255,255,0.7)", lineHeight: 1 }}>({t.seats})</span>}
                            </div>
                            {t.name && <span style={{ fontSize: Math.max(7, fSz * 0.55), color: "rgba(255,255,255,0.7)", zIndex: 1, maxWidth: w - 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>}
                            {seated && orderSt === "free" && (
                              <span style={{ fontSize: Math.max(7, fSz * 0.55), color: "#c4b5fd", zIndex: 1, maxWidth: w - 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{seated.partyName}</span>
                            )}
                            {start && <span style={{ fontSize: Math.max(7, fSz * 0.6), color: breached ? "#fca5a5" : "#fcd34d", fontWeight: 700, zIndex: 1 }}>⏱ {fmtTimer(start)}</span>}
                            {canSeat && (
                              <span style={{ fontSize: Math.max(6, fSz * 0.5), color: "#86efac", zIndex: 1, lineHeight: 1 }}>👆 הושב</span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Legend */}
                    <div style={{ position: "absolute", bottom: 8, left: 8, display: "flex", gap: 6, zIndex: 50 }}>
                      {([["#2e7d2e","פנוי"],["#7c3aed","הושב"],["#b87520","תפוס"],["#8b1a1a","חשבון"]] as const).map(([col, lbl]) => (
                        <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 7px", borderRadius: 7, background: "rgba(0,0,0,0.75)", border: `1px solid ${col}55`, fontSize: 10, backdropFilter: "blur(4px)" }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: col, display: "inline-block" }} />
                          <span style={{ color: "#e5d5b5" }}>{lbl}</span>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* ── WAITLIST TAB ── */}
        {tab === "waitlist" && (
          <div style={{ padding: 20, maxWidth: 600, margin: "0 auto", overflowY: "auto", flex: 1 }}>
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
          <div style={{ padding: 20, maxWidth: 700, margin: "0 auto", overflowY: "auto", flex: 1 }}>
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
          <div style={{ padding: 20, maxWidth: 700, margin: "0 auto", overflowY: "auto", flex: 1 }}>
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
                  <span style={{ width: 36, height: 36, borderRadius: SHAPE_BR[t.shape], background: `${color}22`, border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color }}>{t.num}</span>
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

      {/* ── Manual seat modal (click free table → pick party) ── */}
      {seatTableModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9000 }} onClick={() => setSeatTableModal(null)}>
          <div style={{ background: C.panel, border: `1px solid ${C.gold}`, borderRadius: 16, padding: 28, maxWidth: 360, width: "90%", animation: "slideDown 0.2s ease", direction: "rtl" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: C.gold, fontSize: 16, fontWeight: 700, marginBottom: 16, textAlign: "center" }}>
              🪑 הושבה לשולחן {seatTableModal.tableNum} ({seatTableModal.seats} מקומות)
            </h3>
            {waitlist.length === 0 ? (
              <p style={{ color: C.muted, fontSize: 13, textAlign: "center", marginBottom: 16 }}>אין קבוצות ברשימת ההמתנה</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {waitlist.map(p => (
                  <button key={p.id} onClick={() => seatPartyAtTable(p, seatTableModal.tableNum)}
                    style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", color: C.text }}>
                    <span style={{ fontWeight: 700 }}>{p.name}</span>
                    <span style={{ fontSize: 12, color: C.sub }}>{p.guests} אורחים · {fmtMin(Math.floor((Date.now() - p.since) / 60000))}</span>
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setSeatTableModal(null)} style={{ ...BTN(C.muted, true), width: "100%" }}>ביטול</button>
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
