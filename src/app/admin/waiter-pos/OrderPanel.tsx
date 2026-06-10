"use client";

import React, { useState, useEffect } from "react";
import type { OrderItemDetail } from "./TableOverlay";
import { ALLERGEN_LIST } from "@/lib/allergens";

export type CartItem = {
  key: string;
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  course: number;
  notes: string;
  allergens: string[];
};

type Props = {
  existingItems: OrderItemDetail[];
  cartItems: CartItem[];
  tableAllergens: string[];
  orderNumber?: number | null;
  onQtyChange: (key: string, qty: number) => void;
  onNotesChange: (key: string, notes: string) => void;
  onFireItem: (orderItemId: string) => void;
  onFireCourse: (course: number) => void;
};

const LS_VIEW_KEY = "menu4u_order_panel_view";

const ITEM_STATUS_HE: Record<string, string> = {
  PENDING: "ממתין", PREPARING: "מכין 🍳", DONE: "מוכן ✓", CANCELLED: "בוטל",
};
const ITEM_STATUS_BG: Record<string, string> = {
  PENDING: "#fdf7ed", PREPARING: "#f0f4fa", DONE: "#f0f7f3", CANCELLED: "#f9fafb",
};
const ITEM_STATUS_TX: Record<string, string> = {
  PENDING: "#92400e", PREPARING: "#1e3a5f", DONE: "#1f5c3a", CANCELLED: "#6b7280",
};

