"use client";
import { useState } from "react";

/* ── Sample data (replace with real API data in production) ── */
const CATEGORIES = [
  { id: "starters", label: "🥗 ראשונות" },
  { id: "mains",    label: "🍗 עיקריות" },
  { id: "sides",    label: "🥔 תוספות"  },
  { id: "drinks",   label: "🥤 שתייה"   },
  { id: "desserts", label: "🍰 קינוחים" },
];

const ITEMS: Record<string, { id: string; name: string; price: number; desc?: string }[]> = {
  starters: [
    { id: "s1", name: "סלט ירקות",       price: 38, desc: "עגבניה, מלפפון, בצל סגול" },
    { id: "s2", name: "חומוס ביתי",      price: 34, desc: "עם שמן זית ופלפל" },
    { id: "s3", name: "פלאפל",           price: 32, desc: "5 יחידות + טחינה" },
    { id: "s4", name: "ברוסקטה",         price: 42, desc: "עגבניה, בזיליקום, גבינה" },
    { id: "s5", name: "מרק ירקות",       price: 36, desc: "עונתי" },
    { id: "s6", name: "כבד קצוץ",        price: 45, desc: "עם בצל מטוגן" },
  ],
  mains: [
    { id: "m1", name: "שניצל עוף",       price: 72, desc: "עם תוספת לבחירה" },
    { id: "m2", name: "סטייק אנטריקוט",  price: 138, desc: "300 גרם, בינוני" },
    { id: "m3", name: "פרגיות על האש",   price: 84, desc: "עם רוטב חריף" },
    { id: "m4", name: "פילה סלמון",      price: 96, desc: "עם ירקות מאודים" },
    { id: "m5", name: "פסטה קרבונרה",    price: 68, desc: "שמנת, בייקון, פטריות" },
    { id: "m6", name: "המבורגר",         price: 78, desc: "200 גרם, עם לחמנייה" },
  ],
  sides: [
    { id: "si1", name: "צ'יפס",          price: 22 },
    { id: "si2", name: "אורז",           price: 18 },
    { id: "si3", name: "פירה תפוחי אדמה", price: 22 },
    { id: "si4", name: "ירקות מאודים",   price: 24 },
  ],
  drinks: [
    { id: "d1", name: "קולה",            price: 14 },
    { id: "d2", name: "מים מינרלים",     price: 10 },
    { id: "d3", name: "מיץ תפוזים",      price: 18 },
    { id: "d4", name: "בירה שטיינברגר",  price: 28 },
    { id: "d5", name: "יין אדום",        price: 42, desc: "כוס" },
    { id: "d6", name: "קפה שחור",        price: 14 },
  ],
  desserts: [
    { id: "de1", name: "פונדו שוקולד",   price: 44 },
    { id: "de2", name: "גלידה",          price: 32, desc: "2 כדורים לבחירה" },
    { id: "de3", name: "עוגת גבינה",     price: 38 },
  ],
};

type OrderItem = { id: string; name: string; price: number; qty: number; note: string };

const D = {
  bg: "#0f111a", panel: "#161a1f", card: "#1e2228",
  border: "#2a2f38", text: "#e9ecef", sub: "#868e96",
  amber: "#c9a84c", green: "#4ade80", red: "#f87171",
  blue: "#60a5fa",
};

