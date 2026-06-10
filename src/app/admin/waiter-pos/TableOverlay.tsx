"use client";

import React, { useState, useEffect } from "react";
import { ALLERGEN_LIST } from "@/lib/allergens";

// ── Types ──────────────────────────────────────────────────────────
export type OrderItemDetail = {
  id: string;
  itemId: string;
  itemName: string;
  itemAllergens: string[];
  quantity: number;
  price: number;
  notes: string | null;
  itemStatus: string;
  course: number;
  heldUntilFired: boolean;
  firedAt: string | null;
  doneAt: string | null;
  servedAt: string | null;
  isComped: boolean;
};

export type OrderDetail = {
  id: string;
  orderNumber: number | null;
  totalAmount: number;
  status: string;
  tableAllergens: string[];
  coversCount: number | null;
  notes: string | null;
  items: OrderItemDetail[];
};

type Insight = { tableNum: string; type: "alert" | "tip" | "info"; text: string };

type Props = {
  tableNum: string;
  seats: number;
  availStatus: string;
  guests: number;
  minutesSitting: number;
  sittingStart: string | null;
  activeOrderIds: string[];
  totalAmount: number;
  orderStatus: string | null;
  insights: Insight[];
  isMobile: boolean;
  onClose: () => void;
  onAddItems: (order: OrderDetail) => void;
  onNewOrder: (guestCount: number, allergens: string[]) => void;
  onStatusChange: (status: "free" | "reserved" | "inactive") => void;
};

