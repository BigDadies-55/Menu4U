"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  voidedAt?: string | null;
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
  freeTables: string[];
  restaurantId: string;
  onClose: () => void;
  onAddItems: (order: OrderDetail) => void;
  onNewOrder: (guestCount: number, allergens: string[]) => void;
  onStatusChange: (status: "free" | "reserved" | "inactive" | "bill_requested") => void;
};

function fmtMins(sittingStart: string | null): string {
  if (!sittingStart) return "0";
  return String(Math.floor((Date.now() - new Date(sittingStart).getTime()) / 60000));
}

// ── Component ────────────────────────────────────────────────────────
export function TableOverlay({
  tableNum, seats, availStatus, guests, sittingStart,
  activeOrderIds, totalAmount, insights, isMobile, freeTables, restaurantId,
  onClose, onAddItems, onNewOrder, onStatusChange,
}: Props) {
  const router = useRouter();
  const isOccupied = availStatus === "occupied" || availStatus === "bill_requested";
  const orderId = activeOrderIds[0] ?? null;

  const [order, setOrder]               = useState<OrderDetail | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [allergyEditOpen, setAllergyEditOpen] = useState(false);
  const [statusEditOpen, setStatusEditOpen]   = useState(false);
  const [allergens, setAllergens]       = useState<string[]>([]);
  const [savingAllergens, setSavingAllergens] = useState(false);
  const [guestCount, setGuestCount]     = useState(Math.max(guests, 2));
  const [firingCourse, setFiringCourse] = useState<number | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    if (!isOccupied || !orderId) return;
    setLoadingOrder(true);
    fetch(`/api/admin/orders/${orderId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setOrder(d); setAllergens(d.tableAllergens ?? []); } })
      .finally(() => setLoadingOrder(false));
  }, [orderId, isOccupied]);

  // Courses derived from order items
  const courseNums = Array.from(new Set((order?.items ?? []).map(i => i.course))).sort();

  async function fireCourse(course: number) {
    if (!orderId) return;
    setFiringCourse(course);
    await fetch(`/api/admin/orders/${orderId}/fire-course`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course }),
    });
    const r = await fetch(`/api/admin/orders/${orderId}`);
    if (r.ok) setOrder(await r.json());
    setFiringCourse(null);
  }

  async function transferTable(toTable: string) {
    if (!orderId) return;
    setTransferring(true);
    await fetch(`/api/admin/orders/${orderId}/transfer`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toTable }),
    });
    setTransferring(false);
    onStatusChange("free");
    onClose();
  }

  async function saveAllergens() {
    if (!orderId) return;
    setSavingAllergens(true);
    await fetch(`/api/admin/orders/${orderId}/add-items`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [], tableAllergens: allergens }),
    });
    setSavingAllergens(false);
    setAllergyEditOpen(false);
    setOrder(o => o ? { ...o, tableAllergens: allergens } : o);
  }

  function toggleAllergen(key: string) {
    setAllergens(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }

  const activeItems  = (order?.items ?? []).filter(i => !i.voidedAt && i.itemStatus !== "CANCELLED");
  const billTotal    = order?.totalAmount ?? totalAmount;
  const allergyHits  = (order?.tableAllergens ?? []);

  // ── Overlay wrappers ─────────────────────────────────────────────
  const bgStyle: React.CSSProperties = isMobile
    ? { position: "fixed", inset: 0, zIndex: 500 }
    : { position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" };

  const panelStyle: React.CSSProperties = isMobile
    ? { position: "fixed", inset: 0, background: "#f5f3ef", display: "flex", flexDirection: "column", zIndex: 501, overflowY: "auto" }
    : { background: "#f5f3ef", borderRadius: 28, width: 460, maxHeight: "90dvh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,.22)" };

  return (
    <div style={bgStyle} onClick={isMobile ? undefined : onClose}>
      <div style={panelStyle} onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div style={{ background: "#fff", padding: "16px 20px 14px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #ede9e3" }}>
          {/* X button */}
          <button onClick={onClose} style={{ width: 42, height: 42, borderRadius: 99, border: "none", background: "#f0ede8", cursor: "pointer", fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center", color: "#555", flexShrink: 0, fontFamily: "inherit" }}>✕</button>

          {/* Middle info */}
          {isOccupied ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#e07060", fontVariantNumeric: "tabular-nums" }}>⏱ {fmtMins(sittingStart)} דק&apos;</span>
                <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 12px", borderRadius: 99, background: "#fdf2f0", color: "#c0392b", border: "1.5px solid #f5c4bc" }}>תפוס</span>
              </div>
              <div style={{ fontSize: 12, color: "#888" }}>👤 {guests > 0 ? `${guests} סועדים` : `${seats} מקומות`}</div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 12px", borderRadius: 99, background: "#f0f7f3", color: "#1f5c3a", border: "1.5px solid #b3d9c4" }}>פנוי</span>
              <div style={{ fontSize: 12, color: "#888" }}>👤 {seats} מקומות</div>
            </div>
          )}

          {/* Table number */}
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 10, color: "#aaa", fontWeight: 600, letterSpacing: ".05em" }}>שולחן</div>
            <div style={{ fontSize: 46, fontWeight: 900, color: "#1a1612", lineHeight: 1 }}>{tableNum}</div>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>

          {/* AI insights */}
          {insights.length > 0 && (
            <div style={{ background: "#f0eeff", border: "1.5px solid #d0c8f0", borderRadius: 16, padding: "12px 16px", marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#5a4a9e", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>✨ תובנות AI</div>
              {insights.map((ins, i) => (
                <div key={i} style={{ fontSize: 13, color: "#3d3070", lineHeight: 1.5, marginBottom: i < insights.length - 1 ? 5 : 0, display: "flex", alignItems: "flex-start", gap: 6 }}>
                  <span style={{ flexShrink: 0 }}>{ins.type === "alert" ? "⚠️" : ins.type === "tip" ? "💡" : "ℹ️"}</span>
                  {ins.text}
                </div>
              ))}
            </div>
          )}

          {/* ════ OCCUPIED ════ */}
          {isOccupied && (
            <>
              {loadingOrder && <div style={{ textAlign: "center", color: "#aaa", fontSize: 13, padding: 20 }}>טוען הזמנה...</div>}

              {order && (
                <>
                  {/* Order label */}
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#aaa", textAlign: "left", marginBottom: 8 }}>הזמנה #{order.orderNumber}</div>

                  {/* Items card */}
                  <div style={{ background: "#fff", border: "1.5px solid #e8e2da", borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
                    {activeItems.map((oi, i) => {
                      const allergyHit = oi.itemAllergens.some(a => allergyHits.includes(a));
                      const allergyLabel = oi.itemAllergens.filter(a => allergyHits.includes(a))
                        .map(k => ALLERGEN_LIST.find(a => a.key === k)?.label ?? k).join(", ");
                      return (
                        <div key={oi.id} style={{ padding: "10px 16px", borderBottom: i < activeItems.length - 1 ? "1px solid #f0ebe4" : undefined, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: "#1a1612" }}>₪{(oi.price * oi.quantity).toFixed(0)}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {allergyHit && (
                              <span style={{ fontSize: 10, fontWeight: 800, background: "#fdf2f0", color: "#8b2e22", borderRadius: 99, padding: "2px 8px", border: "1px solid #f5c4bc" }}>⚠️ {allergyLabel}</span>
                            )}
                            {oi.isComped && <span style={{ fontSize: 10, fontWeight: 800, background: "#f0fdf4", color: "#166534", borderRadius: 99, padding: "2px 8px" }}>🎁 חינם</span>}
                            <span style={{ fontSize: 13, color: "#1a1612" }}>{oi.itemName} × {oi.quantity}</span>
                          </div>
                        </div>
                      );
                    })}
                    {/* Total row */}
                    <div style={{ padding: "11px 16px", borderTop: "1.5px solid #e8e2da", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 15, fontWeight: 900, color: "#1a1612" }}>₪{billTotal.toFixed(0)}</div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: "#1a1612" }}>סה&quot;כ</div>
                    </div>
                  </div>

                  {/* Course management */}
                  {courseNums.length > 0 && (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#c07020", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>🔥 ניהול קורסים</div>
                      {courseNums.map(c => {
                        const courseItems = (order.items ?? []).filter(i => i.course === c && !i.voidedAt && i.itemStatus !== "CANCELLED");
                        const hasFired    = courseItems.some(i => i.firedAt || !i.heldUntilFired);
                        const allHeld     = courseItems.every(i => i.heldUntilFired);
                        return (
                          <div key={c} style={{ background: "#fff", border: "1.5px solid #e8e2da", borderRadius: 14, padding: "12px 16px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 800, color: "#1a1612" }}>קורס {c} – {courseItems.length} פריטים</div>
                              <div style={{ fontSize: 11, color: "#8a8480", marginTop: 2 }}>
                                {allHeld ? "ממתין לשחרור" : hasFired ? "✓ יצא למטבח" : "בהכנה"}
                              </div>
                            </div>
                            {allHeld ? (
                              <button onClick={() => fireCourse(c)} disabled={firingCourse === c} style={{ padding: "7px 18px", borderRadius: 99, border: "1.5px solid #d4a840", background: "#fdf7ed", color: "#92400e", fontSize: 12, fontWeight: 800, cursor: firingCourse === c ? "default" : "pointer", fontFamily: "inherit" }}>
                                {firingCourse === c ? "…" : "🔥 שחרר"}
                              </button>
                            ) : (
                              <div style={{ padding: "7px 18px", borderRadius: 99, background: "#f0f7f3", color: "#1f5c3a", fontSize: 12, fontWeight: 800, border: "1.5px solid #b3d9c4" }}>✓ יצא</div>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}

                  {/* Allergy edit */}
                  {allergyEditOpen && (
                    <div style={{ background: "#fff", border: "1.5px solid #e8e2da", borderRadius: 14, padding: "14px 16px", marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#8a8480", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>עדכון אלרגיות בשולחן</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 12 }}>
                        <button onClick={() => setAllergens([])} style={{ padding: "7px 14px", borderRadius: 99, border: `1.5px solid ${allergens.length === 0 ? "#5a9e7a" : "#e8e2da"}`, background: allergens.length === 0 ? "#f0f7f3" : "#f4f1ed", color: allergens.length === 0 ? "#1f5c3a" : "#4a4540", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>ללא</button>
                        {ALLERGEN_LIST.map(a => (
                          <button key={a.key} onClick={() => toggleAllergen(a.key)} style={{ padding: "7px 14px", borderRadius: 99, border: `1.5px solid ${allergens.includes(a.key) ? "#e07060" : "#e8e2da"}`, background: allergens.includes(a.key) ? "#fdf2f0" : "#f4f1ed", color: allergens.includes(a.key) ? "#8b2e22" : "#4a4540", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{a.label}</button>
                        ))}
                      </div>
                      <button onClick={saveAllergens} disabled={savingAllergens} style={{ width: "100%", padding: 11, borderRadius: 10, border: "none", background: "#1a1612", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                        {savingAllergens ? "שומר..." : "✓ שמור"}
                      </button>
                    </div>
                  )}

                  {/* Status edit */}
                  {statusEditOpen && (
                    <div style={{ background: "#fff", border: "1.5px solid #e8e2da", borderRadius: 14, padding: "12px 16px", marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#8a8480", marginBottom: 10 }}>שינוי סטטוס שולחן</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                        {(["bill_requested", "reserved", "inactive", "free"] as const).map(s => (
                          <button key={s} onClick={() => { onStatusChange(s); setStatusEditOpen(false); }} style={{ flex: 1, minWidth: 70, padding: "9px 6px", borderRadius: 10, border: "1.5px solid #e8e2da", background: "#f4f1ed", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#4a4540", fontFamily: "inherit" }}>
                            {{ bill_requested: "🧾 מבקש חשבון", reserved: "🔵 מוזמן", inactive: "🔴 לא פעיל", free: "🟢 פנוי" }[s]}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setTransferOpen(o => !o)} style={{ width: "100%", padding: 10, borderRadius: 10, border: `1.5px solid ${transferOpen ? "#93c5fd" : "#e8e2da"}`, background: transferOpen ? "#eff6ff" : "#f4f1ed", fontSize: 12, fontWeight: 700, cursor: "pointer", color: transferOpen ? "#1d4ed8" : "#4a4540", fontFamily: "inherit" }}>
                        🔄 העבר לשולחן אחר
                      </button>
                      {transferOpen && (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ fontSize: 11, color: "#8a8480", marginBottom: 7 }}>בחר שולחן יעד (פנויים)</div>
                          {freeTables.length === 0 ? (
                            <div style={{ fontSize: 12, color: "#aaa" }}>אין שולחנות פנויים</div>
                          ) : (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {freeTables.map(t => (
                                <button key={t} onClick={() => transferTable(t)} disabled={transferring} style={{ padding: "6px 16px", borderRadius: 99, border: "1.5px solid #93c5fd", background: "#eff6ff", color: "#1d4ed8", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                                  {transferring ? "…" : `שולחן ${t}`}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Fallback: no order loaded */}
              {!loadingOrder && !order && (
                <div style={{ textAlign: "center", color: "#aaa", fontSize: 13, padding: 12 }}>₪{totalAmount.toFixed(0)} סה&quot;כ</div>
              )}
            </>
          )}

          {/* ════ FREE / RESERVED / INACTIVE ════ */}
          {!isOccupied && (
            <>
              <div style={{ background: "#fff", border: "1.5px solid #e8e2da", borderRadius: 16, padding: "14px 18px", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#1a1612" }}>כמה סועדים?</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#f4f1ed", borderRadius: 99, padding: "6px 16px" }}>
                    <button onClick={() => setGuestCount(g => Math.max(1, g - 1))} style={{ width: 30, height: 30, borderRadius: 99, border: "none", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,.08)", cursor: "pointer", fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>−</button>
                    <span style={{ fontSize: 20, fontWeight: 900, minWidth: 28, textAlign: "center" }}>{guestCount}</span>
                    <button onClick={() => setGuestCount(g => g + 1)} style={{ width: 30, height: 30, borderRadius: 99, border: "none", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,.08)", cursor: "pointer", fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>+</button>
                  </div>
                </div>
                {guestCount > seats && (
                  <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: "#92620a" }}>⚠️ שולחן מוגדר ל־{seats} מקומות</div>
                )}
              </div>
              <div style={{ background: "#fff", border: "1.5px solid #e8e2da", borderRadius: 16, padding: "14px 18px", marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#8a8480", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>אלרגיות בשולחן?</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  <button onClick={() => setAllergens([])} style={{ padding: "7px 14px", borderRadius: 99, border: `1.5px solid ${allergens.length === 0 ? "#5a9e7a" : "#e8e2da"}`, background: allergens.length === 0 ? "#f0f7f3" : "#f4f1ed", color: allergens.length === 0 ? "#1f5c3a" : "#4a4540", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>ללא</button>
                  {ALLERGEN_LIST.map(a => (
                    <button key={a.key} onClick={() => toggleAllergen(a.key)} style={{ padding: "7px 14px", borderRadius: 99, border: `1.5px solid ${allergens.includes(a.key) ? "#e07060" : "#e8e2da"}`, background: allergens.includes(a.key) ? "#fdf2f0" : "#f4f1ed", color: allergens.includes(a.key) ? "#8b2e22" : "#4a4540", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{a.label}</button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#8a8480", marginBottom: 8 }}>שינוי סטטוס:</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {(["reserved", "inactive", "free"] as const).map(s => (
                    <button key={s} onClick={() => { onStatusChange(s); }} style={{ flex: 1, padding: "8px 6px", borderRadius: 10, border: "1.5px solid #e8e2da", background: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#4a4540", fontFamily: "inherit" }}>
                      {{ reserved: "🔵 מוזמן", inactive: "🔴 לא פעיל", free: "🟢 פנוי" }[s]}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ background: "#fff", borderTop: "1px solid #ede9e3", padding: "14px 16px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>

          {/* Occupied + order loaded */}
          {isOccupied && order && (
            <>
              <button onClick={() => onAddItems(order)} style={{ padding: 16, borderRadius: 14, border: "none", background: "#1a1612", color: "#fff", fontSize: 15, fontWeight: 900, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                ➕ הוסף מנות
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => router.push(`/admin/cashier?tableNumber=${encodeURIComponent(tableNum)}&restaurantId=${encodeURIComponent(restaurantId)}&waiter=1`)}
                  style={{ flex: 1, padding: 13, borderRadius: 12, border: "1.5px solid #f5c4bc", background: "#fdf2f0", fontSize: 13, fontWeight: 800, cursor: "pointer", color: "#c0392b", fontFamily: "inherit" }}>
                  💳 סגור חשבון
                </button>
                <button onClick={() => { setStatusEditOpen(o => !o); setAllergyEditOpen(false); }} style={{ flex: 1, padding: 13, borderRadius: 12, border: `1.5px solid ${statusEditOpen ? "#93c5fd" : "#e8e2da"}`, background: statusEditOpen ? "#eff6ff" : "#f4f1ed", fontSize: 13, fontWeight: 800, cursor: "pointer", color: statusEditOpen ? "#1d4ed8" : "#4a4540", fontFamily: "inherit" }}>
                  🔄 שנה סטטוס
                </button>
                <button onClick={() => { setAllergyEditOpen(o => !o); setStatusEditOpen(false); }} style={{ flex: 1, padding: 13, borderRadius: 12, border: `1.5px solid ${allergyEditOpen ? "#e07060" : "#e8e2da"}`, background: allergyEditOpen ? "#fdf2f0" : "#f4f1ed", fontSize: 13, fontWeight: 800, cursor: "pointer", color: allergyEditOpen ? "#8b2e22" : "#4a4540", fontFamily: "inherit" }}>
                  ⚠️ אלרגיות
                </button>
              </div>
            </>
          )}

          {/* Occupied, no order */}
          {isOccupied && !order && !loadingOrder && (
            <>
              <button onClick={() => onNewOrder(guestCount, allergens)} style={{ padding: 15, borderRadius: 12, border: "none", background: "#1a1612", color: "#fff", fontSize: 15, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}>
                🍽️ פתח הזמנה חדשה
              </button>
              <button onClick={() => onStatusChange("free")} style={{ padding: 12, borderRadius: 12, border: "1.5px solid #e8e2da", background: "#f4f1ed", fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#4a4540", fontFamily: "inherit" }}>
                🟢 סמן כפנוי
              </button>
            </>
          )}

          {/* Free table */}
          {!isOccupied && (
            <>
              <button onClick={() => onNewOrder(guestCount, allergens)} style={{ padding: 16, borderRadius: 14, border: "none", background: "#1a1612", color: "#fff", fontSize: 15, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}>
                🍽️ פתח שולחן והזמן
              </button>
              <button onClick={onClose} style={{ padding: 12, borderRadius: 12, border: "1.5px solid #e8e2da", background: "#f4f1ed", fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#4a4540", fontFamily: "inherit" }}>
                ביטול
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
