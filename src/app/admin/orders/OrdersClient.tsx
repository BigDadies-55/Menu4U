"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { T } from "@/lib/ui";

type OrderItemModifier = { groupName: string; label: string; priceAdd: number };

type OrderItem = {
  id: string;
  quantity: number;
  price: number;
  notes: string | null;
  itemStatus: string;
  course: number;
  heldUntilFired: boolean;
  firedAt: string | null;
  doneAt: string | null;
  servedAt: string | null;
  item: { name: string };
  modifiers?: OrderItemModifier[];
};

type Order = {
  id: string;
  tableNumber: string | null;
  status: string;
  orderNumber?: number | null;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
  orderSource: string;
  loyaltyMemberId: string | null;
  loyaltyMemberName: string | null;
  loyaltyDiscountAmount: number | null;
  restaurant: { id: string; name: string };
  items: OrderItem[];
};

type Restaurant = { id: string; name: string };
type TableLayout = { tableNumber?: string; seats?: number };

const ITEM_STATUS_LABEL: Record<string, string> = {
  PENDING: "ממתין",
  PREPARING: "בהכנה",
  DONE: "הוכן",
  CANCELLED: "בוטל",
  HELD: "ממתין להצתה",
};

const COURSE_LABEL: Record<number, string> = { 1: "ראשון", 2: "עיקרי", 3: "קינוח" };
const COURSE_EMOJI: Record<number, string> = { 1: "🥗", 2: "🍖", 3: "🍮" };

const DK_INPUT: React.CSSProperties = {
  background: T.overlay, border: `1px solid ${T.border}`, color: T.text,
  borderRadius: 10, padding: "8px 12px", fontSize: 13,
  outline: "none", width: "100%", fontFamily: "inherit",
};

const ITEM_STATUS_STYLE: Record<string, React.CSSProperties> = {
  PENDING:   { background: "rgba(212,160,23,.15)",  color: T.gold },
  PREPARING: { background: "rgba(59,130,246,.15)",  color: T.blue },
  DONE:      { background: "rgba(34,197,94,.15)",   color: T.green },
  CANCELLED: { background: "rgba(239,68,68,.12)",   color: T.red, textDecoration: "line-through" },
  HELD:      { background: "rgba(167,139,250,.15)", color: T.purple },
};

const ORDER_STATUS_STYLE: Record<string, React.CSSProperties> = {
  PENDING:   { background: "rgba(212,160,23,.15)",  color: T.gold },
  CONFIRMED: { background: "rgba(59,130,246,.15)",  color: T.blue },
  PREPARING: { background: "rgba(249,115,22,.15)",  color: T.orange },
  READY:     { background: "rgba(34,197,94,.15)",   color: T.green },
  DELIVERED: { background: "rgba(122,96,80,.15)",   color: T.muted },
  CANCELLED: { background: "rgba(122,96,80,.12)",   color: T.muted },
  PAID:      { background: "rgba(34,197,94,.2)",    color: T.green },
};

// Keep old maps for any remaining usage (unused but avoids TS errors)
const ITEM_STATUS_COLOR: Record<string, string> = {
  PENDING: "", PREPARING: "", DONE: "", CANCELLED: "",
};
const ORDER_STATUS_BADGE: Record<string, string> = {
  PENDING: "", CONFIRMED: "", PREPARING: "", READY: "", DELIVERED: "", CANCELLED: "", PAID: "",
};

function timeSince(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return "עכשיו";
  if (diff < 60) return `${diff} דק'`;
  return `${Math.floor(diff / 60)}ש'`;
}

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

function playBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch { /* ignore */ }
}

