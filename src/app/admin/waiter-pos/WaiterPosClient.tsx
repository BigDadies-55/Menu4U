"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { T, btn, btnGhost } from "@/lib/ui";

// ── Types ──────────────────────────────────────────────────────────
interface ApiOrderItem {
  id: string; itemId: string; quantity: number; price: number;
  notes: string | null; itemStatus: string; course: number;
  heldUntilFired: boolean; firedAt: string | null; doneAt: string | null;
  servedAt: string | null; isComped: boolean;
  item: { name: string };
}
interface ApiOrder {
  id: string; tableNumber: string | null; status: string;
  orderNumber: number | null; totalAmount: number; notes: string | null;
  createdAt: string; updatedAt: string; coversCount: number | null;
  items: ApiOrderItem[];
}
interface MenuCat {
  id: string; name: string;
  items: { id: string; name: string; description: string | null; price: number; image: string | null }[];
}
interface CartEntry {
  itemId: string; name: string; price: number; qty: number; notes: string; course: number;
}
interface AIInsight {
  type: "alert" | "upsell" | "action" | "info";
  icon: string; color: string; title: string; desc: string;
}
interface Notif {
  id: string; tableNumber: string; message: string;
  at: number; read: boolean; type: "ready" | "alert" | "info";
}
type TableShape = "round" | "rect" | "square" | "oval" | "long" | "banquet";
interface LayoutTable { id: string; num: number; name: string; shape: TableShape; x: number; y: number; w: number; h: number; seats: number; rot: number; customColor?: string; }
interface LayoutRoom { id: string; name: string; tables: LayoutTable[]; bg?: number; }
interface Layout { version: 2; rooms: LayoutRoom[]; }

// ── Constants ─────────────────────────────────────────────────────
const COURSE_LABELS = ["", "ראשון", "עיקרי", "קינוח"];
const STATUS_COLORS: Record<string, string> = {
  free: T.green, occupied: T.orange, "bill-requested": T.red,
};
const SHAPE_BR: Record<TableShape, string> = {
  round: "50%", rect: "8px", square: "6px", oval: "50%/40%", long: "10px", banquet: "4px",
};
const LS_REST = "menu4u_pos_rest";

