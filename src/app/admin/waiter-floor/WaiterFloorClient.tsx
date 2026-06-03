"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { T, btn, btnGhost, inp, STATUS, type StatusKey } from "@/lib/ui";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";

// ── Types ──────────────────────────────────────────────────────────
type TableShape  = "round" | "rect" | "square" | "oval" | "long" | "banquet";
type FreeTable   = { id: string; num: number; name: string; shape: TableShape; x: number; y: number; w: number; h: number; seats: number; rot: number; zIdx?: number; customColor?: string };
type Decoration  = { id: string; kind: "line" | "label" | "image"; x: number; y: number; w: number; h: number; rot: number; text: string; color: string; zIdx: number; imgSrc?: string };
type Room        = { id: string; name: string; tables: FreeTable[]; bg?: number; bgImg?: string; bgOpacity?: number; decos?: Decoration[] };
type LayoutV2    = { version: 2; rooms: Room[] };
type OrderItem  = { id: string; quantity: number; price: number; notes: string | null; itemStatus: string; course: number; heldUntilFired: boolean; firedAt: string | null; doneAt: string | null; isComped: boolean; compReason: string | null; item: { name: string } };
type Order      = { id: string; tableNumber: string | null; status: string; orderNumber: number | null; totalAmount: number; notes: string | null; createdAt: string; coversCount: number | null; items: OrderItem[] };
type CartItem   = { itemId: string; name: string; price: number; qty: number; note: string; course: number };
type MenuItem   = { id: string; name: string; price: number; description: string | null };
type MenuCat    = { id: string; name: string; items: MenuItem[] };
type Restaurant = { id: string; name: string };


// ── Room background themes (identical to layout-builder) ───────────
const BGS = [
  { body: "#1a0a0a", cw: `repeating-linear-gradient(0deg,rgba(212,160,23,0.04) 0px,rgba(212,160,23,0.04) 1px,transparent 1px,transparent 40px),repeating-linear-gradient(90deg,rgba(212,160,23,0.04) 0px,rgba(212,160,23,0.04) 1px,transparent 1px,transparent 40px),radial-gradient(ellipse at 50% 50%,#2a0e0e 0%,#0d0404 100%)` },
  { body: "#0a150a", cw: `radial-gradient(ellipse at 30% 20%,#1a2a1a,#0a150a)` },
  { body: "#0a0800", cw: `repeating-linear-gradient(0deg,rgba(212,160,23,0.09) 0px,rgba(212,160,23,0.09) 1px,transparent 1px,transparent 40px),repeating-linear-gradient(90deg,rgba(212,160,23,0.09) 0px,rgba(212,160,23,0.09) 1px,transparent 1px,transparent 40px),radial-gradient(ellipse at 60% 40%,#1a1205,#0a0800)` },
  { body: "#050510", cw: `repeating-linear-gradient(60deg,rgba(100,80,220,0.08) 0px,rgba(100,80,220,0.08) 1px,transparent 1px,transparent 40px),radial-gradient(ellipse at 50% 50%,#0a0a20,#050510)` },
  { body: "#0a0502", cw: `repeating-linear-gradient(30deg,rgba(180,80,20,0.09) 0px,rgba(180,80,20,0.09) 1px,transparent 1px,transparent 40px),radial-gradient(ellipse at 40% 60%,#1a0a05,#0a0502)` },
  { body: T.text, cw: `linear-gradient(135deg,#f5f0e8 0%,#e8dcc8 50%,#f0e8d8 100%)` },
];

// ── Table shape border-radius (identical to layout-builder) ────────
const SHAPE_BR: Record<TableShape, string> = {
  round: "50%", rect: "10px", square: "8px", oval: "50%/40%", long: "12px", banquet: "6px",
};


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

const MANAGER_PIN = "1234";

