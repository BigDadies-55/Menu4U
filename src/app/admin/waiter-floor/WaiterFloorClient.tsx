"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ── Types ──────────────────────────────────────────────────────────
type TableShape  = "round" | "rect" | "square" | "oval" | "long" | "banquet";
type FreeTable   = { id: string; num: number; name: string; shape: TableShape; x: number; y: number; w: number; h: number; seats: number; rot: number; zIdx?: number; customColor?: string };
type Decoration  = { id: string; kind: "line" | "label" | "image"; x: number; y: number; w: number; h: number; rot: number; text: string; color: string; zIdx: number; imgSrc?: string };
type Room        = { id: string; name: string; tables: FreeTable[]; bg?: number; bgImg?: string; bgOpacity?: number; decos?: Decoration[] };
type LayoutV2    = { version: 2; rooms: Room[] };
type OrderItem  = { id: string; quantity: number; price: number; notes: string | null; itemStatus: string; course: number; heldUntilFired: boolean; firedAt: string | null; doneAt: string | null; item: { name: string } };
type Order      = { id: string; tableNumber: string | null; status: string; orderNumber: number | null; totalAmount: number; notes: string | null; createdAt: string; coversCount: number | null; items: OrderItem[] };
type CartItem   = { itemId: string; name: string; price: number; qty: number; note: string; course: number };
type MenuItem   = { id: string; name: string; price: number; description: string | null };
type MenuCat    = { id: string; name: string; items: MenuItem[] };
type Restaurant = { id: string; name: string };

// ── Design tokens ──────────────────────────────────────────────────
const C = {
  bg:       "#0a0402",
  card:     "#160805",
  panel:    "#1a0c06",
  border:   "rgba(212,160,23,0.18)",
  gold:     "#d4a017",
  text:     "#f0e6d3",
  sub:      "#c4a882",
  muted:    "#7a6050",
  green:    "#22c55e",
  orange:   "#f97316",
  red:      "#ef4444",
  blue:     "#3b82f6",
  inp:      "#2a1408",
  inpBd:    "rgba(212,160,23,0.25)",
};

// ── Room background themes (identical to layout-builder) ───────────
const BGS = [
  { body: "#1a0a0a", cw: `repeating-linear-gradient(0deg,rgba(212,160,23,0.04) 0px,rgba(212,160,23,0.04) 1px,transparent 1px,transparent 40px),repeating-linear-gradient(90deg,rgba(212,160,23,0.04) 0px,rgba(212,160,23,0.04) 1px,transparent 1px,transparent 40px),radial-gradient(ellipse at 50% 50%,#2a0e0e 0%,#0d0404 100%)` },
  { body: "#0a150a", cw: `radial-gradient(ellipse at 30% 20%,#1a2a1a,#0a150a)` },
  { body: "#0a0800", cw: `repeating-linear-gradient(0deg,rgba(212,160,23,0.09) 0px,rgba(212,160,23,0.09) 1px,transparent 1px,transparent 40px),repeating-linear-gradient(90deg,rgba(212,160,23,0.09) 0px,rgba(212,160,23,0.09) 1px,transparent 1px,transparent 40px),radial-gradient(ellipse at 60% 40%,#1a1205,#0a0800)` },
  { body: "#050510", cw: `repeating-linear-gradient(60deg,rgba(100,80,220,0.08) 0px,rgba(100,80,220,0.08) 1px,transparent 1px,transparent 40px),radial-gradient(ellipse at 50% 50%,#0a0a20,#050510)` },
  { body: "#0a0502", cw: `repeating-linear-gradient(30deg,rgba(180,80,20,0.09) 0px,rgba(180,80,20,0.09) 1px,transparent 1px,transparent 40px),radial-gradient(ellipse at 40% 60%,#1a0a05,#0a0502)` },
  { body: "#f5f0e8", cw: `linear-gradient(135deg,#f5f0e8 0%,#e8dcc8 50%,#f0e8d8 100%)` },
];

// ── Table shape border-radius (identical to layout-builder) ────────
const SHAPE_BR: Record<TableShape, string> = {
  round: "50%", rect: "10px", square: "8px", oval: "50%/40%", long: "12px", banquet: "6px",
};

// ── Order-status visual config for floor rendering ─────────────────
const ORDER_STATUS_CFG = {
  free:            { bg: "radial-gradient(circle at 40% 35%,#2a5c2a,#0f2e0f)", border: "#2e7d2e",  glow: "rgba(34,197,94,0.35)"  },
  occupied:        { bg: "radial-gradient(circle at 40% 35%,#5c3a00,#2e1900)", border: "#b87520",  glow: "rgba(249,115,22,0.35)"  },
  "bill-requested":{ bg: "radial-gradient(circle at 40% 35%,#5c1414,#2e0a0a)", border: "#8b1a1a",  glow: "rgba(239,68,68,0.45)"   },
};
const INP: React.CSSProperties = { background: C.inp, border: `1px solid ${C.inpBd}`, borderRadius: 8, color: C.text, fontSize: 13, padding: "7px 10px", width: "100%", outline: "none" };
const BTN = (col: string, light = false): React.CSSProperties => ({
  background: light ? `rgba(${col},0.15)` : col,
  color: light ? col : "#fff",
  border: light ? `1px solid rgba(${col},0.4)` : "none",
  borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer",
});

// ── Helpers ────────────────────────────────────────────────────────
const COURSE = ["", "ראשון", "עיקרי", "קינוח"];
const EMOJI  = ["", "🥗", "🍖", "🍮"];

