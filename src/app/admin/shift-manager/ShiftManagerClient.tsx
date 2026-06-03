"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { T, STATUS, type StatusKey } from "@/lib/ui";

// ── Types ──────────────────────────────────────────────────────────
type TableShape  = "round" | "rect" | "square" | "oval" | "long" | "banquet";
type FreeTable   = { id: string; num: number; name: string; shape: TableShape; x: number; y: number; w: number; h: number; seats: number; rot: number; zIdx?: number; customColor?: string };
type Decoration  = { id: string; kind: "line" | "label" | "image"; x: number; y: number; w: number; h: number; rot: number; text: string; color: string; zIdx: number; imgSrc?: string };
type Room        = { id: string; name: string; tables: FreeTable[]; bg?: number; bgImg?: string; bgOpacity?: number; decos?: Decoration[] };
type LayoutV2    = { version: 2; rooms: Room[] };
type OrderItem  = { id: string; quantity: number; price: number; itemStatus: string; course: number; heldUntilFired: boolean; firedAt: string | null; item: { name: string } };
type Order      = { id: string; tableNumber: string | null; status: string; totalAmount: number; createdAt: string; coversCount: number | null; items: OrderItem[] };
type MenuItem   = { id: string; name: string; price: number; isActive: boolean };
type MenuCat    = { id: string; name: string; menuName: string; items: MenuItem[] };
type Restaurant = { id: string; name: string };
type WaitParty  = { id: string; name: string; guests: number; since: number };
type WaiterUser = { id: string; name: string | null; email: string };
type WaiterStation = { userId: string; tableNumbers: string[]; label: string | null; user: WaiterUser };

const INP: React.CSSProperties = {
  background: T.overlay, border: `1px solid rgba(212,160,23,0.25)`, borderRadius: 8,
  color: T.text, fontSize: 13, padding: "7px 10px", width: "100%", outline: "none",
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
  { body: T.bg, cw: `repeating-linear-gradient(0deg,rgba(212,160,23,0.04) 0px,rgba(212,160,23,0.04) 1px,transparent 1px,transparent 40px),repeating-linear-gradient(90deg,rgba(212,160,23,0.04) 0px,rgba(212,160,23,0.04) 1px,transparent 1px,transparent 40px),radial-gradient(ellipse at 50% 50%,#2a0e0e 0%,#0d0404 100%)` },
  { body: T.bg, cw: `radial-gradient(ellipse at 30% 20%,#1a2a1a,#0a150a)` },
  { body: T.bg, cw: `repeating-linear-gradient(0deg,rgba(212,160,23,0.09) 0px,rgba(212,160,23,0.09) 1px,transparent 1px,transparent 40px),repeating-linear-gradient(90deg,rgba(212,160,23,0.09) 0px,rgba(212,160,23,0.09) 1px,transparent 1px,transparent 40px),radial-gradient(ellipse at 60% 40%,#1a1205,#0a0800)` },
  { body: T.bg, cw: `repeating-linear-gradient(60deg,rgba(100,80,220,0.08) 0px,rgba(100,80,220,0.08) 1px,transparent 1px,transparent 40px),radial-gradient(ellipse at 50% 50%,#0a0a20,#050510)` },
  { body: T.bg, cw: `repeating-linear-gradient(30deg,rgba(180,80,20,0.09) 0px,rgba(180,80,20,0.09) 1px,transparent 1px,transparent 40px),radial-gradient(ellipse at 40% 60%,#1a0a05,#0a0502)` },
  { body: T.text, cw: `linear-gradient(135deg,#f5f0e8 0%,#e8dcc8 50%,#f0e8d8 100%)` },
];
const SHAPE_BR: Record<TableShape, string> = {
  round: "50%", rect: "10px", square: "8px", oval: "50%/40%", long: "12px", banquet: "6px",
};
const TABLE_BG = T.bg;

