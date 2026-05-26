"use client";

import { useState, useEffect, useCallback, useRef } from "react";

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
  totalAmount: number;
  notes: string | null;
  createdAt: string;
  orderSource: string;
  restaurant: { id: string; name: string };
  items: OrderItem[];
};

type Restaurant = { id: string; name: string };

const ITEM_STATUS_LABEL: Record<string, string> = {
  PENDING: "ממתין",
  PREPARING: "בהכנה",
  DONE: "הוכן",
  CANCELLED: "בוטל",
  HELD: "ממתין להצתה",
};

const COURSE_LABEL: Record<number, string> = { 1: "ראשון", 2: "עיקרי", 3: "קינוח" };
const COURSE_EMOJI: Record<number, string> = { 1: "🥗", 2: "🍖", 3: "🍮" };

const ITEM_STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  PREPARING: "bg-blue-100 text-blue-700",
  DONE: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-500 line-through",
};

const ORDER_STATUS_BADGE: Record<string, string> = {
  PENDING:   "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  PREPARING: "bg-orange-100 text-orange-800",
  READY:     "bg-green-100 text-green-800",
  DELIVERED: "bg-gray-100 text-gray-500",
  CANCELLED: "bg-gray-200 text-gray-600",
  PAID:      "bg-emerald-100 text-emerald-800",
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
  onConfirm: () => void;
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
  const subtotal = validOrders.reduce((s, o) => s + o.totalAmount, 0);
  const tipAmount = tipPct === -1
    ? (parseFloat(customTip) || 0)
    : Math.round(subtotal * tipPct) / 100;
  const total = subtotal + tipAmount;

  async function handleConfirm() {
    setConfirming(true);
    onConfirm();
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

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 60,
      background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16, direction: "rtl",
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, width: "100%", maxWidth: 480,
        maxHeight: "90vh", display: "flex", flexDirection: "column",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)", overflow: "hidden",
      }}>
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid #f1f5f9",
          background: "#c9a84c",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 18 }}>💳 חשבון — שולחן {tableNumber}</div>
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 }}>
              {validOrders.length} הזמנות · {validOrders[0] ? fmtTime(validOrders[0].createdAt) : ""}
            </div>
          </div>
          <button type="button" onClick={onClose} style={{
            background: "rgba(255,255,255,0.2)", border: "none",
            borderRadius: "50%", width: 32, height: 32, color: "#fff",
            fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}>✕</button>
        </div>

        <div style={{ padding: "20px 20px 4px" }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>טיפ</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {TIP_OPTS.map(opt => (
                <button key={opt.pct} type="button"
                  onClick={() => { setTipPct(opt.pct); if (opt.pct !== -1) setCustomTip(""); }}
                  style={{
                    padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600,
                    border: `2px solid ${tipPct === opt.pct ? "#c9a84c" : "#e5e7eb"}`,
                    background: tipPct === opt.pct ? "#fdf8ec" : "#fff",
                    color: tipPct === opt.pct ? "#8B6914" : "#6b7280",
                    cursor: "pointer",
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
            {tipPct === -1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
                <span style={{ fontSize: 13, color: "#6b7280" }}>₪</span>
                <input
                  type="number" min="0" step="1"
                  value={customTip} onChange={e => setCustomTip(e.target.value)}
                  placeholder="סכום טיפ"
                  style={{ border: "2px solid #c9a84c", borderRadius: 10, padding: "6px 12px", fontSize: 14, width: 110, outline: "none" }}
                />
              </div>
            )}
          </div>

          <div style={{ background: "#f9fafb", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#6b7280", marginBottom: 8 }}>
              <span>סכום מקורי</span>
              <span style={{ fontWeight: 600, color: "#111827" }}>₪{subtotal.toFixed(2)}</span>
            </div>
            {tipAmount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#6b7280", marginBottom: 8 }}>
                <span>טיפ</span>
                <span style={{ fontWeight: 600, color: "#111827" }}>₪{tipAmount.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800, color: "#111827", borderTop: "1px solid #e5e7eb", paddingTop: 8 }}>
              <span>סה&quot;כ</span>
              <span style={{ color: "#c9a84c" }}>₪{total.toFixed(2)}</span>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>אמצעי תשלום</div>
            <div style={{ display: "flex", gap: 8 }}>
              {PAY_METHODS.map(m => (
                <button key={m.value} type="button"
                  onClick={() => setPayMethod(m.value)}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 12, fontSize: 13, fontWeight: 600,
                    border: `2px solid ${payMethod === m.value ? "#c9a84c" : "#e5e7eb"}`,
                    background: payMethod === m.value ? "#fdf8ec" : "#fff",
                    color: payMethod === m.value ? "#8B6914" : "#6b7280",
                    cursor: "pointer",
                  }}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid #f1f5f9", display: "flex", gap: 10 }}>
          <button type="button" onClick={onClose} style={{
            flex: 1, padding: "11px 0", borderRadius: 12, border: "2px solid #e5e7eb",
            background: "#fff", color: "#6b7280", fontWeight: 600, fontSize: 14, cursor: "pointer",
          }}>ביטול</button>
          <button type="button" onClick={handleConfirm} disabled={confirming} style={{
            flex: 2, padding: "11px 0", borderRadius: 12, border: "none",
            background: confirming ? "#d4b96a" : "#c9a84c",
            color: "#fff", fontWeight: 800, fontSize: 15, cursor: confirming ? "wait" : "pointer",
          }}>
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
  onShowBill,
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
  onShowBill: (tableNumber: string) => void;
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
    } else {
      onShowBill(tableNumber);
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
    : { label: "💳 הצג חשבון", color: "#c9a84c", disabled: false };

  // Collapsed row (for closed tables)
  if (isCollapsed) {
    const lastOrder = nonCancelledOrders[nonCancelledOrders.length - 1];
    return (
      <div
        onClick={() => setIsCollapsed(false)}
        className="bg-white rounded-xl border border-gray-100 px-4 py-2.5 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors shadow-sm"
        style={highlighted ? { outline: "2px solid #c9a84c" } : undefined}
      >
        <div className="w-7 h-7 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center font-black text-gray-500 text-xs shrink-0">
          {tableNumber === "–" ? "?" : tableNumber}
        </div>
        <span className="text-sm font-semibold text-gray-500">שולחן {tableNumber}</span>
        <span className="text-xs text-gray-400 flex-1">
          {allPaid ? "✓ שולם" : "✓ סופק"} · ₪{totalAmount.toFixed(0)}
          {lastOrder ? ` · ${fmtTime(lastOrder.createdAt)}` : ""}
        </span>
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    );
  }

  return (
    <div
      id={`table-${tableNumber}`}
      className="bg-white rounded-2xl border overflow-hidden shadow-sm"
      style={{ borderColor: cardBorder, borderWidth: hasPending ? 2 : 1 }}
    >
      {/* Table header */}
      <div
        className="px-3 pt-2 pb-1.5"
        style={{ background: headerBg, borderBottom: `1px solid ${hasPending ? "#fcd34d" : "#e5e7eb"}` }}
      >
        <div className="flex items-center gap-1.5">
          <div
            className="w-8 h-8 rounded-lg border-2 flex items-center justify-center font-black text-xs shrink-0 cursor-pointer"
            style={isClosed
              ? { background: "#f3f4f6", borderColor: "#d1d5db", color: "#9ca3af" }
              : hasPending
              ? { background: "#fef3c7", borderColor: "#f59e0b", color: "#92400e" }
              : { background: "#fef3c7", borderColor: "#fcd34d", color: "#92400e" }
            }
            onClick={() => setIsCollapsed(true)}
            title="קפל שולחן"
          >
            {tableNumber === "–" ? "?" : tableNumber}
          </div>
          <span className="font-bold text-gray-900 text-sm flex-1">
            {tableNumber === "–" ? "ללא שולחן" : `שולחן ${tableNumber}`}
          </span>
          {hasPending && (
            <span className="text-xs px-1.5 py-0.5 rounded-full font-bold shrink-0 animate-pulse"
              style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d" }}>
              🕐 ממתין לאישור
            </span>
          )}
          {orders.some(o => o.orderSource === "WAITER") && (
            <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold shrink-0" style={{ background: "#ede9fe", color: "#7c3aed" }}>
              🧑‍🍳 POS
            </span>
          )}
          <span className="font-black text-gray-900 text-lg shrink-0">₪{totalAmount.toFixed(0)}</span>
        </div>
        <div className={`flex justify-between mt-0.5 text-xs ${hasPending ? "text-amber-600 font-semibold" : isUrgent ? "text-red-500 font-semibold" : "text-gray-400"}`}>
          <span>⏱ {timeSince(oldestOrder.createdAt)} · {allItems.length} מנות</span>
          <span>{nonCancelledOrders.length} הזמנות</span>
        </div>
        {/* Progress bar */}
        {allItems.length > 0 && (
          <div className="flex gap-1 mt-1.5">
            {allItems.map(i => (
              <div key={i.id} className="h-1.5 flex-1 rounded-full"
                style={{ background: i.itemStatus === "DONE" ? "#22c55e" : i.itemStatus === "PREPARING" ? "#38bdf8" : "#e5e7eb" }}
              />
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

        return (
          <div key={order.id} style={{ borderTop: idx > 0 ? "1px solid #f3f4f6" : undefined }}>
            {/* Order sub-header */}
            <div
              className="flex items-center justify-between px-2 py-1"
              style={{
                background: isPending ? "#fefce8" : isDelivered ? "#f9fafb" : isReady ? "#f0fdf4"
                  : isPaid ? "#faf5ff" : isCancelled ? "#fef2f2" : "#fafafa",
              }}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`text-xs font-bold shrink-0 ${
                  isPending ? "text-yellow-700" : isDelivered ? "text-gray-400"
                  : isReady ? "text-green-700" : isPaid ? "text-purple-600"
                  : isCancelled ? "text-red-400 line-through" : "text-gray-500"}`}>
                  {isPending ? "🕐 ממתין" : isDelivered ? "✓ סופק" : isReady ? "✅ מוכן"
                    : isPaid ? "💜 שולם" : isCancelled ? "✕ בוטל" : "הזמנה"}
                </span>
                <span className="text-xs text-gray-400 shrink-0">
                  {order.items.length} מנות · ₪{order.totalAmount.toFixed(0)} · {timeSince(order.createdAt)}
                </span>
                {order.notes && (
                  <span className="text-xs text-gray-400 italic truncate">· 💬 {order.notes}</span>
                )}
              </div>
              {/* Cancel order (only for non-terminal, non-pending orders) */}
              {!isPending && !isDelivered && !isReady && !isPaid && !isCancelled && (
                <button
                  onClick={() => onOrderCancel(order.id)}
                  className="text-xs text-red-400 hover:text-red-600 px-2 py-0.5 rounded-lg hover:bg-red-50 transition-colors shrink-0"
                >
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
                <div className="px-2 py-1.5 flex gap-2 flex-wrap" style={{ background: "#faf5ff", borderBottom: "1px solid #e9d5ff" }}>
                  {Array.from(heldByCourse.entries()).map(([course, count]) => (
                    <button
                      key={course}
                      onClick={() => onFireCourse(order.id, course)}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold text-white"
                      style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}
                    >
                      🔥 הצת {COURSE_LABEL[course] ?? `קורס ${course}`} ({count} מנות)
                    </button>
                  ))}
                </div>
              );
            })()}

            {/* Items */}
            <div className="divide-y divide-gray-50" style={{ opacity: isDelivered || isPaid || isCancelled ? 0.55 : 1 }}>
              {order.items.map(({ id: itemId, quantity, notes, itemStatus, item, modifiers, course, heldUntilFired, firedAt, doneAt, servedAt }) => {
                const isItemCancelled = itemStatus === "CANCELLED";
                const isHeld = heldUntilFired;
                const isDone = itemStatus === "DONE" || isDelivered || isReady || isPaid;
                const isServed = !!servedAt;
                const isServeBusy = busy.has(itemId + "-serve");
                const isCancelBusy = busy.has(itemId + "-cancel");
                const canCancel = !isDelivered && !isReady && !isPaid && !isCancelled && !isItemCancelled && !isDone;
                // Show serve button when item is cooked (DONE) or order is READY/DELIVERED, and order is not yet PAID/CANCELLED
                const canServe = !isItemCancelled && !isCancelled && !isPaid && (itemStatus === "DONE" || isReady || isDelivered);

                return (
                  <div
                    key={itemId}
                    className={`flex items-center gap-1.5 px-2 py-1 ${isItemCancelled ? "opacity-40" : ""}`}
                    style={isHeld ? { background: "#faf5ff" } : isServed ? { background: "#f0fdf4" } : undefined}
                  >
                    <span className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold shrink-0
                      ${isItemCancelled ? "bg-red-50 text-red-400" : isHeld ? "bg-purple-50 text-purple-500" : isServed ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-600"}`}>
                      {quantity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        {course > 1 && (
                          <span className="text-xs shrink-0">{COURSE_EMOJI[course] ?? "🍽"}</span>
                        )}
                        <span className={`text-sm font-semibold truncate
                          ${isItemCancelled ? "line-through text-gray-400" : isHeld ? "text-purple-700" : isServed ? "text-green-700" : "text-gray-900"}`}>
                          {item.name}
                          {isHeld && <span className="text-purple-400 font-normal text-xs"> · ממתין להצתה</span>}
                        </span>
                      </div>
                      {firedAt && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          {doneAt
                            ? `⏱ ${Math.round((new Date(doneAt).getTime() - new Date(firedAt).getTime()) / 60000)} דק' להכנה`
                            : `🔥 הוצת לפני ${Math.round((Date.now() - new Date(firedAt).getTime()) / 60000)} דק'`
                          }
                        </div>
                      )}
                      {modifiers && modifiers.length > 0 && !isItemCancelled && (
                        <div className="flex gap-1 flex-wrap mt-0.5">
                          {modifiers.map((m, i) => (
                            <span key={i} className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "#1e3a2e", color: "#4ade80" }}>
                              {m.label}{m.priceAdd > 0 ? ` +₪${m.priceAdd}` : ""}
                            </span>
                          ))}
                        </div>
                      )}
                      {notes && !isItemCancelled && (
                        <div className="text-xs text-gray-400 italic truncate">{notes}</div>
                      )}
                    </div>

                    {/* Status badge (only when not yet served) */}
                    {!isServed && !isDelivered && !isPaid && !isHeld && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${ITEM_STATUS_COLOR[itemStatus] ?? ""}`}>
                        {ITEM_STATUS_LABEL[itemStatus] ?? itemStatus}
                      </span>
                    )}

                    {/* Serve button / served indicator */}
                    {canServe && (
                      <button
                        onClick={() => toggleServe(order.id, itemId, isServed)}
                        disabled={isServeBusy}
                        title={isServed ? "בטל הגשה" : "הגש לשולחן"}
                        className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
                        style={isServed
                          ? { background: "#dcfce7", color: "#16a34a", border: "1px solid #86efac" }
                          : { background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe" }
                        }
                      >
                        {isServeBusy ? "·" : isServed ? "✓ הוגש" : "🍽 הגש"}
                      </button>
                    )}

                    {canCancel && (
                      <button
                        onClick={() => cancelItem(order.id, itemId)}
                        disabled={isCancelBusy}
                        title="בטל פריט"
                        className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-red-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors text-xs"
                      >
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

      {/* Smart footer action */}
      {nonCancelledOrders.length > 0 && (
        <div className="px-3 py-2 border-t bg-gray-50/50"
          style={{ borderColor: hasPending ? "#fcd34d" : "#f1f5f9" }}>
          <button
            type="button"
            onClick={smartAction}
            disabled={smartBtn.disabled}
            className={`w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:cursor-not-allowed ${hasPending ? "animate-pulse" : ""}`}
            style={{ background: smartBtn.color, opacity: smartBtn.disabled ? 0.5 : 1 }}
          >
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
  const [billTableKey, setBillTableKey] = useState<string | null>(null);
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
  const knownOrderIds = useRef<Set<string>>(new Set(initialOrders.map(o => o.id)));

  const fetchOrders = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    const params = new URLSearchParams();
    if (restaurantId) params.set("restaurantId", restaurantId);
    if (filter === "active") params.set("activeOnly", "1");
    if (dateFrom) params.set("from", new Date(dateFrom).toISOString());
    if (dateTo) params.set("to", new Date(dateTo).toISOString());
    try {
      const res = await fetch(`/api/admin/orders?${params}`);
      if (res.ok) {
        const newOrders: Order[] = await res.json();
        // Sound alert for new PENDING orders
        const newPending = newOrders.filter(o => o.status === "PENDING" && !knownOrderIds.current.has(o.id));
        if (newPending.length > 0 && soundEnabled) playBeep();
        newOrders.forEach(o => knownOrderIds.current.add(o.id));
        setOrders(newOrders);
        setLastRefresh(new Date());
      }
    } catch { /* ignore */ }
    if (showSpinner) setRefreshing(false);
  }, [restaurantId, filter, dateFrom, dateTo, soundEnabled]);

  useEffect(() => {
    fetchOrders();
    // SSE — instant refresh on any order change
    const sseUrl = `/api/admin/orders/stream${restaurantId ? `?restaurantId=${restaurantId}` : ""}`;
    const es = new EventSource(sseUrl);
    es.onmessage = () => { fetchOrders(); };
    es.onerror   = () => { es.close(); };
    // Fallback polling every 30s (SSE covers the fast path)
    const iv = setInterval(() => fetchOrders(), 30000);
    return () => { es.close(); clearInterval(iv); };
  }, [fetchOrders, restaurantId]);

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

  function closeTable(tableNumber: string) {
    const tableOrders = orders.filter(o => (o.tableNumber ?? "–") === tableNumber);
    const rid = tableOrders[0]?.restaurant?.id || restaurantId;
    setBillTableKey(null);
    setOrders(prev => prev.filter(o => (o.tableNumber ?? "–") !== tableNumber));
    fetch("/api/admin/orders/close-table", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableNumber, restaurantId: rid }),
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

  const billOrders = billTableKey
    ? orders.filter(o => (o.tableNumber ?? "–") === billTableKey)
    : [];

  return (
    <div
      className={isFullscreen ? "" : "p-4 md:p-8"}
      style={isFullscreen ? {
        position: "fixed", inset: 0, zIndex: 999,
        background: "#f8fafc", overflowY: "auto",
        padding: "12px 16px",
      } : undefined}
    >
      {/* Bill Modal */}
      {billTableKey && billOrders.length > 0 && (
        <BillModal
          tableNumber={billTableKey}
          orders={billOrders}
          onConfirm={() => closeTable(billTableKey)}
          onClose={() => setBillTableKey(null)}
        />
      )}

      {/* Waiter POS Modal */}
      {showPosModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, direction: "rtl" }}>
          <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 520, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", background: "linear-gradient(135deg,#7c3aed,#a855f7)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: "#fff", fontWeight: 800, fontSize: 18 }}>🧑‍🍳 הזמנה חדשה (POS)</div>
                <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 }}>ישירות למטבח · ללא המתנה לאישור</div>
              </div>
              <button type="button" onClick={() => setShowPosModal(false)} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: 32, height: 32, color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>שולחן *</label>
                  <input value={posTable} onChange={e => setPosTable(e.target.value)} placeholder="מספר שולחן"
                    style={{ width: "100%", border: "2px solid #e5e7eb", borderRadius: 10, padding: "8px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>👥 סועדים</label>
                  <input type="number" min="1" max="50" value={posCovers} onChange={e => setPosCovers(e.target.value)} placeholder="כמות"
                    style={{ width: "100%", border: "2px solid #e5e7eb", borderRadius: 10, padding: "8px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ flex: 2 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>הערות</label>
                  <input value={posNotes} onChange={e => setPosNotes(e.target.value)} placeholder="הערות להזמנה..."
                    style={{ width: "100%", border: "2px solid #e5e7eb", borderRadius: 10, padding: "8px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
              </div>
              <div style={{ background: "#f9fafb", borderRadius: 14, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 10 }}>הוסף פריט</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input value={posNewItem.name} onChange={e => setPosNewItem(p => ({ ...p, name: e.target.value }))} placeholder="שם המנה"
                    style={{ flex: 3, minWidth: 120, border: "2px solid #e5e7eb", borderRadius: 8, padding: "6px 10px", fontSize: 13, outline: "none" }} />
                  <input type="number" min="0" step="0.5" value={posNewItem.price} onChange={e => setPosNewItem(p => ({ ...p, price: e.target.value }))} placeholder="₪ מחיר"
                    style={{ flex: 1, minWidth: 70, border: "2px solid #e5e7eb", borderRadius: 8, padding: "6px 10px", fontSize: 13, outline: "none" }} />
                  <select value={posNewItem.course} onChange={e => setPosNewItem(p => ({ ...p, course: Number(e.target.value) }))}
                    style={{ flex: 1, minWidth: 80, border: "2px solid #e5e7eb", borderRadius: 8, padding: "6px 8px", fontSize: 13, outline: "none" }}>
                    <option value={1}>🥗 ראשון</option>
                    <option value={2}>🍖 עיקרי</option>
                    <option value={3}>🍮 קינוח</option>
                  </select>
                  <input type="number" min="1" max="20" value={posNewItem.qty} onChange={e => setPosNewItem(p => ({ ...p, qty: Number(e.target.value) }))}
                    style={{ width: 48, border: "2px solid #e5e7eb", borderRadius: 8, padding: "6px 8px", fontSize: 13, outline: "none", textAlign: "center" }} />
                  <button type="button"
                    onClick={() => {
                      if (!posNewItem.name || !posNewItem.price) return;
                      setPosItems(prev => [...prev, { name: posNewItem.name, price: Number(posNewItem.price), course: posNewItem.course, qty: posNewItem.qty }]);
                      setPosNewItem({ name: "", price: "", course: posNewItem.course, qty: 1 });
                    }}
                    style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                    + הוסף
                  </button>
                </div>
              </div>
              {posItems.length > 0 && (
                <div style={{ background: "#f9fafb", borderRadius: 14, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>פריטים בהזמנה</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {posItems.map((item, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", borderRadius: 8, padding: "6px 10px", border: "1px solid #e5e7eb" }}>
                        <span style={{ fontSize: 14 }}>{COURSE_EMOJI[item.course] ?? "🍽"}</span>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>×{item.qty} {item.name}</span>
                        <span style={{ fontSize: 13, color: "#6b7280" }}>₪{(item.price * item.qty).toFixed(0)}</span>
                        {item.course > 1 && (
                          <span style={{ fontSize: 11, color: "#7c3aed", background: "#ede9fe", padding: "2px 6px", borderRadius: 20 }}>{COURSE_LABEL[item.course]}</span>
                        )}
                        <button type="button" onClick={() => setPosItems(prev => prev.filter((_, i) => i !== idx))}
                          style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>×</button>
                      </div>
                    ))}
                    <div style={{ textAlign: "left", fontSize: 15, fontWeight: 800, color: "#111827", paddingTop: 4 }}>
                      סה&quot;כ: ₪{posItems.reduce((s, i) => s + i.price * i.qty, 0).toFixed(0)}
                    </div>
                  </div>
                </div>
              )}
              {posItems.some(i => i.course > 1) && (
                <div style={{ background: "#ede9fe", borderRadius: 10, padding: "8px 14px", fontSize: 12, color: "#6d28d9" }}>
                  🔥 מנות עיקריות/קינוח יוחזקו עד שתלחץ &quot;הצת קורס&quot; על השולחן
                </div>
              )}
            </div>
            <div style={{ padding: "12px 20px", borderTop: "1px solid #f1f5f9", display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setShowPosModal(false)} style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "2px solid #e5e7eb", background: "#fff", color: "#6b7280", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>ביטול</button>
              <button type="button" onClick={createWaiterOrder} disabled={posSubmitting || !posTable || posItems.length === 0}
                style={{ flex: 2, padding: "11px 0", borderRadius: 12, border: "none", background: posSubmitting || !posTable || posItems.length === 0 ? "#c4b5fd" : "#7c3aed", color: "#fff", fontWeight: 800, fontSize: 15, cursor: posSubmitting || !posTable || posItems.length === 0 ? "not-allowed" : "pointer" }}>
                {posSubmitting ? "שולח..." : "🔥 שלח למטבח"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Compact Control Bar ── */}
      <div className="flex flex-wrap items-center gap-2 mb-3" dir="rtl">
        {/* Restaurant selector */}
        {isSuperAdmin && restaurants.length > 0 && (
          <select value={restaurantId} onChange={e => setRestaurantId(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
            <option value="">כל המסעדות</option>
            {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}
        {/* Active / All filter */}
        <div className="flex rounded-xl overflow-hidden border border-gray-200">
          {(["active", "all"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${filter === f ? "text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              style={filter === f ? { background: "#c9a84c" } : undefined}>
              {f === "active" ? "פעילות" : "הכל"}
            </button>
          ))}
        </div>
        {/* POS */}
        <button onClick={() => setShowPosModal(true)}
          className="px-3 py-2 rounded-xl text-sm font-bold text-white"
          style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>
          🧑‍🍳 הזמנה חדשה
        </button>
        {/* Date filter popover trigger */}
        <div className="relative">
          <button
            onClick={() => setShowDateFilter(p => !p)}
            className={`p-2 rounded-xl border text-sm font-medium transition-colors ${showDateFilter || dateFrom || dateTo ? "border-amber-400 bg-amber-50 text-amber-700" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}
            title="סינון תאריך"
          >
            📅{dateFrom || dateTo ? " ✦" : ""}
          </button>
          {showDateFilter && (
            <div className="absolute top-10 right-0 z-20 bg-white border border-gray-200 rounded-2xl shadow-xl p-4 flex flex-col gap-3 min-w-[260px]" dir="rtl">
              <div className="text-xs font-semibold text-gray-500">סינון לפי תאריך</div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-4">מ-</span>
                  <input type="datetime-local" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-4">עד-</span>
                  <input type="datetime-local" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
              </div>
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(""); setDateTo(""); setShowDateFilter(false); }}
                  className="text-xs text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors text-center">
                  ✕ נקה סינון
                </button>
              )}
            </div>
          )}
        </div>
        {/* Sound toggle */}
        <button onClick={() => setSoundEnabled(p => !p)} title={soundEnabled ? "כבה צליל" : "הפעל צליל"}
          className="p-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors text-base">
          {soundEnabled ? "🔔" : "🔕"}
        </button>
        {/* Refresh */}
        <button onClick={() => fetchOrders(true)} disabled={refreshing}
          className="p-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50">
          <svg className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        {/* Fullscreen */}
        <button onClick={() => setIsFullscreen(p => !p)} title={isFullscreen ? "יציאה ממסך מלא (Esc)" : "מסך מלא (F)"}
          className="p-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors">
          {isFullscreen ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
          )}
        </button>
        {/* Stats line */}
        <span className="text-xs text-gray-400 mr-auto">
          {tableEntries.filter(e => !e.isClosed).length} שולחנות · {totalItems} מנות · {lastRefresh.toLocaleTimeString("he-IL")}
        </span>
      </div>

      {/* ── Action Rail ── */}
      {hasRail && (
        <div className="grid grid-cols-3 gap-2 mb-4 rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-white" dir="rtl">
          {/* Needs confirm */}
          <div className="p-3" style={{ background: railConfirm.length ? "#fefce8" : "#fafafa" }}>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-base">🕐</span>
              <span className="text-xs font-bold text-yellow-700">לאישור</span>
              {railConfirm.length > 0 && (
                <span className="text-xs font-black bg-yellow-200 text-yellow-800 rounded-full w-5 h-5 flex items-center justify-center">{railConfirm.length}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {railConfirm.length === 0
                ? <span className="text-xs text-gray-300">אין</span>
                : railConfirm.map(t => (
                  <button key={t} onClick={() => scrollToTable(t)}
                    className="text-xs font-bold px-2 py-0.5 rounded-lg bg-yellow-100 text-yellow-800 hover:bg-yellow-200 transition-colors">
                    {t}
                  </button>
                ))
              }
            </div>
          </div>
          {/* Needs serve */}
          <div className="p-3 border-r border-l border-gray-100" style={{ background: railServe.length ? "#f0fdf4" : "#fafafa" }}>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-base">✅</span>
              <span className="text-xs font-bold text-green-700">להגשה</span>
              {railServe.length > 0 && (
                <span className="text-xs font-black bg-green-200 text-green-800 rounded-full w-5 h-5 flex items-center justify-center">{railServe.length}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {railServe.length === 0
                ? <span className="text-xs text-gray-300">אין</span>
                : railServe.map(t => (
                  <button key={t} onClick={() => scrollToTable(t)}
                    className="text-xs font-bold px-2 py-0.5 rounded-lg bg-green-100 text-green-800 hover:bg-green-200 transition-colors">
                    {t}
                  </button>
                ))
              }
            </div>
          </div>
          {/* Needs bill */}
          <div className="p-3" style={{ background: railBill.length ? "#fdf8ec" : "#fafafa" }}>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-base">💳</span>
              <span className="text-xs font-bold" style={{ color: "#8B6914" }}>לחשבון</span>
              {railBill.length > 0 && (
                <span className="text-xs font-black rounded-full w-5 h-5 flex items-center justify-center" style={{ background: "#fde68a", color: "#8B6914" }}>{railBill.length}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {railBill.length === 0
                ? <span className="text-xs text-gray-300">אין</span>
                : railBill.map(t => (
                  <button key={t} onClick={() => scrollToTable(t)}
                    className="text-xs font-bold px-2 py-0.5 rounded-lg hover:opacity-80 transition-colors"
                    style={{ background: "#fef3c7", color: "#8B6914" }}>
                    {t}
                  </button>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* ── Status summary chips ── */}
      {activeOrders.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap" dir="rtl">
          {(["PENDING","CONFIRMED","PREPARING","READY","DELIVERED","PAID","CANCELLED"] as const).map(s => {
            const count = activeOrders.filter(o => o.status === s).length;
            if (!count) return null;
            const label: Record<string, string> = {
              PENDING: "ממתינות", CONFIRMED: "מאושרות", PREPARING: "בהכנה",
              READY: "מוכנות", DELIVERED: "סופקו", PAID: "שולמו", CANCELLED: "בוטלו",
            };
            return (
              <div key={s} className={`px-3 py-1 rounded-full text-xs font-semibold ${ORDER_STATUS_BADGE[s]}`}>
                {count} {label[s]}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Tables grid ── */}
      {tableEntries.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center text-gray-400">
          <div className="text-5xl mb-3">🍽</div>
          <div className="font-medium text-lg">אין הזמנות {filter === "active" ? "פעילות" : ""}</div>
          <div className="text-sm mt-1">הדף מתרענן אוטומטית כל 10 שניות</div>
        </div>
      ) : (
        <div className="flex flex-col gap-3" dir="rtl">
          {/* Active tables — grid */}
          {tableEntries.filter(e => !e.isClosed).length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 items-start">
              {tableEntries.filter(e => !e.isClosed).map(({ table, tableOrders: tOrds }) => (
                <TableCard
                  key={table}
                  tableNumber={table}
                  orders={tOrds}
                  isClosed={false}
                  highlighted={highlightTable === table}
                  showAll={filter === "all"}
                  onItemCancel={cancelItem}
                  onItemServe={serveItem}
                  onOrderCancel={cancelOrder}
                  onConfirmOrder={confirmOrder}
                  onDeliverOrder={deliverOrder}
                  onShowBill={setBillTableKey}
                  onFireCourse={fireCourse}
                />
              ))}
            </div>
          )}
          {/* Closed tables — collapsed list */}
          {tableEntries.filter(e => e.isClosed).length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="text-xs font-semibold text-gray-400 px-1">שולחנות סגורים</div>
              {tableEntries.filter(e => e.isClosed).map(({ table, tableOrders: tOrds }) => (
                <TableCard
                  key={table}
                  tableNumber={table}
                  orders={tOrds}
                  isClosed
                  highlighted={highlightTable === table}
                  showAll={filter === "all"}
                  onItemCancel={cancelItem}
                  onItemServe={serveItem}
                  onOrderCancel={cancelOrder}
                  onConfirmOrder={confirmOrder}
                  onDeliverOrder={deliverOrder}
                  onShowBill={setBillTableKey}
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
