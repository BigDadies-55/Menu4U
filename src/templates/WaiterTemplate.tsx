"use client";
/**
 * TEMPLATE: Waiter Screen — "Visual Sommelier"
 *
 * Innovation vs. current:
 *  - Step 1: Large number-pad table picker (no text field)
 *  - Step 2: Photo-grid menu (like Wolt/Deliveroo, not a list)
 *  - Step 3: Sticky course-lane bar (drag or tap to assign course)
 *  - Slide-up bottom-sheet cart (peek → expanded on demand)
 *  - Category pills scroll horizontally (emoji + name)
 *  - Item cards show photo, name, price, + quick-add button
 *  - Cart peek: "3 פריטים · ₪168 ← שלח" always visible
 *
 * Mock data inlined — replace with real API / props.
 */
import React, { useState, useMemo } from "react";
import { T } from "@/lib/ui";

// ── Types ──────────────────────────────────────────────────
type MenuItem = { id: string; name: string; price: number; emoji: string; desc: string };
type MenuCat  = { id: string; name: string; emoji: string; items: MenuItem[] };
type CartItem = { itemId: string; name: string; price: number; qty: number; course: number };

// ── Mock menu ──────────────────────────────────────────────
const MENU: MenuCat[] = [
  { id: "sal", name: "סלטים", emoji: "🥗", items: [
    { id: "s1", name: "סלט ים תיכוני", price: 52, emoji: "🥗", desc: "עגבניות שרי, מלפפון, זיתים, פטה" },
    { id: "s2", name: "סלט קיסר", price: 58, emoji: "🥬", desc: "חסה רומאית, קרוטון, פרמזן" },
    { id: "s3", name: "קרפצ'יו בקר", price: 72, emoji: "🥩", desc: "רוקט, פרמזן, שמן זית" },
    { id: "s4", name: "סלט גריל", price: 64, emoji: "🌽", desc: "ירקות גריל עונתיים" },
  ]},
  { id: "main", name: "עיקריות", emoji: "🍖", items: [
    { id: "m1", name: "פילה סלמון", price: 128, emoji: "🐟", desc: "אורז עגול, ירקות קלויים" },
    { id: "m2", name: "אנטריקוט 300g", price: 168, emoji: "🥩", desc: "עשוי על הגריל, צ'ימיצ'ורי" },
    { id: "m3", name: "שוק טלה", price: 142, emoji: "🍖", desc: "ברוטב עגבניות, קוסקוס" },
    { id: "m4", name: "פסטה טרטופו", price: 88, emoji: "🍝", desc: "שמנת כמהין, פרמזן" },
    { id: "m5", name: "ריזוטו פטריות", price: 86, emoji: "🍚", desc: "פטריות יער, יין לבן" },
    { id: "m6", name: "פרגית גריל", price: 94, emoji: "🍗", desc: "לימון, שום, צמחי תיבול" },
  ]},
  { id: "des", name: "קינוחים", emoji: "🍮", items: [
    { id: "d1", name: "קרם ברולה", price: 42, emoji: "🍮", desc: "וניל בורבון, פירות יער" },
    { id: "d2", name: "פונדן שוקולד", price: 48, emoji: "🍫", desc: "גלידת וניל" },
    { id: "d3", name: "פנה קוטה", price: 38, emoji: "🍦", desc: "ג'לי תות, מנטה" },
  ]},
  { id: "dri", name: "משקאות", emoji: "🍷", items: [
    { id: "dr1", name: "יין אדום — כוס", price: 44, emoji: "🍷", desc: "קברנה סוביניון" },
    { id: "dr2", name: "בירה מהחבית", price: 32, emoji: "🍺", desc: "גולדסטאר / קרלסברג" },
    { id: "dr3", name: "מים מינרלים", price: 14, emoji: "💧", desc: "500 מ\"ל" },
  ]},
];

