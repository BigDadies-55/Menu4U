"use client";
import { useState, useEffect, useCallback, useRef } from "react";

/* ── Types ── */
type Restaurant = { id: string; name: string };
type Item       = { id: string; name: string; description?: string | null; price: number; image?: string | null };
type Category   = { id: string; name: string; image?: string | null; items: Item[] };
type OrderItem  = { itemId: string; name: string; price: number; qty: number; note: string };

/* ── Design tokens ── */
const D = {
  bg:     "#0f111a",
  panel:  "#161a1f",
  card:   "#1e2228",
  card2:  "#22272f",
  border: "#2a2f38",
  text:   "#e9ecef",
  sub:    "#868e96",
  muted:  "#495057",
  amber:  "#c9a84c",
  green:  "#4ade80",
  red:    "#f87171",
};

/* ── Small reusable components ── */
function QtyBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      width: 28, height: 28, borderRadius: 7, border: `1px solid ${D.border}`,
      background: "transparent", color: D.text, cursor: "pointer",
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [activeCat, setActiveCat]   = useState("");

  /* ── order ── */
  const [order,       setOrder]       = useState<OrderItem[]>([]);
  const [orderNote,   setOrderNote]   = useState("");
  const [mobileView,  setMobileView]  = useState<"menu" | "order">("menu");

  /* ── submit state ── */
  const [sending,    setSending]    = useState(false);
  const [sentOrder,  setSentOrder]  = useState<{ id: string; orderNumber?: number } | null>(null);
  const [sendError,  setSendError]  = useState("");

  /* ── search ── */
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

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
    setMobileView("menu");
  }

  /* ── submit ── */
  async function handleSend() {
    if (order.length === 0 || !tableNum.trim()) return;
    setSending(true);
    setSendError("");
    try {
      const res = await fetch("/api/admin/orders/waiter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: rid,
          tableNumber:  tableNum.trim(),
          coversCount:  guests,
          notes:        orderNote.trim() || null,
          items: order.map(o => ({
            itemId:   o.itemId,
            quantity: o.qty,
            notes:    o.note || null,
            course:   1,
          })),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setSendError(d.error ?? "שגיאה בשליחה");
      } else {
        const d = await res.json();
        setSentOrder({ id: d.id, orderNumber: d.orderNumber });
      }
    } catch {
      setSendError("שגיאת רשת");
    } finally {
      setSending(false);
    }
  }

  /* ── search items ── */
  const searchLower = search.toLowerCase();
  const visibleCats: Category[] = search
    ? categories.map(c => ({
        ...c,
        items: c.items.filter(i =>
          i.name.toLowerCase().includes(searchLower) ||
          (i.description ?? "").toLowerCase().includes(searchLower)
        ),
      })).filter(c => c.items.length > 0)
    : activeCat
      ? categories.filter(c => c.id === activeCat)
      : categories;

  /* ══ SUCCESS SCREEN ══ */
  if (sentOrder) {
    return (
      <div style={{ minHeight: "100vh", background: D.bg, display: "flex", alignItems: "center", justifyContent: "center", direction: "rtl" }}>
        <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 20, padding: "40px 48px", textAlign: "center", maxWidth: 360 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: D.green, marginBottom: 8 }}>נשלח למטבח!</div>
          <div style={{ color: D.sub, fontSize: 14, marginBottom: 6 }}>שולחן {tableNum}</div>
          {sentOrder.orderNumber && (
            <div style={{ color: D.amber, fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
              הזמנה #{sentOrder.orderNumber}
            </div>
          )}
          <div style={{ color: D.sub, fontSize: 13, marginBottom: 28 }}>
            {itemCount} פריטים · ₪{total}
          </div>
          <button onClick={newOrder} style={{
            padding: "12px 32px", borderRadius: 10, border: "none",
            background: D.amber, color: "#000", fontWeight: 800, fontSize: 15, cursor: "pointer",
          }}>
            + הזמנה חדשה
          </button>
        </div>
      </div>
    );
  }

  /* ══ MAIN RENDER ══ */
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: D.bg, color: D.text, direction: "rtl", fontFamily: "sans-serif" }}>

      {/* ── TOP BAR ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        background: D.panel, borderBottom: `1px solid ${D.border}`,
        padding: "0 16px", height: 56, flexShrink: 0, zIndex: 20,
      }}>

        {/* Title */}
        <span style={{ fontWeight: 800, fontSize: 15, color: D.amber, marginLeft: 4 }}>🍽️ הזמנה</span>

        {/* Restaurant picker */}
        {restaurants.length > 1 && (
          <select value={rid} onChange={e => { setRid(e.target.value); setOrder([]); }}
            style={{ background: D.card, border: `1px solid ${D.border}`, color: D.text, borderRadius: 8, padding: "5px 10px", fontSize: 13 }}>
            {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}

        {/* Table stepper */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: D.card, borderRadius: 10, padding: "4px 10px", border: `1px solid ${D.border}` }}>
          <span style={{ fontSize: 12, color: D.sub }}>שולחן</span>
          <button onClick={() => setTableNum(t => String(Math.max(1, Number(t) - 1)))}
            style={{ width: 24, height: 24, borderRadius: 5, border: "none", background: D.border, color: D.text, cursor: "pointer", fontWeight: 700 }}>−</button>
          <input value={tableNum} onChange={e => setTableNum(e.target.value)}
            style={{ width: 32, background: "transparent", border: "none", color: D.amber, fontWeight: 800, fontSize: 16, textAlign: "center", outline: "none" }} />
          <button onClick={() => setTableNum(t => String(Number(t) + 1))}
            style={{ width: 24, height: 24, borderRadius: 5, border: "none", background: D.border, color: D.text, cursor: "pointer", fontWeight: 700 }}>+</button>
        </div>

        {/* Guests stepper */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, background: D.card, borderRadius: 10, padding: "4px 8px", border: `1px solid ${D.border}` }}>
          <span style={{ fontSize: 13 }}>👤</span>
          <button onClick={() => setGuests(g => Math.max(1, g - 1))}
            style={{ width: 22, height: 22, borderRadius: 5, border: "none", background: D.border, color: D.text, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>−</button>
          <span style={{ minWidth: 16, textAlign: "center", fontSize: 14, fontWeight: 700 }}>{guests}</span>
          <button onClick={() => setGuests(g => g + 1)}
            style={{ width: 22, height: 22, borderRadius: 5, border: "none", background: D.border, color: D.text, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>+</button>
        </div>

        <div style={{ flex: 1 }} />

        {/* Waiter badge */}
        <span style={{ fontSize: 12, color: D.sub, display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 20, padding: "3px 10px" }}>
            👤 {waiterName}
          </span>
        </span>

        {/* Mobile tab switcher */}
        <div style={{ display: "flex", background: D.card, borderRadius: 8, padding: 3, gap: 2 }}>
          {(["menu", "order"] as const).map(v => (
            <button key={v} onClick={() => setMobileView(v)} style={{
              padding: "5px 12px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer",
              background: mobileView === v ? D.amber : "transparent",
              color: mobileView === v ? "#000" : D.sub,
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
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${D.border}`, background: D.panel, flexShrink: 0 }}>
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍 חיפוש מנה..."
              style={{
                width: "100%", boxSizing: "border-box",
                background: D.card, border: `1px solid ${D.border}`,
                color: D.text, borderRadius: 8, padding: "7px 12px", fontSize: 13,
              }}
            />
          </div>

          {/* Category tabs — hidden when searching */}
          {!search && (
            <div style={{
              display: "flex", gap: 6, padding: "8px 14px",
              overflowX: "auto", flexShrink: 0,
              borderBottom: `1px solid ${D.border}`, background: D.panel,
            }}>
              {categories.map(c => (
                <button key={c.id} onClick={() => setActiveCat(c.id)} style={{
                  padding: "6px 14px", borderRadius: 20, border: "none",
                  fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer",
                  flexShrink: 0,
                  background: activeCat === c.id ? D.amber : D.card,
                  color: activeCat === c.id ? "#000" : D.sub,
                }}>{c.name}</button>
              ))}
            </div>
          )}

          {/* Items grid */}
          <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
            {menuLoading ? (
              <div style={{ padding: 60, textAlign: "center", color: D.sub }}>טוען תפריט...</div>
            ) : visibleCats.length === 0 ? (
              <div style={{ padding: 60, textAlign: "center", color: D.sub }}>לא נמצאו פריטים</div>
            ) : (
              visibleCats.map(cat => (
                <div key={cat.id}>
                  {search && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: D.sub, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8, marginTop: 4 }}>
                      {cat.name}
                    </div>
                  )}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                    gap: 10, marginBottom: 16,
                  }}>
                    {cat.items.map(item => {
                      const inOrder = order.find(o => o.itemId === item.id);
                      return (
                        <div key={item.id} onClick={() => addItem(item)} style={{
                          background: inOrder ? "rgba(201,168,76,0.09)" : D.card,
                          border: `1px solid ${inOrder ? D.amber : D.border}`,
                          borderRadius: 12, padding: "12px 10px",
                          cursor: "pointer", position: "relative",
                          transition: "border-color 150ms, background 150ms",
                          userSelect: "none",
                        }}>
                          {inOrder && (
                            <div style={{
                              position: "absolute", top: 7, left: 7,
                              background: D.amber, color: "#000",
                              borderRadius: 20, minWidth: 20, height: 20, padding: "0 5px",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 11, fontWeight: 800,
                            }}>×{inOrder.qty}</div>
                          )}
                          {item.image && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.image} alt={item.name} style={{ width: "100%", height: 70, objectFit: "cover", borderRadius: 8, marginBottom: 8 }} />
                          )}
                          <div style={{ fontSize: 13, fontWeight: 700, color: D.text, marginBottom: 3, lineHeight: 1.3 }}>{item.name}</div>
                          {item.description && (
                            <div style={{ fontSize: 11, color: D.sub, marginBottom: 6, lineHeight: 1.4,
                              overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as React.CSSProperties}>
                              {item.description}
                            </div>
                          )}
                          <div style={{ fontSize: 14, fontWeight: 800, color: D.amber }}>₪{item.price}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ══ RIGHT: ORDER PANEL ══ */}
        <div style={{
          width: 300, background: D.panel, borderRight: `1px solid ${D.border}`,
          flexDirection: "column", flexShrink: 0,
          display: mobileView === "menu" ? "none" : "flex",
        } as React.CSSProperties} className="waiter-order-panel">

          {/* Order header */}
          <div style={{
            padding: "12px 16px", borderBottom: `1px solid ${D.border}`,
            display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
          }}>
            <span style={{ fontWeight: 800, fontSize: 14 }}>🛒 שולחן {tableNum}</span>
            {order.length > 0 && (
              <button onClick={() => setOrder([])} style={{
                fontSize: 11, color: D.red, background: "transparent", border: "none", cursor: "pointer",
              }}>נקה הכל</button>
            )}
          </div>

          {/* Order items */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {order.length === 0 ? (
              <div style={{ padding: "48px 20px", textAlign: "center", color: D.sub }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🛒</div>
                <div style={{ fontSize: 13 }}>לחץ על פריט מהתפריט</div>
              </div>
            ) : (
              order.map(item => (
                <div key={item.itemId} style={{ padding: "10px 14px", borderBottom: `1px solid ${D.border}` }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: D.text, lineHeight: 1.3 }}>{item.name}</div>
                      <div style={{ fontSize: 12, color: D.amber, fontWeight: 700, marginTop: 2 }}>
                        ₪{(item.price * item.qty).toFixed(0)}
                        <span style={{ color: D.muted, fontWeight: 400 }}> (₪{item.price} × {item.qty})</span>
                      </div>
                    </div>
                    {/* Qty controls */}
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      <QtyBtn onClick={() => changeQty(item.itemId, -1)}>−</QtyBtn>
                      <span style={{ fontSize: 14, fontWeight: 700, minWidth: 20, textAlign: "center" }}>{item.qty}</span>
                      <QtyBtn onClick={() => changeQty(item.itemId, +1)}>+</QtyBtn>
                    </div>
                  </div>
                  {/* Per-item note */}
                  <input
                    value={item.note}
                    onChange={e => setItemNote(item.itemId, e.target.value)}
                    placeholder="הערה (ללא בצל, אלרגיה...)"
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: D.card2, border: `1px solid ${D.border}`, borderRadius: 6,
                      color: D.sub, fontSize: 11, padding: "4px 8px",
                    }}
                  />
                </div>
              ))
            )}
          </div>

          {/* Order footer */}
          <div style={{ padding: "12px 14px", borderTop: `1px solid ${D.border}`, background: D.card, flexShrink: 0 }}>
            {/* General note */}
            <textarea
              value={orderNote}
              onChange={e => setOrderNote(e.target.value)}
              placeholder="הערה לשולחן..."
              rows={2}
              style={{
                width: "100%", boxSizing: "border-box",
                background: D.panel, border: `1px solid ${D.border}`, borderRadius: 8,
                color: D.text, fontSize: 12, padding: "6px 10px",
                resize: "none", fontFamily: "inherit", marginBottom: 10,
              }}
            />

            {/* Summary row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: D.sub }}>{itemCount} פריטים · {guests} סועדים</span>
              <span style={{ fontSize: 18, fontWeight: 800 }}>₪{total}</span>
            </div>

            {/* Error */}
            {sendError && (
              <div style={{ color: D.red, fontSize: 12, marginBottom: 8, textAlign: "center" }}>{sendError}</div>
            )}

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={sending || order.length === 0 || !tableNum.trim()}
              style={{
                width: "100%", padding: "12px 0", borderRadius: 10, border: "none",
                background: order.length > 0 && tableNum.trim() ? D.amber : D.border,
                color: order.length > 0 && tableNum.trim() ? "#000" : D.muted,
                fontWeight: 800, fontSize: 15, cursor: order.length > 0 ? "pointer" : "not-allowed",
                opacity: sending ? 0.7 : 1, transition: "opacity 200ms",
              }}>
              {sending ? "שולח..." : "📤 שלח למטבח"}
            </button>
          </div>
        </div>

        {/* Desktop: always show order panel */}
        <style>{`
          @media (min-width: 700px) {
            .waiter-order-panel { display: flex !important; }
          }
        `}</style>
      </div>
    </div>
  );
}