export default function WaiterFloorClient({ restaurants, waiterName, waiterId }: { restaurants: Restaurant[]; waiterName: string; waiterId: string }) {
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
  const [firingCourse, setFiringCourse] = useState<string>(""); // "orderId:course"

  // offline
  const [queuedOffline, setQueuedOffline] = useState(false);
  const { isOnline, pendingCount, isSyncing, enqueue } = useOfflineQueue(results => {
    const ok = results.filter(r => r.ok);
    if (ok.length > 0) showToast(`✓ ${ok.length} הזמנה נשלחה לאחר שהרשת חזרה`);
  });

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
  const [addCourse,    setAddCourse]    = useState(1);

  // PIN modal — used for cancel and comp actions
  const [pinModal,     setPinModal]     = useState<{ type: "cancel" | "comp"; orderId: string; itemId: string; itemName: string; isComped?: boolean } | null>(null);
  const [pinValue,     setPinValue]     = useState("");
  const [pinError,     setPinError]     = useState(false);
  const [compReason,   setCompReason]   = useState("");

  // Station assignment — my tables for this waiter
  const [myTables,     setMyTables]     = useState<Set<string>>(new Set());

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

  const loadMyStation = useCallback(async (rid: string) => {
    if (!rid || !waiterId) return;
    try {
      const res = await fetch(`/api/admin/waiter-stations?restaurantId=${rid}&userId=${waiterId}`);
      if (!res.ok) return;
      const data = await res.json();
      const nums = data[0]?.tableNumbers as string[] | undefined;
      setMyTables(nums?.length ? new Set(nums) : new Set());
    } catch { /* no station assigned */ }
  }, [waiterId]);

  useEffect(() => {
    if (!restaurantId) return;
    loadLayout(restaurantId);
    loadOrders(restaurantId);
    loadMenu(restaurantId);
    loadMyStation(restaurantId);
    setRoomIdx(0);
    setPanel(null);
  }, [restaurantId, loadLayout, loadOrders, loadMenu, loadMyStation]);

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

  // ── Service Worker registration ───────────────────────────────────
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

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
  const [floorContainerSize, setFloorContainerSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = floorRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      const { width, height } = el.getBoundingClientRect();
      setFloorContainerSize({ w: width, h: height });
      setScale(Math.min((width - 8) / maxX, (height - 8) / maxY, 1));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [maxX, maxY]);

  const offsetX = Math.max(0, (floorContainerSize.w - maxX * scale) / 2);
  const offsetY = Math.max(0, (floorContainerSize.h - maxY * scale) / 2);

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
    const payload = {
      restaurantId,
      tableNumber: selTable,
      coversCount: guestCount,
      notes: orderNote || null,
      items: cart.map(c => ({ itemId: c.itemId, quantity: c.qty, notes: c.note || null, course: c.course })),
    };
    if (!isOnline) {
      enqueue(payload);
      setQueuedOffline(true);
      showToast("📥 נשמר בתור — יישלח כשהרשת תחזור");
      setCart([]); setOrderNote(""); setPanel(null);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/orders/waiter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      showToast(`הזמנה נשלחה לשולחן ${selTable} ✓`);
      setCart([]); setOrderNote(""); setPanel(null);
      await loadOrders(restaurantId);
    } catch (e) {
      enqueue(payload);
      setQueuedOffline(true);
      showToast("📥 שגיאה — נשמר בתור לשליחה מאוחרת");
      setCart([]); setOrderNote(""); setPanel(null);
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
    const key = `${orderId}:${course}`;
    setFiringCourse(key);
    try {
      await fetch(`/api/admin/orders/${orderId}/fire-course`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course }),
      });
      showToast(`🔥 ${COURSE[course] ?? `קורס ${course}`} הוצת`);
      await loadOrders(restaurantId);
    } finally {
      setFiringCourse("");
    }
  }

  function openPinModal(type: "cancel" | "comp", orderId: string, itemId: string, itemName: string, isComped?: boolean) {
    setPinValue(""); setPinError(false); setCompReason("");
    setPinModal({ type, orderId, itemId, itemName, isComped });
  }

  async function confirmPinValue(pin: string) {
    if (pin !== MANAGER_PIN) { setPinError(true); setPinValue(""); return; }
    if (!pinModal) return;
    const { type, orderId, itemId } = pinModal;
    setPinModal(null);
    try {
      if (type === "cancel") {
        const res = await fetch(`/api/admin/orders/${orderId}/items/${itemId}/status`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cancel: true }),
        });
        if (res.ok) {
          showToast(`✓ מנה בוטלה`);
          await loadOrders(restaurantId);
        }
      } else {
        const res = await fetch(`/api/admin/orders/${orderId}/items/${itemId}/status`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comp: true, compReason: compReason || null }),
        });
        if (res.ok) {
          const data = await res.json();
          showToast(data.isComped ? "✓ מנה סומנה כפיצוי (חינם)" : "✓ ביטול פיצוי — מנה חוזרת לחיוב");
          await loadOrders(restaurantId);
        }
      }
    } catch { showToast("שגיאה בביצוע הפעולה"); }
  }
  async function confirmPin() { await confirmPinValue(pinValue); }

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
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)", background: T.bg, color: T.text, fontFamily: "system-ui,sans-serif", direction: "rtl", position: "relative", overflow: "hidden" }}>

      {/* Blink keyframe */}
      <style>{`
        @keyframes floorBlink { 0%,100%{opacity:1} 50%{opacity:0.35} }
        @keyframes slideIn    { from{transform:translateX(-100%)} to{transform:translateX(0)} }
        .bill-blink { animation: floorBlink 1s ease-in-out infinite; }
      `}</style>

      {/* ── Topbar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", borderBottom: `1px solid ${T.border}`, background: "rgba(10,4,2,0.97)", backdropFilter: "blur(8px)", flexShrink: 0 }}>
        <span style={{ fontWeight: 800, fontSize: 15, color: T.gold }}>🍽 רצפת שירות</span>
        <span style={{ color: T.muted, fontSize: 13 }}>— {waiterName}</span>

        {/* Restaurant picker */}
        {restaurants.length > 1 && (
          <select value={restaurantId} onChange={e => setRestaurantId(e.target.value)}
            style={{ ...inp, width: "auto", marginRight: "auto" }}>
            {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}

        {/* Offline badge */}
        {(!isOnline || pendingCount > 0) && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, background: isOnline ? T.yellowSub : T.redSub, border: `1px solid ${isOnline ? T.yellow + "55" : T.red + "55"}`, fontSize: 12 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: isOnline ? T.yellow : T.red, flexShrink: 0 }} />
            <span style={{ color: isOnline ? T.yellow : T.red }}>
              {isOnline ? (isSyncing ? `שולח ${pendingCount}...` : `${pendingCount} ממתינות`) : "אופליין"}
            </span>
          </div>
        )}

        {/* Live stats */}
        <div style={{ display: "flex", gap: 8, marginRight: restaurants.length > 1 ? 0 : "auto" }}>
          {(["free", "occupied", "bill-requested"] as const).map(s => {
            const count = activeRoom?.tables.filter(t => tableStatus(String(t.num), orders) === s).length ?? 0;
            const labels = { free: "פנויים", occupied: "תפוסים", "bill-requested": "חשבון" };
            const colors = { free: T.green, occupied: T.orange, "bill-requested": T.red };
            return (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, background: `${colors[s]}22`, border: `1px solid ${colors[s]}55`, fontSize: 12 }}>
                <span style={{ fontWeight: 800, color: colors[s] }}>{count}</span>
                <span style={{ color: T.sub }}>{labels[s]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Room tabs ── */}
      {layout && layout.rooms.length > 1 && (
        <div style={{ display: "flex", gap: 4, padding: "6px 14px", borderBottom: `1px solid ${T.border}`, background: "rgba(10,4,2,0.92)", flexShrink: 0, overflowX: "auto" }}>
          {layout.rooms.map((room, i) => (
            <button key={room.id} onClick={() => setRoomIdx(i)} style={{
              padding: "4px 14px", borderRadius: 20, fontSize: 13, fontWeight: i === roomIdx ? 700 : 400, cursor: "pointer",
              background: i === roomIdx ? `${T.gold}22` : "transparent",
              border: `1px solid ${i === roomIdx ? T.gold : T.border}`,
              color: i === roomIdx ? T.gold : T.sub,
            }}>{room.name}</button>
          ))}
        </div>
      )}

      {/* ── Main area: floor + panel ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── Floor map ── */}
        <div ref={floorRef} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {layoutLoading && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: T.muted, fontSize: 14 }}>
              טוען פריסה...
            </div>
          )}
          {!layoutLoading && !layout && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center", justifyContent: "center", height: "100%", color: T.muted, fontSize: 14, textAlign: "center", padding: 20 }}>
              <div style={{ fontSize: 32 }}>🗺️</div>
              <div style={{ color: T.sub, fontWeight: 700 }}>
                {layoutDiag || "אין פריסת שולחנות מוגדרת"}
              </div>
              <div style={{ fontSize: 12 }}>
                מסעדה נבחרת: <span style={{ color: T.gold }}>{restaurants.find(r => r.id === restaurantId)?.name ?? "—"}</span>
              </div>
              {restaurants.length > 1 && (
                <div style={{ fontSize: 12 }}>אם בנית פריסה למסעדה אחרת — בחר אותה בבורר למעלה.</div>
              )}
              <button onClick={() => loadLayout(restaurantId)} style={{ marginTop: 6, background: `${T.gold}22`, color: T.gold, border: `1px solid ${T.gold}55`, borderRadius: 8, padding: "6px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                ↻ נסה שוב
              </button>
            </div>
          )}
          {activeRoom && (() => {
            return (
              <>
                {/* Custom background image only — texture removed */}
                {activeRoom.bgImg && (
                  <div style={{
                    position: "absolute", top: offsetY, left: offsetX,
                    width: maxX * scale, height: maxY * scale,
                    backgroundImage: `url(${activeRoom.bgImg})`, backgroundSize: "cover", backgroundPosition: "center", opacity: activeRoom.bgOpacity ?? 1,
                  }} />
                )}

                {/* ── Canvas layer: decorations + tables ── */}
                <div style={{ position: "absolute", top: offsetY, left: offsetX, width: maxX * scale, height: maxY * scale }}>

                  {/* Decorations (read-only) */}
                  {(activeRoom.decos ?? [])
                    .slice().sort((a, b) => a.zIdx - b.zIdx)
                    .map(deco => {
                      const isLine  = deco.kind === "line";
                      const isImage = deco.kind === "image";
                      const c = deco.color || T.gold;
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
                      const tNum    = String(table.num);
                      const status  = tableStatus(tNum, orders);
                      const start   = timerStart(tNum, orders);
                      const guests  = tableGuests(tNum, orders);
                      const cfg         = STATUS[status as StatusKey];
                      const accentColor = table.customColor || cfg.stripe;
                      const brd         = table.customColor ? table.customColor + "99" : cfg.border;
                      const br      = SHAPE_BR[table.shape];
                      const isSel   = selTable === tNum && panel !== null;
                      const fSz     = Math.max(9, Math.min(table.w, table.h) * scale * 0.22);
                      const w       = table.w * scale;
                      const h       = table.h * scale;
                      const isMine  = myTables.size === 0 || myTables.has(tNum);
                      const isOther = myTables.size > 0 && !myTables.has(tNum);

                      return (
                        <div
                          key={table.id}
                          className={status === "bill-requested" && isMine ? "bill-blink" : ""}
                          onClick={() => openTable(tNum)}
                          title={`שולחן ${table.num}${table.name ? ` — ${table.name}` : ""}${isOther ? " (לא האזור שלך)" : ""}`}
                          style={{
                            position: "absolute",
                            left: table.x * scale, top: table.y * scale,
                            width: w, height: h,
                            transform: table.rot ? `rotate(${table.rot}deg)` : undefined,
                            transformOrigin: "center",
                            zIndex: table.zIdx ?? 1,
                            cursor: "pointer", userSelect: "none",
                            opacity: isOther ? 0.45 : 1,
                          }}
                        >
                          <div style={{
                            position: "absolute", inset: 0, borderRadius: 10,
                            background: "#0e0c0a",
                            border: `${Math.max(1, 1.5 * scale)}px solid ${isSel ? T.gold : isOther ? "rgba(255,255,255,0.06)" : brd}`,
                            boxShadow: isSel ? `0 0 0 ${2 * scale}px rgba(212,160,23,0.35)` : isOther ? "none" : `0 0 ${5 * scale}px ${cfg.glow}`,
                            overflow: "hidden", transition: "border-color 0.2s, box-shadow 0.2s",
                            display: "flex", flexDirection: "column",
                          }}>
                            {/* Top stripe */}
                            <div style={{ height: Math.max(2, 3 * scale), background: isSel ? T.gold : accentColor, opacity: isOther ? 0.3 : 1, flexShrink: 0 }} />

                            {/* Card body */}
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: Math.max(3, 5 * scale) }}>
                              {/* Badge — top-left */}
                              {!isOther && w >= 44 && (
                                <div style={{ alignSelf: "flex-start", background: cfg.badgeBg, border: `1px solid ${cfg.badge}44`, borderRadius: 20, padding: `0 ${Math.max(3, 5 * scale)}px`, lineHeight: `${Math.max(14, 16 * scale)}px` }}>
                                  <span style={{ fontSize: Math.max(6, 7.5 * scale), fontWeight: 700, color: cfg.badge }}>{cfg.label}</span>
                                </div>
                              )}

                              {/* שולחן + number — centered */}
                              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                                {h >= 56 && <span style={{ fontSize: Math.max(7, 9 * scale), color: "rgba(255,255,255,0.38)", lineHeight: 1.2 }}>שולחן</span>}
                                <span style={{ fontSize: fSz, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{table.num}</span>
                              </div>

                              {/* Bottom info — right-aligned */}
                              {h >= 44 && (
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                                  {start ? (
                                    <span style={{ fontSize: Math.max(7, fSz * 0.6), color: status === "bill-requested" ? T.red : T.amber, fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                                      {fmtTimer(start)} ⏱
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: Math.max(7, fSz * 0.52), color: "rgba(255,255,255,0.26)", lineHeight: 1 }}>{cfg.label}</span>
                                  )}
                                  {guests > 0 && <span style={{ fontSize: Math.max(7, fSz * 0.52), color: "rgba(255,255,255,0.44)", lineHeight: 1 }}>{guests} סועדים</span>}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* Legend overlay */}
                <div style={{ position: "absolute", bottom: 10, left: 10, display: "flex", gap: 6, flexWrap: "wrap", zIndex: 50 }}>
                  {([["free",T.green,"פנוי"],["occupied",T.orange,"תפוס"],["bill-requested",T.red,"חשבון"]] as const).map(([, col, lbl]) => (
                    <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 8, background: "rgba(0,0,0,0.75)", border: `1px solid ${col}55`, fontSize: 11, backdropFilter: "blur(4px)" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: col, display: "inline-block" }} />
                      <span style={{ color: T.sub }}>{lbl}</span>
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
            width: 360, flexShrink: 0, borderRight: `1px solid ${T.border}`,
            background: T.panel, display: "flex", flexDirection: "column",
            animation: "slideIn 0.2s ease",
          }}>
            {/* Panel header */}
            <div style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <span style={{ fontWeight: 800, fontSize: 16, color: T.gold }}>שולחן {selTable}</span>
              {selTimerStart && panel === "active" && (
                <span style={{ fontSize: 13, color: selTableStatus === "bill-requested" ? T.red : T.orange, fontWeight: 700 }}>
                  ⏱ {fmtTimer(selTimerStart)}
                </span>
              )}
              {panel === "active" && (
                <span style={{ fontSize: 12, color: T.sub, marginRight: "auto" }}>
                  👤 {tableGuests(selTable, orders)} · ₪{activeTableTotal.toFixed(0)}
                </span>
              )}
              <button onClick={() => { setPanel(null); setSelTable(""); }} style={{ background: "none", border: "none", color: T.muted, fontSize: 18, cursor: "pointer", lineHeight: 1 }}>✕</button>
            </div>

            {/* ── NEW ORDER panel ── */}
            {panel === "new" && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* Guest count */}
                <div style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <span style={{ fontSize: 13, color: T.sub }}>סועדים:</span>
                  <button onClick={() => setGuestCount(g => Math.max(1, g - 1))} style={{ ...btnGhost(T.gold), padding: "4px 12px", fontSize: 16 }}>−</button>
                  <span style={{ fontWeight: 800, fontSize: 16, color: T.text, minWidth: 24, textAlign: "center" }}>{guestCount}</span>
                  <button onClick={() => setGuestCount(g => Math.min(50, g + 1))} style={{ ...btnGhost(T.gold), padding: "4px 12px", fontSize: 16 }}>+</button>
                </div>

                {/* Search */}
                <div style={{ padding: "8px 14px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
                  <input value={menuSearch} onChange={e => { setMenuSearch(e.target.value); setCatIdx(0); }}
                    placeholder="חפש מנה..." style={inp} />
                </div>

                {/* Category tabs */}
                <div style={{ display: "flex", gap: 4, padding: "6px 14px", borderBottom: `1px solid ${T.border}`, overflowX: "auto", flexShrink: 0 }}>
                  {filteredMenu.map((cat, i) => (
                    <button key={cat.id} onClick={() => setCatIdx(i)} style={{
                      padding: "3px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
                      background: catIdx === i ? `${T.gold}22` : "transparent",
                      border: `1px solid ${catIdx === i ? T.gold : T.border}`,
                      color: catIdx === i ? T.gold : T.sub,
                    }}>{cat.name}</button>
                  ))}
                </div>

                {/* Items */}
                <div style={{ flex: 1, overflowY: "auto", padding: "8px 14px" }}>
                  {activeCat?.items.map(item => (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{item.name}</div>
                        {item.description && <div style={{ fontSize: 11, color: T.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.description}</div>}
                        <div style={{ fontSize: 12, color: T.gold, marginTop: 2 }}>₪{item.price.toFixed(0)}</div>
                      </div>
                      <button onClick={() => addToCart(item)} style={{ ...btnGhost(T.gold), padding: "4px 12px", fontSize: 18, marginRight: 8, flexShrink: 0 }}>+</button>
                    </div>
                  ))}
                  {!activeCat?.items.length && <div style={{ color: T.muted, fontSize: 13, textAlign: "center", marginTop: 20 }}>אין פריטים</div>}
                </div>

                {/* Cart */}
                {cart.length > 0 && (
                  <div style={{ borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
                    <div style={{ padding: "6px 14px", maxHeight: 160, overflowY: "auto" }}>
                      {cart.map(c => (
                        <div key={c.itemId + c.course} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0" }}>
                          <button onClick={() => updateCartQty(c.itemId, c.course, -1)} style={{ background: "none", border: `1px solid ${T.border}`, color: T.sub, borderRadius: 4, width: 22, height: 22, cursor: "pointer", fontSize: 14 }}>−</button>
                          <span style={{ fontSize: 12, color: T.text, minWidth: 16, textAlign: "center" }}>{c.qty}</span>
                          <button onClick={() => updateCartQty(c.itemId, c.course, 1)}  style={{ background: "none", border: `1px solid ${T.border}`, color: T.sub, borderRadius: 4, width: 22, height: 22, cursor: "pointer", fontSize: 14 }}>+</button>
                          <span style={{ flex: 1, fontSize: 12, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                          <span style={{ fontSize: 11, color: T.muted }}>{EMOJI[c.course] ?? ""}</span>
                          <span style={{ fontSize: 12, color: T.gold }}>₪{(c.price * c.qty).toFixed(0)}</span>
                          <button onClick={() => removeFromCart(c.itemId, c.course)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 13 }}>✕</button>
                        </div>
                      ))}
                    </div>
                    <div style={{ padding: "8px 14px", borderTop: `1px solid ${T.border}` }}>
                      <input value={orderNote} onChange={e => setOrderNote(e.target.value)} placeholder="הערה להזמנה..." style={{ ...inp, marginBottom: 8 }} />
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 800, color: T.gold }}>₪{cartTotal.toFixed(0)}</span>
                        <button onClick={submitOrder} disabled={submitting} style={{ background: T.green, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: submitting ? 0.6 : 1 }}>
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
                <div style={{ padding: "10px 14px", display: "flex", gap: 6, flexWrap: "wrap", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
                  <button onClick={() => setAddingMore(v => !v)} style={{ ...btnGhost(T.blue), fontSize: 12 }}>
                    {addingMore ? "✕ סגור" : "＋ הוסף מנות"}
                  </button>
                  {selTableStatus !== "bill-requested" && (
                    <button onClick={requestBill} style={{ ...btnGhost(T.orange), fontSize: 12 }}>🧾 ביקש חשבון</button>
                  )}
                  {(selTableStatus === "bill-requested" || selTableStatus === "occupied") && (
                    <button onClick={() => setPayModal(true)} style={{ background: T.green, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>💳 סגור חשבון</button>
                  )}
                  <button onClick={() => { setTransferTo(""); setTransferModal(true); }} style={{ ...btnGhost(T.muted), fontSize: 12 }}>↔ העבר שולחן</button>
                </div>

                {/* Add-more mini menu */}
                {addingMore && (
                  <div style={{ borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
                    <div style={{ padding: "6px 14px" }}>
                      <input value={menuSearch} onChange={e => { setMenuSearch(e.target.value); setCatIdx(0); }} placeholder="חפש מנה..." style={inp} />
                    </div>
                    <div style={{ display: "flex", gap: 4, padding: "4px 14px", overflowX: "auto" }}>
                      {filteredMenu.map((cat, i) => (
                        <button key={cat.id} onClick={() => setCatIdx(i)} style={{ padding: "2px 10px", borderRadius: 20, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap", background: catIdx === i ? `${T.gold}22` : "transparent", border: `1px solid ${catIdx === i ? T.gold : T.border}`, color: catIdx === i ? T.gold : T.sub }}>
                          {cat.name}
                        </button>
                      ))}
                    </div>
                    {/* Course selector */}
                    <div style={{ display: "flex", gap: 4, padding: "4px 14px", borderBottom: `1px solid ${T.border}` }}>
                      {[1,2,3].map(c => (
                        <button key={c} onClick={() => setAddCourse(c)} style={{ padding: "2px 10px", borderRadius: 20, fontSize: 11, cursor: "pointer", background: addCourse === c ? "rgba(167,139,250,0.2)" : "transparent", border: `1px solid ${addCourse === c ? T.purple : T.border}`, color: addCourse === c ? T.purple : T.sub }}>
                          {EMOJI[c]} {COURSE[c]}
                        </button>
                      ))}
                    </div>
                    <div style={{ maxHeight: 150, overflowY: "auto", padding: "4px 14px" }}>
                      {activeCat?.items.map(item => (
                        <div key={item.id} style={{ display: "flex", alignItems: "center", padding: "5px 0", borderBottom: `1px solid ${T.border}` }}>
                          <span style={{ flex: 1, fontSize: 12, color: T.text }}>{item.name}</span>
                          <span style={{ fontSize: 12, color: T.gold, marginLeft: 8 }}>₪{item.price.toFixed(0)}</span>
                          <button onClick={() => addToCart(item, addCourse)} style={{ ...btnGhost(T.gold), padding: "2px 10px", fontSize: 14, marginRight: 6 }}>+</button>
                        </div>
                      ))}
                    </div>
                    {cart.length > 0 && (
                      <div style={{ padding: "6px 14px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: T.sub }}>{cart.reduce((s, c) => s + c.qty, 0)} פריטים · ₪{cartTotal.toFixed(0)}</span>
                        <button onClick={submitOrder} disabled={submitting} style={{ background: T.green, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: submitting ? 0.6 : 1 }}>
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
                      <div key={order.id} style={{ marginBottom: 12, background: "#1a0c0622", border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
                        <div style={{ padding: "6px 10px", background: "rgba(212,160,23,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: T.gold }}>הזמנה #{order.orderNumber ?? "—"}</span>
                          <span style={{ fontSize: 11, color: T.sub }}>₪{order.totalAmount.toFixed(0)}</span>
                        </div>
                        {/* Fire course buttons */}
                        {heldByCourse.size > 0 && (
                          <div style={{ padding: "6px 10px", display: "flex", flexWrap: "wrap", gap: 6, borderTop: `1px solid ${T.border}` }}>
                            {Array.from(heldByCourse.entries()).sort(([a], [b]) => a - b).map(([course, count]) => {
                              const key     = `${order.id}:${course}`;
                              const loading = firingCourse === key;
                              return (
                                <button
                                  key={course}
                                  onClick={() => fireCourse(order.id, course)}
                                  disabled={loading}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 5,
                                    padding: "5px 12px", borderRadius: 8, border: "1px solid #f97316aa",
                                    background: loading ? "#7a3a0088" : "rgba(249,115,22,0.15)",
                                    color: loading ? "#f97316aa" : T.orange,
                                    fontSize: 12, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
                                    transition: "background 150ms",
                                  }}
                                >
                                  <span style={{ fontSize: 14 }}>{loading ? "⏳" : "🔥"}</span>
                                  <span>{loading ? "מצית..." : `הצת ${COURSE[course] ?? `קורס ${course}`}`}</span>
                                  <span style={{ background: "rgba(249,115,22,0.25)", borderRadius: 20, padding: "0 6px", fontSize: 11 }}>{count}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {order.items.map(item => {
                          const statusColors: Record<string, string> = { PENDING: T.muted, PREPARING: T.blue, DONE: T.green, CANCELLED: T.red, HELD: "#7c3aed" };
                          const statusLabels: Record<string, string> = { PENDING: "ממתין", PREPARING: "בהכנה", DONE: "הוכן", CANCELLED: "בוטל", HELD: "ממתין להצתה" };
                          const iHeld = item.heldUntilFired && !item.firedAt;
                          const statusKey = iHeld ? "HELD" : item.itemStatus;
                          const isCancelled = item.itemStatus === "CANCELLED";
                          const canAct = !isCancelled;
                          return (
                            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderTop: `1px solid ${T.border}`, opacity: isCancelled ? 0.4 : 1 }}>
                              <span style={{ fontSize: 11, color: T.muted, flexShrink: 0 }}>×{item.quantity}</span>
                              <span style={{ flex: 1, fontSize: 12, color: item.isComped ? T.purple : T.text, textDecoration: item.isComped ? "line-through" : "none" }}>{item.item.name}</span>
                              {item.isComped && <span style={{ fontSize: 9, color: T.purple, background: "rgba(167,139,250,0.15)", borderRadius: 4, padding: "1px 4px", flexShrink: 0 }}>פיצוי</span>}
                              {item.course > 1 && <span style={{ fontSize: 10, color: T.purple }}>{EMOJI[item.course]}</span>}
                              <span style={{ fontSize: 10, color: statusColors[statusKey] ?? T.muted, whiteSpace: "nowrap" }}>
                                {statusLabels[statusKey] ?? statusKey}
                              </span>
                              {canAct && (
                                <>
                                  <button
                                    onClick={() => openPinModal("comp", order.id, item.id, item.item.name, item.isComped)}
                                    title={item.isComped ? "בטל פיצוי" : "סמן כפיצוי (חינם)"}
                                    style={{ background: item.isComped ? "rgba(167,139,250,0.3)" : "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.4)", borderRadius: 5, padding: "2px 5px", fontSize: 11, cursor: "pointer", color: T.purple, flexShrink: 0 }}
                                  >🎁</button>
                                  <button
                                    onClick={() => openPinModal("cancel", order.id, item.id, item.item.name)}
                                    title="בטל מנה (נדרש PIN מנהל)"
                                    style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 5, padding: "2px 5px", fontSize: 11, cursor: "pointer", color: T.red, flexShrink: 0 }}
                                  >✕</button>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                  {!activeTableOrders.length && <div style={{ color: T.muted, fontSize: 13, textAlign: "center", marginTop: 20 }}>אין הזמנות פעילות</div>}
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
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 24, width: 320, direction: "rtl" }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: T.gold, marginBottom: 16 }}>💳 סגירת שולחן {selTable}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 16 }}>סה"כ: ₪{activeTableTotal.toFixed(0)}</div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: T.sub, marginBottom: 6 }}>טיפ</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[0, 10, 12, 15].map(pct => (
                  <button key={pct} onClick={() => setTip(pct === 0 ? 0 : activeTableTotal * pct / 100)}
                    style={{ flex: 1, padding: "6px 0", borderRadius: 8, fontSize: 12, cursor: "pointer", border: `1px solid ${T.border}`, background: tip === (pct === 0 ? 0 : activeTableTotal * pct / 100) ? `${T.gold}22` : "transparent", color: T.text }}>
                    {pct === 0 ? "ללא" : `${pct}%`}
                  </button>
                ))}
              </div>
              <input type="number" value={tip === 0 ? "" : tip.toFixed(0)} onChange={e => setTip(Number(e.target.value) || 0)}
                placeholder="טיפ ידני (₪)" style={{ ...inp, marginTop: 6 }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: T.sub, marginBottom: 6 }}>אמצעי תשלום</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[["card","אשראי"],["cash","מזומן"],["app","אפליקציה"]].map(([v, l]) => (
                  <button key={v} onClick={() => setPayMethod(v)}
                    style={{ flex: 1, padding: "6px 0", borderRadius: 8, fontSize: 12, cursor: "pointer", border: `1px solid ${T.border}`, background: payMethod === v ? `${T.gold}22` : "transparent", color: T.text }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={closeTable} disabled={closing} style={{ flex: 1, background: T.green, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: closing ? 0.6 : 1 }}>
                {closing ? "סוגר..." : `✓ סגור · ₪${(activeTableTotal + tip).toFixed(0)}`}
              </button>
              <button onClick={() => setPayModal(false)} style={{ ...btnGhost(T.muted), padding: "8px 16px" }}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Transfer modal ── */}
      {transferModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) setTransferModal(false); }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 24, width: 300, direction: "rtl" }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: T.gold, marginBottom: 14 }}>↔ העבר שולחן {selTable} אל</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {activeRoom?.tables.filter(t => String(t.num) !== selTable && tableStatus(String(t.num), orders) === "free")
                .map(t => (
                  <button key={t.id} onClick={() => setTransferTo(String(t.num))}
                    style={{ padding: "6px 12px", borderRadius: 8, fontSize: 13, cursor: "pointer", border: `1px solid ${transferTo === String(t.num) ? T.gold : T.border}`, background: transferTo === String(t.num) ? `${T.gold}22` : "transparent", color: T.text }}>
                    שולחן {t.num}
                  </button>
                ))}
            </div>
            {!activeRoom?.tables.some(t => String(t.num) !== selTable && tableStatus(String(t.num), orders) === "free") && (
              <div style={{ color: T.muted, fontSize: 13, marginBottom: 12 }}>אין שולחנות פנויים להעברה</div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={doTransfer} disabled={!transferTo} style={{ flex: 1, background: T.gold, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: !transferTo ? 0.4 : 1 }}>העבר</button>
              <button onClick={() => setTransferModal(false)} style={{ ...btnGhost(T.muted), padding: "8px 14px" }}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* ── PIN Modal ── */}
      {pinModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) setPinModal(null); }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 28, width: 300, direction: "rtl" }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: T.gold, marginBottom: 4, textAlign: "center" }}>
              {pinModal.type === "cancel" ? "🔐 ביטול מנה" : pinModal.isComped ? "🔐 ביטול פיצוי" : "🔐 סימון פיצוי"}
            </div>
            <div style={{ fontSize: 12, color: T.sub, marginBottom: 16, textAlign: "center" }}>
              {pinModal.itemName}
            </div>
            {pinModal.type === "comp" && !pinModal.isComped && (
              <input
                value={compReason} onChange={e => setCompReason(e.target.value)}
                placeholder="סיבה (אופציונלי — למשל: מנה שרופה)"
                style={{ ...inp, marginBottom: 12 }}
              />
            )}
            {/* PIN dots */}
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 14 }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{ width: 14, height: 14, borderRadius: "50%", background: pinValue.length > i ? T.gold : "transparent", border: `2px solid ${pinValue.length > i ? T.gold : T.border}`, transition: "background 0.15s" }} />
              ))}
            </div>
            {pinError && <div style={{ color: T.red, fontSize: 12, textAlign: "center", marginBottom: 10 }}>קוד שגוי — נסה שוב</div>}
            {/* Numpad */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 10 }}>
              {(["1","2","3","4","5","6","7","8","9","","0","⌫"] as const).map((k, ki) => (
                <button key={ki} onClick={() => {
                  if (!k) return;
                  if (k === "⌫") { setPinValue(v => v.slice(0, -1)); setPinError(false); return; }
                  if (pinValue.length >= 4) return;
                  const next = pinValue + k;
                  setPinValue(next);
                  setPinError(false);
                  if (next.length === 4) setTimeout(() => confirmPinValue(next), 150);
                }}
                style={{ padding: "13px 0", fontSize: 18, fontWeight: 700, borderRadius: 10, cursor: k ? "pointer" : "default", border: `1px solid ${k ? T.border : "transparent"}`, background: k ? T.overlay : "transparent", color: T.text, opacity: k ? 1 : 0 }}>
                  {k}
                </button>
              ))}
            </div>
            <button onClick={() => setPinModal(null)} style={{ ...btnGhost(T.muted), width: "100%", padding: "8px 14px" }}>ביטול</button>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 9999, background: "#1a2e1a", border: "1px solid #22c55e", borderRadius: 10, padding: "10px 20px", color: T.green, fontWeight: 700, fontSize: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.5)", whiteSpace: "nowrap" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
