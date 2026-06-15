"use client";

import React, { useState, useEffect } from "react";
import type { OrderItemDetail } from "./TableOverlay";
import { ALLERGEN_LIST } from "@/lib/allergens";
import { ManagerPinModal } from "./ManagerPinModal";

export type CartItemModifier = { groupName: string; label: string; priceAdd: number };

export type CartItem = {
  key: string;
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  course: number;
  notes: string;
  allergens: string[];
  modifiers: CartItemModifier[];
};

type Props = {
  orderId: string | null;
  restaurantId: string;
  existingItems: OrderItemDetail[];
  cartItems: CartItem[];
  tableAllergens: string[];
  orderNumber?: number | null;
  onQtyChange: (key: string, qty: number) => void;
  onNotesChange: (key: string, notes: string) => void;
  onFireItem: (orderItemId: string) => void;
  onFireCourse: (course: number) => void;
  onItemActioned?: () => void;
};

const LS_VIEW_KEY = "menu4u_order_panel_view";

const ITEM_STATUS_HE: Record<string, string> = {
  PENDING: "ממתין", PREPARING: "מכין 🍳", DONE: "מוכן ✓", CANCELLED: "בוטל",
};
const ITEM_STATUS_BG: Record<string, string> = {
  PENDING: "rgba(251,191,36,0.12)", PREPARING: "rgba(96,165,250,0.12)", DONE: "rgba(52,211,153,0.12)", CANCELLED: "rgba(255,255,255,0.06)",
};
const ITEM_STATUS_TX: Record<string, string> = {
  PENDING: "#FBB040", PREPARING: "#60A5FA", DONE: "#34D399", CANCELLED: "rgba(255,255,255,0.35)",
};