const COURSES = [
  { num: 1, label: "ראשון", emoji: "🥗" },
  { num: 2, label: "עיקרי", emoji: "🍖" },
  { num: 3, label: "קינוח",  emoji: "🍮" },
];

// ── Item card ──────────────────────────────────────────────
function ItemCard({ item, course, onAdd }: { item: MenuItem; course: number; onAdd: () => void }) {
  const [pressed, setPressed] = useState(false);
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.rLg,
      overflow: "hidden", display: "flex", flexDirection: "column",
      transition: "transform 0.15s, box-shadow 0.15s",
      transform: pressed ? "scale(0.97)" : "scale(1)",
      boxShadow: pressed ? "none" : `0 2px 12px rgba(0,0,0,0.3)`,
    }}>
      {/* Emoji "photo" placeholder */}
      <div style={{
        height: 80, background: `linear-gradient(135deg, ${T.raised}, ${T.overlay})`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 36, flexShrink: 0, position: "relative",
      }}>
        {item.emoji}
        <div style={{
          position: "absolute", bottom: 6, right: 8,
          background: `${T.gold}22`, border: `1px solid ${T.gold}44`,
          borderRadius: T.rFull, padding: "1px 7px", fontSize: 10, color: T.gold, fontWeight: 700,
        }}>
          {COURSES[course - 1]?.emoji} {COURSES[course - 1]?.label}
        </div>
      </div>
      {/* Info */}
      <div style={{ padding: "8px 10px", flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.text, lineHeight: 1.3 }}>{item.name}</div>
        <div style={{ fontSize: 10, color: T.muted, lineHeight: 1.4, flex: 1 }}>{item.desc}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 900, color: T.gold }}>₪{item.price}</span>
          <button
            onMouseDown={() => setPressed(true)}
            onMouseUp={() => { setPressed(false); onAdd(); }}
            onMouseLeave={() => setPressed(false)}
            style={{
              width: 28, height: 28, borderRadius: "50%",
              background: T.gold, color: "#000",
              border: "none", cursor: "pointer",
              fontSize: 18, fontWeight: 900, lineHeight: 1,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >+</button>
        </div>
      </div>
    </div>
  );
}

// ── Table picker ───────────────────────────────────────────
function TablePicker({ onPick }: { onPick: (t: string, g: number) => void }) {
  const [num, setNum] = useState("");
  const [guests, setGuests] = useState(2);
  const tables = Array.from({ length: 24 }, (_, i) => String(i + 1));
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 32, padding: 24 }}>
      <div>
        <div style={{ fontSize: 13, color: T.muted, textAlign: "center", marginBottom: 16, fontWeight: 600 }}>בחר שולחן</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 56px)", gap: 8 }}>
          {tables.map(t => (
            <button key={t} onClick={() => setNum(t)} style={{
              width: 56, height: 56, borderRadius: T.rMd, border: `1px solid ${num === t ? T.gold : T.border}`,
              background: num === t ? `${T.gold}22` : T.surface,
              color: num === t ? T.gold : T.sub, fontWeight: num === t ? 900 : 500,
              fontSize: 16, cursor: "pointer", transition: "all 0.15s",
            }}>{t}</button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ fontSize: 13, color: T.muted }}>👤 אורחים:</span>
        {[1,2,3,4,5,6,7,8].map(g => (
          <button key={g} onClick={() => setGuests(g)} style={{
            width: 36, height: 36, borderRadius: "50%",
            background: guests === g ? T.gold : T.surface,
            color: guests === g ? "#000" : T.sub,
            border: `1px solid ${guests === g ? T.gold : T.border}`,
            fontWeight: 700, fontSize: 15, cursor: "pointer",
          }}>{g}</button>
        ))}
        <button onClick={() => setGuests(g => g + 1)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 20 }}>+</button>
      </div>
      <button
        onClick={() => num && onPick(num, guests)}
        disabled={!num}
        style={{
          padding: "14px 48px", borderRadius: T.rLg, border: "none",
          background: num ? T.gold : T.overlay,
          color: num ? "#000" : T.muted,
          fontSize: 16, fontWeight: 900, cursor: num ? "pointer" : "default",
          transition: "all 0.2s",
        }}
      >
        {num ? `המשך → שולחן ${num}` : "בחר שולחן"}
      </button>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────