export function OrderPanel({ existingItems, cartItems, tableAllergens, orderNumber, onQtyChange, onNotesChange, onFireItem, onFireCourse }: Props) {
  const [view, setView] = useState<"B" | "C">(() => {
    if (typeof window !== "undefined") {
      const s = localStorage.getItem(LS_VIEW_KEY);
      if (s === "B" || s === "C") return s;
    }
    return "B";
  });
  const [openLanes, setOpenLanes] = useState<Record<string, boolean>>({ sent: false, preparing: true, holding: true, new: true });
  const [firingItem, setFiringItem] = useState<string | null>(null);
  const [firingCourse, setFiringCourse] = useState<number | null>(null);

  useEffect(() => {
    localStorage.setItem(LS_VIEW_KEY, view);
  }, [view]);

  function switchView(v: "B" | "C") {
    if (v === "C" && view === "C") {
      // toggle all open/closed
      const allOpen = Object.values(openLanes).every(Boolean);
      setOpenLanes({ sent: !allOpen, preparing: !allOpen, holding: !allOpen, new: !allOpen });
      return;
    }
    setView(v);
  }

  function toggleLane(lane: string) {
    setOpenLanes(p => ({ ...p, [lane]: !p[lane] }));
  }

  async function handleFireItem(orderItemId: string) {
    setFiringItem(orderItemId);
    await onFireItem(orderItemId);
    setFiringItem(null);
  }

  async function handleFireCourse(course: number) {
    setFiringCourse(course);
    await onFireCourse(course);
    setFiringCourse(null);
  }

  // categorize existing items
  const sentItems      = existingItems.filter(i => !i.heldUntilFired && (i.itemStatus === "DONE" || i.doneAt));
  const preparingItems = existingItems.filter(i => !i.heldUntilFired && i.itemStatus !== "DONE" && !i.doneAt && i.itemStatus !== "CANCELLED");
  const holdingItems   = existingItems.filter(i => i.heldUntilFired);
  const heldCourses    = Array.from(new Set(holdingItems.map(i => i.course))).sort();

  const existingTotal = existingItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const newTotal      = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);

  function allergyWarn(itemAllergens: string[]) {
    return itemAllergens.some(a => tableAllergens.includes(a));
  }
  function allergyLabel(itemAllergens: string[]) {
    const hits = itemAllergens.filter(a => tableAllergens.includes(a));
    return hits.map(k => ALLERGEN_LIST.find(a => a.key === k)?.label ?? k).join(", ");
  }

  // ── shared row for existing items ──
  function ExistingRow({ item, dim }: { item: OrderItemDetail; dim?: boolean }) {
    const warn = allergyWarn(item.itemAllergens);
    return (
      <div style={{ padding: "9px 14px", borderBottom: "1px solid #f0ebe4", display: "flex", alignItems: "center", gap: 8, opacity: dim ? .45 : 1 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1612", display: "flex", alignItems: "center", gap: 5 }}>
            {item.itemName}
            {warn && <span style={{ fontSize: 9, fontWeight: 800, background: "#fdf2f0", color: "#8b2e22", borderRadius: 5, padding: "1px 5px" }}>⚠️ {allergyLabel(item.itemAllergens)}</span>}
          </div>
          <div style={{ fontSize: 10, color: "#8a8480", marginTop: 1 }}>קורס {item.course} · ×{item.quantity}</div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: item.heldUntilFired ? "#fdf7ed" : (ITEM_STATUS_BG[item.itemStatus] ?? "#f9fafb"), color: item.heldUntilFired ? "#92400e" : (ITEM_STATUS_TX[item.itemStatus] ?? "#666") }}>
          {item.heldUntilFired ? "🔥 ממתין" : (ITEM_STATUS_HE[item.itemStatus] ?? item.itemStatus)}
        </div>
        {item.heldUntilFired && (
          <button onClick={() => handleFireItem(item.id)} disabled={firingItem === item.id} style={{ padding: "4px 9px", borderRadius: 99, border: "1px solid #e8cc90", background: "#fdf7ed", color: "#92400e", fontSize: 10, fontWeight: 800, cursor: firingItem === item.id ? "default" : "pointer", fontFamily: "inherit" }}>
            {firingItem === item.id ? "…" : "🔥"}
          </button>
        )}
        <div style={{ fontSize: 11, fontWeight: 800, color: "#4a4540", flexShrink: 0 }}>₪{(item.price * item.quantity).toFixed(0)}</div>
      </div>
    );
  }

  function NewRow({ item }: { item: CartItem }) {
    const warn = item.allergens.some(a => tableAllergens.includes(a));
    return (
      <div style={{ padding: "10px 14px", borderBottom: "1px solid #ebe7f8", background: "#faf8ff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 20, height: 20, borderRadius: 99, background: "#d0c8f0", color: "#3d3070", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>+</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#3d3070", display: "flex", alignItems: "center", gap: 5 }}>
              {item.name}
              {warn && <span style={{ fontSize: 9, background: "#fdf2f0", color: "#8b2e22", borderRadius: 5, padding: "1px 5px", fontWeight: 800 }}>⚠️</span>}
            </div>
            <div style={{ fontSize: 10, color: "#8878c0", marginTop: 1 }}>קורס {item.course}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <button onClick={() => onQtyChange(item.key, item.quantity - 1)} style={{ width: 22, height: 22, borderRadius: 7, border: "1.5px solid #e8e2da", background: "#f4f1ed", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#1a1612", fontFamily: "inherit" }}>−</button>
            <span style={{ fontSize: 13, fontWeight: 800, minWidth: 16, textAlign: "center" }}>{item.quantity}</span>
            <button onClick={() => onQtyChange(item.key, item.quantity + 1)} style={{ width: 22, height: 22, borderRadius: 7, border: "1.5px solid #e8e2da", background: "#f4f1ed", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#1a1612", fontFamily: "inherit" }}>+</button>
          </div>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#3d3070", flexShrink: 0 }}>₪{(item.price * item.quantity).toFixed(0)}</div>
        </div>
        <input value={item.notes} onChange={e => onNotesChange(item.key, e.target.value)} placeholder="הערה..." style={{ marginTop: 5, width: "100%", background: "#f0ecfc", border: "1px solid #d0c8f0", borderRadius: 6, fontSize: 11, padding: "4px 9px", outline: "none", color: "#3d3070", fontFamily: "inherit" }} />
      </div>
    );
  }

  // ── Section label (B) ──
  function SectionLabel({ label, color, bg, border: bd }: { label: string; color: string; bg: string; border: string }) {
    return (
      <div style={{ padding: "4px 14px 3px", fontSize: 9, fontWeight: 800, color, textTransform: "uppercase", letterSpacing: ".05em", background: bg, borderBottom: `1px solid ${bd}` }}>
        {label}
      </div>
    );
  }

  // ── Lane header (C) ──
  function LaneHead({ lane, label, count, color, bg, border: bd }: { lane: string; label: string; count: number; color: string; bg: string; border: string }) {
    return (
      <div onClick={() => toggleLane(lane)} style={{ padding: "8px 14px", background: bg, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", borderBottom: `1.5px solid ${bd}` }}>
        <div style={{ fontSize: 11, fontWeight: 800, color, display: "flex", alignItems: "center", gap: 6 }}>
          {label}
          <span style={{ fontSize: 10, background: bd, color, padding: "1px 7px", borderRadius: 99, fontWeight: 800 }}>{count}</span>
        </div>
        <span style={{ color: "#8a8480", fontSize: 12, transform: openLanes[lane] ? "rotate(180deg)" : undefined, transition: "transform .15s", display: "inline-block" }}>▾</span>
      </div>
    );
  }

  const panelNewTotal   = newTotal;
  const panelTotal      = existingTotal + newTotal;

  return (
    <div style={{ width: 340, background: "#fff", borderRight: "1px solid #e8e2da", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      {/* Header */}
      <div style={{ padding: "10px 14px", borderBottom: "1px solid #e8e2da", display: "flex", flexDirection: "column", gap: 7, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 900 }}>🛒 {orderNumber ? `הזמנה #${orderNumber}` : "הזמנה חדשה"}</span>
          <span style={{ fontSize: 15, fontWeight: 900 }}>₪{panelTotal.toFixed(0)}</span>
        </div>
        {tableAllergens.length > 0 && (
          <div style={{ fontSize: 10, background: "#fdf2f0", border: "1px solid #f5c4bc", color: "#8b2e22", borderRadius: 8, padding: "3px 8px", fontWeight: 700 }}>
            ⚠️ אלרגיות: {tableAllergens.map(k => ALLERGEN_LIST.find(a => a.key === k)?.label ?? k).join(", ")}
          </div>
        )}
        {/* View toggle */}
        <div style={{ display: "flex", background: "#f4f1ed", borderRadius: 8, border: "1px solid #e8e2da", padding: 2, gap: 2 }}>
          {(["B", "C"] as const).map(v => (
            <button key={v} onClick={() => switchView(v)} style={{ flex: 1, padding: 5, borderRadius: 6, border: "none", fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", background: view === v ? "#1a1612" : "transparent", color: view === v ? "#fff" : "#8a8480", transition: "all .12s" }}>
              {v === "B" ? "ציר זמן" : "שכבות"}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto" }}>

        {/* ══ VIEW B ══ */}
        {view === "B" && (
          <>
            {sentItems.length > 0 && (
              <>
                <SectionLabel label="✅ יצא למטבח" color="#1f5c3a" bg="#f0f7f3" border="#b3d9c4" />
                {sentItems.map(i => <ExistingRow key={i.id} item={i} dim />)}
              </>
            )}
            {preparingItems.length > 0 && (
              <>
                <SectionLabel label="🍳 בהכנה" color="#1e3a5f" bg="#f0f4fa" border="#b8cfe8" />
                {preparingItems.map(i => <ExistingRow key={i.id} item={i} />)}
              </>
            )}
            {holdingItems.length > 0 && (
              <>
                <SectionLabel label="🔥 ממתין לשחרור" color="#92400e" bg="#fdf7ed" border="#e8cc90" />
                {heldCourses.map(c => (
                  <div key={c}>
                    <div style={{ padding: "3px 14px", background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #e8cc90" }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: "#92400e", textTransform: "uppercase" }}>קורס {c}</span>
                      <button onClick={() => handleFireCourse(c)} disabled={firingCourse === c} style={{ padding: "2px 9px", borderRadius: 99, border: "none", background: "#c89440", color: "#fff", fontSize: 10, fontWeight: 800, cursor: firingCourse === c ? "default" : "pointer", fontFamily: "inherit" }}>
                        {firingCourse === c ? "…" : "🔥 שחרר הכל"}
                      </button>
                    </div>
                    {holdingItems.filter(i => i.course === c).map(i => <ExistingRow key={i.id} item={i} />)}
                  </div>
                ))}
              </>
            )}
            {cartItems.length > 0 && (
              <>
                <SectionLabel label="➕ מוסיף עכשיו" color="#3d3070" bg="#f5f3fb" border="#d0c8f0" />
                {cartItems.map(i => <NewRow key={i.key} item={i} />)}
              </>
            )}
          </>
        )}

        {/* ══ VIEW C ══ */}
        {view === "C" && (
          <>
            <div style={{ borderBottom: "2px solid #e8e2da" }}>
              <LaneHead lane="sent" label="✅ יצא למטבח" count={sentItems.length} color="#1f5c3a" bg="#f0f7f3" border="#b3d9c4" />
              {openLanes.sent && sentItems.map(i => <ExistingRow key={i.id} item={i} dim />)}
            </div>
            <div style={{ borderBottom: "2px solid #e8e2da" }}>
              <LaneHead lane="preparing" label="🍳 בהכנה" count={preparingItems.length} color="#1e3a5f" bg="#f0f4fa" border="#b8cfe8" />
              {openLanes.preparing && preparingItems.map(i => <ExistingRow key={i.id} item={i} />)}
            </div>
            <div style={{ borderBottom: "2px solid #e8e2da" }}>
              <LaneHead lane="holding" label="🔥 ממתין לשחרור" count={holdingItems.length} color="#92400e" bg="#fdf7ed" border="#e8cc90" />
              {openLanes.holding && holdingItems.map(i => <ExistingRow key={i.id} item={i} />)}
            </div>
            <div style={{ borderBottom: "2px solid #e8e2da" }}>
              <LaneHead lane="new" label="➕ מוסיף עכשיו" count={cartItems.length} color="#3d3070" bg="#f5f3fb" border="#d0c8f0" />
              {openLanes.new && cartItems.map(i => <NewRow key={i.key} item={i} />)}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "12px 14px", borderTop: "1px solid #e8e2da", background: "#faf8f5", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: "#8a8480" }}>{cartItems.length > 0 ? `${cartItems.length} מנות חדשות · ₪${panelNewTotal.toFixed(0)}` : "אין מנות חדשות"}</span>
          <span style={{ fontSize: 18, fontWeight: 900 }}>₪{panelTotal.toFixed(0)}</span>
        </div>
      </div>
    </div>
  );
}