// ── Helpers ───────────────────────────────────────────────────────
function tableStatus(num: string, orders: ApiOrder[]): "free" | "occupied" | "bill-requested" {
  const tOrds = orders.filter(o => (o.tableNumber ?? "") === num && !["PAID", "CANCELLED"].includes(o.status));
  if (!tOrds.length) return "free";
  if (tOrds.every(o => o.status === "DELIVERED")) return "bill-requested";
  return "occupied";
}
function tableSince(num: string, orders: ApiOrder[]): Date | null {
  const active = orders.filter(o => (o.tableNumber ?? "") === num && !["PAID", "CANCELLED"].includes(o.status));
  if (!active.length) return null;
  return new Date(Math.min(...active.map(o => new Date(o.createdAt).getTime())));
}
function fmtTimer(since: Date): string {
  const s = Math.max(0, Math.floor((Date.now() - since.getTime()) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
function tableTotal(num: string, orders: ApiOrder[]): number {
  return orders.filter(o => (o.tableNumber ?? "") === num && !["PAID", "CANCELLED"].includes(o.status))
    .reduce((s, o) => s + o.totalAmount, 0);
}
function tableGuests(num: string, orders: ApiOrder[]): number {
  return Math.max(0, ...orders.filter(o => (o.tableNumber ?? "") === num).map(o => o.coversCount ?? 0));
}
function computeInsights(tableNum: string, orders: ApiOrder[]): AIInsight[] {
  const tOrds = orders.filter(o => (o.tableNumber ?? "") === tableNum && !["PAID", "CANCELLED"].includes(o.status));
  if (!tOrds.length) return [];
  const now = Date.now();
  const allItems = tOrds.flatMap(o => o.items);
  const insights: AIInsight[] = [];

  // Ready but not served
  const readyUnserved = allItems.filter(i => i.itemStatus === "DONE" && !i.servedAt && !i.isComped && !i.heldUntilFired);
  if (readyUnserved.length > 0) {
    insights.push({ type: "action", icon: "🍽️", color: T.blue, title: `${readyUnserved.length} מנות מוכנות להגשה`, desc: readyUnserved.slice(0, 3).map(i => i.item.name).join(", ") });
  }
  // All course-2 done → suggest dessert
  const mains = allItems.filter(i => i.course === 2 && i.itemStatus !== "CANCELLED");
  const mainsDone = mains.filter(i => i.itemStatus === "DONE");
  if (mains.length > 0 && mainsDone.length === mains.length) {
    const lastDone = Math.max(...mainsDone.map(i => i.doneAt ? new Date(i.doneAt).getTime() : 0).filter(Boolean));
    const min = lastDone ? (now - lastDone) / 60000 : 0;
    if (min > 3 && min < 25) {
      insights.push({ type: "upsell", icon: "🍰", color: T.purple, title: "הצע קינוח", desc: `עיקריות הסתיימו לפני ${Math.round(min)} דק'` });
    }
  }
  // Slow kitchen item
  for (const si of allItems.filter(i => i.itemStatus === "PREPARING" && i.firedAt)) {
    const min = (now - new Date(si.firedAt!).getTime()) / 60000;
    if (min > 15) { insights.push({ type: "alert", icon: "⏰", color: T.red, title: "מנה מתעכבת", desc: `${si.item.name} — ${Math.round(min)} דק' במטבח` }); break; }
  }
  // Neglected table
  const hasKitchen = allItems.some(i => ["PENDING", "PREPARING"].includes(i.itemStatus));
  if (!hasKitchen) {
    const lastTs = Math.max(...tOrds.map(o => new Date(o.updatedAt || o.createdAt).getTime()));
    const min = (now - lastTs) / 60000;
    if (min > 15) insights.push({ type: "alert", icon: "⚠️", color: T.orange, title: "שולחן מוזנח", desc: `${Math.round(min)} דקות ללא פעילות — מומלץ לגשת` });
  }
  // Upsell wine when ordering meat mains (no beverage item)
  const hasMainMeat = mains.some(i => /סטייק|אנטריקוט|בשר|צלע|כבש|פילה/.test(i.item.name));
  const hasBeverage = allItems.some(i => /יין|בירה|משקה|שייק|קוקטייל/.test(i.item.name));
  if (hasMainMeat && !hasBeverage && mains.length > 0 && mainsDone.length < mains.length) {
    insights.push({ type: "upsell", icon: "🍷", color: T.purple, title: "הצע יין", desc: "זוהו מנות בשר — הצע בקבוק יין ​להגביר חוויה ומכירה" });
  }
  // Bill requested / camper
  if (tOrds.some(o => o.status === "DELIVERED")) {
    insights.push({ type: "info", icon: "💳", color: T.muted, title: "ממתין לחשבון", desc: "הבא חשבון — אולי גרנד מרנייה על הדרך?" });
  }
  return insights;
}
function sparkColor(insights: AIInsight[]): string {
  if (!insights.length) return T.green;
  if (insights.find(i => i.type === "alert")) return T.orange;
  if (insights.find(i => i.type === "action")) return T.blue;
  if (insights.find(i => i.type === "upsell")) return T.purple;
  return T.green;
}

// ══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════
export default function WaiterPosClient({ restaurants, waiterName, waiterId }: {
  restaurants: { id: string; name: string }[]; waiterName: string; waiterId: string;
}) {
  // ── Restaurant ──
  const [restaurantId, setRestaurantId] = useState(() => {
    if (typeof window !== "undefined") {
      const s = localStorage.getItem(LS_REST);
      if (s && restaurants.some(r => r.id === s)) return s;
    }
    return restaurants[0]?.id ?? "";
  });
  useEffect(() => { if (restaurantId) localStorage.setItem(LS_REST, restaurantId); }, [restaurantId]);

  // ── Core data ──
  const [orders,   setOrders]   = useState<ApiOrder[]>([]);
  const [menu,     setMenu]     = useState<MenuCat[]>([]);
  const [layout,   setLayout]   = useState<Layout | null>(null);
  const [myTables, setMyTables] = useState<Set<string>>(new Set());
  const [tick,     setTick]     = useState(0);

  // ── Navigation ──
  const [mainTab,  setMainTab]  = useState<"map" | "orders" | "notifs">("map");
  const [viewMode, setViewMode] = useState<"grid" | "floor">("grid");
  const [roomIdx,  setRoomIdx]  = useState(0);

  // ── Table sheet ──
  const [selTable, setSelTable] = useState<string | null>(null);
  const [sheetTab, setSheetTab] = useState<"order" | "bill" | "ai">("order");

  // ── Order entry ──
  const [cart,       setCart]       = useState<CartEntry[]>([]);
  const [catIdx,     setCatIdx]     = useState(0);
  const [menuSearch, setMenuSearch] = useState("");
  const [guestCount, setGuestCount] = useState(2);
  const [orderNote,  setOrderNote]  = useState("");
  const [addCourse,  setAddCourse]  = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // ── Payment ──
  const [payModal,  setPayModal]  = useState(false);
  const [payMethod, setPayMethod] = useState("card");
  const [tip,       setTip]       = useState(0);
  const [closing,   setClosing]   = useState(false);

  // ── Notifications ──
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const prevOrdsRef = useRef<ApiOrder[]>([]);

  // ── Toast ──
  const [toast, setToast] = useState("");
  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  // ── Data loading ──
  const loadOrders = useCallback(async (rid: string) => {
    if (!rid) return;
    const res = await fetch(`/api/admin/orders?restaurantId=${rid}&activeOnly=1`);
    if (!res.ok) return;
    const fresh: ApiOrder[] = await res.json();
    // Detect items that just became DONE → push notification
    const oldMap = new Map<string, string>();
    for (const o of prevOrdsRef.current) for (const i of o.items) oldMap.set(i.id, i.itemStatus);
    for (const o of fresh) {
      for (const i of o.items) {
        const prev = oldMap.get(i.id);
        if (prev && prev !== "DONE" && i.itemStatus === "DONE" && !i.heldUntilFired) {
          setNotifs(ns => [{
            id: `${i.id}-${Date.now()}`, tableNumber: o.tableNumber ?? "?",
            message: `מוכן: ${i.item.name}`, at: Date.now(), read: false, type: "ready" as const,
          }, ...ns].slice(0, 60));
        }
      }
    }
    prevOrdsRef.current = fresh;
    setOrders(fresh);
  }, []);

  const loadMenu = useCallback(async (rid: string) => {
    if (!rid) return;
    const res = await fetch(`/api/admin/waiter/menu?restaurantId=${rid}`);
    if (res.ok) { const d = await res.json(); setMenu(d.categories ?? []); }
  }, []);

  const loadLayout = useCallback(async (rid: string) => {
    if (!rid) return;
    try {
      const res = await fetch(`/api/admin/restaurants/${rid}/layout`);
      if (!res.ok) return;
      const d = await res.json();
      if (!d.tableLayoutJson) return;
      const raw = typeof d.tableLayoutJson === "string" ? JSON.parse(d.tableLayoutJson) : d.tableLayoutJson;
      const rooms = raw?.rooms ?? (Array.isArray(raw) ? raw : null);
      if (rooms && Array.isArray(rooms)) setLayout({ version: 2, rooms });
    } catch { /* no layout */ }
  }, []);

  const loadStation = useCallback(async (rid: string) => {
    if (!rid || !waiterId) return;
    try {
      const res = await fetch(`/api/admin/waiter-stations?restaurantId=${rid}&userId=${waiterId}`);
      if (!res.ok) return;
      const data = await res.json();
      const nums: string[] = data[0]?.tableNumbers ?? [];
      setMyTables(nums.length ? new Set(nums) : new Set());
    } catch { /* no station */ }
  }, [waiterId]);

  useEffect(() => {
    if (!restaurantId) return;
    loadOrders(restaurantId);
    loadMenu(restaurantId);
    loadLayout(restaurantId);
    loadStation(restaurantId);
    setSelTable(null); setCart([]);
  }, [restaurantId, loadOrders, loadMenu, loadLayout, loadStation]);

  // ── SSE ──
  const sseRef = useRef<EventSource | null>(null);
  useEffect(() => {
    if (!restaurantId) return;
    sseRef.current?.close();
    const es = new EventSource(`/api/admin/orders/stream?restaurantId=${restaurantId}`);
    sseRef.current = es;
    es.onmessage = () => loadOrders(restaurantId);
    return () => es.close();
  }, [restaurantId, loadOrders]);

  // ── Timer tick every 15s ──
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 15000);
    return () => clearInterval(id);
  }, []);

  // ── All table numbers ──
  const allTableNums = useMemo(() => {
    const fromLayout = layout?.rooms.flatMap(r => r.tables.map(t => String(t.num))) ?? [];
    const fromOrders = orders.map(o => o.tableNumber).filter(Boolean) as string[];
    return [...new Set([...fromLayout, ...fromOrders])].sort((a, b) => {
      const na = parseInt(a), nb = parseInt(b);
      return isNaN(na) || isNaN(nb) ? a.localeCompare(b) : na - nb;
    });
  }, [layout, orders, tick]); // tick forces recompute for timer refresh

  // ── Actions ──
  async function submitOrder() {
    if (!restaurantId || !selTable || cart.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/orders/waiter", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId, tableNumber: selTable, coversCount: guestCount,
          notes: orderNote || undefined,
          items: cart.map(c => ({ itemId: c.itemId, quantity: c.qty, notes: c.notes || undefined, course: c.course })),
        }),
      });
      if (res.ok) {
        setCart([]); setOrderNote(""); showToast("✓ הזמנה נשלחה למטבח"); setSheetTab("bill");
        loadOrders(restaurantId);
      } else { const d = await res.json(); showToast(`שגיאה: ${d.error ?? "נסה שנית"}`); }
    } finally { setSubmitting(false); }
  }

  async function closeTable() {
    if (!restaurantId || !selTable) return;
    setClosing(true);
    try {
      const res = await fetch("/api/admin/orders/close-table", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, tableNumber: selTable, tipAmount: tip, payMethod }),
      });
      if (res.ok) {
        showToast("✓ שולחן נסגר"); setPayModal(false); setSelTable(null); setTip(0); setPayMethod("card");
        loadOrders(restaurantId);
      } else { const d = await res.json(); showToast(`שגיאה: ${d.error ?? "נסה שנית"}`); }
    } finally { setClosing(false); }
  }

  async function fireCourse(orderId: string, course: number) {
    const res = await fetch(`/api/admin/orders/${orderId}/fire-course`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course }),
    });
    if (res.ok) { showToast(`🔥 ${COURSE_LABELS[course]} יצא למטבח`); loadOrders(restaurantId); }
  }

  // ── Cart helpers ──
  function addToCart(item: MenuCat["items"][0]) {
    setCart(prev => {
      const ex = prev.find(c => c.itemId === item.id && c.course === addCourse);
      if (ex) return prev.map(c => c.itemId === item.id && c.course === addCourse ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { itemId: item.id, name: item.name, price: item.price, qty: 1, notes: "", course: addCourse }];
    });
  }
  function changeQty(itemId: string, course: number, delta: number) {
    setCart(prev => prev.map(c => c.itemId === itemId && c.course === course ? { ...c, qty: Math.max(0, c.qty + delta) } : c).filter(c => c.qty > 0));
  }

  // ── Derived ──
  const cartTotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);
  const unreadNotifs = notifs.filter(n => !n.read).length;

  const tableOrders = selTable ? orders.filter(o => (o.tableNumber ?? "") === selTable && !["PAID", "CANCELLED"].includes(o.status)) : [];
  const tableInsights = selTable ? computeInsights(selTable, orders) : [];

  const heldCourses = useMemo(() => {
    const seen = new Map<string, { orderId: string; course: number; count: number }>();
    for (const o of tableOrders) {
      for (const i of o.items) {
        if (!i.heldUntilFired) continue;
        const key = `${o.id}:${i.course}`;
        const ex = seen.get(key);
        if (ex) ex.count++; else seen.set(key, { orderId: o.id, course: i.course, count: 1 });
      }
    }
    return [...seen.entries()].map(([key, v]) => ({ key, ...v }));
  }, [tableOrders]);

  const displayItems = useMemo(() => {
    if (menuSearch.length >= 2) {
      const q = menuSearch.toLowerCase();
      return menu.flatMap(c => c.items).filter(i => i.name.toLowerCase().includes(q));
    }
    return menu[catIdx]?.items ?? [];
  }, [menu, catIdx, menuSearch]);

  // ══════════════════════════════════════════════════════════════════
  return (
    <div style={{ direction: "rtl", display: "flex", flexDirection: "column", height: "100vh", background: T.bg, fontFamily: T.fontSans, color: T.text, overflow: "hidden" }}>

      {/* ── HEADER ── */}
      <header style={{ flexShrink: 0, height: 50, background: T.surface, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 8, padding: "0 12px" }}>
        {restaurants.length > 1 ? (
          <select value={restaurantId} onChange={e => { setRestaurantId(e.target.value); setSelTable(null); }}
            style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 13, padding: "3px 7px", outline: "none", direction: "rtl", maxWidth: 140 }}>
            {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        ) : (
          <span style={{ fontSize: 14, fontWeight: 700, color: T.gold, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{restaurants[0]?.name}</span>
        )}
        <span style={{ fontSize: 11, color: T.muted }}>👤 {waiterName}</span>
        <div style={{ flex: 1 }} />
        {layout && (
          <button onClick={() => setViewMode(v => v === "grid" ? "floor" : "grid")}
            style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 7, color: T.sub, fontSize: 11, padding: "3px 9px", cursor: "pointer" }}>
            {viewMode === "grid" ? "🗺️" : "⊞"}
          </button>
        )}
        <div style={{ fontSize: 11, color: T.muted, background: T.panel, borderRadius: 6, padding: "2px 7px" }}>
          {allTableNums.filter(t => tableStatus(t, orders) !== "free").length}/{allTableNums.length} תפוסים
        </div>
      </header>

      {/* ── MAIN ── */}
      <div style={{ flex: 1, overflow: "hidden" }}>

        {/* MAP TAB */}
        {mainTab === "map" && (
          <div style={{ height: "100%", overflowY: "auto", padding: "10px 8px 68px" }}>
            {/* Room tabs */}
            {layout && layout.rooms.length > 1 && (
              <div style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto", paddingBottom: 2 }}>
                {layout.rooms.map((room, i) => (
                  <button key={room.id} onClick={() => setRoomIdx(i)}
                    style={{ flexShrink: 0, padding: "4px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer", background: roomIdx === i ? T.gold : T.panel, color: roomIdx === i ? "#000" : T.sub, border: `1px solid ${roomIdx === i ? T.gold : T.border}`, fontWeight: roomIdx === i ? 700 : 400 }}>
                    {room.name}
                  </button>
                ))}
              </div>
            )}

            {viewMode === "floor" && layout ? (
              <FloorView room={layout.rooms[roomIdx]} orders={orders} myTables={myTables}
                onSelect={t => { setSelTable(t); setSheetTab(tableStatus(t, orders) === "free" ? "order" : "bill"); setCart([]); }}
                selected={selTable} />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: 8 }}>
                {allTableNums.length === 0 && (
                  <div style={{ gridColumn: "1/-1", textAlign: "center" as const, padding: 40, color: T.muted, fontSize: 13 }}>
                    אין שולחנות — בנה פריסה בבונה הפריסה
                  </div>
                )}
                {allTableNums.map(tNum => {
                  const status = tableStatus(tNum, orders);
                  const sc = STATUS_COLORS[status];
                  const since = tableSince(tNum, orders);
                  const total = tableTotal(tNum, orders);
                  const guests = tableGuests(tNum, orders);
                  const ins = computeInsights(tNum, orders);
                  const spark = sparkColor(ins);
                  const isMine = myTables.size === 0 || myTables.has(tNum);
                  const isSel = selTable === tNum;
                  return (
                    <button key={tNum}
                      onClick={() => { setSelTable(tNum); setSheetTab(status === "free" ? "order" : "bill"); setCart([]); }}
                      style={{
                        background: isSel ? sc + "20" : T.surface, border: `2px solid ${isSel ? sc : sc + "55"}`,
                        borderRadius: 10, padding: "10px 8px", cursor: "pointer",
                        textAlign: "right" as const, direction: "rtl", opacity: isMine ? 1 : 0.45,
                        position: "relative" as const, minHeight: 84, transition: "border 0.1s",
                      }}>
                      <span style={{ position: "absolute", top: 6, left: 6, fontSize: 10, color: spark, opacity: ins.length > 0 ? 1 : 0.4 }}>✦</span>
                      <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{tNum}</div>
                      {since && <div style={{ fontSize: 10, color: T.muted, marginTop: 1 }}>⏱ {fmtTimer(since)}</div>}
                      <div style={{ display: "flex", gap: 5, marginTop: 3, flexWrap: "wrap", alignItems: "center" }}>
                        {guests > 0 && <span style={{ fontSize: 10, color: T.muted }}>👥{guests}</span>}
                        {total > 0 && <span style={{ fontSize: 11, color: T.gold, fontWeight: 700 }}>₪{Math.round(total)}</span>}
                      </div>
                      <div style={{ marginTop: 5, fontSize: 9, fontWeight: 700, color: sc, background: sc + "18", borderRadius: 20, padding: "1px 6px", display: "inline-block" }}>
                        {status === "free" ? "פנוי" : status === "occupied" ? "תפוס" : "חשבון"}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ORDERS TAB */}
        {mainTab === "orders" && (
          <ActiveOrdersView orders={orders} myTables={myTables}
            onSelect={t => { setSelTable(t); setMainTab("map"); setSheetTab("bill"); }} />
        )}

        {/* NOTIFS TAB */}
        {mainTab === "notifs" && (
          <NotifsView notifs={notifs}
            onMarkAll={() => setNotifs(ns => ns.map(n => ({ ...n, read: true })))}
            onSelect={t => { setSelTable(t); setMainTab("map"); setSheetTab("bill"); }} />
        )}
      </div>

      {/* ── BOTTOM TAB BAR ── */}
      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 56, background: T.surface, borderTop: `1px solid ${T.border}`, display: "flex", zIndex: 200 }}>
        {(["map", "orders", "notifs"] as const).map(tab => {
          const cfg = { map: { icon: "🗺️", label: "מפה" }, orders: { icon: "📋", label: "הזמנות" }, notifs: { icon: "🔔", label: "התראות" } }[tab];
          const isActive = mainTab === tab;
          return (
            <button key={tab} onClick={() => { setMainTab(tab); if (tab !== "map") setSelTable(null); }}
              style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, background: "none", border: "none", cursor: "pointer", color: isActive ? T.gold : T.muted, position: "relative" as const }}>
              <span style={{ fontSize: 20 }}>{cfg.icon}</span>
              <span style={{ fontSize: 9, fontWeight: isActive ? 700 : 400 }}>{cfg.label}</span>
              {tab === "notifs" && unreadNotifs > 0 && (
                <span style={{ position: "absolute", top: 6, right: "calc(50% - 10px)", background: T.red, color: "#fff", borderRadius: "50%", width: 15, height: 15, fontSize: 8, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {unreadNotifs > 9 ? "9+" : unreadNotifs}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ── TABLE SHEET ── */}
      {selTable !== null && mainTab === "map" && (
        <>
          <div onClick={() => { setSelTable(null); setCart([]); }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 300 }} />
          <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0, height: "82vh",
            background: T.surface, borderTop: `1px solid ${T.border}`, borderRadius: "14px 14px 0 0",
            zIndex: 301, display: "flex", flexDirection: "column",
            animation: "slideUp 0.25s ease-out",
          }}>
            {/* Sheet header */}
            <div style={{ flexShrink: 0, padding: "12px 14px 0", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 800 }}>שולחן {selTable}</span>
              {tableGuests(selTable, orders) > 0 && <span style={{ fontSize: 11, color: T.muted }}>👥 {tableGuests(selTable, orders)}</span>}
              {tableTotal(selTable, orders) > 0 && <span style={{ fontSize: 12, color: T.gold, fontWeight: 700 }}>₪{Math.round(tableTotal(selTable, orders))}</span>}
              <div style={{ flex: 1 }} />
              {tableInsights.length > 0 && (
                <span onClick={() => setSheetTab("ai")} style={{ fontSize: 12, color: sparkColor(tableInsights), cursor: "pointer", padding: "2px 8px", background: sparkColor(tableInsights) + "18", borderRadius: 20 }}>
                  ✦ {tableInsights.length} תובנות
                </span>
              )}
              <button onClick={() => { setSelTable(null); setCart([]); }}
                style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: "50%", width: 26, height: 26, cursor: "pointer", color: T.sub, fontSize: 13 }}>✕</button>
            </div>
            {/* Sheet tabs */}
            <div style={{ display: "flex", padding: "8px 14px 0", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
              {([
                { id: "order", label: "🍽️ הזמנה" },
                { id: "bill",  label: "🧾 חשבון" },
                { id: "ai",    label: `✨ AI${tableInsights.length > 0 ? ` (${tableInsights.length})` : ""}` },
              ] as const).map(t => (
                <button key={t.id} onClick={() => setSheetTab(t.id)}
                  style={{ padding: "5px 12px 9px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: sheetTab === t.id ? 700 : 400, color: sheetTab === t.id ? T.gold : T.sub, borderBottom: `2px solid ${sheetTab === t.id ? T.gold : "transparent"}`, marginBottom: -1 }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Sheet content */}
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              {sheetTab === "order" && (
                <OrderTab
                  menu={menu} catIdx={catIdx} setCatIdx={setCatIdx}
                  menuSearch={menuSearch} setMenuSearch={setMenuSearch}
                  displayItems={displayItems} cart={cart} cartTotal={cartTotal} cartCount={cartCount}
                  addToCart={addToCart} changeQty={changeQty}
                  addCourse={addCourse} setAddCourse={setAddCourse}
                  guestCount={guestCount} setGuestCount={setGuestCount}
                  orderNote={orderNote} setOrderNote={setOrderNote}
                  submitting={submitting} onSubmit={submitOrder}
                  heldCourses={heldCourses} onFireCourse={fireCourse}
                  hasActiveOrders={tableOrders.length > 0}
                />
              )}
              {sheetTab === "bill" && (
                <BillTab tableOrders={tableOrders} selTable={selTable}
                  onPayModal={() => setPayModal(true)} onAddMore={() => setSheetTab("order")} />
              )}
              {sheetTab === "ai" && (
                <AITab insights={tableInsights} tableNum={selTable} />
              )}
            </div>
          </div>
        </>
      )}

      {/* ── PAY MODAL ── */}
      {payModal && selTable && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 500, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: "14px 14px 0 0", padding: 20, width: "100%", direction: "rtl" }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 800 }}>סגירת שולחן {selTable}</h3>
            <div style={{ fontSize: 24, fontWeight: 800, color: T.gold, marginBottom: 14 }}>₪{(tableTotal(selTable, orders) + tip).toFixed(0)}</div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 5 }}>טיפ</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[0, 10, 15, 20].map(pct => {
                  const amt = pct === 0 ? 0 : Math.round(tableTotal(selTable, orders) * pct / 100);
                  return (
                    <button key={pct} onClick={() => setTip(amt)}
                      style={{ flex: 1, padding: "5px 0", borderRadius: 7, background: tip === amt ? T.gold : T.panel, color: tip === amt ? "#000" : T.sub, border: `1px solid ${tip === amt ? T.gold : T.border}`, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                      {pct === 0 ? "ללא" : `${pct}%`}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 5 }}>תשלום</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[{ id: "card", label: "💳 כרטיס" }, { id: "cash", label: "💵 מזומן" }, { id: "app", label: "📱 אפליקציה" }].map(pm => (
                  <button key={pm.id} onClick={() => setPayMethod(pm.id)}
                    style={{ flex: 1, padding: "7px 0", borderRadius: 7, background: payMethod === pm.id ? T.blue : T.panel, color: payMethod === pm.id ? "#fff" : T.sub, border: `1px solid ${payMethod === pm.id ? T.blue : T.border}`, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                    {pm.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setPayModal(false)} style={{ ...btnGhost(T.sub, "md"), flex: 1, justifyContent: "center" }}>ביטול</button>
              <button onClick={closeTable} disabled={closing}
                style={{ ...btn("success", "md"), flex: 2, justifyContent: "center", opacity: closing ? 0.6 : 1 }}>
                {closing ? "סוגר..." : "✓ אשר ושלם"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div style={{ position: "fixed", bottom: 68, left: "50%", transform: "translateX(-50%)", background: T.raised, border: `1px solid ${T.border}`, borderRadius: 20, padding: "7px 18px", fontSize: 13, color: T.text, zIndex: 600, whiteSpace: "nowrap" as const, boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
          {toast}
        </div>
      )}

      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes sparkPulse { 0%,100% { opacity:1; } 50% { opacity:0.3; transform:scale(1.4); } }
      `}</style>
    </div>
  );
}

// ── OrderTab ──────────────────────────────────────────────────────
function OrderTab({ menu, catIdx, setCatIdx, menuSearch, setMenuSearch, displayItems, cart, cartTotal, cartCount, addToCart, changeQty, addCourse, setAddCourse, guestCount, setGuestCount, orderNote, setOrderNote, submitting, onSubmit, heldCourses, onFireCourse, hasActiveOrders }: {
  menu: MenuCat[]; catIdx: number; setCatIdx: (i: number) => void;
  menuSearch: string; setMenuSearch: (s: string) => void;
  displayItems: MenuCat["items"];
  cart: CartEntry[]; cartTotal: number; cartCount: number;
  addToCart: (item: MenuCat["items"][0]) => void;
  changeQty: (id: string, course: number, d: number) => void;
  addCourse: number; setAddCourse: (n: number) => void;
  guestCount: number; setGuestCount: (n: number) => void;
  orderNote: string; setOrderNote: (s: string) => void;
  submitting: boolean; onSubmit: () => void;
  heldCourses: { key: string; orderId: string; course: number; count: number }[];
  onFireCourse: (orderId: string, course: number) => void;
  hasActiveOrders: boolean;
}) {
  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {/* Fire buttons */}
      {heldCourses.length > 0 && (
        <div style={{ flexShrink: 0, padding: "6px 12px", background: T.orangeSub, borderBottom: `1px solid ${T.orange}33`, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: T.orange }}>🔥 שלח למטבח:</span>
          {heldCourses.map(hc => (
            <button key={hc.key} onClick={() => onFireCourse(hc.orderId, hc.course)}
              style={{ ...btn("warning", "sm"), padding: "3px 10px", fontSize: 11 }}>
              {COURSE_LABELS[hc.course]} ({hc.count})
            </button>
          ))}
        </div>
      )}
      {/* Guest + course */}
      <div style={{ flexShrink: 0, padding: "6px 12px", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        {!hasActiveOrders && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 11, color: T.muted }}>👥</span>
            <button onClick={() => setGuestCount(Math.max(1, guestCount - 1))} style={{ width: 22, height: 22, borderRadius: "50%", background: T.panel, border: `1px solid ${T.border}`, color: T.text, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
            <span style={{ fontSize: 13, fontWeight: 700, minWidth: 18, textAlign: "center" as const }}>{guestCount}</span>
            <button onClick={() => setGuestCount(guestCount + 1)} style={{ width: 22, height: 22, borderRadius: "50%", background: T.panel, border: `1px solid ${T.border}`, color: T.text, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
          </div>
        )}
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: T.muted }}>קורס:</span>
          {[1, 2, 3].map(c => (
            <button key={c} onClick={() => setAddCourse(c)}
              style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, cursor: "pointer", background: addCourse === c ? T.gold : T.panel, color: addCourse === c ? "#000" : T.sub, border: `1px solid ${addCourse === c ? T.gold : T.border}`, fontWeight: addCourse === c ? 700 : 400 }}>
              {COURSE_LABELS[c]}
            </button>
          ))}
        </div>
      </div>
      {/* Search */}
      <div style={{ flexShrink: 0, padding: "5px 10px", borderBottom: `1px solid ${T.border}` }}>
        <input type="text" value={menuSearch} onChange={e => setMenuSearch(e.target.value)}
          placeholder="🔍 חפש מנה..."
          style={{ width: "100%", background: T.panel, border: `1px solid ${T.border}`, borderRadius: 7, color: T.text, fontSize: 13, padding: "5px 10px", outline: "none", direction: "rtl" }} />
      </div>
      {/* Category chips */}
      {menuSearch.length < 2 && (
        <div style={{ flexShrink: 0, display: "flex", gap: 5, padding: "5px 10px", overflowX: "auto", borderBottom: `1px solid ${T.border}`, scrollbarWidth: "none" as const }}>
          {menu.map((cat, i) => (
            <button key={cat.id} onClick={() => setCatIdx(i)}
              style={{ flexShrink: 0, padding: "3px 11px", borderRadius: 20, fontSize: 12, cursor: "pointer", background: catIdx === i ? T.gold : T.panel, color: catIdx === i ? "#000" : T.sub, border: `1px solid ${catIdx === i ? T.gold : T.border}`, fontWeight: catIdx === i ? 700 : 400 }}>
              {cat.name}
            </button>
          ))}
        </div>
      )}
      {/* Items grid */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 7 }}>
          {displayItems.map(item => {
            const cartQty = cart.filter(c => c.itemId === item.id && c.course === addCourse).reduce((s, c) => s + c.qty, 0);
            return (
              <div key={item.id} style={{ background: cartQty > 0 ? T.goldSub : T.panel, border: `1px solid ${cartQty > 0 ? T.gold + "66" : T.border}`, borderRadius: 9, padding: "9px 9px", display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.text, lineHeight: 1.3 }}>{item.name}</div>
                {item.description && <div style={{ fontSize: 9, color: T.muted, lineHeight: 1.2 }}>{item.description.slice(0, 35)}</div>}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.gold }}>₪{item.price.toFixed(0)}</span>
                  {cartQty === 0 ? (
                    <button onClick={() => addToCart(item)} style={{ width: 26, height: 26, borderRadius: "50%", background: T.gold, color: "#fff", border: "none", cursor: "pointer", fontSize: 18, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button onClick={() => changeQty(item.id, addCourse, -1)} style={{ width: 22, height: 22, borderRadius: "50%", background: T.raised, color: T.text, border: `1px solid ${T.border}`, cursor: "pointer", fontSize: 13 }}>−</button>
                      <span style={{ fontSize: 13, fontWeight: 700, minWidth: 14, textAlign: "center" as const }}>{cartQty}</span>
                      <button onClick={() => changeQty(item.id, addCourse, 1)} style={{ width: 22, height: 22, borderRadius: "50%", background: T.gold, color: "#fff", border: "none", cursor: "pointer", fontSize: 13 }}>+</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Cart footer */}
      {cartCount > 0 && (
        <div style={{ flexShrink: 0, padding: "9px 12px", background: T.panel, borderTop: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: T.muted }}>{cartCount} פריטים</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.gold }}>₪{cartTotal.toFixed(0)}</div>
          </div>
          <input value={orderNote} onChange={e => setOrderNote(e.target.value)} placeholder="הערה..."
            style={{ background: T.overlay, border: `1px solid ${T.border}`, borderRadius: 7, color: T.text, fontSize: 12, padding: "4px 8px", width: 80, outline: "none", direction: "rtl" }} />
          <button onClick={onSubmit} disabled={submitting}
            style={{ ...btn("primary", "sm"), opacity: submitting ? 0.6 : 1 }}>
            {submitting ? "..." : "📤 שלח"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── BillTab ───────────────────────────────────────────────────────
function BillTab({ tableOrders, selTable, onPayModal, onAddMore }: {
  tableOrders: ApiOrder[]; selTable: string;
  onPayModal: () => void; onAddMore: () => void;
}) {
  const total = tableOrders.reduce((s, o) => s + o.totalAmount, 0);
  if (!tableOrders.length) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 10, padding: 24, color: T.muted }}>
      <div style={{ fontSize: 36 }}>🍽️</div>
      <div style={{ fontSize: 13 }}>שולחן {selTable} — אין הזמנות פעילות</div>
      <button onClick={onAddMore} style={btn("primary", "sm")}>+ צור הזמנה</button>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
        {tableOrders.map(order => (
          <div key={order.id} style={{ marginBottom: 10, background: T.panel, border: `1px solid ${T.border}`, borderRadius: 9 }}>
            <div style={{ padding: "7px 11px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: T.sub }}>#{order.orderNumber ?? "—"}</span>
              <span style={{ fontSize: 11, color: T.muted }}>₪{order.totalAmount.toFixed(0)}</span>
            </div>
            {order.items.filter(i => i.itemStatus !== "CANCELLED").map(item => (
              <div key={item.id} style={{ padding: "6px 11px", display: "flex", alignItems: "center", gap: 7, borderBottom: `1px solid ${T.borderSub}`, opacity: item.isComped ? 0.55 : 1 }}>
                <span style={{ fontSize: 12, flex: 1, color: T.text }}>{item.item.name}</span>
                <span style={{ fontSize: 10, color: T.muted }}>×{item.quantity}</span>
                {item.isComped && <span style={{ fontSize: 9, color: T.green, background: T.greenSub, borderRadius: 8, padding: "1px 5px" }}>חינם</span>}
                <span style={{
                  fontSize: 9, fontWeight: 700, borderRadius: 10, padding: "1px 6px",
                  color: item.itemStatus === "DONE" ? T.green : item.itemStatus === "PREPARING" ? T.orange : T.muted,
                  background: (item.itemStatus === "DONE" ? T.green : item.itemStatus === "PREPARING" ? T.orange : T.muted) + "18",
                }}>
                  {item.itemStatus === "DONE" ? "מוכן" : item.itemStatus === "PREPARING" ? "מכין" : "ממתין"}
                </span>
                <span style={{ fontSize: 11, color: T.gold }}>₪{(item.price * item.quantity).toFixed(0)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ flexShrink: 0, padding: "10px 12px", borderTop: `1px solid ${T.border}`, background: T.panel, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: T.muted }}>סה"כ לתשלום</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.gold }}>₪{total.toFixed(0)}</div>
        </div>
        <button onClick={onAddMore} style={btnGhost(T.blue, "sm")}>+ הוסף</button>
        <button onClick={onPayModal} style={btn("success", "md")}>💳 שלם</button>
      </div>
    </div>
  );
}

// ── AITab ─────────────────────────────────────────────────────────
function AITab({ insights, tableNum }: { insights: AIInsight[]; tableNum: string }) {
  if (!insights.length) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 8, padding: 24, color: T.muted }}>
      <div style={{ fontSize: 32, color: T.green }}>✦</div>
      <div style={{ fontSize: 14, color: T.green }}>שולחן {tableNum} — הכל תקין</div>
      <div style={{ fontSize: 12 }}>אין תובנות כרגע</div>
    </div>
  );
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
      {insights.map((ins, i) => (
        <div key={i} style={{ background: ins.color + "10", border: `1px solid ${ins.color}44`, borderRadius: 10, padding: "11px 13px", marginBottom: 8, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>{ins.icon}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: ins.color }}>{ins.title}</div>
            <div style={{ fontSize: 11, color: T.sub, marginTop: 2, lineHeight: 1.4 }}>{ins.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── ActiveOrdersView ──────────────────────────────────────────────
function ActiveOrdersView({ orders, myTables, onSelect }: {
  orders: ApiOrder[]; myTables: Set<string>; onSelect: (t: string) => void;
}) {
  const active = orders.filter(o => !["PAID", "CANCELLED"].includes(o.status) && o.tableNumber);
  const byTable = new Map<string, ApiOrder[]>();
  for (const o of active) {
    const t = o.tableNumber!;
    if (!byTable.has(t)) byTable.set(t, []);
    byTable.get(t)!.push(o);
  }
  if (!active.length) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: T.muted, gap: 8 }}>
      <div style={{ fontSize: 36 }}>📋</div><div style={{ fontSize: 13 }}>אין הזמנות פעילות</div>
    </div>
  );
  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "10px 8px 68px" }}>
      {[...byTable.entries()].map(([tNum, tOrds]) => {
        const total = tOrds.reduce((s, o) => s + o.totalAmount, 0);
        const since = new Date(Math.min(...tOrds.map(o => new Date(o.createdAt).getTime())));
        const allItems = tOrds.flatMap(o => o.items);
        const readyCount = allItems.filter(i => i.itemStatus === "DONE" && !i.servedAt && !i.isComped).length;
        const prepCount = allItems.filter(i => i.itemStatus === "PREPARING").length;
        const isMine = myTables.size === 0 || myTables.has(tNum);
        return (
          <button key={tNum} onClick={() => onSelect(tNum)}
            style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px", marginBottom: 8, cursor: "pointer", textAlign: "right" as const, direction: "rtl", opacity: isMine ? 1 : 0.5 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: T.text }}>שולחן {tNum}</span>
              <span style={{ fontSize: 10, color: T.muted }}>⏱ {fmtTimer(since)}</span>
              {readyCount > 0 && <span style={{ fontSize: 9, background: T.blue + "22", color: T.blue, border: `1px solid ${T.blue}44`, borderRadius: 8, padding: "1px 6px", fontWeight: 700 }}>🍽️ {readyCount} מוכן</span>}
              {prepCount > 0 && <span style={{ fontSize: 9, background: T.orange + "22", color: T.orange, border: `1px solid ${T.orange}44`, borderRadius: 8, padding: "1px 6px", fontWeight: 700 }}>🍳 {prepCount}</span>}
              <span style={{ marginRight: "auto", fontSize: 14, fontWeight: 800, color: T.gold }}>₪{total.toFixed(0)}</span>
            </div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {tOrds.map(o => <span key={o.id} style={{ fontSize: 9, color: T.muted, background: T.panel, borderRadius: 5, padding: "2px 5px" }}>#{o.orderNumber ?? "—"} · {o.items.length}פר</span>)}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── NotifsView ────────────────────────────────────────────────────
function NotifsView({ notifs, onMarkAll, onSelect }: {
  notifs: Notif[]; onMarkAll: () => void; onSelect: (t: string) => void;
}) {
  const colors = { ready: T.green, alert: T.orange, info: T.blue };
  return (
    <div style={{ height: "100%", overflowY: "auto", paddingBottom: 68 }}>
      {notifs.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 14px 2px" }}>
          <button onClick={onMarkAll} style={{ fontSize: 11, color: T.muted, background: "none", border: "none", cursor: "pointer" }}>סמן הכל כנקרא</button>
        </div>
      )}
      {!notifs.length && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "80vh", color: T.muted, gap: 8 }}>
          <div style={{ fontSize: 36 }}>🔔</div><div style={{ fontSize: 13 }}>אין התראות</div>
        </div>
      )}
      {notifs.map(n => (
        <div key={n.id} onClick={() => onSelect(n.tableNumber)}
          style={{ padding: "10px 14px", background: n.read ? "transparent" : colors[n.type] + "08", borderBottom: `1px solid ${T.borderSub}`, cursor: "pointer", direction: "rtl", display: "flex", gap: 8, alignItems: "flex-start" }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, marginTop: 4, background: n.read ? "transparent" : colors[n.type] }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: n.read ? T.muted : T.text, fontWeight: n.read ? 400 : 600 }}>שולחן {n.tableNumber} — {n.message}</div>
            <div style={{ fontSize: 10, color: T.muted, marginTop: 1 }}>{new Date(n.at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── FloorView ─────────────────────────────────────────────────────
function FloorView({ room, orders, myTables, onSelect, selected }: {
  room: LayoutRoom | undefined; orders: ApiOrder[]; myTables: Set<string>;
  onSelect: (t: string) => void; selected: string | null;
}) {
  if (!room?.tables?.length) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200, color: T.muted, fontSize: 13 }}>
      אין שולחנות בפריסה
    </div>
  );
  const maxX = Math.max(...room.tables.map(t => t.x + t.w));
  const maxY = Math.max(...room.tables.map(t => t.y + t.h));
  return (
    <div style={{ position: "relative", width: "100%", paddingBottom: `${(maxY / maxX) * 100}%`, minHeight: 280 }}>
      <div style={{ position: "absolute", inset: 0 }}>
        {room.tables.map(t => {
          const tNum = String(t.num);
          const status = tableStatus(tNum, orders);
          const sc = STATUS_COLORS[status];
          const since = tableSince(tNum, orders);
          const ins = computeInsights(tNum, orders);
          const spark = sparkColor(ins);
          const isMine = myTables.size === 0 || myTables.has(tNum);
          const isSel = selected === tNum;
          return (
            <button key={t.id} onClick={() => onSelect(tNum)}
              style={{
                position: "absolute", left: `${(t.x / maxX) * 100}%`, top: `${(t.y / maxY) * 100}%`,
                width: `${(t.w / maxX) * 100}%`, height: `${(t.h / maxY) * 100}%`,
                borderRadius: SHAPE_BR[t.shape],
                background: isSel ? sc + "30" : t.customColor ?? (sc + "15"),
                border: `2px solid ${isSel ? sc : sc + "60"}`,
                cursor: "pointer", display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                opacity: isMine ? 1 : 0.35,
                transform: t.rot ? `rotate(${t.rot}deg)` : undefined,
                fontSize: "clamp(7px,1.4vw,12px)", color: T.text, padding: 1,
              }}>
              <span style={{ color: spark, fontSize: "0.9em" }}>✦</span>
              <span style={{ fontWeight: 700, lineHeight: 1 }}>{t.num}</span>
              {since && <span style={{ fontSize: "0.75em", color: T.muted }}>{fmtTimer(since)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