// ── Helpers ─────────────────────────────────────────────────────────
function fmtTimer(sittingStart: string | null): string {
  if (!sittingStart) return "00:00";
  const s = Math.max(0, Math.floor((Date.now() - new Date(sittingStart).getTime()) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

const ITEM_STATUS_HE: Record<string, string> = {
  PENDING: "ממתין", PREPARING: "מכין", DONE: "מוכן", CANCELLED: "בוטל",
};

const STATUS_BG: Record<string, string> = {
  PENDING: "#fdf7ed", PREPARING: "#f0f4fa", DONE: "#f0f7f3", CANCELLED: "#f9fafb",
};
const STATUS_TX: Record<string, string> = {
  PENDING: "#92400e", PREPARING: "#1e3a5f", DONE: "#1f5c3a", CANCELLED: "#6b7280",
};

// ── Component ────────────────────────────────────────────────────────
export function TableOverlay({
  tableNum, seats, availStatus, guests, minutesSitting, sittingStart,
  activeOrderIds, totalAmount, insights, isMobile,
  onClose, onAddItems, onNewOrder, onStatusChange,
}: Props) {
  const isOccupied = availStatus === "occupied";
  const orderId = activeOrderIds[0] ?? null;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [allergyEditOpen, setAllergyEditOpen] = useState(false);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [savingAllergens, setSavingAllergens] = useState(false);
  const [guestCount, setGuestCount] = useState(Math.max(guests, 2));
  const [firingCourse, setFiringCourse] = useState<number | null>(null);

  useEffect(() => {
    if (!isOccupied || !orderId) return;
    setLoadingOrder(true);
    fetch(`/api/admin/orders/${orderId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setOrder(d);
          setAllergens(d.tableAllergens ?? []);
        }
      })
      .finally(() => setLoadingOrder(false));
  }, [orderId, isOccupied]);

  // derived: courses that are held
  const heldCourses = Array.from(
    new Set((order?.items ?? []).filter(i => i.heldUntilFired).map(i => i.course))
  ).sort();

  async function fireCourse(course: number) {
    if (!orderId) return;
    setFiringCourse(course);
    await fetch(`/api/admin/orders/${orderId}/fire-course`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course }),
    });
    // refresh order
    const r = await fetch(`/api/admin/orders/${orderId}`);
    if (r.ok) setOrder(await r.json());
    setFiringCourse(null);
  }

  async function saveAllergens() {
    if (!orderId) return;
    setSavingAllergens(true);
    await fetch(`/api/admin/orders/${orderId}/add-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [], tableAllergens: allergens }),
    });
    setSavingAllergens(false);
    setAllergyEditOpen(false);
  }

  function toggleAllergen(key: string) {
    setAllergens(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  }

  // ── Inline styles ─────────────────────────────────────────────────
  const panelStyle: React.CSSProperties = isMobile
    ? { position: "fixed", inset: 0, background: "#faf8f5", display: "flex", flexDirection: "column", zIndex: 201, overflowY: "auto" }
    : { background: "#faf8f5", borderRadius: 24, width: 440, maxHeight: "88dvh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 12px 50px rgba(26,22,18,.18)" };

  const bgStyle: React.CSSProperties = isMobile
    ? { position: "fixed", inset: 0, zIndex: 200 }
    : { position: "fixed", inset: 0, background: "rgba(26,22,18,.4)", backdropFilter: "blur(3px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" };

  return (
    <div style={bgStyle} onClick={isMobile ? undefined : onClose}>
      <div style={panelStyle} onClick={e => e.stopPropagation()}>

        {/* ── Dark hero header ── */}
        <div style={{ background: "#1a1612", padding: "20px 20px 18px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, color: "#888", fontWeight: 600, letterSpacing: ".04em", marginBottom: 2 }}>שולחן</div>
            <div style={{ fontSize: 46, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{tableNum}</div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
              👤 {isOccupied && guests > 0 ? `${guests} סועדים` : `${seats} מקומות`}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 99, width: 34, height: 34, fontSize: 16, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            {isOccupied && (
              <>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#e07060", fontVariantNumeric: "tabular-nums" }}>{fmtTimer(sittingStart)}</div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: "rgba(224,112,96,.18)", color: "#e07060" }}>תפוס</span>
              </>
            )}
            {!isOccupied && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: "rgba(90,158,122,.18)", color: "#5a9e7a" }}>פנוי</span>
            )}
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>

          {/* ════════ OCCUPIED TABLE ════════ */}
          {isOccupied && (
            <>
              {/* AI insights */}
              {insights.length > 0 && (
                <div style={{ background: "#f5f3fb", border: "1.5px solid #d0c8f0", borderRadius: 14, padding: "12px 14px", marginBottom: 14, display: "flex", gap: 8 }}>
                  <span style={{ fontSize: 15, flexShrink: 0 }}>✨</span>
                  <div>
                    {insights.map((ins, i) => (
                      <div key={i} style={{ fontSize: 12, color: "#3d3070", fontWeight: 500, lineHeight: 1.5, marginBottom: i < insights.length - 1 ? 4 : 0 }}>{ins.text}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Order summary */}
              {loadingOrder && <div style={{ fontSize: 12, color: "#888", textAlign: "center", padding: 20 }}>טוען הזמנה...</div>}

              {order && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#8a8480", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>
                    הזמנה #{order.orderNumber} · ₪{order.totalAmount.toFixed(0)}
                    {order.tableAllergens.length > 0 && (
                      <span style={{ marginRight: 8, color: "#8b2e22", background: "#fdf2f0", padding: "1px 8px", borderRadius: 99, fontWeight: 700 }}>
                        ⚠️ {order.tableAllergens.map(k => ALLERGEN_LIST.find(a => a.key === k)?.label ?? k).join(", ")}
                      </span>
                    )}
                  </div>

                  <div style={{ background: "#fff", border: "1.5px solid #e8e2da", borderRadius: 14, marginBottom: 14, overflow: "hidden" }}>
                    {order.items.map((oi, i) => (
                      <div key={oi.id} style={{ padding: "9px 14px", borderBottom: i < order.items.length - 1 ? "1px solid #f0ebe4" : undefined, display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1612" }}>
                            {oi.itemName}
                            {oi.itemAllergens.some(a => allergens.includes(a)) && <span style={{ marginRight: 4, fontSize: 10, fontWeight: 800, color: "#8b2e22", background: "#fdf2f0", padding: "1px 5px", borderRadius: 5 }}>⚠️</span>}
                          </div>
                          <div style={{ fontSize: 10, color: "#8a8480", marginTop: 2 }}>קורס {oi.course} · ×{oi.quantity}</div>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: STATUS_BG[oi.itemStatus] ?? "#f9fafb", color: STATUS_TX[oi.itemStatus] ?? "#666" }}>
                          {oi.heldUntilFired ? "ממתין 🔥" : (ITEM_STATUS_HE[oi.itemStatus] ?? oi.itemStatus)}
                        </span>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#4a4540", flexShrink: 0 }}>₪{(oi.price * oi.quantity).toFixed(0)}</div>
                      </div>
                    ))}
                  </div>

                  {/* Held courses fire buttons */}
                  {heldCourses.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#92400e", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>🔥 קורסים ממתינים לשחרור</div>
                      {heldCourses.map(c => (
                        <div key={c} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fdf7ed", border: "1.5px solid #e8cc90", borderRadius: 12, padding: "10px 14px", marginBottom: 6 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1612" }}>קורס {c}</div>
                            <div style={{ fontSize: 11, color: "#8a8480", marginTop: 2 }}>
                              {order.items.filter(i => i.course === c && i.heldUntilFired).length} פריטים ממתינים
                            </div>
                          </div>
                          <button onClick={() => fireCourse(c)} disabled={firingCourse === c} style={{ padding: "8px 18px", borderRadius: 99, border: "none", background: firingCourse === c ? "#e8cc90" : "#c89440", color: "#fff", fontSize: 12, fontWeight: 800, cursor: firingCourse === c ? "default" : "pointer", fontFamily: "inherit" }}>
                            {firingCourse === c ? "שולח..." : "🔥 שחרר"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Allergy edit panel */}
                  {allergyEditOpen && (
                    <div style={{ background: "#fff", border: "1.5px solid #e8e2da", borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#8a8480", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>עדכון אלרגיות בשולחן</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 12 }}>
                        {ALLERGEN_LIST.map(a => (
                          <button key={a.key} onClick={() => toggleAllergen(a.key)} style={{ padding: "7px 14px", borderRadius: 99, border: `1.5px solid ${allergens.includes(a.key) ? "#e07060" : "#e8e2da"}`, background: allergens.includes(a.key) ? "#fdf2f0" : "#f4f1ed", color: allergens.includes(a.key) ? "#8b2e22" : "#4a4540", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                            {a.label}
                          </button>
                        ))}
                      </div>
                      <button onClick={saveAllergens} disabled={savingAllergens} style={{ width: "100%", padding: 12, borderRadius: 10, border: "none", background: "#1a1612", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                        {savingAllergens ? "שומר..." : "✓ שמור"}
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Total summary if no order loaded yet but we have amount */}
              {!loadingOrder && !order && totalAmount > 0 && (
                <div style={{ fontSize: 13, color: "#888", textAlign: "center", padding: 8 }}>₪{totalAmount.toFixed(0)} סה״כ</div>
              )}
            </>
          )}

          {/* ════════ FREE TABLE ════════ */}
          {!isOccupied && (
            <>
              {/* Guest count stepper */}
              <div style={{ background: guestCount > seats ? "#fffbf0" : "#fff", border: `1.5px solid ${guestCount > seats ? "#f5c842" : "#e8e2da"}`, borderRadius: 16, padding: "14px 18px", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#1a1612" }}>כמה סועדים?</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#f4f1ed", borderRadius: 99, padding: "6px 16px", border: "1.5px solid #e8e2da" }}>
                    <button onClick={() => setGuestCount(g => Math.max(1, g - 1))} style={{ width: 30, height: 30, borderRadius: 99, border: "none", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,.08)", cursor: "pointer", fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", color: "#1a1612", fontFamily: "inherit" }}>−</button>
                    <span style={{ fontSize: 20, fontWeight: 900, minWidth: 28, textAlign: "center" }}>{guestCount}</span>
                    <button onClick={() => setGuestCount(g => g + 1)} style={{ width: 30, height: 30, borderRadius: 99, border: "none", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,.08)", cursor: "pointer", fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", color: "#1a1612", fontFamily: "inherit" }}>+</button>
                  </div>
                </div>
                {guestCount > seats && (
                  <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: "#92620a", display: "flex", alignItems: "center", gap: 5 }}>
                    ⚠️ שולחן מוגדר ל־{seats} מקומות
                  </div>
                )}
              </div>

              {/* Allergy chips */}
              <div style={{ background: "#fff", border: "1.5px solid #e8e2da", borderRadius: 16, padding: "14px 18px", marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#8a8480", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>אלרגיות בשולחן?</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  <button onClick={() => setAllergens([])} style={{ padding: "7px 14px", borderRadius: 99, border: `1.5px solid ${allergens.length === 0 ? "#5a9e7a" : "#e8e2da"}`, background: allergens.length === 0 ? "#f0f7f3" : "#f4f1ed", color: allergens.length === 0 ? "#1f5c3a" : "#4a4540", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    ללא
                  </button>
                  {ALLERGEN_LIST.map(a => (
                    <button key={a.key} onClick={() => toggleAllergen(a.key)} style={{ padding: "7px 14px", borderRadius: 99, border: `1.5px solid ${allergens.includes(a.key) ? "#e07060" : "#e8e2da"}`, background: allergens.includes(a.key) ? "#fdf2f0" : "#f4f1ed", color: allergens.includes(a.key) ? "#8b2e22" : "#4a4540", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Status change (non-occupied tables) */}
          {!isOccupied && (
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#8a8480", marginBottom: 8 }}>שינוי סטטוס:</div>
              <div style={{ display: "flex", gap: 8 }}>
                {(["reserved", "inactive", "free"] as const).map(s => (
                  <button key={s} onClick={() => onStatusChange(s)} style={{ flex: 1, padding: "8px 6px", borderRadius: 10, border: "1.5px solid #e8e2da", background: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#4a4540", fontFamily: "inherit" }}>
                    {{ reserved: "🔵 מוזמן", inactive: "🔴 לא פעיל", free: "🟢 פנוי" }[s]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer CTAs ── */}
        <div style={{ borderTop: "1px solid #e8e2da", padding: "14px 16px", background: "#fff", flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {isOccupied && order && (
            <>
              <button onClick={() => onAddItems(order)} style={{ padding: 15, borderRadius: 12, border: "none", background: "#1a1612", color: "#fff", fontSize: 15, fontWeight: 900, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                ➕ הוסף מנות
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setAllergyEditOpen(o => !o)} style={{ flex: 1, padding: 13, borderRadius: 12, border: `1.5px solid ${allergyEditOpen ? "#e07060" : "#e8e2da"}`, background: allergyEditOpen ? "#fdf2f0" : "#f4f1ed", fontSize: 13, fontWeight: 800, cursor: "pointer", color: allergyEditOpen ? "#8b2e22" : "#1a1612", fontFamily: "inherit" }}>
                  ⚠️ אלרגיות
                </button>
                <button onClick={onClose} style={{ flex: 1, padding: 13, borderRadius: 12, border: "1.5px solid #f5c4bc", background: "#fdf2f0", fontSize: 13, fontWeight: 800, cursor: "pointer", color: "#8b2e22", fontFamily: "inherit" }}>
                  💳 סגור חשבון
                </button>
              </div>
            </>
          )}
          {isOccupied && !order && !loadingOrder && (
            <button onClick={onClose} style={{ padding: 14, borderRadius: 12, border: "none", background: "#f4f1ed", color: "#1a1612", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>סגור</button>
          )}
          {!isOccupied && (
            <>
              <button onClick={() => onNewOrder(guestCount, allergens)} style={{ padding: 15, borderRadius: 12, border: "none", background: "#1a1612", color: "#fff", fontSize: 15, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}>
                🍽️ פתח שולחן והזמן
              </button>
              <button onClick={onClose} style={{ padding: 13, borderRadius: 12, border: "1.5px solid #e8e2da", background: "#f4f1ed", fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#4a4540", fontFamily: "inherit" }}>
                ביטול
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