function tableStatus(num: string, orders: Order[]): "free" | "occupied" | "bill-requested" {
  const tOrds = orders.filter(o => (o.tableNumber ?? "") === num);
  if (!tOrds.length) return "free";
  if (tOrds.every(o => o.status === "DELIVERED")) return "bill-requested";
  return "occupied";
}
function timerStart(num: string, orders: Order[]): Date | null {
  const firedAts = orders.filter(o => (o.tableNumber ?? "") === num)
    .flatMap(o => o.items).map(i => i.firedAt).filter(Boolean).map(f => new Date(f!));
  return firedAts.length ? new Date(Math.min(...firedAts.map(d => d.getTime()))) : null;
}
function fmtTimer(start: Date): string {
  const s = Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
function tableGuests(num: string, orders: Order[]): number {
  return Math.max(0, ...orders.filter(o => (o.tableNumber ?? "") === num).map(o => o.coversCount ?? 0));
}
function tableTotal(num: string, orders: Order[]): number {
  return orders.filter(o => (o.tableNumber ?? "") === num).reduce((s, o) => s + o.totalAmount, 0);
}

// ── Main component ─────────────────────────────────────────────────
const LS_REST_KEY = "menu4u_active_restaurant";

export default function WaiterFloorClient({ restaurants, waiterName }: { restaurants: Restaurant[]; waiterName: string }) {
  const [restaurantId, setRestaurantId] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(LS_REST_KEY);
      if (saved && restaurants.some(r => r.id === saved)) return saved;
    }
    return restaurants[0]?.id ?? "";
  });
  // Persist selected restaurant so the screen reopens on the one you worked on
  useEffect(() => {
    if (restaurantId && typeof window !== "undefined") localStorage.setItem(LS_REST_KEY, restaurantId);
  }, [restaurantId]);
  const [layout,       setLayout]       = useState<LayoutV2 | null>(null);
  const [layoutDiag,   setLayoutDiag]   = useState("");
  const [layoutLoading,setLayoutLoading]= useState(true);
  const [roomIdx,      setRoomIdx]      = useState(0);
  const [orders,       setOrders]       = useState<Order[]>([]);
  const [menu,         setMenu]         = useState<MenuCat[]>([]);
  const [tick,         setTick]         = useState(0);

  // panel state
  const [panel,        setPanel]        = useState<"new" | "active" | null>(null);
  const [selTable,     setSelTable]     = useState<string>("");   // table number string
  const [guestCount,   setGuestCount]   = useState(2);
  const [cart,         setCart]         = useState<CartItem[]>([]);
  const [catIdx,       setCatIdx]       = useState(0);
  const [orderNote,    setOrderNote]    = useState("");
  const [menuSearch,   setMenuSearch]   = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [toast,        setToast]        = useState("");

  // payment modal
  const [payModal,     setPayModal]     = useState(false);
  const [tip,          setTip]          = useState(0);
  const [payMethod,    setPayMethod]    = useState("card");
  const [closing,      setClosing]      = useState(false);

  // transfer modal
  const [transferModal, setTransferModal] = useState(false);
  const [transferTo,    setTransferTo]    = useState("");

  // add-more state (for active table panel)
  const [addingMore,   setAddingMore]   = useState(false);

  const floorRef     = useRef<HTMLDivElement>(null);
  const sseRef       = useRef<EventSource | null>(null);
  const ridRef       = useRef(restaurantId);
  const prevBillTables = useRef<Set<string>>(new Set());
  useEffect(() => { ridRef.current = restaurantId; }, [restaurantId]);

  // ── Data loading ─────────────────────────────────────────────────
  const loadOrders = useCallback(async (rid: string) => {
    if (!rid) return;
    const res = await fetch(`/api/admin/orders?restaurantId=${rid}&activeOnly=1`);
    if (res.ok) setOrders(await res.json());
  }, []);

  const loadLayout = useCallback(async (rid: string) => {
    if (!rid) { setLayoutLoading(false); return; }
    setLayoutLoading(true);
    try {
      const res = await fetch(`/api/admin/restaurants/${rid}/layout`);
      if (!res.ok) {
        console.error("[waiter-floor] layout fetch failed", res.status);
        setLayout(null); setLayoutDiag(`שגיאת טעינה (HTTP ${res.status})`); setLayoutLoading(false); return;
      }
      const data = await res.json();
      const raw = data.tableLayoutJson;
      console.log("[waiter-floor] tableLayoutJson type:", typeof raw, "truthy:", !!raw, "preview:", typeof raw === "string" ? raw.slice(0, 80) : raw);
      if (!raw) { setLayout(null); setLayoutDiag("לא נשמרה פריסה למסעדה זו — בנה פריסה בבונה הפריסה"); setLayoutLoading(false); return; }
      try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        const rooms = parsed?.rooms ?? (Array.isArray(parsed) ? parsed : null);
        console.log("[waiter-floor] rooms:", Array.isArray(rooms) ? `array[${rooms.length}]` : rooms);
        if (rooms && Array.isArray(rooms)) {
          setLayout({ version: 2, rooms });
          const tableCount = rooms.reduce((s: number, r: Room) => s + (r.tables?.length ?? 0), 0);
          console.log("[waiter-floor] tableCount:", tableCount);
          setLayoutDiag(tableCount === 0 ? "הפריסה קיימת אך ללא שולחנות — הוסף שולחנות בבונה הפריסה" : "");
        } else {
          setLayout(null);
          setLayoutDiag(`מבנה פריסה לא מזוהה (version=${parsed?.version}, keys=${Object.keys(parsed ?? {}).join(",")})`);
        }
      } catch (e) {
        console.error("[waiter-floor] parse error", e);
        setLayout(null);
        setLayoutDiag("שגיאת פענוח פריסה");
      }
    } catch (e) {
      console.error("[waiter-floor] network error", e);
      setLayout(null);
      setLayoutDiag("שגיאת רשת בטעינת פריסה");
    }
    setLayoutLoading(false);
  }, []);

  const loadMenu = useCallback(async (rid: string) => {
    if (!rid) return;
    const res = await fetch(`/api/admin/waiter/menu?restaurantId=${rid}`);
    if (res.ok) { const d = await res.json(); setMenu(d.categories ?? []); }
  }, []);

  useEffect(() => {
    if (!restaurantId) return;
    loadLayout(restaurantId);
    loadOrders(restaurantId);
    loadMenu(restaurantId);
    setRoomIdx(0);
    setPanel(null);
  }, [restaurantId, loadLayout, loadOrders, loadMenu]);

  // ── SSE ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!restaurantId) return;
    sseRef.current?.close();
    const es = new EventSource(`/api/admin/orders/stream?restaurantId=${restaurantId}`);
    es.onmessage = () => loadOrders(ridRef.current);
    es.onerror   = () => {};
    sseRef.current = es;
    return () => es.close();
  }, [restaurantId, loadOrders]);

  // ── Detect bill-requested transitions → toast ────────────────────
  useEffect(() => {
    if (!activeRoom) return;
    const nowBill = new Set(
      activeRoom.tables.filter(t => tableStatus(String(t.num), orders) === "bill-requested").map(t => String(t.num))
    );
    for (const num of nowBill) {
      if (!prevBillTables.current.has(num)) {
        showToast(`🔔 שולחן ${num} — מוכן לחשבון!`);
        break;
      }
    }
    prevBillTables.current = nowBill;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  // ── Timer tick every second ───────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Floor scale ───────────────────────────────────────────────────
  const activeRoom = layout?.rooms[roomIdx] ?? layout?.rooms[0] ?? null;

  const { maxX, maxY } = useMemo(() => {
    let mx = 400, my = 300;
    if (activeRoom) {
      for (const t of activeRoom.tables) { mx = Math.max(mx, t.x + t.w); my = Math.max(my, t.y + t.h); }
    }
    return { maxX: mx + 40, maxY: my + 40 };
  }, [activeRoom]);

  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = floorRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      const { width, height } = el.getBoundingClientRect();
      setScale(Math.min((width - 8) / maxX, (height - 8) / maxY, 1));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [maxX, maxY]);

  // ── Toast ─────────────────────────────────────────────────────────
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  // ── Helpers ───────────────────────────────────────────────────────
  function openTable(num: string) {
    setSelTable(num);
    const status = tableStatus(num, orders);
    if (status === "free") {
      setCart([]); setGuestCount(2); setOrderNote(""); setCatIdx(0); setMenuSearch(""); setAddingMore(false);
      setPanel("new");
    } else {
      setAddingMore(false);
      setPanel("active");
    }
  }

  function addToCart(item: MenuItem, course = 1) {
    setCart(prev => {
      const ex = prev.find(c => c.itemId === item.id && c.course === course);
      if (ex) return prev.map(c => c.itemId === item.id && c.course === course ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { itemId: item.id, name: item.name, price: item.price, qty: 1, note: "", course }];
    });
  }
  function removeFromCart(itemId: string, course: number) {
    setCart(prev => prev.filter(c => !(c.itemId === itemId && c.course === course)));
  }
  function updateCartQty(itemId: string, course: number, delta: number) {
    setCart(prev => prev.map(c => c.itemId === itemId && c.course === course
      ? { ...c, qty: Math.max(0, c.qty + delta) }
      : c).filter(c => c.qty > 0));
  }

  const cartTotal = cart.reduce((s, c) => s + c.price * c.qty, 0);

  async function submitOrder() {
    if (!cart.length || !restaurantId || !selTable) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/orders/waiter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          tableNumber: selTable,
          coversCount: guestCount,
          notes: orderNote || null,
          items: cart.map(c => ({ itemId: c.itemId, quantity: c.qty, notes: c.note || null, course: c.course })),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      showToast(`הזמנה נשלחה לשולחן ${selTable} ✓`);
      setCart([]); setOrderNote(""); setPanel(null);
      await loadOrders(restaurantId);
    } catch (e) {
      showToast("שגיאה בשליחת ההזמנה");
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  async function requestBill() {
    const tOrds = orders.filter(o => (o.tableNumber ?? "") === selTable);
    await Promise.all(tOrds.map(o =>
      fetch(`/api/admin/orders/${o.id}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DELIVERED" }),
      })
    ));
    await loadOrders(restaurantId);
    showToast(`שולחן ${selTable} — ביקש חשבון`);
  }

  async function closeTable() {
    setClosing(true);
    try {
      const res = await fetch("/api/admin/orders/close-table", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, tableNumber: selTable, tipAmount: tip, payMethod }),
      });
      if (!res.ok) throw new Error();
      showToast(`שולחן ${selTable} נסגר ✓`);
      setPayModal(false); setPanel(null); setTip(0); setPayMethod("card");
      await loadOrders(restaurantId);
    } catch {
      showToast("שגיאה בסגירת שולחן");
    } finally {
      setClosing(false);
    }
  }

  async function fireCourse(orderId: string, course: number) {
    await fetch(`/api/admin/orders/${orderId}/fire-course`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course }),
    });
    await loadOrders(restaurantId);
  }

  async function doTransfer() {
    if (!transferTo || transferTo === selTable) return;
    const res = await fetch("/api/admin/orders/transfer-table", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId, fromTable: selTable, toTable: transferTo }),
    });
    if (res.ok) {
      showToast(`שולחן ${selTable} → שולחן ${transferTo} ✓`);
      setTransferModal(false); setPanel(null);
      await loadOrders(restaurantId);
    } else {
      showToast("שגיאה בהעברת שולחן");
    }
  }

  // ── Filtered menu items ───────────────────────────────────────────
  const filteredMenu = useMemo(() => {
    if (!menuSearch) return menu;
    const q = menuSearch.toLowerCase();
    return menu.map(cat => ({ ...cat, items: cat.items.filter(i => i.name.toLowerCase().includes(q) || (i.description ?? "").toLowerCase().includes(q)) }))
      .filter(cat => cat.items.length > 0);
  }, [menu, menuSearch]);

  const activeCat = filteredMenu[catIdx] ?? filteredMenu[0];

  // ── Active table data ─────────────────────────────────────────────
  const activeTableOrders = orders.filter(o => (o.tableNumber ?? "") === selTable);
  const activeTableTotal  = tableTotal(selTable, orders);
  const selTableStatus    = tableStatus(selTable, orders);
  const selTimerStart     = timerStart(selTable, orders);

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)", background: C.bg, color: C.text, fontFamily: "system-ui,sans-serif", direction: "rtl", position: "relative", overflow: "hidden" }}>

      {/* Blink keyframe */}
      <style>{`
        @keyframes floorBlink { 0%,100%{opacity:1} 50%{opacity:0.35} }
        @keyframes slideIn    { from{transform:translateX(-100%)} to{transform:translateX(0)} }
        .bill-blink { animation: floorBlink 1s ease-in-out infinite; }
      `}</style>

      {/* ── Topbar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", borderBottom: `1px solid ${C.border}`, background: "rgba(10,4,2,0.97)", backdropFilter: "blur(8px)", flexShrink: 0 }}>
        <span style={{ fontWeight: 800, fontSize: 15, color: C.gold }}>🍽 רצפת שירות</span>
        <span style={{ color: C.muted, fontSize: 13 }}>— {waiterName}</span>

        {/* Restaurant picker */}
        {restaurants.length > 1 && (
          <select value={restaurantId} onChange={e => setRestaurantId(e.target.value)}
            style={{ ...INP, width: "auto", marginRight: "auto" }}>
            {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}

        {/* Live stats */}
        <div style={{ display: "flex", gap: 8, marginRight: restaurants.length > 1 ? 0 : "auto" }}>
          {(["free", "occupied", "bill-requested"] as const).map(s => {
            const count = activeRoom?.tables.filter(t => tableStatus(String(t.num), orders) === s).length ?? 0;
            const labels = { free: "פנויים", occupied: "תפוסים", "bill-requested": "חשבון" };
            const colors = { free: C.green, occupied: C.orange, "bill-requested": C.red };
            return (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, background: `${colors[s]}22`, border: `1px solid ${colors[s]}55`, fontSize: 12 }}>
                <span style={{ fontWeight: 800, color: colors[s] }}>{count}</span>
                <span style={{ color: C.sub }}>{labels[s]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Room tabs ── */}
      {layout && layout.rooms.length > 1 && (
        <div style={{ display: "flex", gap: 4, padding: "6px 14px", borderBottom: `1px solid ${C.border}`, background: "rgba(10,4,2,0.92)", flexShrink: 0, overflowX: "auto" }}>
          {layout.rooms.map((room, i) => (
            <button key={room.id} onClick={() => setRoomIdx(i)} style={{
              padding: "4px 14px", borderRadius: 20, fontSize: 13, fontWeight: i === roomIdx ? 700 : 400, cursor: "pointer",
              background: i === roomIdx ? `${C.gold}22` : "transparent",
              border: `1px solid ${i === roomIdx ? C.gold : C.border}`,
              color: i === roomIdx ? C.gold : C.sub,
            }}>{room.name}</button>
          ))}
        </div>
      )}

      {/* ── Main area: floor + panel ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── Floor map ── */}
        <div ref={floorRef} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {layoutLoading && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: C.muted, fontSize: 14 }}>
              טוען פריסה...
            </div>
          )}
          {!layoutLoading && !layout && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center", justifyContent: "center", height: "100%", color: C.muted, fontSize: 14, textAlign: "center", padding: 20 }}>
              <div style={{ fontSize: 32 }}>🗺️</div>
              <div style={{ color: C.sub, fontWeight: 700 }}>
                {layoutDiag || "אין פריסת שולחנות מוגדרת"}
              </div>
              <div style={{ fontSize: 12 }}>
                מסעדה נבחרת: <span style={{ color: C.gold }}>{restaurants.find(r => r.id === restaurantId)?.name ?? "—"}</span>
              </div>
              {restaurants.length > 1 && (
                <div style={{ fontSize: 12 }}>אם בנית פריסה למסעדה אחרת — בחר אותה בבורר למעלה.</div>
              )}
              <button onClick={() => loadLayout(restaurantId)} style={{ marginTop: 6, background: `${C.gold}22`, color: C.gold, border: `1px solid ${C.gold}55`, borderRadius: 8, padding: "6px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                ↻ נסה שוב
              </button>
            </div>
          )}
          {activeRoom && (() => {
            const bgCfg = BGS[activeRoom.bg ?? 0] ?? BGS[0];
            return (
              <>
                {/* ── Room background (same as layout-builder) ── */}
                <div style={{
                  position: "absolute", top: 0, left: 0,
                  width: maxX * scale, height: maxY * scale,
                  ...(activeRoom.bgImg
                    ? { backgroundImage: `url(${activeRoom.bgImg})`, backgroundSize: "cover", backgroundPosition: "center", opacity: activeRoom.bgOpacity ?? 1 }
                    : { background: bgCfg.cw, backgroundSize: `${40 * scale}px ${40 * scale}px` }
                  ),
                }} />

                {/* ── Canvas layer: decorations + tables ── */}
                <div style={{ position: "absolute", top: 0, left: 0, width: maxX * scale, height: maxY * scale }}>

                  {/* Decorations (read-only) */}
                  {(activeRoom.decos ?? [])
                    .slice().sort((a, b) => a.zIdx - b.zIdx)
                    .map(deco => {
                      const isLine  = deco.kind === "line";
                      const isImage = deco.kind === "image";
                      const c = deco.color || "#d4a017";
                      return (
                        <div key={deco.id} style={{
                          position: "absolute",
                          left: deco.x * scale, top: deco.y * scale,
                          width: deco.w * scale, height: Math.max(isLine ? 2 : 20, deco.h * scale),
                          transform: `rotate(${deco.rot}deg)`, transformOrigin: "center",
                          zIndex: deco.zIdx, pointerEvents: "none",
                        }}>
                          {isLine ? (
                            <div style={{ position: "absolute", inset: 0, background: c, borderRadius: 2 }} />
                          ) : isImage ? (
                            <div style={{ position: "absolute", inset: 0, borderRadius: 6 * scale, overflow: "hidden" }}>
                              {deco.imgSrc && <img src={deco.imgSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />}
                            </div>
                          ) : (
                            <div style={{ position: "absolute", inset: 0, background: `${c}20`, border: `1px solid ${c}60`, borderRadius: 6 * scale, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                              <span style={{ fontSize: Math.max(9, 13 * scale), color: c, fontWeight: 700, textAlign: "center", padding: "0 4px" }}>{deco.text}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}

                  {/* Tables */}
                  {activeRoom.tables
                    .slice().sort((a, b) => (a.zIdx ?? 0) - (b.zIdx ?? 0))
                    .map(table => {
                      const tNum   = String(table.num);
                      const status = tableStatus(tNum, orders);
                      const start  = timerStart(tNum, orders);
                      const guests = tableGuests(tNum, orders);
                      const cfg    = ORDER_STATUS_CFG[status];
                      const bg     = table.customColor
                        ? `radial-gradient(circle at 40% 35%,${table.customColor}cc,${table.customColor}44)`
                        : cfg.bg;
                      const brd    = table.customColor || cfg.border;
                      const br     = SHAPE_BR[table.shape];
                      const isSel  = selTable === tNum && panel !== null;
                      const fSz    = Math.max(9, Math.min(table.w, table.h) * scale * 0.22);
                      const w      = table.w * scale;
                      const h      = table.h * scale;

                      return (
                        <div
                          key={table.id}
                          className={status === "bill-requested" ? "bill-blink" : ""}
                          onClick={() => openTable(tNum)}
                          title={`שולחן ${table.num}${table.name ? ` — ${table.name}` : ""}`}
                          style={{
                            position: "absolute",
                            left: table.x * scale, top: table.y * scale,
                            width: w, height: h,
                            transform: table.rot ? `rotate(${table.rot}deg)` : undefined,
                            transformOrigin: "center",
                            zIndex: table.zIdx ?? 1,
                            cursor: "pointer", userSelect: "none",
                          }}
                        >
                          {/* Table body (layout-builder style) */}
                          <div style={{
                            position: "absolute", inset: 0, borderRadius: br,
                            background: bg,
                            border: `${Math.max(1, 2 * scale)}px solid ${isSel ? "#d4a017" : brd}`,
                            boxShadow: isSel
                              ? `0 0 0 ${2 * scale}px #d4a01766, 0 0 ${12 * scale}px ${cfg.glow}`
                              : `0 0 ${8 * scale}px ${cfg.glow}, 0 ${2 * scale}px ${8 * scale}px rgba(0,0,0,0.4)`,
                            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                            overflow: "hidden", transition: "border-color 0.2s, box-shadow 0.2s",
                          }}>
                            {/* Gloss highlight (same as layout-builder) */}
                            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "45%", background: "linear-gradient(180deg,rgba(255,255,255,0.07) 0%,transparent 100%)", pointerEvents: "none" }} />

                            {/* Number + seats */}
                            <div style={{ display: "flex", alignItems: "baseline", gap: Math.max(1, 3 * scale), zIndex: 1 }}>
                              <span style={{ fontSize: fSz, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{table.num}</span>
                              {table.seats > 0 && (
                                <span style={{ fontSize: Math.max(7, fSz * 0.65), fontWeight: 700, color: "rgba(255,255,255,0.7)", lineHeight: 1 }}>({table.seats})</span>
                              )}
                            </div>

                            {/* Table name */}
                            {table.name && (
                              <div style={{ fontSize: Math.max(7, fSz * 0.55), color: "rgba(255,255,255,0.7)", zIndex: 1, marginTop: 1, maxWidth: w - 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {table.name}
                              </div>
                            )}

                            {/* Live timer */}
                            {start && (
                              <div style={{ fontSize: Math.max(7, fSz * 0.6), color: status === "bill-requested" ? "#fca5a5" : "#fcd34d", fontWeight: 700, zIndex: 1, lineHeight: 1 }}>
                                ⏱ {fmtTimer(start)}
                              </div>
                            )}

                            {/* Covers */}
                            {guests > 0 && (
                              <div style={{ fontSize: Math.max(7, fSz * 0.55), color: "rgba(255,255,255,0.6)", zIndex: 1, lineHeight: 1 }}>
                                👤{guests}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* Legend overlay */}
                <div style={{ position: "absolute", bottom: 10, left: 10, display: "flex", gap: 6, flexWrap: "wrap", zIndex: 50 }}>
                  {([["free","#2e7d2e","פנוי"],["occupied","#b87520","תפוס"],["bill-requested","#8b1a1a","חשבון"]] as const).map(([, col, lbl]) => (
                    <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 8, background: "rgba(0,0,0,0.75)", border: `1px solid ${col}55`, fontSize: 11, backdropFilter: "blur(4px)" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: col, display: "inline-block" }} />
                      <span style={{ color: "#e5d5b5" }}>{lbl}</span>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>

        {/* ── Side Panel ── */}
        {panel && (
          <div style={{
            width: 360, flexShrink: 0, borderRight: `1px solid ${C.border}`,
            background: C.panel, display: "flex", flexDirection: "column",
            animation: "slideIn 0.2s ease",
          }}>
            {/* Panel header */}
            <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <span style={{ fontWeight: 800, fontSize: 16, color: C.gold }}>שולחן {selTable}</span>
              {selTimerStart && panel === "active" && (
                <span style={{ fontSize: 13, color: selTableStatus === "bill-requested" ? C.red : C.orange, fontWeight: 700 }}>
                  ⏱ {fmtTimer(selTimerStart)}
                </span>
              )}
              {panel === "active" && (
                <span style={{ fontSize: 12, color: C.sub, marginRight: "auto" }}>
                  👤 {tableGuests(selTable, orders)} · ₪{activeTableTotal.toFixed(0)}
                </span>
              )}
              <button onClick={() => { setPanel(null); setSelTable(""); }} style={{ background: "none", border: "none", color: C.muted, fontSize: 18, cursor: "pointer", lineHeight: 1 }}>✕</button>
            </div>

            {/* ── NEW ORDER panel ── */}
            {panel === "new" && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* Guest count */}
                <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <span style={{ fontSize: 13, color: C.sub }}>סועדים:</span>
                  <button onClick={() => setGuestCount(g => Math.max(1, g - 1))} style={{ ...BTN(C.gold, true), padding: "4px 12px", fontSize: 16 }}>−</button>
                  <span style={{ fontWeight: 800, fontSize: 16, color: C.text, minWidth: 24, textAlign: "center" }}>{guestCount}</span>
                  <button onClick={() => setGuestCount(g => Math.min(50, g + 1))} style={{ ...BTN(C.gold, true), padding: "4px 12px", fontSize: 16 }}>+</button>
                </div>

                {/* Search */}
                <div style={{ padding: "8px 14px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
                  <input value={menuSearch} onChange={e => { setMenuSearch(e.target.value); setCatIdx(0); }}
                    placeholder="חפש מנה..." style={INP} />
                </div>

                {/* Category tabs */}
                <div style={{ display: "flex", gap: 4, padding: "6px 14px", borderBottom: `1px solid ${C.border}`, overflowX: "auto", flexShrink: 0 }}>
                  {filteredMenu.map((cat, i) => (
                    <button key={cat.id} onClick={() => setCatIdx(i)} style={{
                      padding: "3px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
                      background: catIdx === i ? `${C.gold}22` : "transparent",
                      border: `1px solid ${catIdx === i ? C.gold : C.border}`,
                      color: catIdx === i ? C.gold : C.sub,
                    }}>{cat.name}</button>
                  ))}
                </div>

                {/* Items */}
                <div style={{ flex: 1, overflowY: "auto", padding: "8px 14px" }}>
                  {activeCat?.items.map(item => (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{item.name}</div>
                        {item.description && <div style={{ fontSize: 11, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.description}</div>}
                        <div style={{ fontSize: 12, color: C.gold, marginTop: 2 }}>₪{item.price.toFixed(0)}</div>
                      </div>
                      <button onClick={() => addToCart(item)} style={{ ...BTN(C.gold, true), padding: "4px 12px", fontSize: 18, marginRight: 8, flexShrink: 0 }}>+</button>
                    </div>
                  ))}
                  {!activeCat?.items.length && <div style={{ color: C.muted, fontSize: 13, textAlign: "center", marginTop: 20 }}>אין פריטים</div>}
                </div>

                {/* Cart */}
                {cart.length > 0 && (
                  <div style={{ borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
                    <div style={{ padding: "6px 14px", maxHeight: 160, overflowY: "auto" }}>
                      {cart.map(c => (
                        <div key={c.itemId + c.course} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0" }}>
                          <button onClick={() => updateCartQty(c.itemId, c.course, -1)} style={{ background: "none", border: `1px solid ${C.border}`, color: C.sub, borderRadius: 4, width: 22, height: 22, cursor: "pointer", fontSize: 14 }}>−</button>
                          <span style={{ fontSize: 12, color: C.text, minWidth: 16, textAlign: "center" }}>{c.qty}</span>
                          <button onClick={() => updateCartQty(c.itemId, c.course, 1)}  style={{ background: "none", border: `1px solid ${C.border}`, color: C.sub, borderRadius: 4, width: 22, height: 22, cursor: "pointer", fontSize: 14 }}>+</button>
                          <span style={{ flex: 1, fontSize: 12, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                          <span style={{ fontSize: 11, color: C.muted }}>{EMOJI[c.course] ?? ""}</span>
                          <span style={{ fontSize: 12, color: C.gold }}>₪{(c.price * c.qty).toFixed(0)}</span>
                          <button onClick={() => removeFromCart(c.itemId, c.course)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13 }}>✕</button>
                        </div>
                      ))}
                    </div>
                    <div style={{ padding: "8px 14px", borderTop: `1px solid ${C.border}` }}>
                      <input value={orderNote} onChange={e => setOrderNote(e.target.value)} placeholder="הערה להזמנה..." style={{ ...INP, marginBottom: 8 }} />
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 800, color: C.gold }}>₪{cartTotal.toFixed(0)}</span>
                        <button onClick={submitOrder} disabled={submitting} style={{ ...BTN("#16a34a"), opacity: submitting ? 0.6 : 1 }}>
                          {submitting ? "שולח..." : "🚀 שלח למטבח"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── ACTIVE TABLE panel ── */}
            {panel === "active" && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

                {/* Action buttons */}
                <div style={{ padding: "10px 14px", display: "flex", gap: 6, flexWrap: "wrap", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
                  <button onClick={() => setAddingMore(v => !v)} style={{ ...BTN(C.blue, true), fontSize: 12 }}>
                    {addingMore ? "✕ סגור" : "＋ הוסף מנות"}
                  </button>
                  {selTableStatus !== "bill-requested" && (
                    <button onClick={requestBill} style={{ ...BTN(C.orange, true), fontSize: 12 }}>🧾 ביקש חשבון</button>
                  )}
                  {(selTableStatus === "bill-requested" || selTableStatus === "occupied") && (
                    <button onClick={() => setPayModal(true)} style={{ ...BTN("#16a34a"), fontSize: 12 }}>💳 סגור חשבון</button>
                  )}
                  <button onClick={() => { setTransferTo(""); setTransferModal(true); }} style={{ ...BTN(C.muted, true), fontSize: 12 }}>↔ העבר שולחן</button>
                </div>

                {/* Add-more mini menu */}
                {addingMore && (
                  <div style={{ borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
                    <div style={{ padding: "6px 14px" }}>
                      <input value={menuSearch} onChange={e => { setMenuSearch(e.target.value); setCatIdx(0); }} placeholder="חפש מנה..." style={INP} />
                    </div>
                    <div style={{ display: "flex", gap: 4, padding: "4px 14px", overflowX: "auto" }}>
                      {filteredMenu.map((cat, i) => (
                        <button key={cat.id} onClick={() => setCatIdx(i)} style={{ padding: "2px 10px", borderRadius: 20, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap", background: catIdx === i ? `${C.gold}22` : "transparent", border: `1px solid ${catIdx === i ? C.gold : C.border}`, color: catIdx === i ? C.gold : C.sub }}>
                          {cat.name}
                        </button>
                      ))}
                    </div>
                    <div style={{ maxHeight: 150, overflowY: "auto", padding: "4px 14px" }}>
                      {activeCat?.items.map(item => (
                        <div key={item.id} style={{ display: "flex", alignItems: "center", padding: "5px 0", borderBottom: `1px solid ${C.border}` }}>
                          <span style={{ flex: 1, fontSize: 12, color: C.text }}>{item.name}</span>
                          <span style={{ fontSize: 12, color: C.gold, marginLeft: 8 }}>₪{item.price.toFixed(0)}</span>
                          <button onClick={() => addToCart(item)} style={{ ...BTN(C.gold, true), padding: "2px 10px", fontSize: 14, marginRight: 6 }}>+</button>
                        </div>
                      ))}
                    </div>
                    {cart.length > 0 && (
                      <div style={{ padding: "6px 14px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: C.sub }}>{cart.reduce((s, c) => s + c.qty, 0)} פריטים · ₪{cartTotal.toFixed(0)}</span>
                        <button onClick={submitOrder} disabled={submitting} style={{ ...BTN("#16a34a"), fontSize: 12, opacity: submitting ? 0.6 : 1 }}>
                          {submitting ? "שולח..." : "🚀 שלח"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Current orders list */}
                <div style={{ flex: 1, overflowY: "auto", padding: "8px 14px" }}>
                  {activeTableOrders.map(order => {
                    const heldByCourse = new Map<number, number>();
                    order.items.forEach(i => { if (i.heldUntilFired && !i.firedAt) heldByCourse.set(i.course, (heldByCourse.get(i.course) ?? 0) + 1); });
                    return (
                      <div key={order.id} style={{ marginBottom: 12, background: "#1a0c0622", border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
                        <div style={{ padding: "6px 10px", background: "rgba(212,160,23,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: C.gold }}>הזמנה #{order.orderNumber ?? "—"}</span>
                          <span style={{ fontSize: 11, color: C.sub }}>₪{order.totalAmount.toFixed(0)}</span>
                        </div>
                        {/* Fire course buttons */}
                        {Array.from(heldByCourse.entries()).map(([course, count]) => (
                          <button key={course} onClick={() => fireCourse(order.id, course)} style={{ margin: "4px 8px", ...BTN("#b45309", true), fontSize: 11, padding: "3px 10px" }}>
                            🔥 הצת {COURSE[course] ?? `קורס ${course}`} ({count})
                          </button>
                        ))}
                        {order.items.map(item => {
                          const statusColors: Record<string, string> = { PENDING: C.muted, PREPARING: C.blue, DONE: C.green, CANCELLED: C.red, HELD: "#7c3aed" };
                          const statusLabels: Record<string, string> = { PENDING: "ממתין", PREPARING: "בהכנה", DONE: "הוכן", CANCELLED: "בוטל", HELD: "ממתין להצתה" };
                          const iHeld = item.heldUntilFired && !item.firedAt;
                          const statusKey = iHeld ? "HELD" : item.itemStatus;
                          return (
                            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderTop: `1px solid ${C.border}`, opacity: item.itemStatus === "CANCELLED" ? 0.4 : 1 }}>
                              <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>×{item.quantity}</span>
                              <span style={{ flex: 1, fontSize: 12, color: C.text }}>{item.item.name}</span>
                              {item.course > 1 && <span style={{ fontSize: 10, color: "#a78bfa" }}>{EMOJI[item.course]}</span>}
                              <span style={{ fontSize: 10, color: statusColors[statusKey] ?? C.muted, whiteSpace: "nowrap" }}>
                                {statusLabels[statusKey] ?? statusKey}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                  {!activeTableOrders.length && <div style={{ color: C.muted, fontSize: 13, textAlign: "center", marginTop: 20 }}>אין הזמנות פעילות</div>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Payment modal ── */}
      {payModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) setPayModal(false); }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, width: 320, direction: "rtl" }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: C.gold, marginBottom: 16 }}>💳 סגירת שולחן {selTable}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 16 }}>סה"כ: ₪{activeTableTotal.toFixed(0)}</div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: C.sub, marginBottom: 6 }}>טיפ</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[0, 10, 12, 15].map(pct => (
                  <button key={pct} onClick={() => setTip(pct === 0 ? 0 : activeTableTotal * pct / 100)}
                    style={{ flex: 1, padding: "6px 0", borderRadius: 8, fontSize: 12, cursor: "pointer", border: `1px solid ${C.border}`, background: tip === (pct === 0 ? 0 : activeTableTotal * pct / 100) ? `${C.gold}22` : "transparent", color: C.text }}>
                    {pct === 0 ? "ללא" : `${pct}%`}
                  </button>
                ))}
              </div>
              <input type="number" value={tip === 0 ? "" : tip.toFixed(0)} onChange={e => setTip(Number(e.target.value) || 0)}
                placeholder="טיפ ידני (₪)" style={{ ...INP, marginTop: 6 }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: C.sub, marginBottom: 6 }}>אמצעי תשלום</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[["card","אשראי"],["cash","מזומן"],["app","אפליקציה"]].map(([v, l]) => (
                  <button key={v} onClick={() => setPayMethod(v)}
                    style={{ flex: 1, padding: "6px 0", borderRadius: 8, fontSize: 12, cursor: "pointer", border: `1px solid ${C.border}`, background: payMethod === v ? `${C.gold}22` : "transparent", color: C.text }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={closeTable} disabled={closing} style={{ flex: 1, ...BTN("#16a34a"), opacity: closing ? 0.6 : 1 }}>
                {closing ? "סוגר..." : `✓ סגור · ₪${(activeTableTotal + tip).toFixed(0)}`}
              </button>
              <button onClick={() => setPayModal(false)} style={{ ...BTN(C.muted, true), padding: "8px 16px" }}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Transfer modal ── */}
      {transferModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) setTransferModal(false); }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, width: 300, direction: "rtl" }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: C.gold, marginBottom: 14 }}>↔ העבר שולחן {selTable} אל</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {activeRoom?.tables.filter(t => String(t.num) !== selTable && tableStatus(String(t.num), orders) === "free")
                .map(t => (
                  <button key={t.id} onClick={() => setTransferTo(String(t.num))}
                    style={{ padding: "6px 12px", borderRadius: 8, fontSize: 13, cursor: "pointer", border: `1px solid ${transferTo === String(t.num) ? C.gold : C.border}`, background: transferTo === String(t.num) ? `${C.gold}22` : "transparent", color: C.text }}>
                    שולחן {t.num}
                  </button>
                ))}
            </div>
            {!activeRoom?.tables.some(t => String(t.num) !== selTable && tableStatus(String(t.num), orders) === "free") && (
              <div style={{ color: C.muted, fontSize: 13, marginBottom: 12 }}>אין שולחנות פנויים להעברה</div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={doTransfer} disabled={!transferTo} style={{ flex: 1, ...BTN(C.gold), opacity: !transferTo ? 0.4 : 1 }}>העבר</button>
              <button onClick={() => setTransferModal(false)} style={{ ...BTN(C.muted, true), padding: "8px 14px" }}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: "50%", transform: "translateX(50%)", zIndex: 9999, background: "#1a2e1a", border: "1px solid #22c55e", borderRadius: 10, padding: "10px 20px", color: "#22c55e", fontWeight: 700, fontSize: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