function statusColor(s: "free" | "occupied" | "bill-requested"): string {
  if (s === "free") return T.green;
  if (s === "occupied") return T.orange;
  return T.red;
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
  const [tab,          setTab]          = useState<"floor" | "86" | "waitlist" | "summary" | "stations">("floor");

  // Floor map
  const [roomIdx,      setRoomIdx]      = useState(0);
  const floorRef                        = useRef<HTMLDivElement>(null);
  const [floorScale,   setFloorScale]   = useState(1);
  const [floorContainerSize, setFloorContainerSize] = useState({ w: 0, h: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
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

  // Expediter panel
  const [firingCourse, setFiringCourse] = useState<string>("");

  // Station assignment
  const [stations,     setStations]     = useState<WaiterStation[]>([]);
  const [waiters,      setWaiters]      = useState<WaiterUser[]>([]);
  const [stationEdit,  setStationEdit]  = useState<Record<string, string>>({}); // userId → comma-sep table nums
  const [stationSaving,setStationSaving]= useState<string | null>(null);

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

  // ── Fetch station assignments ─────────────────────────────────────
  const fetchStations = useCallback(async (rid: string) => {
    try {
      const res = await fetch(`/api/admin/waiter-stations?restaurantId=${rid}`);
      if (!res.ok) return;
      const data: WaiterStation[] = await res.json();
      setStations(data);
      const editMap: Record<string, string> = {};
      data.forEach(s => { editMap[s.userId] = s.tableNumbers.join(", "); });
      setStationEdit(editMap);
    } catch { /* ignore */ }
  }, []);

  const fetchWaiters = useCallback(async (rid: string) => {
    try {
      const res = await fetch(`/api/admin/restaurants/${rid}/users`);
      if (!res.ok) return;
      const data = await res.json();
      setWaiters((data as Array<{ user: WaiterUser; role: string }>)
        .filter(ru => ru.role === "WAITER")
        .map(ru => ru.user));
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
    fetchStations(rid);
    fetchWaiters(rid);
  }, [restaurantId, fetchLayout, fetchOrders, fetchItems, fetchStations, fetchWaiters]);

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
      if (!floorRef.current) return;
      const cw = floorRef.current.clientWidth;
      const ch = floorRef.current.clientHeight;
      setFloorContainerSize({ w: cw, h: ch });
      if (!layout) return;
      const room = layout.rooms[roomIdx];
      if (!room?.tables.length) return;
      const maxX = Math.max(...room.tables.map(t => t.x + t.w)) + 20;
      const maxY = Math.max(...room.tables.map(t => t.y + t.h)) + 20;
      setFloorScale(Math.min(cw / maxX, ch / maxY, 1));
    });
    obs.observe(floorRef.current);
    return () => obs.disconnect();
  }, [layout, roomIdx]);

  // ── Fullscreen change listener ────────────────────────────────────
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

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

  // ── Expediter fire ────────────────────────────────────────────────
  async function expediterFire(orderId: string, tableNum: string, course: number) {
    const key = `${orderId}:${course}`;
    setFiringCourse(key);
    try {
      await fetch(`/api/admin/orders/${orderId}/fire-course`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course }),
      });
      const COURSE = ["", "ראשון", "עיקרי", "קינוח"];
      showToast(`🔥 שולחן ${tableNum} — ${COURSE[course] ?? `קורס ${course}`} הוצת`);
      fetchOrders(restaurantId);
    } finally {
      setFiringCourse("");
    }
  }

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

  // ── Station assignment save ───────────────────────────────────────
  async function saveStation(userId: string) {
    setStationSaving(userId);
    try {
      const raw = stationEdit[userId] ?? "";
      const tableNumbers = raw.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
      const res = await fetch("/api/admin/waiter-stations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, userId, tableNumbers }),
      });
      if (res.ok) {
        showToast("✓ תחנה נשמרה");
        await fetchStations(restaurantId);
      } else {
        showToast("שגיאה בשמירת תחנה");
      }
    } finally { setStationSaving(null); }
  }

  async function deleteStation(userId: string) {
    await fetch(`/api/admin/waiter-stations?restaurantId=${restaurantId}&userId=${userId}`, { method: "DELETE" });
    showToast("✓ תחנה נמחקה");
    await fetchStations(restaurantId);
    const next = { ...stationEdit }; delete next[userId]; setStationEdit(next);
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
  const offsetX = Math.max(0, (floorContainerSize.w - mapMaxX * floorScale) / 2);
  const offsetY = Math.max(0, (floorContainerSize.h - mapMaxY * floorScale) / 2);

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
    <div style={{ height: "calc(100vh - 64px)", background: T.bg, color: T.text, fontFamily: "system-ui,sans-serif", direction: "rtl", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-20px)} to{opacity:1;transform:translateY(0)} }
        .sla-blink { animation: blink 1s infinite; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ background: "rgba(10,4,2,0.97)", backdropFilter: "blur(8px)", padding: "10px 24px", display: "flex", alignItems: "center", gap: 16, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <span style={{ fontSize: 22, fontWeight: 900, color: T.gold, letterSpacing: 2 }}>Menu4U</span>
        <span style={{ fontSize: 13, color: T.sub }}>מנהל משמרת</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 13, color: T.muted }}>{managerName}</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: T.gold, fontVariantNumeric: "tabular-nums" }}>{clockStr}</span>
        {restaurants.length > 1 && (
          <select value={restaurantId} onChange={e => setRestaurantId(e.target.value)} style={{ ...INP, width: "auto" }}>
            {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}
      </div>

      {/* ── SLA alert banner ── */}
      {kpis.slaBreached.length > 0 && (
        <div className="sla-blink" style={{ background: "rgba(239,68,68,0.15)", borderBottom: `1px solid ${T.red}`, padding: "8px 24px", display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ color: T.red, fontWeight: 700 }}>⚠️ SLA</span>
          <span style={{ color: T.red, fontSize: 13 }}>
            שולחנות מעל {slaMin} דקות: {kpis.slaBreached.map(t => `#${t.num}`).join(" · ")}
          </span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: T.muted }}>ספ: </span>
          <input type="number" value={slaMin} onChange={e => setSlaMin(Number(e.target.value))} min={10} max={120}
            style={{ ...INP, width: 52, padding: "4px 6px", fontSize: 12 }} />
          <span style={{ fontSize: 12, color: T.muted }}>דק'</span>
        </div>
      )}

      {/* ── KPI bar ── */}
      <div style={{ display: "flex", gap: 2, padding: "12px 20px", background: T.surface, borderBottom: `1px solid ${T.border}`, flexWrap: "wrap" }}>
        {[
          { label: "הכנסה היום", value: fmtNis(kpis.revenue), color: T.gold },
          { label: "הזמנות פתוחות", value: kpis.activeCount, color: T.orange },
          { label: "שולחנות פנויים", value: `${kpis.freeTables}/${kpis.totalTables}`, color: T.green },
          { label: "ממוצע שירות", value: kpis.avgServiceMin > 0 ? fmtMin(Math.round(kpis.avgServiceMin)) : "—", color: T.blue },
          { label: "SLA חריגות", value: kpis.slaBreached.length, color: kpis.slaBreached.length ? T.red : T.green },
          { label: "ממתינים", value: waitlist.length, color: waitlist.length ? T.orange : T.muted },
        ].map(k => (
          <div key={k.label} style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 18px", minWidth: 110, textAlign: "center", flex: "1 1 110px" }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: "auto" }}>
          <button onClick={() => setSummaryOpen(true)} style={BTN(T.gold)}>📊 סכום משמרת</button>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div style={{ display: "flex", gap: 4, padding: "10px 20px 0", borderBottom: `1px solid ${T.border}`, background: T.surface }}>
        {(["floor", "waitlist", "86", "summary", "stations"] as const).map(t => {
          const label = { floor: "🗺️ מפת רצפה", waitlist: `⏳ המתנה (${waitlist.length})`, "86": "🚫 86 תפריט", summary: "📋 סטטוס", stations: "📍 תחנות" }[t];
          return (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer",
              background: tab === t ? T.gold : "transparent",
              color: tab === t ? T.panel : T.sub,
              border: "none", borderRadius: "8px 8px 0 0",
            }}>{label}</button>
          );
        })}
      </div>

      {/* ── Tab content ── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

        {/* ── FLOOR MAP TAB ── */}
        {tab === "floor" && (
          <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>

            {/* ── Floor canvas column ── */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "10px 12px", gap: 8, overflow: "hidden", minWidth: 0 }}>
              {/* Room tabs */}
              {layout && layout.rooms.length > 1 && (
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {layout.rooms.map((r, i) => (
                    <button key={r.id} onClick={() => setRoomIdx(i)} style={{
                      padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                      background: i === roomIdx ? T.gold : T.panel,
                      color: i === roomIdx ? T.panel : T.sub,
                      border: `1px solid ${T.border}`, borderRadius: 8,
                    }}>{r.name}</button>
                  ))}
                </div>
              )}

              {/* Floor canvas */}
              <div ref={floorRef} style={{ flex: 1, position: "relative", overflow: "hidden", borderRadius: 12, border: `1px solid ${T.border}` }}>
                {!activeRoom && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted, fontSize: 13 }}>
                    {layout ? "אין שולחנות בחדר זה" : "לא נשמרה פריסת שולחנות"}
                  </div>
                )}
                {activeRoom && (() => {
                  return (
                    <>
                      {/* Custom background image only — texture removed */}
                      {activeRoom.bgImg && (
                        <div style={{
                          position: "absolute", top: offsetY, left: offsetX,
                          width: mapMaxX * floorScale, height: mapMaxY * floorScale,
                          backgroundImage: `url(${activeRoom.bgImg})`, backgroundSize: "cover", backgroundPosition: "center", opacity: activeRoom.bgOpacity ?? 1,
                        }} />
                      )}

                      {/* Decorations */}
                      {(activeRoom.decos ?? []).slice().sort((a, b) => a.zIdx - b.zIdx).map(deco => {
                        const isLine = deco.kind === "line";
                        const isImage = deco.kind === "image";
                        const c = deco.color || T.gold;
                        return (
                          <div key={deco.id} style={{
                            position: "absolute",
                            left: offsetX + deco.x * floorScale, top: offsetY + deco.y * floorScale,
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
                        const cfg         = STATUS[effectSt as StatusKey];
                        const accentColor = t.customColor || cfg.stripe;
                        const brd         = t.customColor ? t.customColor + "99" : breached ? T.red : cfg.border;
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
                              left: offsetX + t.x * floorScale, top: offsetY + t.y * floorScale,
                              width: w, height: h,
                              transform: t.rot ? `rotate(${t.rot}deg)` : undefined, transformOrigin: "center",
                              zIndex: t.zIdx ?? 1,
                              cursor: canSeat ? "pointer" : "default",
                            }}
                          >
                            <div style={{
                              position: "absolute", inset: 0, borderRadius: 10,
                              background: TABLE_BG,
                              border: `${Math.max(1, 1.5 * floorScale)}px solid ${brd}`,
                              boxShadow: breached
                                ? `0 0 0 ${2 * floorScale}px ${T.red}55, 0 0 ${8 * floorScale}px rgba(239,68,68,0.3)`
                                : `0 0 ${5 * floorScale}px ${cfg.glow}`,
                              overflow: "hidden", transition: "border-color 0.3s",
                              animation: breached ? "blink 1s infinite" : undefined,
                              display: "flex", flexDirection: "column",
                            }}>
                              {/* Top stripe */}
                              <div style={{ height: Math.max(2, 3 * floorScale), background: breached ? T.red : accentColor, flexShrink: 0 }} />

                              {/* Card body */}
                              <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: Math.max(3, 5 * floorScale) }}>
                                {/* Badge — top-left */}
                                {w >= 44 && (
                                  <div style={{ alignSelf: "flex-start", background: cfg.badgeBg, border: `1px solid ${cfg.badge}44`, borderRadius: 20, padding: `0 ${Math.max(3, 5 * floorScale)}px`, lineHeight: `${Math.max(14, 16 * floorScale)}px` }}>
                                    <span style={{ fontSize: Math.max(6, 7.5 * floorScale), fontWeight: 700, color: cfg.badge }}>{cfg.label}</span>
                                  </div>
                                )}

                                {/* שולחן + number — centered */}
                                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                                  {h >= 56 && <span style={{ fontSize: Math.max(7, 9 * floorScale), color: "rgba(255,255,255,0.38)", lineHeight: 1.2 }}>שולחן</span>}
                                  <span style={{ fontSize: fSz, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{t.num}</span>
                                  {seated && orderSt === "free" && h >= 50 && (
                                    <span style={{ fontSize: Math.max(7, fSz * 0.5), color: T.purple, lineHeight: 1.2 }}>{seated.partyName}</span>
                                  )}
                                </div>

                                {/* Bottom info — right-aligned */}
                                {h >= 44 && (
                                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                                    {start ? (
                                      <span style={{ fontSize: Math.max(7, fSz * 0.6), color: breached ? T.red : T.amber, fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                                        {fmtTimer(start)} ⏱
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: Math.max(7, fSz * 0.52), color: "rgba(255,255,255,0.26)", lineHeight: 1 }}>{cfg.label}</span>
                                    )}
                                    {canSeat && <span style={{ fontSize: Math.max(6, fSz * 0.5), color: T.green, lineHeight: 1 }}>👆 הושב</span>}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Fullscreen button */}
                      <button
                        onClick={() => {
                          if (!document.fullscreenElement) {
                            floorRef.current?.requestFullscreen();
                          } else {
                            document.exitFullscreen();
                          }
                        }}
                        title={isFullscreen ? "צא ממסך מלא" : "מסך מלא"}
                        style={{
                          position: "absolute", top: 8, right: 8, zIndex: 50,
                          background: "rgba(0,0,0,0.65)", border: `1px solid ${T.border}`,
                          borderRadius: 8, padding: "5px 9px", cursor: "pointer",
                          color: T.sub, fontSize: 15, backdropFilter: "blur(4px)",
                          lineHeight: 1,
                        }}
                      >
                        {isFullscreen ? "⊡" : "⛶"}
                      </button>

                      {/* Legend */}
                      <div style={{ position: "absolute", bottom: 8, left: 8, display: "flex", gap: 6, zIndex: 50 }}>
                        {([[T.green,"פנוי"],[T.purple,"הושב"],[T.orange,"תפוס"],[T.red,"חשבון"]] as const).map(([col, lbl]) => (
                          <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 7px", borderRadius: 7, background: "rgba(0,0,0,0.75)", border: `1px solid ${col}55`, fontSize: 10, backdropFilter: "blur(4px)" }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: col, display: "inline-block" }} />
                            <span style={{ color: T.sub }}>{lbl}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* ── Waitlist sidebar ── */}
            <div style={{ width: 264, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", background: T.surface, flexShrink: 0, overflow: "hidden" }}>
              {/* Header */}
              <div style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <span style={{ fontWeight: 700, color: T.gold, fontSize: 14 }}>⏳ המתנה</span>
                {waitlist.length > 0 && (
                  <span style={{ background: `${T.orange}22`, color: T.orange, borderRadius: 20, padding: "1px 8px", fontSize: 12, fontWeight: 700 }}>{waitlist.length}</span>
                )}
                <span style={{ flex: 1 }} />
                <button onClick={() => setTab("waitlist")} style={{ fontSize: 11, color: T.sub, background: "none", border: "none", cursor: "pointer" }}>הכל ←</button>
              </div>

              {/* Quick-add */}
              <div style={{ padding: "8px 14px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
                <div style={{ display: "flex", gap: 5 }}>
                  <input value={wName} onChange={e => setWName(e.target.value)} onKeyDown={e => e.key === "Enter" && addToWaitlist()}
                    placeholder="שם קבוצה..." style={{ ...INP, flex: 1, padding: "5px 8px", fontSize: 12 }} />
                  <input type="number" value={wGuests} min={1} max={20} onChange={e => setWGuests(Number(e.target.value))}
                    style={{ ...INP, width: 44, padding: "5px 4px", fontSize: 12, textAlign: "center" }} />
                  <button onClick={addToWaitlist} style={{ ...BTN(T.gold), padding: "5px 10px", fontSize: 13, flexShrink: 0 }}>+</button>
                </div>
              </div>

              {/* ── Expediter panel ── */}
              {(() => {
                const COURSE_LBL = ["", "ראשון", "עיקרי", "קינוח"];
                const COURSE_EMO = ["", "🥗", "🍖", "🍮"];
                type HeldEntry = { orderId: string; tableNum: string; course: number; count: number; itemNames: string[] };
                const heldMap = new Map<string, HeldEntry>();
                for (const ord of orders) {
                  const tNum = ord.tableNumber ?? "";
                  for (const item of ord.items) {
                    if (!item.heldUntilFired || item.firedAt) continue;
                    const key = `${ord.id}:${item.course}`;
                    const existing = heldMap.get(key);
                    if (existing) { existing.count += item.quantity; existing.itemNames.push(item.item.name); }
                    else heldMap.set(key, { orderId: ord.id, tableNum: tNum, course: item.course, count: item.quantity, itemNames: [item.item.name] });
                  }
                }
                const held = Array.from(heldMap.values()).sort((a, b) => Number(a.tableNum) - Number(b.tableNum));
                if (held.length === 0) return null;
                return (
                  <div style={{ borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
                    <div style={{ padding: "8px 14px 4px", display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.orange }}>🔥 להוצאה</span>
                      <span style={{ background: `${T.orange}22`, color: T.orange, borderRadius: 20, padding: "1px 6px", fontSize: 11, fontWeight: 700 }}>{held.length}</span>
                    </div>
                    <div style={{ maxHeight: 220, overflowY: "auto" }}>
                      {held.map(h => {
                        const key = `${h.orderId}:${h.course}`;
                        const firing = firingCourse === key;
                        return (
                          <div key={key} style={{ padding: "6px 14px", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${T.borderSub}` }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>
                                {COURSE_EMO[h.course] || "🍽"} {COURSE_LBL[h.course] ?? `קורס ${h.course}`}
                                <span style={{ marginRight: 4, color: T.muted, fontSize: 11 }}>ש׳{h.tableNum}</span>
                              </div>
                              <div style={{ fontSize: 10, color: T.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {h.count}× {h.itemNames.slice(0, 2).join(", ")}{h.itemNames.length > 2 ? `+${h.itemNames.length - 2}` : ""}
                              </div>
                            </div>
                            <button
                              disabled={firing}
                              onClick={() => expediterFire(h.orderId, h.tableNum, h.course)}
                              style={{ ...BTN(firing ? T.muted : T.orange), padding: "4px 10px", fontSize: 11, flexShrink: 0, opacity: firing ? 0.6 : 1 }}
                            >
                              {firing ? "..." : "🔥"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Waitlist items */}
              <div style={{ flex: 1, overflowY: "auto" }}>
                {waitlist.length === 0 ? (
                  <div style={{ color: T.muted, textAlign: "center", padding: 24, fontSize: 12 }}>אין ממתינים</div>
                ) : (
                  waitlist.map((p, idx) => {
                    const waitedMin = Math.floor((Date.now() - p.since) / 60000);
                    const urgent = waitedMin >= 20;
                    return (
                      <div key={p.id} style={{ padding: "8px 14px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 8, background: urgent ? "rgba(239,68,68,0.05)" : "transparent" }}>
                        <span style={{ color: T.muted, fontSize: 11, minWidth: 18 }}>#{idx + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: urgent ? T.red : T.muted }}>👤{p.guests} · {fmtMin(waitedMin)}{urgent ? " ⚠" : ""}</div>
                        </div>
                        <button onClick={() => seatFromWaitlist(p)} style={{ ...BTN(T.green), padding: "4px 8px", fontSize: 11, flexShrink: 0 }}>הושב</button>
                        <button onClick={() => removeFromWaitlist(p.id)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 14, flexShrink: 0, lineHeight: 1 }}>✕</button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Table count summary + SLA control */}
              <div style={{ borderTop: `1px solid ${T.border}`, padding: "10px 14px", flexShrink: 0 }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  {(["free","occupied","bill-requested"] as const).map(s => {
                    const count = activeRoom?.tables.filter(t => tableStatus(String(t.num), orders) === s).length ?? 0;
                    const col = { free: T.green, occupied: T.orange, "bill-requested": T.red }[s];
                    const lbl = { free: "פנוי", occupied: "תפוס", "bill-requested": "חשבון" }[s];
                    return (
                      <div key={s} style={{ flex: 1, textAlign: "center" }}>
                        <div style={{ fontSize: 18, fontWeight: 900, color: col }}>{count}</div>
                        <div style={{ fontSize: 10, color: T.muted }}>{lbl}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.muted }}>
                  <span>SLA:</span>
                  <input type="number" value={slaMin} onChange={e => setSlaMin(Number(e.target.value))} min={10} max={120}
                    style={{ ...INP, width: 44, padding: "3px 5px", fontSize: 11 }} />
                  <span>דק'</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── WAITLIST TAB ── */}
        {tab === "waitlist" && (
          <div style={{ padding: 20, maxWidth: 600, margin: "0 auto", overflowY: "auto", flex: 1 }}>
            <h2 style={{ color: T.gold, fontSize: 16, fontWeight: 700, marginBottom: 16 }}>רשימת המתנה</h2>

            {/* Add party form */}
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, marginBottom: 20, display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: 2, minWidth: 150 }}>
                <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 4 }}>שם / מספר</label>
                <input value={wName} onChange={e => setWName(e.target.value)} placeholder="שם קבוצה..." style={INP}
                  onKeyDown={e => e.key === "Enter" && addToWaitlist()} />
              </div>
              <div style={{ flex: 1, minWidth: 80 }}>
                <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 4 }}>אורחים</label>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => setWGuests(g => Math.max(1, g - 1))} style={{ ...BTN(T.panel), padding: "7px 10px", border: `1px solid ${T.border}` }}>−</button>
                  <input type="number" value={wGuests} min={1} max={20} readOnly style={{ ...INP, width: 50, textAlign: "center" }} />
                  <button onClick={() => setWGuests(g => Math.min(20, g + 1))} style={{ ...BTN(T.panel), padding: "7px 10px", border: `1px solid ${T.border}` }}>+</button>
                </div>
              </div>
              <button onClick={addToWaitlist} style={BTN(T.gold)}>+ הוסף</button>
            </div>

            {/* Waitlist */}
            {waitlist.length === 0 ? (
              <div style={{ color: T.muted, textAlign: "center", padding: 40, fontSize: 14 }}>אין ממתינים כרגע</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {waitlist.map((p, idx) => {
                  const waitedMin = Math.floor((Date.now() - p.since) / 60000);
                  const urgent    = waitedMin >= 20;
                  return (
                    <div key={p.id} style={{ background: T.surface, border: `1px solid ${urgent ? T.red : T.border}`, borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 14, color: T.muted, fontWeight: 700, minWidth: 20 }}>#{idx + 1}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: T.sub }}>👤 {p.guests} · ⏱ {fmtMin(waitedMin)}{urgent ? " ⚠️" : ""}</div>
                      </div>
                      <button onClick={() => seatFromWaitlist(p)} style={BTN(T.green)}>הושב</button>
                      <button onClick={() => removeFromWaitlist(p.id)} style={BTN(T.red, true)}>✕</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── 86 MENU TAB ── */}
        {tab === "86" && (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>

            {/* Toolbar */}
            <div style={{ padding: "10px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 12, flexShrink: 0, background: T.surface }}>
              <input value={itemSearch} onChange={e => setItemSearch(e.target.value)} placeholder="🔍 חפש פריט..." style={{ ...INP, maxWidth: 280 }} />
              <span style={{ fontSize: 12, color: T.muted }}>
                {filtered86.reduce((s, c) => s + c.items.length, 0)} פריטים ·{" "}
                <span style={{ color: T.red, fontWeight: 700 }}>
                  {filtered86.reduce((s, c) => s + c.items.filter(i => !i.isActive).length, 0)} ב-86
                </span>
              </span>
            </div>

            {/* Category columns */}
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {filtered86.length === 0 && (
                <div style={{ color: T.muted, textAlign: "center", padding: 60, fontSize: 14 }}>אין פריטים תואמים</div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, alignItems: "start" }}>
                {filtered86.map(cat => (
                  <div key={cat.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                    {/* Category header */}
                    <div style={{ padding: "8px 12px", background: "rgba(212,160,23,0.08)", borderBottom: `1px solid ${T.border}` }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.gold }}>{cat.name}</div>
                      <div style={{ fontSize: 10, color: T.muted }}>{cat.menuName}</div>
                    </div>
                    {/* Items */}
                    <div style={{ padding: "6px 0" }}>
                      {cat.items.map(item => {
                        const is86 = !item.isActive;
                        return (
                          <div key={item.id} style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "8px 12px",
                            borderBottom: `1px solid ${T.border}`,
                            opacity: togglingId === item.id ? 0.5 : 1,
                            background: is86 ? "rgba(239,68,68,0.06)" : "transparent",
                            transition: "background 0.2s",
                          }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: is86 ? T.muted : T.text, textDecoration: is86 ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {item.name}
                              </div>
                              <div style={{ fontSize: 11, color: T.muted }}>₪{item.price.toFixed(0)}</div>
                            </div>
                            <button
                              onClick={() => toggle86(item.id, item.isActive)}
                              disabled={togglingId === item.id}
                              style={{
                                flexShrink: 0,
                                padding: "4px 10px", fontSize: 12, fontWeight: 700,
                                borderRadius: 6, cursor: "pointer", border: "none",
                                background: is86 ? T.green : T.red,
                                color: "#fff",
                              }}
                            >
                              {is86 ? "✓ החזר" : "86"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── STATUS TAB ── */}
        {tab === "summary" && (
          <div style={{ padding: 16, overflowY: "auto", flex: 1 }}>
            {/* Summary row */}
            {activeRoom && (() => {
              const tables = activeRoom.tables;
              const freeCount     = tables.filter(t => tableStatus(String(t.num), orders) === "free").length;
              const occupiedCount = tables.filter(t => tableStatus(String(t.num), orders) === "occupied").length;
              const billCount     = tables.filter(t => tableStatus(String(t.num), orders) === "bill-requested").length;
              const seatedCount   = [...seatedTables.keys()].filter(n => tableStatus(n, orders) === "free").length;
              return (
                <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                  {[
                    { label: "פנויים",    value: freeCount,     color: T.green },
                    { label: "הושבו",     value: seatedCount,   color: T.purple },
                    { label: "תפוסים",   value: occupiedCount, color: T.orange },
                    { label: "ביקשו חשבון", value: billCount,  color: T.red },
                  ].map(s => (
                    <div key={s.label} style={{ flex: "1 1 80px", background: T.surface, border: `1px solid ${s.color}44`, borderRadius: 10, padding: "10px 0", textAlign: "center" }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Table grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
              {activeRoom?.tables.slice().sort((a, b) => a.num - b.num).map(t => {
                const tNum    = String(t.num);
                const status  = tableStatus(tNum, orders);
                const seated  = seatedTables.get(tNum);
                const effectSt = seated && status === "free" ? "seated" : status;
                const start   = timerStart(tNum, orders);
                const mins    = start ? timerMinutes(start) : 0;
                const breached = start && mins >= slaMin;
                const tOrds   = orders.filter(o => (o.tableNumber ?? "") === tNum);
                const total   = tOrds.reduce((s, o) => s + o.totalAmount, 0);
                const guests  = Math.max(0, ...tOrds.map(o => o.coversCount ?? 0));
                const cfg     = STATUS[effectSt as StatusKey];
                return (
                  <div key={t.id} style={{
                    background: TABLE_BG,
                    border: `1.5px solid ${breached ? T.red : cfg.border}`,
                    borderRadius: 12,
                    overflow: "hidden",
                    display: "flex", flexDirection: "column",
                    minHeight: 150,
                    boxShadow: breached
                      ? `0 0 0 2px ${T.red}55, 0 0 10px rgba(239,68,68,0.3)`
                      : `0 0 6px ${cfg.glow}`,
                    animation: breached ? "blink 1s infinite" : undefined,
                  }}>
                    {/* Top stripe */}
                    <div style={{ height: 3, background: breached ? T.red : cfg.stripe, flexShrink: 0 }} />

                    {/* Card body */}
                    <div style={{ flex: 1, padding: "8px 10px", display: "flex", flexDirection: "column" }}>
                      {/* Badge — top-left */}
                      <div style={{ alignSelf: "flex-start", background: cfg.badgeBg, border: `1px solid ${cfg.badge}44`, borderRadius: 20, padding: "2px 8px" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: cfg.badge }}>{cfg.label}</span>
                      </div>

                      {/* שולחן + number — centered */}
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.4 }}>שולחן</span>
                        <span style={{ fontSize: 40, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{t.num}</span>
                        {t.name && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.26)", marginTop: 2 }}>{t.name}</span>}
                        {seated && status === "free" && (
                          <span style={{ fontSize: 10, color: T.purple, marginTop: 2, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{seated.partyName}</span>
                        )}
                      </div>

                      {/* Bottom info — right-aligned */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                        {guests > 0 && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{guests} סועדים</span>}
                        {start ? (
                          <span style={{ fontSize: 12, fontWeight: 700, color: breached ? T.red : T.amber, fontVariantNumeric: "tabular-nums" }}>{fmtTimer(start)} ⏱</span>
                        ) : (
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.26)" }}>{cfg.label}</span>
                        )}
                        {total > 0 && <span style={{ fontSize: 11, color: T.gold, fontWeight: 700 }}>{fmtNis(total)}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* ── STATIONS TAB ── */}
        {tab === "stations" && (
          <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
            <h2 style={{ color: T.gold, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>📍 שיוך תחנות מלצרים</h2>
            <p style={{ fontSize: 12, color: T.muted, marginBottom: 20 }}>
              הגדר אילו שולחנות שייכים לכל מלצר. המלצרים יראו את השולחנות שלהם מודגשים ברצפת השירות.
            </p>

            {waiters.length === 0 && (
              <div style={{ color: T.muted, textAlign: "center", padding: 40, fontSize: 13 }}>
                אין מלצרים משויכים למסעדה זו
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {waiters.map(waiter => {
                const saved = stations.find(s => s.userId === waiter.id);
                return (
                  <div key={waiter.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${T.gold}22`, border: `1px solid ${T.gold}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                        👤
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{waiter.name ?? waiter.email}</div>
                        <div style={{ fontSize: 11, color: T.muted }}>{waiter.email}</div>
                      </div>
                      {saved && (
                        <div style={{ fontSize: 11, color: T.green, background: `${T.green}18`, borderRadius: 20, padding: "2px 8px", border: `1px solid ${T.green}44` }}>
                          {saved.tableNumbers.length} שולחנות
                        </div>
                      )}
                    </div>

                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 4 }}>
                        שולחנות (הפרד בפסיק: 1, 2, 3, 4, 5)
                      </label>
                      <input
                        value={stationEdit[waiter.id] ?? ""}
                        onChange={e => setStationEdit(prev => ({ ...prev, [waiter.id]: e.target.value }))}
                        placeholder="לדוגמה: 1, 2, 3, 4, 5"
                        style={INP}
                      />
                    </div>

                    {/* Quick table buttons from current layout */}
                    {activeRoom && activeRoom.tables.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                        {activeRoom.tables.slice().sort((a, b) => a.num - b.num).map(t => {
                          const tStr = String(t.num);
                          const current = (stationEdit[waiter.id] ?? "").split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
                          const isIn = current.includes(tStr);
                          return (
                            <button key={t.id} onClick={() => {
                              setStationEdit(prev => {
                                const cur = (prev[waiter.id] ?? "").split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
                                const next = isIn ? cur.filter(n => n !== tStr) : [...cur, tStr];
                                return { ...prev, [waiter.id]: next.join(", ") };
                              });
                            }} style={{
                              padding: "4px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                              border: `1px solid ${isIn ? T.gold : T.border}`,
                              background: isIn ? `${T.gold}22` : "transparent",
                              color: isIn ? T.gold : T.sub,
                            }}>
                              {t.num}{t.name ? ` ${t.name}` : ""}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => saveStation(waiter.id)}
                        disabled={stationSaving === waiter.id}
                        style={{ ...BTN(T.gold), fontSize: 12, opacity: stationSaving === waiter.id ? 0.6 : 1 }}
                      >
                        {stationSaving === waiter.id ? "שומר..." : "💾 שמור תחנה"}
                      </button>
                      {saved && (
                        <button
                          onClick={() => deleteStation(waiter.id)}
                          style={{ ...BTN(T.red, true), fontSize: 12 }}
                        >
                          🗑 מחק תחנה
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* ── Toast ── */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: T.gold, color: T.text, padding: "10px 24px", borderRadius: 24, fontWeight: 700, fontSize: 14, zIndex: 9999, animation: "slideDown 0.2s ease" }}>
          {toast}
        </div>
      )}

      {/* ── Waitlist seat suggestion modal ── */}
      {seatSuggest && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9000 }}>
          <div style={{ background: T.panel, border: `1px solid ${T.gold}`, borderRadius: 16, padding: 32, maxWidth: 380, width: "90%", textAlign: "center", animation: "slideDown 0.2s ease" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🎉</div>
            <h3 style={{ color: T.gold, fontSize: 18, fontWeight: 700, marginBottom: 8 }}>שולחן התפנה!</h3>
            <p style={{ color: T.text, fontSize: 14, marginBottom: 20 }}>
              שולחן <strong style={{ color: T.gold }}>#{seatSuggest.table.num}</strong> ({seatSuggest.table.seats} מקומות) פנוי.<br />
              <strong>{seatSuggest.party.name}</strong> ({seatSuggest.party.guests} אורחים) ממתין{" "}
              {fmtMin(Math.floor((Date.now() - seatSuggest.party.since) / 60000))}.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => seatFromWaitlist(seatSuggest.party)} style={BTN(T.green)}>✓ הושב</button>
              <button onClick={() => setSeatSuggest(null)} style={BTN(T.red, true)}>דחה</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Manual seat modal (click free table → pick party) ── */}
      {seatTableModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9000 }} onClick={() => setSeatTableModal(null)}>
          <div style={{ background: T.panel, border: `1px solid ${T.gold}`, borderRadius: 16, padding: 28, maxWidth: 360, width: "90%", animation: "slideDown 0.2s ease", direction: "rtl" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: T.gold, fontSize: 16, fontWeight: 700, marginBottom: 16, textAlign: "center" }}>
              🪑 הושבה לשולחן {seatTableModal.tableNum} ({seatTableModal.seats} מקומות)
            </h3>
            {waitlist.length === 0 ? (
              <p style={{ color: T.muted, fontSize: 13, textAlign: "center", marginBottom: 16 }}>אין קבוצות ברשימת ההמתנה</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {waitlist.map(p => (
                  <button key={p.id} onClick={() => seatPartyAtTable(p, seatTableModal.tableNum)}
                    style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", color: T.text }}>
                    <span style={{ fontWeight: 700 }}>{p.name}</span>
                    <span style={{ fontSize: 12, color: T.sub }}>{p.guests} אורחים · {fmtMin(Math.floor((Date.now() - p.since) / 60000))}</span>
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setSeatTableModal(null)} style={{ ...BTN(T.muted, true), width: "100%" }}>ביטול</button>
          </div>
        </div>
      )}

      {/* ── Shift summary modal ── */}
      {summaryOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9000 }} onClick={() => setSummaryOpen(false)}>
          <div style={{ background: T.panel, border: `1px solid ${T.gold}`, borderRadius: 16, padding: 32, maxWidth: 440, width: "90%", animation: "slideDown 0.2s ease" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: T.gold, fontSize: 18, fontWeight: 700, marginBottom: 20, textAlign: "center" }}>📊 סיכום משמרת</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
              {[
                ["התחלה", shiftStart.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })],
                ["הזמנות", shiftOrders.length],
                ["הכנסה כוללת", fmtNis(shiftOrders.filter(o => o.status === "PAID").reduce((s, o) => s + o.totalAmount, 0))],
                ["הזמנות פתוחות", shiftOrders.filter(o => !["PAID", "CANCELLED"].includes(o.status)).length],
                ["SLA חריגות עכשיו", kpis.slaBreached.length],
                ["ממתינים בתור", waitlist.length],
              ].map(([l, v]) => (
                <div key={String(l)} style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${T.border}`, paddingBottom: 8 }}>
                  <span style={{ color: T.sub, fontSize: 14 }}>{l}</span>
                  <span style={{ color: T.text, fontWeight: 700, fontSize: 14 }}>{v}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setSummaryOpen(false)} style={{ ...BTN(T.gold), width: "100%" }}>סגור</button>
          </div>
        </div>
      )}
    </div>
  );
}