/* ── Bill Modal ── */
function BillModal({
  tableNumber, orders, onConfirm, onClose,
}: {
  tableNumber: string;
  orders: Order[];
  onConfirm: (tipAmount: number, payMethod: string) => void;
  onClose: () => void;
}) {
  const [tipPct, setTipPct]     = useState<number>(0);
  const [customTip, setCustomTip] = useState("");
  const [payMethod, setPayMethod] = useState<"cash" | "card" | "app">("card");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const validOrders = orders.filter(o => !["CANCELLED","PAID"].includes(o.status));
  // totalAmount already has discount baked in after redemption
  const subtotal = validOrders.reduce((s, o) => s + o.totalAmount, 0);
  const loyaltyDiscount = validOrders.reduce((s, o) => s + (o.loyaltyDiscountAmount ?? 0), 0);
  const loyaltyMemberNames = [...new Set(validOrders.filter(o => o.loyaltyMemberName).map(o => o.loyaltyMemberName!))];
  const tipAmount = tipPct === -1
    ? (parseFloat(customTip) || 0)
    : Math.round(subtotal * tipPct) / 100;
  const total = subtotal + tipAmount;

  async function handleConfirm() {
    setConfirming(true);
    onConfirm(tipAmount, payMethod);
  }

  const PAY_METHODS = [
    { value: "card" as const, label: "💳 כרטיס" },
    { value: "cash" as const, label: "💵 מזומן" },
    { value: "app"  as const, label: "📱 אפליקציה" },
  ];
  const TIP_OPTS = [
    { pct: 0,  label: "ללא" },
    { pct: 10, label: "10%" },
    { pct: 12, label: "12%" },
    { pct: 15, label: "15%" },
    { pct: -1, label: "אחר" },
  ];

  const lbl = (t: string) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>{t}</div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, direction: "rtl" }}>
      <div style={{ background: T.surface, borderRadius: 18, border: `1px solid ${T.border}`, boxShadow: "0 24px 60px rgba(0,0,0,.5)", width: "100%", maxWidth: 480, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "16px 20px", background: "linear-gradient(135deg,#8B6914,#C9A84C)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 18 }}>💳 חשבון — שולחן {tableNumber}</div>
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 }}>
              {validOrders.length} הזמנות · {validOrders[0] ? fmtTime(validOrders[0].createdAt) : ""}
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: 32, height: 32, color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
          {/* Tip */}
          <div>
            {lbl("טיפ")}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {TIP_OPTS.map(opt => (
                <button key={opt.pct} type="button"
                  onClick={() => { setTipPct(opt.pct); if (opt.pct !== -1) setCustomTip(""); }}
                  style={{ padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: "pointer",
                    border: `1px solid ${tipPct === opt.pct ? T.gold : T.border}`,
                    background: tipPct === opt.pct ? "rgba(252,196,25,.15)" : T.overlay,
                    color: tipPct === opt.pct ? T.gold : T.sub }}>
                  {opt.label}
                </button>
              ))}
            </div>
            {tipPct === -1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
                <span style={{ fontSize: 13, color: T.muted }}>₪</span>
                <input type="number" min="0" step="1" value={customTip} onChange={e => setCustomTip(e.target.value)}
                  placeholder="סכום טיפ" style={{ ...DK_INPUT, width: 110 }} />
              </div>
            )}
          </div>

          {/* Summary */}
          <div style={{ background: T.overlay, borderRadius: 12, padding: "14px 16px" }}>
            {loyaltyDiscount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: T.sub, marginBottom: 8 }}>
                <span>סכום לפני הנחה</span>
                <span style={{ fontWeight: 600, color: T.text }}>₪{(subtotal + loyaltyDiscount).toFixed(2)}</span>
              </div>
            )}
            {loyaltyDiscount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 8, alignItems: "center" }}>
                <span style={{ color: "#4ade80", display: "flex", alignItems: "center", gap: 4 }}>
                  ⭐ הנחת מועדון{loyaltyMemberNames.length > 0 ? ` (${loyaltyMemberNames.join(", ")})` : ""}
                </span>
                <span style={{ fontWeight: 700, color: "#4ade80" }}>−₪{loyaltyDiscount.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: T.sub, marginBottom: 8 }}>
              <span>{loyaltyDiscount > 0 ? "לאחר הנחה" : "סכום"}</span>
              <span style={{ fontWeight: 600, color: T.text }}>₪{subtotal.toFixed(2)}</span>
            </div>
            {tipAmount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: T.sub, marginBottom: 8 }}>
                <span>טיפ</span>
                <span style={{ fontWeight: 600, color: T.text }}>₪{tipAmount.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 900, borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
              <span style={{ color: T.text }}>סה&quot;כ לתשלום</span>
              <span style={{ color: T.gold }}>₪{total.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment method */}
          <div>
            {lbl("אמצעי תשלום")}
            <div style={{ display: "flex", gap: 8 }}>
              {PAY_METHODS.map(m => (
                <button key={m.value} type="button" onClick={() => setPayMethod(m.value)}
                  style={{ flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
                    border: `1px solid ${payMethod === m.value ? T.gold : T.border}`,
                    background: payMethod === m.value ? "rgba(252,196,25,.15)" : T.overlay,
                    color: payMethod === m.value ? T.gold : T.sub }}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 10 }}>
          <button type="button" onClick={onClose}
            style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: `1px solid ${T.border}`, background: T.overlay, color: T.sub, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
            ביטול
          </button>
          <button type="button" onClick={handleConfirm} disabled={confirming}
            style={{ flex: 2, padding: "11px 0", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#8B6914,#C9A84C)", color: "#fff", fontWeight: 800, fontSize: 15, cursor: confirming ? "wait" : "pointer", opacity: confirming ? 0.7 : 1 }}>
            {confirming ? "שומר..." : "✓ אשר תשלום"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Table Card ── */
function TableCard({
  tableNumber,
  orders,
  isClosed,
  highlighted,
  showAll,
  onItemCancel,
  onItemServe,
  onOrderCancel,
  onConfirmOrder,
  onDeliverOrder,
  onFireCourse,
}: {
  tableNumber: string;
  orders: Order[];
  isClosed: boolean;
  highlighted?: boolean;
  showAll?: boolean;
  onItemCancel: (orderId: string, itemId: string) => Promise<void>;
  onItemServe: (orderId: string, itemId: string, served: boolean) => Promise<void>;
  onOrderCancel: (orderId: string) => Promise<void>;
  onConfirmOrder: (orderId: string) => Promise<void>;
  onDeliverOrder: (orderId: string) => Promise<void>;
  onFireCourse: (orderId: string, course: number) => Promise<void>;
}) {
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [isCollapsed, setIsCollapsed] = useState(isClosed);
  const [actioning, setActioning] = useState(false);

  // Sync collapse when isClosed changes
  useEffect(() => { if (isClosed) setIsCollapsed(true); }, [isClosed]);

  const nonCancelledOrders = showAll
    ? orders
    : orders.filter(o => o.status !== "CANCELLED" && o.status !== "PAID");
  const activeOrders = nonCancelledOrders.filter(o => !["DELIVERED","PAID","CANCELLED"].includes(o.status));
  const allItems = activeOrders
    .flatMap(o => o.items)
    .filter(i => !i.heldUntilFired);

  const oldestOrder = orders.reduce((a, b) =>
    new Date(a.createdAt) < new Date(b.createdAt) ? a : b
  );
  const ageMin = Math.floor((Date.now() - new Date(oldestOrder.createdAt).getTime()) / 60000);
  const isUrgent = ageMin > 20 && activeOrders.length > 0;
  const totalAmount = nonCancelledOrders
    .filter(o => !["CANCELLED"].includes(o.status))
    .reduce((s, o) => s + o.totalAmount, 0);

  // Smart action button state
  const hasPending = nonCancelledOrders.some(o => o.status === "PENDING");
  const hasReady   = nonCancelledOrders.some(o => o.status === "READY");
  const allPaid    = nonCancelledOrders.length > 0 && nonCancelledOrders.every(o => ["PAID","CANCELLED"].includes(o.status));

  // Border / header color
  const cardBorder = hasPending ? "#f59e0b" : isUrgent ? "#ef4444" : highlighted ? "#c9a84c" : "#e5e7eb";
  const headerBg   = hasPending ? "#fffbeb" : isUrgent ? "#fef2f2" : "#f9fafb";

  async function smartAction() {
    setActioning(true);
    if (hasPending) {
      for (const o of nonCancelledOrders.filter(x => x.status === "PENDING")) {
        await onConfirmOrder(o.id);
      }
    } else if (hasReady) {
      for (const o of nonCancelledOrders.filter(x => x.status === "READY")) {
        await onDeliverOrder(o.id);
      }
    }
    setActioning(false);
  }

  async function cancelItem(orderId: string, itemId: string) {
    setBusy(prev => new Set(prev).add(itemId + "-cancel"));
    await onItemCancel(orderId, itemId);
    setBusy(prev => { const n = new Set(prev); n.delete(itemId + "-cancel"); return n; });
  }

  async function toggleServe(orderId: string, itemId: string, currentlyServed: boolean) {
    setBusy(prev => new Set(prev).add(itemId + "-serve"));
    await onItemServe(orderId, itemId, !currentlyServed);
    setBusy(prev => { const n = new Set(prev); n.delete(itemId + "-serve"); return n; });
  }

  // Smart button appearance
  const smartBtn = allPaid
    ? { label: "✓ שולם", color: "#9ca3af", disabled: true }
    : hasPending
    ? { label: actioning ? "..." : "✓ אשר הכל", color: "#16a34a", disabled: actioning }
    : hasReady
    ? { label: actioning ? "..." : "🛎 הגש לשולחן", color: "#0891b2", disabled: actioning }
    : { label: "💳 לתשלום בקופה", color: "#374151", disabled: true };

  // Collapsed row (for closed tables)
  if (isCollapsed) {
    const lastOrder = nonCancelledOrders[nonCancelledOrders.length - 1];
    return (
      <div onClick={() => setIsCollapsed(false)}
        style={{ background: T.surface, borderRadius: 10, border: `1px solid ${highlighted ? T.gold : T.border}`, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: T.overlay, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 11, color: T.muted, flexShrink: 0 }}>
          {tableNumber === "–" ? "?" : tableNumber}
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: T.sub }}>שולחן {tableNumber}</span>
        <span style={{ fontSize: 12, color: T.muted, flex: 1 }}>
          {allPaid ? "✓ שולם" : "✓ סופק"} · ₪{totalAmount.toFixed(0)}
          {lastOrder ? ` · ${fmtTime(lastOrder.createdAt)}` : ""}
        </span>
        <svg width="14" height="14" fill="none" stroke={T.muted} strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
      </div>
    );
  }

  // Header colors based on state
  const hdrBg   = hasPending ? "#2a2310" : isUrgent ? "#2a1a1a" : "#252930";
  const hdrBdr  = hasPending ? "rgba(252,196,25,.3)" : isUrgent ? "rgba(255,107,107,.3)" : T.border;
  const numStyle: React.CSSProperties = hasPending
    ? { background: "rgba(252,196,25,.18)", border: `1.5px solid ${T.gold}`, color: T.gold }
    : isUrgent
    ? { background: "rgba(239,68,68,.15)", border: `1.5px solid ${T.red}`, color: T.red }
    : { background: T.overlay, border: `1.5px solid ${T.border}`, color: T.muted };
  const subTextColor = hasPending ? T.gold : isUrgent ? T.red : T.muted;

  return (
    <div id={`table-${tableNumber}`}
      style={{ borderRadius: 14, overflow: "hidden", border: `${hasPending ? 2 : 1}px solid ${cardBorder}`, background: T.surface }}>

      {/* Table header */}
      <div style={{ padding: "10px 12px 8px", background: hdrBg, borderBottom: `1px solid ${hdrBdr}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div onClick={() => setIsCollapsed(true)} title="קפל שולחן"
            style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 12, flexShrink: 0, cursor: "pointer", ...numStyle }}>
            {tableNumber === "–" ? "?" : tableNumber}
          </div>
          <span style={{ fontWeight: 700, fontSize: 14, flex: 1, color: T.text }}>
            {tableNumber === "–" ? "ללא שולחן" : `שולחן ${tableNumber}`}
          </span>
          {hasPending && (
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 700, flexShrink: 0, background: "rgba(252,196,25,.15)", color: T.gold, border: `1px solid rgba(252,196,25,.3)` }}>
              🕐 ממתין לאישור
            </span>
          )}
          {orders.some(o => o.orderSource === "WAITER") && (
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 700, flexShrink: 0, background: "rgba(124,58,237,.2)", color: T.purple, border: "1px solid rgba(124,58,237,.3)" }}>
              🧑‍🍳 POS
            </span>
          )}
          <div style={{ textAlign: "left", flexShrink: 0 }}>
            <span style={{ fontWeight: 900, fontSize: 18, color: T.text }}>₪{totalAmount.toFixed(0)}</span>
            {(() => {
              const disc = orders.find(o => o.loyaltyDiscountAmount && o.loyaltyDiscountAmount > 0);
              return disc ? (
                <div style={{ fontSize: 10, color: "#C5A880", marginTop: 1 }}>
                  ⭐ −₪{disc.loyaltyDiscountAmount!.toFixed(2)} ({disc.loyaltyMemberName})
                </div>
              ) : null;
            })()}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontSize: 11, color: subTextColor, fontWeight: hasPending || isUrgent ? 600 : 400 }}>
          <span>⏱ {timeSince(oldestOrder.createdAt)} · {allItems.length} מנות</span>
          <span>{nonCancelledOrders.length} הזמנות</span>
        </div>
        {allItems.length > 0 && (
          <div style={{ display: "flex", gap: 3, marginTop: 6 }}>
            {allItems.map(i => (
              <div key={i.id} style={{ height: 4, flex: 1, borderRadius: 2,
                background: i.itemStatus === "DONE" ? T.green : i.itemStatus === "PREPARING" ? T.blue : T.border }} />
            ))}
          </div>
        )}
      </div>

      {/* Orders */}
      {[...nonCancelledOrders].reverse().map((order, idx) => {
        const isPending   = order.status === "PENDING";
        const isDelivered = order.status === "DELIVERED";
        const isReady     = order.status === "READY";
        const isPaid      = order.status === "PAID";
        const isCancelled = order.status === "CANCELLED";

        const orderHdrBg = isPending ? "#262010" : isReady ? "#161e1a" : isPaid ? "#161520" : isCancelled ? "#1f1616" : T.raised;
        const orderStatusLabel = isPending ? "🕐 ממתין" : isDelivered ? "✓ סופק" : isReady ? "✅ מוכן"
          : isPaid ? "💜 שולם" : isCancelled ? "✕ בוטל" : "הזמנה";
        const orderStatusColor = isPending ? T.gold : isDelivered ? T.muted : isReady ? T.green
          : isPaid ? T.purple : isCancelled ? T.red : T.sub;

        return (
          <div key={order.id} style={{ borderTop: idx > 0 ? `1px solid ${T.border}` : undefined }}>
            {/* Order sub-header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 10px", background: orderHdrBg }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700, flexShrink: 0, color: orderStatusColor }}>
                  {orderStatusLabel}
                </span>
                {order.orderNumber != null && (
                  <span style={{ fontSize: 11, fontWeight: 800, color: T.gold, flexShrink: 0 }}>
                    #{order.orderNumber}
                  </span>
                )}
                <span style={{ fontSize: 11, color: T.muted, flexShrink: 0 }}>
                  {order.items.length} מנות · ₪{order.totalAmount.toFixed(0)} · {timeSince(order.createdAt)}
                </span>
                {order.notes && (
                  <span style={{ fontSize: 11, color: T.muted, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>· 💬 {order.notes}</span>
                )}
              </div>
              {!isPending && !isDelivered && !isReady && !isPaid && !isCancelled && (
                <button onClick={() => onOrderCancel(order.id)}
                  style={{ fontSize: 11, color: T.red, background: "rgba(255,107,107,.1)", border: "none", borderRadius: 8, padding: "2px 8px", cursor: "pointer", flexShrink: 0 }}>
                  ✕ בטל
                </button>
              )}
            </div>

            {/* Fire course buttons */}
            {!isPending && !isDelivered && !isPaid && !isCancelled && (() => {
              const heldByCourse = new Map<number, number>();
              order.items.forEach(i => { if (i.heldUntilFired) heldByCourse.set(i.course, (heldByCourse.get(i.course) ?? 0) + 1); });
              if (heldByCourse.size === 0) return null;
              return (
                <div style={{ padding: "6px 10px", display: "flex", gap: 6, flexWrap: "wrap", background: "#1e1528", borderBottom: `1px solid #2d1f4a` }}>
                  {Array.from(heldByCourse.entries()).map(([course, count]) => (
                    <button key={course} onClick={() => onFireCourse(order.id, course)}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 10, fontSize: 12, fontWeight: 700, color: "#fff", border: "none", cursor: "pointer", background: "linear-gradient(135deg,#5b21b6,#7c3aed)" }}>
                      🔥 הצת {COURSE_LABEL[course] ?? `קורס ${course}`} ({count} מנות)
                    </button>
                  ))}
                </div>
              );
            })()}

            {/* Items */}
            <div style={{ opacity: isDelivered || isPaid || isCancelled ? 0.55 : 1 }}>
              {order.items.map(({ id: itemId, quantity, notes, itemStatus, item, modifiers, course, heldUntilFired, firedAt, doneAt, servedAt }) => {
                const isItemCancelled = itemStatus === "CANCELLED";
                const isHeld = heldUntilFired;
                const isDone = itemStatus === "DONE" || isDelivered || isReady || isPaid;
                const isServed = !!servedAt;
                const isServeBusy = busy.has(itemId + "-serve");
                const isCancelBusy = busy.has(itemId + "-cancel");
                const canCancel = !isDelivered && !isReady && !isPaid && !isCancelled && !isItemCancelled && !isDone;
                const canServe = !isItemCancelled && !isCancelled && !isPaid && (itemStatus === "DONE" || isReady || isDelivered);

                const rowBgStyle: React.CSSProperties = isHeld ? { background: "#1a1528" } : isServed ? { background: "#141e18" } : {};
                const qtyStyle: React.CSSProperties = isItemCancelled
                  ? { background: "rgba(255,107,107,.12)", color: T.red }
                  : isHeld ? { background: "rgba(167,139,250,.18)", color: T.purple }
                  : isServed ? { background: "rgba(81,207,102,.15)", color: T.green }
                  : { background: T.overlay, color: T.muted };
                const nameColor = isItemCancelled ? T.muted : isHeld ? T.purple : isServed ? T.green : T.text;

                return (
                  <div key={itemId}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderTop: `1px solid #1a1d23`, opacity: isItemCancelled ? 0.45 : 1, ...rowBgStyle }}>
                    <div style={{ width: 20, height: 20, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0, ...qtyStyle }}>
                      {quantity}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        {course > 1 && <span style={{ fontSize: 11, flexShrink: 0 }}>{COURSE_EMOJI[course] ?? "🍽"}</span>}
                        <span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: nameColor, textDecoration: isItemCancelled ? "line-through" : undefined }}>
                          {item.name}
                          {isHeld && <span style={{ color: "#7c3aed", fontWeight: 400, fontSize: 11 }}> · ממתין להצתה</span>}
                        </span>
                      </div>
                      {firedAt && (
                        <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>
                          {doneAt
                            ? `⏱ ${Math.round((new Date(doneAt).getTime() - new Date(firedAt).getTime()) / 60000)} דק' להכנה`
                            : `🔥 הוצת לפני ${Math.round((Date.now() - new Date(firedAt).getTime()) / 60000)} דק'`}
                        </div>
                      )}
                      {modifiers && modifiers.length > 0 && !isItemCancelled && (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 2 }}>
                          {modifiers.map((m, i) => (
                            <span key={i} style={{ fontSize: 10, padding: "1px 7px", borderRadius: 20, background: "#1e3a2e", color: T.green }}>
                              {m.label}{m.priceAdd > 0 ? ` +₪${m.priceAdd}` : ""}
                            </span>
                          ))}
                        </div>
                      )}
                      {notes && !isItemCancelled && (
                        <div style={{ fontSize: 11, color: T.muted, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{notes}</div>
                      )}
                    </div>

                    {!isServed && !isDelivered && !isPaid && !isHeld && (
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 600, flexShrink: 0, ...(ITEM_STATUS_STYLE[itemStatus] ?? {}) }}>
                        {ITEM_STATUS_LABEL[itemStatus] ?? itemStatus}
                      </span>
                    )}

                    {canServe && (
                      <button onClick={() => toggleServe(order.id, itemId, isServed)} disabled={isServeBusy}
                        title={isServed ? "בטל הגשה" : "הגש לשולחן"}
                        style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer",
                          opacity: isServeBusy ? 0.4 : 1,
                          background: isServed ? "rgba(81,207,102,.15)" : "rgba(51,154,240,.15)",
                          color: isServed ? T.green : T.blue,
                          border: `1px solid ${isServed ? "rgba(81,207,102,.35)" : "rgba(51,154,240,.35)"}` }}>
                        {isServeBusy ? "·" : isServed ? "✓ הוגש" : "🍽 הגש"}
                      </button>
                    )}

                    {canCancel && (
                      <button onClick={() => cancelItem(order.id, itemId)} disabled={isCancelBusy}
                        title="בטל פריט"
                        style={{ flexShrink: 0, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", color: T.red, background: "rgba(255,107,107,.1)", border: "none", cursor: "pointer", fontSize: 11, opacity: isCancelBusy ? 0.4 : 1 }}>
                        {isCancelBusy ? "·" : "✕"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Smart footer */}
      {nonCancelledOrders.length > 0 && (
        <div style={{ padding: "10px 12px", borderTop: `1px solid ${hasPending ? "rgba(252,196,25,.3)" : T.border}` }}>
          <button type="button" onClick={smartAction} disabled={smartBtn.disabled}
            style={{ width: "100%", padding: "11px 0", borderRadius: 10, fontSize: 14, fontWeight: 700, color: "#fff", border: "none", cursor: smartBtn.disabled ? "not-allowed" : "pointer",
              background: smartBtn.color, opacity: smartBtn.disabled ? 0.5 : 1 }}>
            {smartBtn.label}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Main Component ── */
export default function OrdersClient({
  initialOrders,
  restaurants,
  isSuperAdmin,
  defaultRestaurantId,
}: {
  initialOrders: Order[];
  restaurants: Restaurant[];
  isSuperAdmin: boolean;
  defaultRestaurantId: string | null;
}) {
  const [orders, setOrders]             = useState<Order[]>(initialOrders);
  const [filter, setFilter]             = useState<"active" | "all">("active");
  const [restaurantId, setRestaurantId] = useState(defaultRestaurantId ?? "");
  const [refreshing, setRefreshing]     = useState(false);
  const [lastRefresh, setLastRefresh]   = useState(new Date());
  const [dateFrom, setDateFrom]         = useState("");
  const [dateTo, setDateTo]             = useState("");
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [showPosModal, setShowPosModal] = useState(false);
  const [posTable, setPosTable]         = useState("");
  const [posCovers, setPosCovers]       = useState("");
  const [posNotes, setPosNotes]         = useState("");
  const [posItems, setPosItems]         = useState<{ name: string; price: number; course: number; qty: number }[]>([]);
  const [posNewItem, setPosNewItem]     = useState({ name: "", price: "", course: 1, qty: 1 });
  const [posSubmitting, setPosSubmitting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [highlightTable, setHighlightTable] = useState<string | null>(null);
  const [tableLayouts, setTableLayouts]     = useState<TableLayout[]>([]);
  const knownOrderIds = useRef<Set<string>>(new Set(initialOrders.map(o => o.id)));

  // Use refs for values read inside the callback but shouldn't recreate it
  const filterRef      = useRef(filter);
  const dateFromRef    = useRef(dateFrom);
  const dateToRef      = useRef(dateTo);
  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => { filterRef.current = filter; }, [filter]);
  useEffect(() => { dateFromRef.current = dateFrom; }, [dateFrom]);
  useEffect(() => { dateToRef.current = dateTo; }, [dateTo]);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

  const fetchOrders = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    const params = new URLSearchParams();
    if (restaurantId) params.set("restaurantId", restaurantId);
    if (filterRef.current === "active") params.set("activeOnly", "1");
    if (dateFromRef.current) params.set("from", new Date(dateFromRef.current).toISOString());
    if (dateToRef.current) params.set("to", new Date(dateToRef.current).toISOString());
    try {
      const res = await fetch(`/api/admin/orders?${params}`);
      if (res.ok) {
        const newOrders: Order[] = await res.json();
        // Sound alert for new PENDING orders
        const newPending = newOrders.filter(o => o.status === "PENDING" && !knownOrderIds.current.has(o.id));
        if (newPending.length > 0 && soundEnabledRef.current) playBeep();
        newOrders.forEach(o => knownOrderIds.current.add(o.id));
        setOrders(newOrders);
        setLastRefresh(new Date());
      }
    } catch { /* network error, will retry */ }
    if (showSpinner) setRefreshing(false);
  }, [restaurantId]);    // ← only restaurantId; filter/dates/sound via refs

  // Fetch fresh data when filter/date params change (without recreating SSE)
  useEffect(() => { fetchOrders(); }, [fetchOrders, filter, dateFrom, dateTo]);

  // SSE — only reconnects when restaurantId changes
  useEffect(() => {
    fetchOrders();
    const sseUrl = `/api/admin/orders/stream${restaurantId ? `?restaurantId=${restaurantId}` : ""}`;
    let es: EventSource;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      es = new EventSource(sseUrl);
      es.onmessage = () => { fetchOrders(); };
      es.onerror   = () => {
        es.close();
        // Auto-reconnect after 5 s
        reconnectTimer = setTimeout(connect, 5000);
      };
    }
    connect();

    // Fallback polling every 30s
    const iv = setInterval(() => fetchOrders(), 30000);
    return () => { es?.close(); clearTimeout(reconnectTimer); clearInterval(iv); };
  }, [restaurantId, fetchOrders]);

  // Fetch table layout (seats per table) when restaurant changes
  useEffect(() => {
    const rid = restaurantId || restaurants[0]?.id;
    if (!rid) return;
    fetch(`/api/admin/restaurants/${rid}/layout`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.tableLayoutJson) return;
        try {
          const cells: TableLayout[] = JSON.parse(data.tableLayoutJson).filter(
            (c: TableLayout) => c.tableNumber && c.tableNumber.trim()
          );
          setTableLayouts(cells);
        } catch { /* ignore */ }
      })
      .catch(() => {});
  }, [restaurantId, restaurants]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (e.key === "f" || e.key === "F") setIsFullscreen(prev => !prev);
      if (e.key === "Escape") { setIsFullscreen(false); setShowDateFilter(false); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  async function advanceItem(orderId: string, itemId: string) {
    const res = await fetch(`/api/admin/orders/${orderId}/items/${itemId}/status`, { method: "PATCH" });
    if (!res.ok) return;
    const { itemStatus, orderReady } = await res.json();
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      const updatedItems = o.items.map(i => i.id === itemId ? { ...i, itemStatus } : i);
      return { ...o, status: orderReady ? "READY" : o.status, items: updatedItems };
    }));
  }

  async function serveItem(orderId: string, itemId: string, served: boolean) {
    const res = await fetch(`/api/admin/orders/${orderId}/items/${itemId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(served ? { serve: true } : { unserve: true }),
    });
    if (!res.ok) return;
    const { servedAt } = await res.json();
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      return { ...o, items: o.items.map(i => i.id === itemId ? { ...i, servedAt: servedAt ?? null } : i) };
    }));
  }

  async function cancelItem(orderId: string, itemId: string) {
    const res = await fetch(`/api/admin/orders/${orderId}/items/${itemId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cancel: true }),
    });
    if (!res.ok) return;
    const { newTotal } = await res.json();
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      const updatedItems = o.items.map(i => i.id === itemId ? { ...i, itemStatus: "CANCELLED" } : i);
      return { ...o, items: updatedItems, ...(newTotal !== undefined ? { totalAmount: newTotal } : {}) };
    }));
  }

  async function cancelOrder(orderId: string) {
    await fetch(`/api/admin/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    if (filter === "active") {
      setOrders(prev => prev.filter(o => o.id !== orderId));
    } else {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: "CANCELLED" } : o));
    }
  }

  async function confirmOrder(orderId: string) {
    const res = await fetch(`/api/admin/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CONFIRMED" }),
    });
    if (!res.ok) return;
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: "CONFIRMED" } : o));
  }

  async function deliverOrder(orderId: string) {
    const res = await fetch(`/api/admin/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DELIVERED" }),
    });
    if (!res.ok) return;
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: "DELIVERED" } : o));
  }

  async function createWaiterOrder() {
    if (!posTable || posItems.length === 0) return;
    setPosSubmitting(true);
    const rid = restaurantId || restaurants[0]?.id;
    if (!rid) { setPosSubmitting(false); return; }
    await fetch("/api/admin/orders/waiter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId: rid, tableNumber: posTable, notes: posNotes || null, coversCount: posCovers ? parseInt(posCovers) : null, items: posItems }),
    });
    setShowPosModal(false);
    setPosTable(""); setPosCovers(""); setPosNotes(""); setPosItems([]);
    setPosNewItem({ name: "", price: "", course: 1, qty: 1 });
    setPosSubmitting(false);
    fetchOrders(false);
  }

  async function fireCourse(orderId: string, course: number) {
    await fetch(`/api/admin/orders/${orderId}/fire-course`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course }),
    });
    fetchOrders();
  }

  function closeTable(tableNumber: string, tipAmount = 0, payMethod = "card") {
    const tableOrders = orders.filter(o => (o.tableNumber ?? "–") === tableNumber);
    const rid = tableOrders[0]?.restaurant?.id || restaurantId;
    setOrders(prev => prev.filter(o => (o.tableNumber ?? "–") !== tableNumber));
    fetch("/api/admin/orders/close-table", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableNumber, restaurantId: rid, tipAmount, payMethod }),
    }).catch(() => {});
  }

  function scrollToTable(table: string) {
    setHighlightTable(table);
    setTimeout(() => {
      document.getElementById(`table-${table}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    setTimeout(() => setHighlightTable(null), 2000);
  }

  // Build table map — include ALL statuses so closed tables show collapsed
  // Orders without tableNumber are grouped under "–"
  const allTableOrders = new Map<string, Order[]>();
  [...orders].forEach(o => {
    const key = (o.tableNumber && o.tableNumber.trim() !== "") ? o.tableNumber : "–";
    if (!allTableOrders.has(key)) allTableOrders.set(key, []);
    allTableOrders.get(key)!.push(o);
  });

  // Determine which tables to show and sort
  type TableEntry = { table: string; tableOrders: Order[]; isClosed: boolean; urgency: number };
  const tableEntries: TableEntry[] = [];
  for (const [table, tableOrds] of allTableOrders.entries()) {
    const active = tableOrds.filter(o => !["CANCELLED","PAID","DELIVERED"].includes(o.status));
    const isClosed = active.length === 0;
    // Skip fully-closed tables in "active" mode unless we're showing all
    if (filter === "active" && isClosed && tableOrds.every(o => o.status === "PAID")) continue;
    const oldest = tableOrds.reduce((a, b) => new Date(a.createdAt) < new Date(b.createdAt) ? a : b);
    const ageMin = Math.floor((Date.now() - new Date(oldest.createdAt).getTime()) / 60000);
    // Urgency: closed = high number (sort last), urgent active = 0 (sort first)
    const urgency = isClosed ? 9999 : (ageMin > 20 ? 0 : ageMin);
    tableEntries.push({ table, tableOrders: tableOrds, isClosed, urgency });
  }
  tableEntries.sort((a, b) => a.urgency - b.urgency);

  const activeOrders = filter === "active"
    ? orders.filter(o => !["CANCELLED","PAID"].includes(o.status))
    : orders;
  const totalItems = activeOrders.reduce((s, o) => s + o.items.length, 0);

  // Action rail
  const railConfirm: string[] = [];
  const railServe:   string[] = [];
  const railBill:    string[] = [];
  for (const { table, tableOrders: tOrds } of tableEntries) {
    const nc = tOrds.filter(o => !["CANCELLED"].includes(o.status));
    if (nc.some(o => o.status === "PENDING")) railConfirm.push(table);
    else if (nc.some(o => o.status === "READY")) railServe.push(table);
    else if (nc.length > 0 && nc.every(o => o.status === "DELIVERED")) railBill.push(table);
  }
  const hasRail = railConfirm.length > 0 || railServe.length > 0 || railBill.length > 0;

  return (
    <div
      style={isFullscreen ? {
        position: "fixed", inset: 0, zIndex: 999,
        background: T.bg, overflowY: "auto",
        padding: "12px 16px", color: T.text,
      } : { padding: "24px 28px", color: T.text }}
    >
      {/* Waiter POS Modal */}
      {showPosModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, direction: "rtl" }}>
          <div style={{ background: T.surface, borderRadius: 18, border: `1px solid ${T.border}`, boxShadow: "0 24px 60px rgba(0,0,0,.5)", width: "100%", maxWidth: 520, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", background: "linear-gradient(135deg,#5b21b6,#7c3aed)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: "#fff", fontWeight: 800, fontSize: 18 }}>🧑‍🍳 הזמנה חדשה (POS)</div>
                <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 }}>ישירות למטבח · ללא המתנה לאישור</div>
              </div>
              <button type="button" onClick={() => setShowPosModal(false)} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: 32, height: 32, color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 5 }}>שולחן *</div>
                  {tableLayouts.length > 0 ? (
                    <select value={posTable}
                      onChange={e => { const val=e.target.value; setPosTable(val); const cell=tableLayouts.find(c=>c.tableNumber===val); if(cell?.seats) setPosCovers(String(cell.seats)); }}
                      style={DK_INPUT}>
                      <option value="">בחר שולחן</option>
                      {tableLayouts.map(c => <option key={c.tableNumber} value={c.tableNumber!}>שולחן {c.tableNumber}{c.seats?` (${c.seats} מקומות)`:""}</option>)}
                    </select>
                  ) : (
                    <input value={posTable} onChange={e => setPosTable(e.target.value)} placeholder="מספר שולחן" style={DK_INPUT} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 80 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 5 }}>👥 סועדים</div>
                  <input type="number" min="1" max="50" value={posCovers} onChange={e => setPosCovers(e.target.value)} placeholder="כמות" style={DK_INPUT} />
                </div>
                <div style={{ flex: 2, minWidth: 140 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 5 }}>הערות</div>
                  <input value={posNotes} onChange={e => setPosNotes(e.target.value)} placeholder="הערות להזמנה..." style={DK_INPUT} />
                </div>
              </div>
              <div style={{ background: T.overlay, borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>הוסף פריט</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <input value={posNewItem.name} onChange={e => setPosNewItem(p=>({...p,name:e.target.value}))} placeholder="שם המנה"
                    style={{ flex: 3, minWidth: 120, background: T.raised, border: `1px solid ${T.border}`, color: T.text, borderRadius: 8, padding: "7px 10px", fontSize: 13, outline: "none" }} />
                  <input type="number" min="0" step="0.5" value={posNewItem.price} onChange={e => setPosNewItem(p=>({...p,price:e.target.value}))} placeholder="₪ מחיר"
                    style={{ flex: 1, minWidth: 70, background: T.raised, border: `1px solid ${T.border}`, color: T.text, borderRadius: 8, padding: "7px 10px", fontSize: 13, outline: "none" }} />
                  <select value={posNewItem.course} onChange={e => setPosNewItem(p=>({...p,course:Number(e.target.value)}))}
                    style={{ flex: 1, minWidth: 85, background: T.raised, border: `1px solid ${T.border}`, color: T.text, borderRadius: 8, padding: "7px 8px", fontSize: 13, outline: "none" }}>
                    <option value={1}>🥗 ראשון</option>
                    <option value={2}>🍖 עיקרי</option>
                    <option value={3}>🍮 קינוח</option>
                  </select>
                  <input type="number" min="1" max="20" value={posNewItem.qty} onChange={e => setPosNewItem(p=>({...p,qty:Number(e.target.value)}))}
                    style={{ width: 44, background: T.raised, border: `1px solid ${T.border}`, color: T.text, borderRadius: 8, padding: "7px 8px", fontSize: 13, outline: "none", textAlign: "center" }} />
                  <button type="button"
                    onClick={() => { if(!posNewItem.name||!posNewItem.price) return; setPosItems(prev=>[...prev,{name:posNewItem.name,price:Number(posNewItem.price),course:posNewItem.course,qty:posNewItem.qty}]); setPosNewItem({name:"",price:"",course:posNewItem.course,qty:1}); }}
                    style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                    + הוסף
                  </button>
                </div>
              </div>
              {posItems.length > 0 && (
                <div style={{ background: T.overlay, borderRadius: 12, padding: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>פריטים בהזמנה</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {posItems.map((item, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, background: T.raised, borderRadius: 8, padding: "7px 10px", border: `1px solid ${T.border}` }}>
                        <span style={{ fontSize: 14 }}>{COURSE_EMOJI[item.course] ?? "🍽"}</span>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: T.text }}>×{item.qty} {item.name}</span>
                        <span style={{ fontSize: 13, color: T.sub }}>₪{(item.price * item.qty).toFixed(0)}</span>
                        {item.course > 1 && (
                          <span style={{ fontSize: 11, color: T.purple, background: "rgba(124,58,237,.2)", padding: "2px 7px", borderRadius: 20 }}>{COURSE_LABEL[item.course]}</span>
                        )}
                        <button type="button" onClick={() => setPosItems(prev => prev.filter((_,i) => i !== idx))}
                          style={{ color: T.red, background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>×</button>
                      </div>
                    ))}
                    <div style={{ fontSize: 15, fontWeight: 900, color: T.text, paddingTop: 6, borderTop: `1px solid ${T.border}`, marginTop: 2 }}>
                      סה&quot;כ: ₪{posItems.reduce((s, i) => s + i.price * i.qty, 0).toFixed(0)}
                    </div>
                  </div>
                </div>
              )}
              {posItems.some(i => i.course > 1) && (
                <div style={{ background: "rgba(124,58,237,.12)", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: T.purple, border: "1px solid rgba(124,58,237,.25)" }}>
                  🔥 מנות עיקריות/קינוח יוחזקו עד שתלחץ &quot;הצת קורס&quot; על השולחן
                </div>
              )}
            </div>
            <div style={{ padding: "12px 20px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setShowPosModal(false)} style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: `1px solid ${T.border}`, background: T.overlay, color: T.sub, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>ביטול</button>
              <button type="button" onClick={createWaiterOrder} disabled={posSubmitting||!posTable||posItems.length===0}
                style={{ flex: 2, padding: "11px 0", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#5b21b6,#7c3aed)", color: "#fff", fontWeight: 800, fontSize: 15, cursor: posSubmitting||!posTable||posItems.length===0?"not-allowed":"pointer", opacity: posSubmitting||!posTable||posItems.length===0?0.55:1 }}>
                {posSubmitting ? "שולח..." : "🔥 שלח למטבח"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Compact Control Bar ── */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 14 }} dir="rtl">
        {isSuperAdmin && restaurants.length > 0 && (
          <select value={restaurantId} onChange={e => setRestaurantId(e.target.value)}
            style={{ ...DK_INPUT, width: "auto", padding: "8px 12px", fontSize: 13 }}>
            <option value="">כל המסעדות</option>
            {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}
        <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: `1px solid ${T.border}` }}>
          {(["active", "all"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: "8px 18px", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
                background: filter === f ? "linear-gradient(135deg,#8B6914,#C9A84C)" : T.overlay,
                color: filter === f ? "#fff" : T.sub }}>
              {f === "active" ? "פעילות" : "הכל"}
            </button>
          ))}
        </div>
        <button onClick={() => setShowPosModal(true)}
          style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700, color: "#fff", border: "none", cursor: "pointer", background: "linear-gradient(135deg,#5b21b6,#7c3aed)" }}>
          🧑‍🍳 הזמנה חדשה
        </button>
        <div style={{ position: "relative" }}>
          <button onClick={() => setShowDateFilter(p => !p)} title="סינון תאריך"
            style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${showDateFilter||dateFrom||dateTo ? T.gold : T.border}`, background: showDateFilter||dateFrom||dateTo ? "rgba(252,196,25,.1)" : T.overlay, color: showDateFilter||dateFrom||dateTo ? T.gold : T.sub, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>
            📅{dateFrom || dateTo ? "✦" : ""}
          </button>
          {showDateFilter && (
            <div style={{ position: "absolute", top: 42, right: 0, zIndex: 20, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: "0 12px 40px rgba(0,0,0,.4)", padding: 16, display: "flex", flexDirection: "column", gap: 10, minWidth: 260 }} dir="rtl">
              <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".05em" }}>סינון לפי תאריך</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: T.muted, width: 24 }}>מ-</span>
                  <input type="datetime-local" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    style={{ flex: 1, ...DK_INPUT, padding: "6px 10px", fontSize: 12 }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: T.muted, width: 24 }}>עד-</span>
                  <input type="datetime-local" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    style={{ flex: 1, ...DK_INPUT, padding: "6px 10px", fontSize: 12 }} />
                </div>
              </div>
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(""); setDateTo(""); setShowDateFilter(false); }}
                  style={{ fontSize: 12, color: T.red, background: "rgba(255,107,107,.1)", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer" }}>
                  ✕ נקה סינון
                </button>
              )}
            </div>
          )}
        </div>
        <button onClick={() => setSoundEnabled(p => !p)} title={soundEnabled ? "כבה צליל" : "הפעל צליל"}
          style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${T.border}`, background: T.overlay, color: T.sub, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {soundEnabled ? "🔔" : "🔕"}
        </button>
        <button onClick={() => fetchOrders(true)} disabled={refreshing}
          style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${T.border}`, background: T.overlay, color: T.sub, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: refreshing ? 0.5 : 1 }}>
          <svg width="16" height="16" style={{ animation: refreshing ? "spin 1s linear infinite" : undefined }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        <button onClick={() => setIsFullscreen(p => !p)} title={isFullscreen ? "יציאה ממסך מלא (Esc)" : "מסך מלא (F)"}
          style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${T.border}`, background: T.overlay, color: T.sub, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {isFullscreen ? (
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"/></svg>
          ) : (
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"/></svg>
          )}
        </button>
        <span style={{ fontSize: 12, color: T.muted, marginRight: "auto" }}>
          {tableEntries.filter(e => !e.isClosed).length} שולחנות · {totalItems} מנות · {lastRefresh.toLocaleTimeString("he-IL")}
        </span>
      </div>

      {/* ── Action Rail ── */}
      {hasRail && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderRadius: 14, overflow: "hidden", border: `1px solid ${T.border}`, marginBottom: 16, background: T.surface }} dir="rtl">
          {/* Confirm */}
          <div style={{ padding: 12, borderRight: `3px solid ${T.gold}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span>🕐</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: T.gold, textTransform: "uppercase", letterSpacing: ".05em" }}>לאישור</span>
              {railConfirm.length > 0 && <span style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(252,196,25,.2)", color: T.gold, fontSize: 10, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>{railConfirm.length}</span>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {railConfirm.length === 0
                ? <span style={{ fontSize: 11, color: T.muted }}>אין</span>
                : railConfirm.map(t => (
                  <button key={t} onClick={() => scrollToTable(t)}
                    style={{ fontSize: 12, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: "rgba(252,196,25,.15)", color: T.gold, border: `1px solid rgba(252,196,25,.3)`, cursor: "pointer" }}>
                    {t}
                  </button>
                ))}
            </div>
          </div>
          {/* Serve */}
          <div style={{ padding: 12, borderRight: `1px solid ${T.border}`, borderLeft: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span>✅</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: T.blue, textTransform: "uppercase", letterSpacing: ".05em" }}>להגשה</span>
              {railServe.length > 0 && <span style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(51,154,240,.2)", color: T.blue, fontSize: 10, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>{railServe.length}</span>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {railServe.length === 0
                ? <span style={{ fontSize: 11, color: T.muted }}>אין</span>
                : railServe.map(t => (
                  <button key={t} onClick={() => scrollToTable(t)}
                    style={{ fontSize: 12, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: "rgba(51,154,240,.15)", color: T.blue, border: `1px solid rgba(51,154,240,.3)`, cursor: "pointer" }}>
                    {t}
                  </button>
                ))}
            </div>
          </div>
          {/* Bill */}
          <div style={{ padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span>💳</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: T.green, textTransform: "uppercase", letterSpacing: ".05em" }}>לחשבון</span>
              {railBill.length > 0 && <span style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(81,207,102,.2)", color: T.green, fontSize: 10, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>{railBill.length}</span>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {railBill.length === 0
                ? <span style={{ fontSize: 11, color: T.muted }}>אין</span>
                : railBill.map(t => (
                  <button key={t} onClick={() => scrollToTable(t)}
                    style={{ fontSize: 12, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: "rgba(81,207,102,.15)", color: T.green, border: `1px solid rgba(81,207,102,.3)`, cursor: "pointer" }}>
                    {t}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Status summary chips ── */}
      {activeOrders.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }} dir="rtl">
          {(["PENDING","CONFIRMED","PREPARING","READY","DELIVERED","PAID","CANCELLED"] as const).map(s => {
            const count = activeOrders.filter(o => o.status === s).length;
            if (!count) return null;
            const label: Record<string, string> = {
              PENDING: "ממתינות", CONFIRMED: "מאושרות", PREPARING: "בהכנה",
              READY: "מוכנות", DELIVERED: "סופקו", PAID: "שולמו", CANCELLED: "בוטלו",
            };
            return (
              <div key={s} style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, ...(ORDER_STATUS_STYLE[s] ?? {}) }}>
                {count} {label[s]}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Tables grid ── */}
      {tableEntries.length === 0 ? (
        <div style={{ background: T.surface, borderRadius: 16, border: `1px solid ${T.border}`, padding: "64px 32px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🍽</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: T.sub }}>אין הזמנות {filter === "active" ? "פעילות" : ""}</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 6 }}>הדף מתרענן אוטומטית כל 10 שניות</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }} dir="rtl">
          {tableEntries.filter(e => !e.isClosed).length > 0 && (
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", alignItems: "start" }}>
              {tableEntries.filter(e => !e.isClosed).map(({ table, tableOrders: tOrds }) => (
                <TableCard
                  key={table} tableNumber={table} orders={tOrds}
                  isClosed={false} highlighted={highlightTable === table} showAll={filter === "all"}
                  onItemCancel={cancelItem} onItemServe={serveItem} onOrderCancel={cancelOrder}
                  onConfirmOrder={confirmOrder} onDeliverOrder={deliverOrder}
                  onFireCourse={fireCourse}
                />
              ))}
            </div>
          )}
          {tableEntries.filter(e => e.isClosed).length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, paddingRight: 4, textTransform: "uppercase", letterSpacing: ".05em" }}>שולחנות סגורים</div>
              {tableEntries.filter(e => e.isClosed).map(({ table, tableOrders: tOrds }) => (
                <TableCard
                  key={table} tableNumber={table} orders={tOrds}
                  isClosed highlighted={highlightTable === table} showAll={filter === "all"}
                  onItemCancel={cancelItem} onItemServe={serveItem} onOrderCancel={cancelOrder}
                  onConfirmOrder={confirmOrder} onDeliverOrder={deliverOrder}
                  onFireCourse={fireCourse}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Close date popover on outside click */}
      {showDateFilter && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10 }} onClick={() => setShowDateFilter(false)} />
      )}
    </div>
  );
}