export function OrderPanel({ orderId, restaurantId, existingItems, cartItems, tableAllergens, orderNumber, onQtyChange, onNotesChange, onFireItem, onFireCourse, onItemActioned }: Props) {
  const [view, setView] = useState<"B" | "C">(() => {
    if (typeof window !== "undefined") {
      const s = localStorage.getItem(LS_VIEW_KEY);
      if (s === "B" || s === "C") return s;
    }
    return "B";
  });
  const [openLanes, setOpenLanes] = useState<Record<string, boolean>>({ sent: false, preparing: true, holding: true, new: true });
  const [firingItem, setFiringItem]   = useState<string | null>(null);
  const [firingCourse, setFiringCourse] = useState<number | null>(null);
  type PinAction = { type: "void" | "comp"; itemId: string; itemName: string };
  const [pinAction, setPinAction]     = useState<PinAction | null>(null);
  const [reasonInput, setReasonInput] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

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

  async function doVoidOrComp(token: string, managerName: string) {
    if (!pinAction || !orderId) return;
    setActionLoading(true);
    const url = `/api/admin/orders/${orderId}/items/${pinAction.itemId}/${pinAction.type}`;
    await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ managerToken: token, reason: reasonInput || null }),
    });
    setActionLoading(false);
    setPinAction(null);
    setReasonInput("");
    onItemActioned?.();
    void managerName;
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
    const isVoided = !!(item as OrderItemDetail & { voidedAt?: string }).voidedAt;
    const canAct = !isVoided && !item.isComped && item.itemStatus !== "CANCELLED";
    return (
      <div style={{ padding: "9px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: isVoided || item.isComped ? "rgba(255,255,255,0.03)" : undefined, opacity: dim || isVoided ? .45 : 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
              {item.itemName}
              {warn && <span style={{ fontSize: 9, fontWeight: 800, background: "rgba(248,113,113,0.12)", color: "#FCA5A5", borderRadius: 5, padding: "1px 5px", border: "1px solid rgba(248,113,113,0.25)" }}>⚠️ {allergyLabel(item.itemAllergens)}</span>}
              {item.isComped && <span style={{ fontSize: 9, fontWeight: 800, background: "rgba(52,211,153,0.12)", color: "#34D399", borderRadius: 5, padding: "1px 5px" }}>🎁 חינם</span>}
              {isVoided && <span style={{ fontSize: 9, fontWeight: 800, background: "rgba(248,113,113,0.12)", color: "#F87171", borderRadius: 5, padding: "1px 5px" }}>✕ בוטל</span>}
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.38)", marginTop: 1 }}>קורס {item.course} · ×{item.quantity}</div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: item.heldUntilFired ? "rgba(251,191,36,0.12)" : (ITEM_STATUS_BG[item.itemStatus] ?? "rgba(255,255,255,0.06)"), color: item.heldUntilFired ? "#FBB040" : (ITEM_STATUS_TX[item.itemStatus] ?? "#666") }}>
            {item.heldUntilFired ? "🔥 ממתין" : (ITEM_STATUS_HE[item.itemStatus] ?? item.itemStatus)}
          </div>
          {item.heldUntilFired && (
            <button onClick={() => handleFireItem(item.id)} disabled={firingItem === item.id} style={{ padding: "4px 9px", borderRadius: 99, border: "1px solid rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.12)", color: "#FBB040", fontSize: 10, fontWeight: 800, cursor: firingItem === item.id ? "default" : "pointer", fontFamily: "inherit" }}>
              {firingItem === item.id ? "…" : "🔥"}
            </button>
          )}
          {canAct && orderId && (
            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
              <button onClick={() => { setReasonInput(""); setPinAction({ type: "comp", itemId: item.id, itemName: item.itemName }); }} title="על חשבון הבית" style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid rgba(52,211,153,0.25)", background: "rgba(52,211,153,0.1)", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>🎁</button>
              <button onClick={() => { setReasonInput(""); setPinAction({ type: "void", itemId: item.id, itemName: item.itemName }); }} title="בטל מנה" style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid rgba(248,113,113,0.25)", background: "rgba(248,113,113,0.1)", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>
          )}
          <div style={{ fontSize: 11, fontWeight: 800, color: item.isComped || isVoided ? "rgba(255,255,255,0.38)" : "rgba(255,255,255,0.7)", flexShrink: 0, textDecoration: item.isComped || isVoided ? "line-through" : "none" }}>₪{(item.price * item.quantity).toFixed(0)}</div>
        </div>
      </div>
    );
  }

  function NewRow({ item }: { item: CartItem }) {
    const warn = item.allergens.some(a => tableAllergens.includes(a));
    const [notesOpen, setNotesOpen] = useState(!!item.notes);
    return (
      <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(167,139,250,0.12)", background: "rgba(167,139,250,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 20, height: 20, borderRadius: 99, background: "rgba(167,139,250,0.12)", color: "#A78BFA", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>+</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: 5 }}>
              {item.name}
              {warn && <span style={{ fontSize: 9, background: "rgba(248,113,113,0.12)", color: "#FCA5A5", borderRadius: 5, padding: "1px 5px", fontWeight: 800, border: "1px solid rgba(248,113,113,0.25)" }}>⚠️</span>}
            </div>
            <div style={{ fontSize: 10, color: "#A78BFA", marginTop: 1 }}>קורס {item.course}</div>
            {item.modifiers?.length > 0 && (
              <div style={{ fontSize: 10, color: "rgba(167,139,250,0.8)", marginTop: 2 }}>{item.modifiers.map(m => m.label).join(" · ")}</div>
            )}
          </div>
          <button onClick={() => setNotesOpen(o => !o)} title="הוסף הערה" style={{ width: 26, height: 26, borderRadius: 7, border: `1.5px solid ${notesOpen ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.15)"}`, background: notesOpen ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.06)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all .12s" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={notesOpen ? "#A78BFA" : "rgba(255,255,255,0.38)"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <button onClick={() => onQtyChange(item.key, item.quantity - 1)} style={{ width: 22, height: 22, borderRadius: 7, border: "1.5px solid rgba(255,255,255,0.1)", background: item.quantity === 1 ? "rgba(248,113,113,0.12)" : "rgba(255,255,255,0.06)", fontSize: item.quantity === 1 ? 11 : 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: item.quantity === 1 ? "#F87171" : "#ffffff", fontFamily: "inherit" }}>{item.quantity === 1 ? "🗑" : "−"}</button>
            <span style={{ fontSize: 13, fontWeight: 800, minWidth: 16, textAlign: "center", color: "#fff" }}>{item.quantity}</span>
            <button onClick={() => onQtyChange(item.key, item.quantity + 1)} style={{ width: 22, height: 22, borderRadius: 7, border: "1.5px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff", fontFamily: "inherit" }}>+</button>
          </div>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#A78BFA", flexShrink: 0 }}>₪{(item.price * item.quantity).toFixed(0)}</div>
        </div>
        {notesOpen && (
          <input autoFocus value={item.notes} onChange={e => onNotesChange(item.key, e.target.value)} placeholder="הערה למטבח..." style={{ marginTop: 7, width: "100%", background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 8, fontSize: 12, padding: "6px 10px", outline: "none", color: "#fff", fontFamily: "inherit", boxSizing: "border-box" }} />
        )}
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
        <span style={{ color: "rgba(255,255,255,0.38)", fontSize: 12, transform: openLanes[lane] ? "rotate(180deg)" : undefined, transition: "transform .15s", display: "inline-block" }}>▾</span>
      </div>
    );
  }

  const panelNewTotal   = newTotal;
  const panelTotal      = existingTotal + newTotal;

  return (
    <div style={{ width: "100%", minWidth: 0, background: "transparent", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      {/* Header */}
      <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", gap: 7, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 900, color: "#fff" }}>🛒 {orderNumber ? `הזמנה #${orderNumber}` : "הזמנה חדשה"}</span>
          <span style={{ fontSize: 15, fontWeight: 900, color: "#fff" }}>₪{panelTotal.toFixed(0)}</span>
        </div>
        {tableAllergens.length > 0 && (
          <div style={{ fontSize: 10, background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.25)", color: "#FCA5A5", borderRadius: 8, padding: "3px 8px", fontWeight: 700 }}>
            ⚠️ אלרגיות: {tableAllergens.map(k => ALLERGEN_LIST.find(a => a.key === k)?.label ?? k).join(", ")}
          </div>
        )}
        {/* View toggle */}
        <div style={{ display: "flex", background: "rgba(255,255,255,0.06)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", padding: 2, gap: 2 }}>
          {(["B", "C"] as const).map(v => (
            <button key={v} onClick={() => switchView(v)} style={{ flex: 1, padding: 5, borderRadius: 6, border: "none", fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", background: view === v ? "linear-gradient(135deg,#D97706,#F59E0B)" : "transparent", color: view === v ? "#fff" : "rgba(255,255,255,0.45)", transition: "all .12s" }}>
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
                <SectionLabel label="✅ יצא למטבח" color="#34D399" bg="rgba(52,211,153,0.12)" border="rgba(52,211,153,0.25)" />
                {sentItems.map(i => <ExistingRow key={i.id} item={i} dim />)}
              </>
            )}
            {preparingItems.length > 0 && (
              <>
                <SectionLabel label="🍳 בהכנה" color="#60A5FA" bg="rgba(96,165,250,0.12)" border="rgba(96,165,250,0.25)" />
                {preparingItems.map(i => <ExistingRow key={i.id} item={i} />)}
              </>
            )}
            {holdingItems.length > 0 && (
              <>
                <SectionLabel label="🔥 ממתין לשחרור" color="#FBB040" bg="rgba(251,191,36,0.12)" border="rgba(251,191,36,0.3)" />
                {heldCourses.map(c => (
                  <div key={c}>
                    <div style={{ padding: "3px 14px", background: "rgba(251,191,36,0.12)", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(251,191,36,0.3)" }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: "#FBB040", textTransform: "uppercase" }}>קורס {c}</span>
                      <button onClick={() => handleFireCourse(c)} disabled={firingCourse === c} style={{ padding: "2px 9px", borderRadius: 99, border: "none", background: "linear-gradient(135deg,#D97706,#F59E0B)", color: "#fff", fontSize: 10, fontWeight: 800, cursor: firingCourse === c ? "default" : "pointer", fontFamily: "inherit" }}>
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
                <SectionLabel label="➕ מוסיף עכשיו" color="#A78BFA" bg="rgba(167,139,250,0.12)" border="rgba(167,139,250,0.25)" />
                {cartItems.map(i => <NewRow key={i.key} item={i} />)}
              </>
            )}
          </>
        )}

        {/* ══ VIEW C ══ */}
        {view === "C" && (
          <>
            <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <LaneHead lane="sent" label="✅ יצא למטבח" count={sentItems.length} color="#34D399" bg="rgba(52,211,153,0.12)" border="rgba(52,211,153,0.25)" />
              {openLanes.sent && sentItems.map(i => <ExistingRow key={i.id} item={i} dim />)}
            </div>
            <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <LaneHead lane="preparing" label="🍳 בהכנה" count={preparingItems.length} color="#60A5FA" bg="rgba(96,165,250,0.12)" border="rgba(96,165,250,0.25)" />
              {openLanes.preparing && preparingItems.map(i => <ExistingRow key={i.id} item={i} />)}
            </div>
            <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <LaneHead lane="holding" label="🔥 ממתין לשחרור" count={holdingItems.length} color="#FBB040" bg="rgba(251,191,36,0.12)" border="rgba(251,191,36,0.3)" />
              {openLanes.holding && heldCourses.map(c => (
                <div key={c}>
                  <div style={{ padding: "3px 14px", background: "rgba(251,191,36,0.12)", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(251,191,36,0.3)" }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: "#FBB040" }}>קורס {c}</span>
                    <button onClick={() => handleFireCourse(c)} disabled={firingCourse === c} style={{ padding: "2px 9px", borderRadius: 99, border: "none", background: "linear-gradient(135deg,#D97706,#F59E0B)", color: "#fff", fontSize: 10, fontWeight: 800, cursor: firingCourse === c ? "default" : "pointer", fontFamily: "inherit" }}>
                      {firingCourse === c ? "…" : "🔥 שחרר"}
                    </button>
                  </div>
                  {holdingItems.filter(i => i.course === c).map(i => <ExistingRow key={i.id} item={i} />)}
                </div>
              ))}
            </div>
            <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <LaneHead lane="new" label="➕ מוסיף עכשיו" count={cartItems.length} color="#A78BFA" bg="rgba(167,139,250,0.12)" border="rgba(167,139,250,0.25)" />
              {openLanes.new && cartItems.map(i => <NewRow key={i.key} item={i} />)}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.1)", background: "transparent", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.38)" }}>{cartItems.length > 0 ? `${cartItems.length} מנות חדשות · ₪${panelNewTotal.toFixed(0)}` : "אין מנות חדשות"}</span>
          <span style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>₪{panelTotal.toFixed(0)}</span>
        </div>
      </div>

      {/* ── PIN modal for void/comp ── */}
      {pinAction && (
        <>
          {/* Reason input step */}
          <div style={{ position: "fixed", inset: 0, zIndex: 590, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div style={{ background: "rgba(15,15,24,0.98)", borderRadius: "20px 20px 0 0", padding: "24px 20px 32px", width: "100%", maxWidth: 420, direction: "rtl", border: "1px solid rgba(255,255,255,0.12)" }}>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8, color: "#fff" }}>
                {pinAction.type === "void" ? "✕ ביטול מנה" : "🎁 על חשבון הבית"} — {pinAction.itemName}
              </div>
              <input
                autoFocus
                value={reasonInput}
                onChange={e => setReasonInput(e.target.value)}
                placeholder={pinAction.type === "void" ? "סיבת הביטול (אופציונלי)..." : "סיבה (אופציונלי)..."}
                style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "10px 14px", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 14, color: "#fff" }}
                onKeyDown={e => { if (e.key === "Enter") { setPinAction(p => p ? { ...p, _showPin: true } as never : p); } }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setPinAction(null)} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.08)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>ביטול</button>
                <button
                  onClick={() => setPinAction(p => p ? { ...p, _showPin: true } as never : p)}
                  style={{ flex: 2, padding: 12, borderRadius: 10, border: "none", background: pinAction.type === "void" ? "#DC2626" : "#059669", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                  המשך — הכנס PIN מנהל
                </button>
              </div>
            </div>
          </div>
          {(pinAction as never as { _showPin?: boolean })._showPin && (
            <ManagerPinModal
              restaurantId={restaurantId}
              title={pinAction.type === "void" ? "אישור ביטול מנה" : "אישור — על חשבון הבית"}
              description={`${pinAction.itemName}${reasonInput ? ` · ${reasonInput}` : ""}`}
              onApproved={doVoidOrComp}
              onCancel={() => setPinAction(null)}
            />
          )}
        </>
      )}
      {actionLoading && (
        <div style={{ position: "fixed", inset: 0, zIndex: 610, background: "rgba(0,0,0,.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "rgba(15,15,24,0.97)", borderRadius: 16, padding: "20px 32px", fontSize: 14, fontWeight: 700, border: "1px solid rgba(255,255,255,0.12)", color: "#fff" }}>מבצע...</div>
        </div>
      )}
    </div>
  );
}