export default function WaiterTemplate() {
  const [step, setStep]       = useState<"table" | "menu">("table");
  const [tableNum, setTableNum] = useState("");
  const [guests, setGuests]   = useState(2);
  const [catId, setCatId]     = useState(MENU[0].id);
  const [cart, setCart]       = useState<CartItem[]>([]);
  const [course, setCourse]   = useState(1);
  const [cartOpen, setCartOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const activeCat = MENU.find(c => c.id === catId) ?? MENU[0];
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  function addToCart(item: MenuItem) {
    setCart(prev => {
      const ex = prev.find(c => c.itemId === item.id && c.course === course);
      if (ex) return prev.map(c => c.itemId === item.id && c.course === course ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { itemId: item.id, name: item.name, price: item.price, qty: 1, course }];
    });
  }

  function removeFromCart(itemId: string, course: number) {
    setCart(prev => {
      const updated = prev.map(c => c.itemId === itemId && c.course === course ? { ...c, qty: c.qty - 1 } : c);
      return updated.filter(c => c.qty > 0);
    });
  }

  async function send() {
    setSending(true);
    await new Promise(r => setTimeout(r, 1200));
    setSending(false);
    setCart([]); setCartOpen(false); setStep("table");
  }

  // Cart grouped by course
  const cartByCourse = useMemo(() => {
    const map = new Map<number, CartItem[]>();
    for (const item of cart) {
      if (!map.has(item.course)) map.set(item.course, []);
      map.get(item.course)!.push(item);
    }
    return map;
  }, [cart]);

  if (step === "table") {
    return (
      <div style={{ height: "calc(100vh - 64px)", background: T.bg, color: T.text, fontFamily: "system-ui,sans-serif", direction: "rtl" }}>
        {/* Header */}
        <div style={{ padding: "14px 24px", borderBottom: `1px solid ${T.border}`, background: T.panel, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 900, color: T.gold }}>🍽 הזמנה חדשה</span>
        </div>
        <TablePicker onPick={(t, g) => { setTableNum(t); setGuests(g); setStep("menu"); }} />
      </div>
    );
  }

  return (
    <div style={{ height: "calc(100vh - 64px)", background: T.bg, color: T.text, fontFamily: "system-ui,sans-serif", direction: "rtl", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Header ── */}
      <div style={{ padding: "10px 20px", borderBottom: `1px solid ${T.border}`, background: T.panel, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <button onClick={() => setStep("table")} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 20 }}>←</button>
        <div>
          <span style={{ fontSize: 16, fontWeight: 900, color: T.gold }}>שולחן {tableNum}</span>
          <span style={{ fontSize: 13, color: T.muted, marginRight: 8 }}>👤 {guests} אורחים</span>
        </div>

        {/* Course selector */}
        <div style={{ display: "flex", gap: 6, marginRight: "auto" }}>
          {COURSES.map(c => (
            <button key={c.num} onClick={() => setCourse(c.num)} style={{
              padding: "5px 14px", borderRadius: T.rFull, border: `1px solid ${course === c.num ? T.gold : T.border}`,
              background: course === c.num ? `${T.gold}22` : "transparent",
              color: course === c.num ? T.gold : T.muted,
              fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>{c.emoji} {c.label}</button>
          ))}
        </div>
      </div>

      {/* ── Category pills ── */}
      <div style={{ display: "flex", gap: 8, padding: "10px 20px", borderBottom: `1px solid ${T.border}`, background: T.surface, overflowX: "auto", flexShrink: 0 }}>
        {MENU.map(cat => (
          <button key={cat.id} onClick={() => setCatId(cat.id)} style={{
            padding: "6px 16px", borderRadius: T.rFull, whiteSpace: "nowrap",
            border: `1px solid ${catId === cat.id ? T.gold : T.border}`,
            background: catId === cat.id ? `${T.gold}22` : "transparent",
            color: catId === cat.id ? T.gold : T.sub,
            fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>{cat.emoji} {cat.name}</button>
        ))}
      </div>

      {/* ── Photo grid ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", paddingBottom: cartCount > 0 ? 80 : 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
          {activeCat.items.map(item => (
            <ItemCard key={item.id} item={item} course={course} onAdd={() => addToCart(item)} />
          ))}
        </div>
      </div>

      {/* ── Cart peek bar ── */}
      {cartCount > 0 && (
        <div style={{ position: "absolute", bottom: 0, right: 0, left: 0, zIndex: 100 }}>

          {/* Expanded cart */}
          {cartOpen && (
            <div style={{
              background: T.panel, border: `1px solid ${T.border}`,
              borderTopLeftRadius: T.rXl, borderTopRightRadius: T.rXl,
              maxHeight: "60vh", display: "flex", flexDirection: "column",
              boxShadow: "0 -8px 32px rgba(0,0,0,0.6)",
            }}>
              <div style={{ padding: "16px 20px 8px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: T.gold }}>העגלה שלך</span>
                <button onClick={() => setCartOpen(false)} style={{ marginRight: "auto", background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 20 }}>⌄</button>
              </div>
              <div style={{ overflowY: "auto", flex: 1 }}>
                {Array.from(cartByCourse.entries()).sort(([a],[b]) => a - b).map(([c, items]) => (
                  <div key={c}>
                    <div style={{ padding: "6px 20px", fontSize: 11, color: T.muted, fontWeight: 700, background: T.surface }}>
                      {COURSES[c-1]?.emoji} {COURSES[c-1]?.label}
                    </div>
                    {items.map(item => (
                      <div key={item.itemId} style={{ padding: "8px 20px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${T.borderSub}` }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{item.name}</div>
                          <div style={{ fontSize: 11, color: T.muted }}>₪{item.price} × {item.qty}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <button onClick={() => removeFromCart(item.itemId, item.course)} style={{ width: 26, height: 26, borderRadius: "50%", background: T.overlay, border: `1px solid ${T.border}`, color: T.text, cursor: "pointer", fontSize: 16, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                          <span style={{ fontSize: 14, fontWeight: 700, minWidth: 16, textAlign: "center" }}>{item.qty}</span>
                          <button onClick={() => addToCart({ id: item.itemId, name: item.name, price: item.price, emoji: "", desc: "" })} style={{ width: 26, height: 26, borderRadius: "50%", background: T.gold, border: "none", color: "#000", cursor: "pointer", fontSize: 16, fontWeight: 900, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: T.gold, minWidth: 48, textAlign: "left" }}>₪{item.price * item.qty}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Peek bar */}
          <button onClick={() => !cartOpen ? setCartOpen(true) : send()} style={{
            width: "100%", padding: "16px 24px", border: "none", cursor: "pointer",
            background: cartOpen ? T.gold : `linear-gradient(135deg, #b8860b, ${T.gold})`,
            color: "#000", display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: T.rFull, padding: "2px 10px", fontSize: 13, fontWeight: 900 }}>
                {cartCount}
              </div>
              <span style={{ fontSize: 15, fontWeight: 900 }}>
                {cartOpen ? (sending ? "שולח..." : "📤 שלח למטבח") : "הצג עגלה"}
              </span>
            </div>
            <span style={{ fontSize: 17, fontWeight: 900 }}>₪{cartTotal}</span>
          </button>
        </div>
      )}
    </div>
  );
}
