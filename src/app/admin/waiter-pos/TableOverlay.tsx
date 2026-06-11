"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ALLERGEN_LIST } from "@/lib/allergens";
import Receipt from "./Receipt";

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
  servedAt: string | null | undefined;
  isComped: boolean;
  voidedAt?: string | null;
  noKitchen?: boolean;
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
  restaurantName?: string;
  waiterName?: string;
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
  restaurantName = "המסעדה", waiterName = "",
  onClose, onAddItems, onNewOrder, onStatusChange,
}: Props) {
  const router = useRouter();
  const isOccupied = availStatus === "occupied" || availStatus === "bill_requested";
  const orderId = activeOrderIds[0] ?? null;

  const [order, setOrder]               = useState<OrderDetail | null>(null);
  const [showReceipt, setShowReceipt]   = useState(false);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [allergyEditOpen, setAllergyEditOpen] = useState(false);
  const [statusEditOpen, setStatusEditOpen]   = useState(false);
  const [allergens, setAllergens]       = useState<string[]>([]);
  const [savingAllergens, setSavingAllergens] = useState(false);
  const [guestCount, setGuestCount]     = useState(Math.max(guests, 2));
  const [firingCourse, setFiringCourse]   = useState<number | null>(null);
  const [servingCourse, setServingCourse] = useState<number | null>(null);
  const [transferOpen, setTransferOpen]   = useState(false);
  const [transferring, setTransferring]   = useState(false);
  const [removingItem, setRemovingItem]   = useState<string | null>(null);
  const [servingItem, setServingItem]     = useState<string | null>(null);
  const [billWarning, setBillWarning]     = useState(false);

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

  function handleCloseBill() {
    if (!order) return;
    const openItems = order.items.filter(i =>
      !i.voidedAt && !i.isComped && i.itemStatus !== "CANCELLED" &&
      i.itemStatus !== "SERVED" && !i.servedAt
    );
    if (openItems.length > 0) { setBillWarning(true); return; }
    router.push(`/admin/cashier?tableNumber=${encodeURIComponent(tableNum)}&restaurantId=${encodeURIComponent(restaurantId)}&waiter=1`);
  }

  async function toggleComp(itemId: string) {
    if (!orderId) return;
    setRemovingItem(itemId);
    await fetch(`/api/admin/orders/${orderId}/items/${itemId}/status`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comp: true }),
    });
    const r = await fetch(`/api/admin/orders/${orderId}`);
    if (r.ok) setOrder(await r.json());
    setRemovingItem(null);
  }

  async function serveItem(itemId: string) {
    if (!orderId) return;
    setServingItem(itemId);
    await fetch(`/api/admin/orders/${orderId}/items/${itemId}/status`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serve: true }),
    });
    const r = await fetch(`/api/admin/orders/${orderId}`);
    if (r.ok) setOrder(await r.json());
    setServingItem(null);
  }

  async function serveCourse(course: number) {
    if (!orderId || !order) return;
    setServingCourse(course);
    const items = order.items.filter(i => i.course === course && !i.voidedAt && (i.itemStatus === "DONE" || i.itemStatus === "SERVED"));
    await Promise.all(items.map(i =>
      fetch(`/api/admin/orders/${orderId}/items/${i.id}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serve: true }),
      })
    ));
    const r = await fetch(`/api/admin/orders/${orderId}`);
    if (r.ok) setOrder(await r.json());
    setServingCourse(null);
  }

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

  const activeItems = (order?.items ?? [])
    .filter(i => !i.voidedAt && i.itemStatus !== "CANCELLED")
    .sort((a, b) => {
      const aDone = a.itemStatus === "DONE" ? 0 : 1;
      const bDone = b.itemStatus === "DONE" ? 0 : 1;
      if (aDone !== bDone) return aDone - bDone;
      return a.course - b.course;
    });
  const noKitchenItems = activeItems.filter(i => i.noKitchen);
  const kitchenItems   = activeItems.filter(i => !i.noKitchen);
  const billTotal    = order?.totalAmount ?? totalAmount;
  const allergyHits  = (order?.tableAllergens ?? []);

  // ── Overlay wrappers ─────────────────────────────────────────────
  const bgStyle: React.CSSProperties = isMobile
    ? { position: "fixed", inset: 0, zIndex: 500 }
    : { position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" };

  const panelStyle: React.CSSProperties = isMobile
    ? { position: "fixed", inset: 0, background: "#f5f3ef", display: "flex", flexDirection: "column", zIndex: 501 }
    : { position: "relative", background: "#f5f3ef", borderRadius: 28, width: 500, height: "min(92dvh, 820px)", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,.22)" };

  return (
    <>
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
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 16px 8px" }}>

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
                  {(() => {
                    const itemStatusMap: Record<string, { label: string; bg: string; color: string }> = {
                      PENDING:   { label: "ממתין", bg: "#f3f4f6", color: "#6b7280" },
                      PREPARING: { label: "בהכנה", bg: "#fff7ed", color: "#c2410c" },
                      DONE:      { label: "מוכן",  bg: "#f0fdf4", color: "#15803d" },
                      SERVED:    { label: "הוגש",  bg: "#eff6ff", color: "#1d4ed8" },
                      CANCELLED: { label: "בוטל",  bg: "#fef2f2", color: "#dc2626" },
                    };

                    const renderItem = (oi: typeof activeItems[0], isLast: boolean) => {
                      const allergyHit   = oi.itemAllergens.some(a => allergyHits.includes(a));
                      const allergyLabel = oi.itemAllergens.filter(a => allergyHits.includes(a))
                        .map(k => ALLERGEN_LIST.find(a => a.key === k)?.label ?? k).join(", ");
                      const si       = itemStatusMap[oi.itemStatus] ?? itemStatusMap.PENDING;
                      const isServed = !!(oi.servedAt) || oi.itemStatus === "SERVED";
                      const canServe = !isServed && !oi.isComped && oi.itemStatus !== "CANCELLED";
                      return (
                        <div key={oi.id} style={{ padding: "8px 14px", borderBottom: isLast ? undefined : "1px solid #f0ebe4", display: "flex", alignItems: "center", direction: "rtl", gap: 6, opacity: oi.isComped ? 0.6 : 1 }}>
                          {/* RTL start (physical right): course + name + allergens */}
                          <div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 14, color: "#1a1612", fontWeight: 600, textDecoration: oi.isComped ? "line-through" : "none" }}>{oi.itemName} × {oi.quantity}</span>
                            {allergyHit && <span style={{ fontSize: 10, fontWeight: 800, background: "#fdf2f0", color: "#8b2e22", borderRadius: 99, padding: "2px 7px", border: "1px solid #f5c4bc", flexShrink: 0 }}>⚠️ {allergyLabel}</span>}
                          </div>
                          {/* Status + price */}
                          <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, background: si.bg, color: si.color, borderRadius: 99, padding: "3px 9px", whiteSpace: "nowrap" }}>{si.label}</span>
                            <div style={{ fontSize: 14, fontWeight: 800, color: oi.isComped ? "#9ca3af" : "#1a1612", minWidth: 34, textAlign: "left", textDecoration: oi.isComped ? "line-through" : "none" }}>
                              ₪{(oi.price * oi.quantity).toFixed(0)}
                            </div>
                          </div>
                          {/* RTL end (physical left): הגש + X */}
                          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                            {canServe ? (
                              <button onClick={() => serveItem(oi.id)} disabled={servingItem === oi.id}
                                style={{ height: 24, padding: "0 8px", borderRadius: 6, border: "1.5px solid #86efac", background: "#f0fdf4", color: "#15803d", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0, fontFamily: "inherit", whiteSpace: "nowrap" }}>
                                {servingItem === oi.id ? "…" : "הגש"}
                              </button>
                            ) : <div style={{ width: 32 }} />}
                            <button onClick={() => toggleComp(oi.id)} disabled={removingItem === oi.id} title={oi.isComped ? "בטל הסרה" : "הסר מחשבון"}
                              style={{ background: "none", border: "none", color: oi.isComped ? "#9ca3af" : "#dc2626", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "2px 4px", flexShrink: 0, fontFamily: "inherit", lineHeight: 1 }}>
                              {removingItem === oi.id ? "…" : "✕"}
                            </button>
                          </div>
                        </div>
                      );
                    };

                    return (
                      <div style={{ background: "#fff", border: "1.5px solid #e8e2da", borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
                        {/* ── No-kitchen items ── */}
                        {noKitchenItems.length > 0 && (
                          <>
                            {(noKitchenItems.length > 0 && kitchenItems.length > 0) && <div style={{ height: 6, background: "#f4f1ed", borderTop: "1px solid #e8e2da", borderBottom: "1px solid #e8e2da" }} />}
                            <div style={{ display: "flex", direction: "rtl" }}>
                              <div style={{ writingMode: "vertical-rl", transform: "rotate(0deg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, letterSpacing: 2, padding: "10px 6px", flexShrink: 0, width: 28, borderLeft: "3px solid #f59e0b", color: "#92400e" }}>ללא מטבח</div>
                              <div style={{ flex: 1 }}>
                                {noKitchenItems.map((oi, i) => renderItem(oi, i === noKitchenItems.length - 1))}
                              </div>
                            </div>
                          </>
                        )}

                        {/* ── Kitchen items grouped by course ── */}
                        {(() => {
                          const courses = Array.from(new Set(kitchenItems.map(i => i.course))).sort();
                          const courseColors = ["#3b82f6","#22c55e","#a855f7","#f59e0b","#ef4444","#06b6d4"];
                          const courseFg     = ["#1d4ed8","#166534","#7e22ce","#92400e","#b91c1c","#0e7490"];
                          return courses.map((c, ci) => {
                            const items = kitchenItems.filter(i => i.course === c);
                            const isFirst = ci === 0;
                            return (
                              <React.Fragment key={c}>
                                {(noKitchenItems.length > 0 || !isFirst) && <div style={{ height: 6, background: "#f4f1ed", borderTop: "1px solid #e8e2da", borderBottom: "1px solid #e8e2da" }} />}
                                <div style={{ display: "flex", direction: "rtl" }}>
                                  <div style={{ writingMode: "vertical-rl", transform: "rotate(0deg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, letterSpacing: 2, padding: "10px 6px", flexShrink: 0, width: 28, borderLeft: `3px solid ${courseColors[ci % courseColors.length]}`, color: courseFg[ci % courseFg.length] }}>{["I","II","III","IV","V","VI","VII","VIII"][c-1] ?? String(c)}</div>
                                  <div style={{ flex: 1 }}>
                                    {items.map((oi, i) => renderItem(oi, i === items.length - 1))}
                                  </div>
                                </div>
                              </React.Fragment>
                            );
                          });
                        })()}

                        {/* Total row — RTL: סה"כ on right, amount on left */}
                        <div style={{ padding: "11px 16px", borderTop: "1.5px solid #e8e2da", display: "flex", justifyContent: "space-between", alignItems: "center", direction: "rtl" }}>
                          <div style={{ fontSize: 14, fontWeight: 900, color: "#1a1612" }}>סה&quot;כ</div>
                          <div style={{ fontSize: 15, fontWeight: 900, color: "#1a1612" }}>₪{billTotal.toFixed(0)}</div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Course management */}
                  {courseNums.length > 0 && (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#c07020", marginBottom: 5, display: "flex", alignItems: "center", gap: 4 }}>🔥 ניהול קורסים</div>
                      {courseNums.map(c => {
                        const courseItems  = (order.items ?? []).filter(i => i.course === c && !i.voidedAt && i.itemStatus !== "CANCELLED");
                        const allHeld      = courseItems.length > 0 && courseItems.every(i => i.heldUntilFired && !i.firedAt);
                        const allServed    = courseItems.length > 0 && courseItems.every(i => i.servedAt || i.itemStatus === "SERVED");
                        const allDone      = courseItems.length > 0 && courseItems.every(i => i.itemStatus === "DONE" || i.itemStatus === "SERVED" || i.servedAt);
                        const anyPreparing = courseItems.some(i => i.itemStatus === "PREPARING");
                        const hasFired     = courseItems.some(i => !!i.firedAt);

                        // Derive display status after firing
                        type CourseState = "held" | "pending" | "preparing" | "done" | "served";
                        const state: CourseState =
                          allServed   ? "served"   :
                          allDone     ? "done"     :
                          anyPreparing? "preparing":
                          allHeld     ? "held"     :
                          hasFired    ? "pending"  : "held";

                        const stateStyle: Record<CourseState, { bg: string; border: string; label: string; labelColor: string }> = {
                          held:      { bg: "#fff",    border: "1.5px solid #e8e2da", label: "ממתין לשחרור", labelColor: "#8a8480" },
                          pending:   { bg: "#fffbeb", border: "1.5px solid #fde68a", label: "⏳ נשלח — ממתין במטבח", labelColor: "#92400e" },
                          preparing: { bg: "#fff7ed", border: "1.5px solid #fed7aa", label: "🍳 בהכנה", labelColor: "#c2410c" },
                          done:      { bg: "#f0fdf4", border: "1.5px solid #86efac", label: "✅ מוכן להגשה!", labelColor: "#15803d" },
                          served:    { bg: "#eff6ff", border: "1.5px solid #bfdbfe", label: "🍽️ הוגש", labelColor: "#1d4ed8" },
                        };
                        const ss = stateStyle[state];

                        return (
                          <div key={c} style={{ background: ss.bg, border: ss.border, borderRadius: 10, padding: "7px 12px", marginBottom: 5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 800, color: "#1a1612" }}>קורס {c} – {courseItems.length} פריטים</div>
                              <div style={{ fontSize: 10, marginTop: 2, fontWeight: 700, color: ss.labelColor }}>{ss.label}</div>
                            </div>
                            {state === "held" ? (
                              <button onClick={() => fireCourse(c)} disabled={firingCourse === c} style={{ padding: "4px 13px", borderRadius: 99, border: "1.5px solid #d4a840", background: "#fdf7ed", color: "#92400e", fontSize: 11, fontWeight: 800, cursor: firingCourse === c ? "default" : "pointer", fontFamily: "inherit" }}>
                                {firingCourse === c ? "…" : "🔥 שחרר"}
                              </button>
                            ) : state === "done" ? (
                              <button onClick={() => serveCourse(c)} disabled={servingCourse === c} style={{ padding: "4px 13px", borderRadius: 99, background: "#dcfce7", color: "#15803d", fontSize: 11, fontWeight: 800, border: "1.5px solid #86efac", cursor: servingCourse === c ? "default" : "pointer", fontFamily: "inherit" }}>
                                {servingCourse === c ? "…" : "✅ הוגש"}
                              </button>
                            ) : state === "served" ? (
                              <div style={{ padding: "4px 10px", borderRadius: 99, background: "#eff6ff", color: "#1d4ed8", fontSize: 11, fontWeight: 800, border: "1.5px solid #bfdbfe" }}>✓ הוגש</div>
                            ) : (
                              <div style={{ padding: "4px 10px", borderRadius: 99, background: ss.bg, color: ss.labelColor, fontSize: 11, fontWeight: 700, border: ss.border }}>{state === "preparing" ? "מכינים..." : "במטבח"}</div>
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

        {/* ── Bill warning modal ── */}
        {billWarning && order && (() => {
          const blockItems   = order.items.filter(i => !i.voidedAt && !i.isComped && i.itemStatus !== "CANCELLED" && (i.itemStatus === "PENDING" || i.itemStatus === "PREPARING"));
          const notServItems = order.items.filter(i => !i.voidedAt && !i.isComped && i.itemStatus !== "CANCELLED" && i.itemStatus !== "SERVED" && !i.servedAt && i.itemStatus !== "PENDING" && i.itemStatus !== "PREPARING");
          const hardBlock    = blockItems.length > 0;
          return (
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "inherit" }}>
              <div style={{ background: "#fff", borderRadius: 20, padding: "24px 20px", margin: 16, width: "100%", maxWidth: 380, direction: "rtl", boxShadow: "0 12px 40px rgba(0,0,0,0.25)" }}>
                <div style={{ fontSize: 28, textAlign: "center", marginBottom: 8 }}>{hardBlock ? "🚫" : "⚠️"}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#1a1612", textAlign: "center", marginBottom: 6 }}>
                  {hardBlock ? "לא ניתן לסגור חשבון" : "יש מנות שלא הוגשו"}
                </div>
                <div style={{ fontSize: 13, color: "#6b7280", textAlign: "center", marginBottom: 16, lineHeight: 1.6 }}>
                  {hardBlock
                    ? "ישנן מנות שעדיין בהכנה במטבח. יש להמתין לסיום לפני סגירת החשבון."
                    : "הבא המנות הבאות לא סומנו כהוגשו. האם לסגור את החשבון בכל זאת?"}
                </div>

                {/* List of problematic items */}
                <div style={{ background: "#f9fafb", borderRadius: 12, padding: "10px 14px", marginBottom: 16, maxHeight: 160, overflowY: "auto" }}>
                  {[...blockItems, ...notServItems].map(i => (
                    <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: "1px solid #f3f4f6" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, background: i.itemStatus === "PREPARING" ? "#fff7ed" : i.itemStatus === "PENDING" ? "#f3f4f6" : "#eff6ff", color: i.itemStatus === "PREPARING" ? "#c2410c" : i.itemStatus === "PENDING" ? "#6b7280" : "#1d4ed8", borderRadius: 99, padding: "1px 7px", whiteSpace: "nowrap" }}>
                        {i.itemStatus === "PREPARING" ? "בהכנה" : i.itemStatus === "PENDING" ? "ממתין" : "מוכן"}
                      </span>
                      <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>{i.itemName}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setBillWarning(false)}
                    style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "1.5px solid #e5e7eb", background: "#f9fafb", fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#374151", fontFamily: "inherit" }}>
                    ביטול
                  </button>
                  {!hardBlock && (
                    <button onClick={() => { setBillWarning(false); router.push(`/admin/cashier?tableNumber=${encodeURIComponent(tableNum)}&restaurantId=${encodeURIComponent(restaurantId)}&waiter=1`); }}
                      style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "1.5px solid #f5c4bc", background: "#fdf2f0", fontSize: 13, fontWeight: 800, cursor: "pointer", color: "#c0392b", fontFamily: "inherit" }}>
                      סגור בכל זאת
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Footer ── */}
        <div style={{ background: "#fff", borderTop: "1px solid #ede9e3", padding: "14px 16px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>

          {/* Occupied + order loaded */}
          {isOccupied && order && (
            <>
              <button onClick={() => onAddItems(order)} style={{ padding: 16, borderRadius: 14, border: "none", background: "#1a1612", color: "#fff", fontSize: 15, fontWeight: 900, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                ➕ הוסף מנות
              </button>
              <div style={{ display: "flex", gap: 8, direction: "rtl" }}>
                <button onClick={() => { onStatusChange("bill_requested"); if (order) setShowReceipt(true); }}
                  style={{ flex: 1, padding: 13, borderRadius: 12, border: "1.5px solid #fed7aa", background: "#fff7ed", fontSize: 13, fontWeight: 800, cursor: "pointer", color: "#c2410c", fontFamily: "inherit" }}>
                  🧾 מבקש חשבון
                </button>
                <button onClick={handleCloseBill}
                  style={{ flex: 1, padding: 13, borderRadius: 12, border: "1.5px solid #f5c4bc", background: "#fdf2f0", fontSize: 13, fontWeight: 800, cursor: "pointer", color: "#c0392b", fontFamily: "inherit" }}>
                  💳 סגור חשבון
                </button>
                <button onClick={() => { setStatusEditOpen(o => !o); setAllergyEditOpen(false); }}
                  style={{ flex: 1, padding: 13, borderRadius: 12, border: `1.5px solid ${statusEditOpen ? "#93c5fd" : "#e8e2da"}`, background: statusEditOpen ? "#eff6ff" : "#f4f1ed", fontSize: 13, fontWeight: 800, cursor: "pointer", color: statusEditOpen ? "#1d4ed8" : "#4a4540", fontFamily: "inherit" }}>
                  סטטוס
                </button>
                <button onClick={() => { setAllergyEditOpen(o => !o); setStatusEditOpen(false); }}
                  style={{ flex: 1, padding: 13, borderRadius: 12, border: `1.5px solid ${allergyEditOpen ? "#e07060" : "#e8e2da"}`, background: allergyEditOpen ? "#fdf2f0" : "#f4f1ed", fontSize: 13, fontWeight: 800, cursor: "pointer", color: allergyEditOpen ? "#8b2e22" : "#4a4540", fontFamily: "inherit" }}>
                  אלרגנים
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

    {showReceipt && order && (
      <Receipt
        order={order}
        tableNum={tableNum}
        restaurantName={restaurantName}
        waiterName={waiterName}
        autoPrint={true}
        onClose={() => setShowReceipt(false)}
      />
    )}
    </>
  );
}