export default function WaiterPreviewPage() {
  const [activeCat, setActiveCat]   = useState("starters");
  const [order, setOrder]           = useState<OrderItem[]>([]);
  const [tableNum, setTableNum]     = useState("4");
  const [guests, setGuests]         = useState(2);
  const [note, setNote]             = useState("");
  const [view, setView]             = useState<"menu" | "order">("menu");
  const [sentPulse, setSentPulse]   = useState(false);

  const itemCount = order.reduce((s, i) => s + i.qty, 0);
  const total     = order.reduce((s, i) => s + i.price * i.qty, 0);

  function addItem(item: { id: string; name: string; price: number }) {
    setOrder(prev => {
      const existing = prev.find(o => o.id === item.id);
      if (existing) return prev.map(o => o.id === item.id ? { ...o, qty: o.qty + 1 } : o);
      return [...prev, { ...item, qty: 1, note: "" }];
    });
  }

  function changeQty(id: string, delta: number) {
    setOrder(prev => prev
      .map(o => o.id === id ? { ...o, qty: o.qty + delta } : o)
      .filter(o => o.qty > 0));
  }

  function sendToKitchen() {
    if (order.length === 0) return;
    setSentPulse(true);
    setTimeout(() => { setSentPulse(false); setOrder([]); setNote(""); }, 1800);
  }

  const items = ITEMS[activeCat] ?? [];

  return (
    <div style={{ minHeight: "100vh", background: D.bg, color: D.text, direction: "rtl", fontFamily: "sans-serif" }}>

      {/* ── TOP BAR ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        background: D.panel, borderBottom: `1px solid ${D.border}`,
        padding: "0 20px", height: 56, position: "sticky", top: 0, zIndex: 30,
        flexWrap: "wrap",
      }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: D.amber }}>🍽️ קבלת הזמנה</div>

        {/* Table selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: D.card, borderRadius: 10, padding: "4px 10px", border: `1px solid ${D.border}` }}>
          <span style={{ fontSize: 12, color: D.sub }}>שולחן</span>
          <button onClick={() => setTableNum(t => String(Math.max(1, Number(t) - 1)))}
            style={{ width: 26, height: 26, borderRadius: 6, border: "none", background: D.border, color: D.text, cursor: "pointer", fontWeight: 700 }}>−</button>
          <span style={{ fontSize: 18, fontWeight: 800, minWidth: 28, textAlign: "center", color: D.amber }}>{tableNum}</span>
          <button onClick={() => setTableNum(t => String(Number(t) + 1))}
            style={{ width: 26, height: 26, borderRadius: 6, border: "none", background: D.border, color: D.text, cursor: "pointer", fontWeight: 700 }}>+</button>
        </div>

        {/* Guest count */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: D.card, borderRadius: 10, padding: "4px 10px", border: `1px solid ${D.border}` }}>
          <span style={{ fontSize: 13 }}>👤</span>
          <button onClick={() => setGuests(g => Math.max(1, g - 1))}
            style={{ width: 22, height: 22, borderRadius: 5, border: "none", background: D.border, color: D.text, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>−</button>
          <span style={{ fontSize: 14, fontWeight: 700, minWidth: 16, textAlign: "center" }}>{guests}</span>
          <button onClick={() => setGuests(g => g + 1)}
            style={{ width: 22, height: 22, borderRadius: 5, border: "none", background: D.border, color: D.text, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>+</button>
        </div>

        <div style={{ flex: 1 }} />

        {/* Mobile tab toggle */}
        <div style={{ display: "flex", background: D.card, borderRadius: 8, padding: 3, gap: 2 }}>
          {([["menu", "📋 תפריט"], ["order", `🛒 הזמנה${itemCount > 0 ? ` (${itemCount})` : ""}`]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setView(k)} style={{
              padding: "5px 14px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer",
              background: view === k ? D.amber : "transparent",
              color: view === k ? "#000" : D.sub,
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* ── MAIN ── */}
      <div style={{ display: "flex", height: "calc(100vh - 56px)" }}>

        {/* ── LEFT: MENU ── */}
        <div style={{
          flex: view === "order" ? "none" : 1,
          display: view === "order" ? "none" : "flex",
          flexDirection: "column", overflow: "hidden",
        } as React.CSSProperties}>

          {/* Category tabs */}
          <div style={{
            display: "flex", gap: 6, padding: "10px 16px",
            overflowX: "auto", borderBottom: `1px solid ${D.border}`,
            background: D.panel, flexShrink: 0,
          }}>
            {CATEGORIES.map(c => (
              <button key={c.id} onClick={() => setActiveCat(c.id)} style={{
                padding: "7px 16px", borderRadius: 20, border: "none", fontSize: 13, fontWeight: 600,
                whiteSpace: "nowrap", cursor: "pointer",
                background: activeCat === c.id ? D.amber : D.card,
                color: activeCat === c.id ? "#000" : D.sub,
                flexShrink: 0,
              }}>{c.label}</button>
            ))}
          </div>

          {/* Items grid */}
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
              gap: 12,
            }}>
              {items.map(item => {
                const inOrder = order.find(o => o.id === item.id);
                return (
                  <div key={item.id} onClick={() => addItem(item)}
                    style={{
                      background: inOrder ? `rgba(201,168,76,0.1)` : D.card,
                      border: `1px solid ${inOrder ? D.amber : D.border}`,
                      borderRadius: 12, padding: "14px 12px", cursor: "pointer",
                      transition: "all 150ms", position: "relative",
                      userSelect: "none",
                    }}>
                    {inOrder && (
                      <div style={{
                        position: "absolute", top: 8, left: 8,
                        background: D.amber, color: "#000",
                        borderRadius: 20, minWidth: 22, height: 22,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 800, padding: "0 6px",
                      }}>×{inOrder.qty}</div>
                    )}
                    <div style={{ fontSize: 14, fontWeight: 700, color: D.text, marginBottom: 4, lineHeight: 1.3 }}>{item.name}</div>
                    {item.desc && <div style={{ fontSize: 11, color: D.sub, marginBottom: 6, lineHeight: 1.4 }}>{item.desc}</div>}
                    <div style={{ fontSize: 15, fontWeight: 800, color: D.amber }}>₪{item.price}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── RIGHT: ORDER PANEL ── */}
        <div style={{
          width: 320, background: D.panel, borderRight: `1px solid ${D.border}`,
          flexDirection: "column",
          display: view === "menu" ? "none" : "flex",
        } as React.CSSProperties}
          className="order-panel"
        >
          {/* Order header */}
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${D.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>
              🛒 הזמנה — שולחן {tableNum}
            </div>
            {order.length > 0 && (
              <button onClick={() => setOrder([])}
                style={{ fontSize: 11, color: D.red, background: "transparent", border: "none", cursor: "pointer", padding: "2px 8px" }}>
                נקה
              </button>
            )}
          </div>

          {/* Order items */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
            {order.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: D.sub, fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🛒</div>
                הוסף פריטים מהתפריט
              </div>
            ) : (
              order.map(item => (
                <div key={item.id} style={{
                  padding: "10px 16px", borderBottom: `1px solid ${D.border}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: D.text }}>{item.name}</div>
                    <div style={{ fontSize: 13, color: D.amber, fontWeight: 700, flexShrink: 0 }}>
                      ₪{item.price * item.qty}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button onClick={() => changeQty(item.id, -1)}
                      style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${D.border}`, background: "transparent", color: D.text, cursor: "pointer", fontSize: 14 }}>−</button>
                    <span style={{ fontSize: 14, fontWeight: 700, minWidth: 20, textAlign: "center" }}>{item.qty}</span>
                    <button onClick={() => changeQty(item.id, +1)}
                      style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${D.border}`, background: "transparent", color: D.text, cursor: "pointer", fontSize: 14 }}>+</button>
                    <span style={{ fontSize: 11, color: D.sub, marginRight: 4 }}>× ₪{item.price}</span>
                  </div>
                  {/* Per-item note */}
                  <input
                    value={item.note}
                    onChange={e => setOrder(prev => prev.map(o => o.id === item.id ? { ...o, note: e.target.value } : o))}
                    placeholder="הערה לפריט (אלרגיה, בלי בצל...)"
                    onClick={e => e.stopPropagation()}
                    style={{
                      marginTop: 6, width: "100%", boxSizing: "border-box",
                      background: D.card, border: `1px solid ${D.border}`, borderRadius: 6,
                      color: D.sub, fontSize: 11, padding: "4px 8px",
                    }}
                  />
                </div>
              ))
            )}
          </div>

          {/* Order footer */}
          <div style={{ padding: "12px 16px", borderTop: `1px solid ${D.border}`, background: D.card }}>
            {/* General note */}
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="הערה כללית לשולחן..."
              rows={2}
              style={{
                width: "100%", boxSizing: "border-box",
                background: D.panel, border: `1px solid ${D.border}`, borderRadius: 8,
                color: D.text, fontSize: 12, padding: "6px 10px",
                resize: "none", fontFamily: "inherit", marginBottom: 10,
              }}
            />

            {/* Total */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, padding: "0 2px" }}>
              <span style={{ fontSize: 14, color: D.sub }}>{itemCount} פריטים</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: D.text }}>₪{total}</span>
            </div>

            {/* Send button */}
            <button onClick={sendToKitchen} disabled={order.length === 0}
              style={{
                width: "100%", padding: "12px 0", borderRadius: 10, border: "none",
                background: sentPulse ? D.green : order.length > 0 ? D.amber : D.border,
                color: sentPulse ? "#000" : order.length > 0 ? "#000" : D.sub,
                fontWeight: 800, fontSize: 15, cursor: order.length > 0 ? "pointer" : "not-allowed",
                transition: "background 300ms",
              }}>
              {sentPulse ? "✓ נשלח למטבח!" : "📤 שלח למטבח"}
            </button>
          </div>
        </div>

        {/* ── Desktop: always show order panel on right ── */}
        <style>{`
          @media (min-width: 700px) {
            .order-panel { display: flex !important; width: 320px !important; }
            [data-menu] { display: flex !important; }
          }
        `}</style>
      </div>
    </div>
  );
}
