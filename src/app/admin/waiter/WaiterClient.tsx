"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { T, btn, btnGhost, inp, badge } from "@/lib/ui";

/* ── Types ── */
type Restaurant = { id: string; name: string };
type Item       = { id: string; name: string; description?: string | null; price: number; image?: string | null };
type Category   = { id: string; name: string; image?: string | null; items: Item[] };
type OrderItem  = { itemId: string; name: string; price: number; qty: number; note: string };

/* ── Small reusable components ── */
function QtyBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      width: 28, height: 28, borderRadius: T.rMd, border: `1px solid ${T.border}`,
      background: "transparent", color: T.text, cursor: "pointer",
      fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    }}>{children}</button>
  );
}

/* ══════════════════════════════════════════════════════════ */
export default function WaiterClient({ restaurants, waiterName }: {
  restaurants: Restaurant[];
  waiterName: string;
}) {
  /* ── restaurant / table / guests ── */
  const [rid,      setRid]      = useState(restaurants[0]?.id ?? "");
  const [tableNum, setTableNum] = useState("1");
  const [guests,   setGuests]   = useState(2);

  /* ── menu data ── */
  const [categories,  setCategories]  = useState<Category[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [activeCat,   setActiveCat]   = useState("");

  /* ── order ── */
  const [order,      setOrder]      = useState<OrderItem[]>([]);
  const [orderNote,  setOrderNote]  = useState("");
  const [mobileView, setMobileView] = useState<"menu" | "order">("menu");

  /* ── submit state ── */
  const [sending,       setSending]       = useState(false);
  const [sentOrder,     setSentOrder]     = useState<{ id: string; orderNumber?: number } | null>(null);
  const [sendError,     setSendError]     = useState("");
  const [queuedOffline, setQueuedOffline] = useState(false);

  /* ── offline queue ── */
  const { isOnline, pendingCount, isSyncing, enqueue } = useOfflineQueue(results => {
    const ok = results.filter(r => r.ok);
    if (ok.length > 0) console.info(`[offline] synced ${ok.length} order(s)`);
  });

  /* ── search ── */
  const [search,  setSearch]  = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  /* ── register service worker ── */
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  /* ── fetch menu ── */
  const fetchMenu = useCallback(async () => {
    if (!rid) return;
    setMenuLoading(true);
    setCategories([]);
    setActiveCat("");
    setSearch("");
    const res = await fetch(`/api/admin/waiter/menu?restaurantId=${rid}`);
    if (res.ok) {
      const data = await res.json();
      setCategories(data.categories ?? []);
      setActiveCat(data.categories?.[0]?.id ?? "");
    }
    setMenuLoading(false);
  }, [rid]);

  useEffect(() => { fetchMenu(); }, [fetchMenu]);

  /* ── helpers ── */
  const itemCount = order.reduce((s, i) => s + i.qty, 0);
  const total     = order.reduce((s, i) => s + i.price * i.qty, 0);

  function addItem(item: Item) {
    setOrder(prev => {
      const ex = prev.find(o => o.itemId === item.id);
      if (ex) return prev.map(o => o.itemId === item.id ? { ...o, qty: o.qty + 1 } : o);
      return [...prev, { itemId: item.id, name: item.name, price: item.price, qty: 1, note: "" }];
    });
  }

  function changeQty(itemId: string, delta: number) {
    setOrder(prev =>
      prev.map(o => o.itemId === itemId ? { ...o, qty: o.qty + delta } : o)
          .filter(o => o.qty > 0)
    );
  }

  function setItemNote(itemId: string, note: string) {
    setOrder(prev => prev.map(o => o.itemId === itemId ? { ...o, note } : o));
  }

  function newOrder() {
    setOrder([]);
    setOrderNote("");
    setSentOrder(null);
    setSendError("");
    setQueuedOffline(false);
    setMobileView("menu");
  }

  /* ── submit ── */
  async function handleSend() {
    if (order.length === 0 || !tableNum.trim()) return;
    setSendError("");

    const payload = {
      restaurantId: rid,
      tableNumber:  tableNum.trim(),
      coversCount:  guests,
      notes:        orderNote.trim() || null,
      items: order.map(o => ({ itemId: o.itemId, quantity: o.qty, notes: o.note || null, course: 1 })),
    };

    if (!isOnline) { enqueue(payload); setQueuedOffline(true); return; }

    setSending(true);
    try {
      const res = await fetch("/api/admin/orders/waiter", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!res.ok) { const d = await res.json(); setSendError(d.error ?? "שגיאה בשליחה"); }
      else         { const d = await res.json(); setSentOrder({ id: d.id, orderNumber: d.orderNumber }); }
    } catch {
      enqueue(payload); setQueuedOffline(true);
    } finally {
      setSending(false);
    }
  }

  /* ── search items ── */
  const searchLower = search.toLowerCase();
  const visibleCats: Category[] = search
    ? categories.map(c => ({ ...c, items: c.items.filter(i =>
        i.name.toLowerCase().includes(searchLower) ||
        (i.description ?? "").toLowerCase().includes(searchLower)
      )})).filter(c => c.items.length > 0)
    : activeCat ? categories.filter(c => c.id === activeCat) : categories;

  /* ══ QUEUED OFFLINE SCREEN ══ */
  if (queuedOffline) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", direction: "rtl" }}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.rXl, padding: "40px 48px", textAlign: "center", maxWidth: 360 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>📶</div>
          <div style={{ fontSize: T.fxl, fontWeight: 800, color: T.yellow, marginBottom: 8 }}>נשמר בתור</div>
          <div style={{ color: T.sub, fontSize: T.fmd, marginBottom: 6 }}>אין חיבור לרשת כרגע</div>
          <div style={{ color: T.sub, fontSize: T.fmd, marginBottom: 24 }}>ההזמנה תישלח אוטומטית כשהחיבור יחזור</div>
          <div style={{ ...badge(T.yellow), display: "block", marginBottom: 24, fontSize: T.fmd, padding: "6px 16px" }}>
            {pendingCount} הזמנה{pendingCount !== 1 ? "ות" : ""} ממתינ{pendingCount !== 1 ? "ות" : "ת"} לשליחה
          </div>
          <button onClick={newOrder} style={{ ...btn("primary", "lg"), width: "100%", justifyContent: "center" }}>
            + הזמנה חדשה
          </button>
        </div>
      </div>
    );
  }

  /* ══ SUCCESS SCREEN ══ */
  if (sentOrder) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", direction: "rtl" }}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.rXl, padding: "40px 48px", textAlign: "center", maxWidth: 360 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: T.fxl, fontWeight: 800, color: T.green, marginBottom: 8 }}>נשלח למטבח!</div>
          <div style={{ color: T.sub, fontSize: T.fmd, marginBottom: 6 }}>שולחן {tableNum}</div>
          {sentOrder.orderNumber && (
            <div style={{ color: T.gold, fontSize: T.fxl, fontWeight: 700, marginBottom: 6 }}>
              הזמנה #{sentOrder.orderNumber}
            </div>
          )}
          <div style={{ color: T.sub, fontSize: T.fmd, marginBottom: 28 }}>{itemCount} פריטים · ₪{total}</div>
          <button onClick={newOrder} style={{ ...btn("primary", "lg"), width: "100%", justifyContent: "center" }}>
            + הזמנה חדשה
          </button>
        </div>
      </div>
    );
  }

  /* ══ MAIN RENDER ══ */
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: T.bg, color: T.text, direction: "rtl", fontFamily: "sans-serif" }}>

      {/* ── TOP BAR ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        background: T.surface, borderBottom: `1px solid ${T.border}`,
        padding: "0 16px", height: 56, flexShrink: 0, zIndex: 20,
      }}>
        <span style={{ fontWeight: 800, fontSize: T.flg, color: T.gold, marginLeft: 4 }}>🍽️ הזמנה</span>

        {/* Restaurant picker */}
        {restaurants.length > 1 && (
          <select value={rid} onChange={e => { setRid(e.target.value); setOrder([]); }}
            style={{ background: T.raised, border: `1px solid ${T.border}`, color: T.text, borderRadius: T.rMd, padding: "5px 10px", fontSize: T.fmd }}>
            {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}

        {/* Table stepper */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: T.raised, borderRadius: T.rMd, padding: "4px 10px", border: `1px solid ${T.border}` }}>
          <span style={{ fontSize: T.fsm, color: T.sub }}>שולחן</span>
          <button onClick={() => setTableNum(t => String(Math.max(1, Number(t) - 1)))}
            style={{ width: 24, height: 24, borderRadius: T.rSm, border: "none", background: T.border, color: T.text, cursor: "pointer", fontWeight: 700 }}>−</button>
          <input value={tableNum} onChange={e => setTableNum(e.target.value)}
            style={{ width: 32, background: "transparent", border: "none", color: T.gold, fontWeight: 800, fontSize: T.flg, textAlign: "center", outline: "none" }} />
          <button onClick={() => setTableNum(t => String(Number(t) + 1))}
            style={{ width: 24, height: 24, borderRadius: T.rSm, border: "none", background: T.border, color: T.text, cursor: "pointer", fontWeight: 700 }}>+</button>
        </div>

        {/* Guests stepper */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, background: T.raised, borderRadius: T.rMd, padding: "4px 8px", border: `1px solid ${T.border}` }}>
          <span style={{ fontSize: T.fmd }}>👤</span>
          <button onClick={() => setGuests(g => Math.max(1, g - 1))}
            style={{ width: 22, height: 22, borderRadius: T.rSm, border: "none", background: T.border, color: T.text, cursor: "pointer", fontSize: T.fsm, fontWeight: 700 }}>−</button>
          <span style={{ minWidth: 16, textAlign: "center", fontSize: T.fmd, fontWeight: 700 }}>{guests}</span>
          <button onClick={() => setGuests(g => g + 1)}
            style={{ width: 22, height: 22, borderRadius: T.rSm, border: "none", background: T.border, color: T.text, cursor: "pointer", fontSize: T.fsm, fontWeight: 700 }}>+</button>
        </div>

        <div style={{ flex: 1 }} />

        {/* Offline / pending indicator */}
        {(!isOnline || pendingCount > 0) && (
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            background: isOnline ? T.yellowSub : T.redSub,
            border: `1px solid ${isOnline ? T.yellow + "55" : T.red + "55"}`,
            borderRadius: T.rFull, padding: "3px 10px", fontSize: T.fsm,
            color: isOnline ? T.yellow : T.red,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: isOnline ? T.yellow : T.red, flexShrink: 0 }} />
            {isOnline ? (isSyncing ? `שולח ${pendingCount}...` : `${pendingCount} ממתינות`) : "אופליין"}
          </div>
        )}

        {/* Waiter badge */}
        <span style={{ ...badge(T.gold), fontSize: T.fsm }}>👤 {waiterName}</span>

        {/* Mobile tab switcher */}
        <div style={{ display: "flex", background: T.raised, borderRadius: T.rMd, padding: 3, gap: 2 }}>
          {(["menu", "order"] as const).map(v => (
            <button key={v} onClick={() => setMobileView(v)} style={{
              padding: "5px 12px", borderRadius: T.rSm, border: "none", fontSize: T.fsm, fontWeight: 700, cursor: "pointer",
              background: mobileView === v ? T.gold : "transparent",
              color: mobileView === v ? "#000" : T.sub,
            }}>
              {v === "menu" ? "📋 תפריט" : `🛒${itemCount > 0 ? ` (${itemCount})` : ""}`}
            </button>
          ))}
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ══ LEFT: MENU PANEL ══ */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column", overflow: "hidden",
          ...(mobileView === "order" ? { display: "none" } : {}),
        } as React.CSSProperties}>

          {/* Search bar */}
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`, background: T.surface, flexShrink: 0 }}>
            <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 חיפוש מנה..."
              style={{ ...inp, boxSizing: "border-box" }} />
          </div>

          {/* Category tabs */}
          {!search && (
            <div style={{ display: "flex", gap: 6, padding: "8px 14px", overflowX: "auto", flexShrink: 0, borderBottom: `1px solid ${T.border}`, background: T.surface }}>
              {categories.map(c => (
                <button key={c.id} onClick={() => setActiveCat(c.id)}
                  style={{ padding: "6px 14px", borderRadius: T.rFull, border: "none", fontSize: T.fmd, fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer", flexShrink: 0,
                    background: activeCat === c.id ? T.gold : T.raised,
                    color:      activeCat === c.id ? "#000" : T.sub,
                  }}>{c.name}</button>
              ))}
            </div>
          )}

          {/* Items grid */}
          <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
            {menuLoading ? (
              <div style={{ padding: 60, textAlign: "center", color: T.sub }}>טוען תפריט...</div>
            ) : visibleCats.length === 0 ? (
              <div style={{ padding: 60, textAlign: "center", color: T.sub }}>לא נמצאו פריטים</div>
            ) : visibleCats.map(cat => (
              <div key={cat.id}>
                {search && (
                  <div style={{ fontSize: T.fxs, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8, marginTop: 4 }}>
                    {cat.name}
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginBottom: 16 }}>
                  {cat.items.map(item => {
                    const inOrder = order.find(o => o.itemId === item.id);
                    return (
                      <div key={item.id} onClick={() => addItem(item)} style={{
                        background: inOrder ? T.goldSub : T.raised,
                        border: `1px solid ${inOrder ? T.gold : T.border}`,
                        borderRadius: T.rLg, padding: "12px 10px",
                        cursor: "pointer", position: "relative",
                        transition: "border-color 150ms, background 150ms",
                        userSelect: "none",
                      }}>
                        {inOrder && (
                          <div style={{ position: "absolute", top: 7, left: 7, background: T.gold, color: "#fff",
                            borderRadius: T.rFull, minWidth: 20, height: 20, padding: "0 5px",
                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: T.fxs, fontWeight: 800 }}>
                            ×{inOrder.qty}
                          </div>
                        )}
                        {item.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.image} alt={item.name} style={{ width: "100%", height: 70, objectFit: "cover", borderRadius: T.rMd, marginBottom: 8 }} />
                        )}
                        <div style={{ fontSize: T.fmd, fontWeight: 700, color: T.text, marginBottom: 3, lineHeight: 1.3 }}>{item.name}</div>
                        {item.description && (
                          <div style={{ fontSize: T.fsm, color: T.sub, marginBottom: 6, lineHeight: 1.4,
                            overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as React.CSSProperties}>
                            {item.description}
                          </div>
                        )}
                        <div style={{ fontSize: T.fmd, fontWeight: 800, color: T.gold }}>₪{item.price}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ══ RIGHT: ORDER PANEL ══ */}
        <div style={{
          width: 300, background: T.surface, borderRight: `1px solid ${T.border}`,
          flexDirection: "column", flexShrink: 0,
          display: mobileView === "menu" ? "none" : "flex",
        } as React.CSSProperties} className="waiter-order-panel">

          {/* Order header */}
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <span style={{ fontWeight: 800, fontSize: T.fmd }}>🛒 שולחן {tableNum}</span>
            {order.length > 0 && (
              <button onClick={() => setOrder([])} style={{ fontSize: T.fsm, color: T.red, background: "transparent", border: "none", cursor: "pointer" }}>
                נקה הכל
              </button>
            )}
          </div>

          {/* Order items */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {order.length === 0 ? (
              <div style={{ padding: "48px 20px", textAlign: "center", color: T.sub }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🛒</div>
                <div style={{ fontSize: T.fmd }}>לחץ על פריט מהתפריט</div>
              </div>
            ) : order.map(item => (
              <div key={item.itemId} style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}` }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: T.fmd, fontWeight: 600, color: T.text, lineHeight: 1.3 }}>{item.name}</div>
                    <div style={{ fontSize: T.fsm, color: T.gold, fontWeight: 700, marginTop: 2 }}>
                      ₪{(item.price * item.qty).toFixed(0)}
                      <span style={{ color: T.muted, fontWeight: 400 }}> (₪{item.price} × {item.qty})</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    <QtyBtn onClick={() => changeQty(item.itemId, -1)}>−</QtyBtn>
                    <span style={{ fontSize: T.fmd, fontWeight: 700, minWidth: 20, textAlign: "center" }}>{item.qty}</span>
                    <QtyBtn onClick={() => changeQty(item.itemId, +1)}>+</QtyBtn>
                  </div>
                </div>
                <input value={item.note} onChange={e => setItemNote(item.itemId, e.target.value)}
                  placeholder="הערה (ללא בצל, אלרגיה...)"
                  style={{ ...inp, boxSizing: "border-box", fontSize: T.fxs, padding: "4px 8px" }} />
              </div>
            ))}
          </div>

          {/* Order footer */}
          <div style={{ padding: "12px 14px", borderTop: `1px solid ${T.border}`, background: T.raised, flexShrink: 0 }}>
            <textarea value={orderNote} onChange={e => setOrderNote(e.target.value)}
              placeholder="הערה לשולחן..." rows={2}
              style={{ ...inp, boxSizing: "border-box", fontSize: T.fsm, padding: "6px 10px", resize: "none", marginBottom: 10 } as React.CSSProperties} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: T.fsm, color: T.sub }}>{itemCount} פריטים · {guests} סועדים</span>
              <span style={{ fontSize: T.fxl, fontWeight: 800 }}>₪{total}</span>
            </div>

            {sendError && (
              <div style={{ color: T.red, fontSize: T.fsm, marginBottom: 8, textAlign: "center" }}>{sendError}</div>
            )}

            <button onClick={handleSend} disabled={sending || order.length === 0 || !tableNum.trim()}
              style={{
                width: "100%", padding: "12px 0", borderRadius: T.rMd, border: "none", justifyContent: "center",
                background: order.length > 0 && tableNum.trim() ? (isOnline ? T.gold : "#854d0e") : T.border,
                color:      order.length > 0 && tableNum.trim() ? (isOnline ? "#000" : "#fef08a") : T.muted,
                fontWeight: 800, fontSize: T.flg, cursor: order.length > 0 ? "pointer" : "not-allowed",
                opacity: sending ? 0.7 : 1, transition: "opacity 200ms",
              }}>
              {sending ? "שולח..." : isOnline ? "📤 שלח למטבח" : "📥 שמור בתור (אופליין)"}
            </button>
          </div>
        </div>

        {/* Desktop: always show order panel */}
        <style>{`
          @media (min-width: 700px) { .waiter-order-panel { display: flex !important; } }
        `}</style>
      </div>
    </div>
  );
}
