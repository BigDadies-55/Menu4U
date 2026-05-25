"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

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

const ITEM_NEXT_LABEL: Record<string, string> = {
  PENDING: "הכנה",
  PREPARING: "הוכן ✓",
};

/* #5 — Unified semantic status palette */
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

  /* #7 — Escape closes modal */
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
    { value: "card" as const,  label: "💳 כרטיס" },
    { value: "cash" as const,  label: "💵 מזומן" },
    { value: "app"  as const,  label: "📱 אפליקציה" },
  ];
  const TIP_OPTS = [
    { pct: 0,   label: "ללא" },
    { pct: 10,  label: "10%" },
    { pct: 12,  label: "12%" },
    { pct: 15,  label: "15%" },
    { pct: -1,  label: "אחר" },
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
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid #f1f5f9",
          background: "#c9a84c",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 18 }}>💳 חשבון — שולחן {tableNumber}</div>
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 }}>
              {validOrders.length} הזמנות · {fmtTime(validOrders[0]?.createdAt ?? "")}
            </div>
          </div>
          <button type="button" onClick={onClose} style={{
            background: "rgba(255,255,255,0.2)", border: "none",
            borderRadius: "50%", width: 32, height: 32, color: "#fff",
            fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}>✕</button>
        </div>

        {/* Summary + tip + payment */}
        <div style={{ padding: "20px 20px 4px" }}>

          {/* Tip selector */}
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
                  value={customTip}
                  onChange={e => setCustomTip(e.target.value)}
                  placeholder="סכום טיפ"
                  style={{ border: "2px solid #c9a84c", borderRadius: 10, padding: "6px 12px", fontSize: 14, width: 110, outline: "none" }}
                />
              </div>
            )}
          </div>

          {/* Totals breakdown */}
          <div style={{ background: "#f9fafb", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#6b7280", marginBottom: 8 }}>
              <span>סכום מקורי</span>
              <span style={{ fontWeight: 600, color: "#111827" }}>₪{subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#6b7280", marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #e5e7eb" }}>
              <span>טיפ</span>
              <span style={{ fontWeight: 600, color: tipAmount > 0 ? "#8B6914" : "#9ca3af" }}>
                {tipAmount > 0 ? `₪${tipAmount.toFixed(2)}` : "—"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: "#111827" }}>סה"כ לתשלום</span>
              <span style={{ fontWeight: 900, fontSize: 24, color: "#6d28d9" }}>₪{total.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment method */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>אמצעי תשלום</div>
            <div style={{ display: "flex", gap: 8 }}>
              {PAY_METHODS.map(m => (
                <button key={m.value} type="button"
                  onClick={() => setPayMethod(m.value)}
                  style={{
                    flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 13, fontWeight: 600,
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

        {/* Footer buttons */}
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

function TableCard({
  tableNumber,
  orders,
  isSuperAdmin,
  showAll,
  onItemAdvance,
  onItemCancel,
  onOrderCancel,
  onConfirmOrder,
  onDeliverOrder,
  onShowBill,
  onFireCourse,
}: {
  tableNumber: string;
  orders: Order[];
  isSuperAdmin: boolean;
  showAll?: boolean;
  onItemAdvance: (orderId: string, itemId: string) => Promise<void>;
  onItemCancel: (orderId: string, itemId: string) => Promise<void>;
  onOrderCancel: (orderId: string) => Promise<void>;
  onConfirmOrder: (orderId: string) => Promise<void>;
  onDeliverOrder: (orderId: string) => Promise<void>;
  onShowBill: (tableNumber: string) => void;
  onFireCourse: (orderId: string, course: number) => Promise<void>;
}) {
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [confirmingOrder, setConfirmingOrder] = useState<string | null>(null);

  // In "all" mode show every order; in active mode hide CANCELLED/PAID
  const nonCancelledOrders = showAll
    ? orders
    : orders.filter(o => o.status !== "CANCELLED" && o.status !== "PAID");
  const activeOrders = nonCancelledOrders.filter(o => o.status !== "DELIVERED");
  const allItems = activeOrders.flatMap(o => o.items);
  const doneCount = allItems.filter(i => i.itemStatus === "DONE").length;
  const totalCount = allItems.length;
  const oldestOrder = orders.reduce((a, b) =>
    new Date(a.createdAt) < new Date(b.createdAt) ? a : b
  );
  const ageMin = Math.floor((Date.now() - new Date(oldestOrder.createdAt).getTime()) / 60000);
  const hasActive = activeOrders.length > 0;
  const isUrgent = ageMin > 20 && hasActive;
  const totalAmount = nonCancelledOrders.reduce((s, o) => s + o.totalAmount, 0);

  async function advanceItem(orderId: string, itemId: string) {
    setBusy(prev => new Set(prev).add(itemId));
    await onItemAdvance(orderId, itemId);
    setBusy(prev => { const n = new Set(prev); n.delete(itemId); return n; });
  }

  async function cancelItem(orderId: string, itemId: string) {
    setBusy(prev => new Set(prev).add(itemId + "-cancel"));
    await onItemCancel(orderId, itemId);
    setBusy(prev => { const n = new Set(prev); n.delete(itemId + "-cancel"); return n; });
  }

  async function confirmOrder(orderId: string) {
    setConfirmingOrder(orderId);
    await onConfirmOrder(orderId);
    setConfirmingOrder(null);
  }

  function showBill() {
    onShowBill(tableNumber);
  }

  return (
    <div
      className="bg-white rounded-2xl border overflow-hidden shadow-sm"
      style={{ borderColor: isUrgent ? "#ef4444" : "#e5e7eb" }}
    >
      {/* Table header */}
      <div
        className="px-3 pt-2 pb-1.5"
        style={{ background: isUrgent ? "#fef2f2" : "#f9fafb", borderBottom: "1px solid #e5e7eb" }}
      >
        {/* Row 1: icon + name | source badge | price */}
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-8 rounded-lg bg-amber-100 border-2 border-amber-300 flex items-center justify-center font-black text-amber-800 text-xs shrink-0">
            {tableNumber === "–" ? "?" : tableNumber}
          </div>
          <span className="font-bold text-gray-900 text-sm flex-1">שולחן {tableNumber}</span>
          {orders.some(o => o.orderSource === "WAITER") && (
            <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold shrink-0" style={{ background: "#ede9fe", color: "#7c3aed" }}>
              🧑‍🍳 POS
            </span>
          )}
          <span className="font-black text-gray-900 text-lg shrink-0">₪{totalAmount.toFixed(0)}</span>
        </div>
        {/* Row 2: time + dishes | order count */}
        <div className={`flex justify-between mt-0.5 text-xs ${isUrgent ? "text-red-500 font-semibold" : "text-gray-400"}`}>
          <span>⏱ {timeSince(oldestOrder.createdAt)} · {totalCount} מנות</span>
          <span>{nonCancelledOrders.length} הזמנות</span>
        </div>
        {/* Row 3: progress dots */}
        <div className="flex gap-1 mt-1.5">
          {allItems.map(i => (
            <div key={i.id} className="w-2 h-2 rounded-full"
              style={{ background: i.itemStatus === "DONE" ? "#22c55e" : i.itemStatus === "PREPARING" ? "#38bdf8" : "#d1d5db" }}
            />
          ))}
        </div>
      </div>

      {/* Orders — newest first */}
      {[...nonCancelledOrders].reverse().map((order, idx, arr) => {
        const isPending = order.status === "PENDING";
        const isDelivered = order.status === "DELIVERED";
        const isReady = order.status === "READY";
        const isPaid = order.status === "PAID";
        const isCancelled = order.status === "CANCELLED";
        const orderNum = arr.length - idx;

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
                    : isPaid ? "💜 שולם" : isCancelled ? "✕ בוטל" : `הזמנה ${orderNum}`}
                </span>
                <span className="text-xs text-gray-400 shrink-0">
                  {order.items.length} מנות · ₪{order.totalAmount.toFixed(0)} · {timeSince(order.createdAt)}
                </span>
                {order.notes && (
                  <span className="text-xs text-gray-400 italic truncate">· 💬 {order.notes}</span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {isPending && (
                  <button
                    onClick={() => confirmOrder(order.id)}
                    disabled={confirmingOrder === order.id}
                    className="px-3 py-1 rounded-xl text-xs font-bold text-white disabled:opacity-50 transition-all"
                    style={{ background: "#16a34a" }}
                  >
                    {confirmingOrder === order.id ? "..." : "✓ אשר"}
                  </button>
                )}
                {isReady && (
                  <button
                    onClick={() => onDeliverOrder(order.id)}
                    className="px-3 py-1 rounded-xl text-xs font-bold text-white transition-all"
                    style={{ background: "#0891b2" }}
                  >
                    🛎 סופק לשולחן
                  </button>
                )}
                {!isPending && !isDelivered && !isReady && !isPaid && !isCancelled && (
                  confirmingOrder === order.id + "-cancel" ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setConfirmingOrder(null); onOrderCancel(order.id); }}
                        className="text-xs text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded-lg transition-colors"
                      >✕ בטל</button>
                      <button
                        onClick={() => setConfirmingOrder(null)}
                        className="text-xs text-gray-500 hover:text-gray-700 px-2 py-0.5 rounded-lg hover:bg-gray-100 transition-colors"
                      >ביטול</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmingOrder(order.id + "-cancel")}
                      className="text-xs text-red-500 hover:text-red-700 px-2 py-0.5 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      ✕ בטל
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Held items fire buttons — show per course */}
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
                      className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold text-white transition-all"
                      style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}
                    >
                      🔥 הצת {COURSE_LABEL[course] ?? `קורס ${course}`} ({count} מנות)
                    </button>
                  ))}
                </div>
              );
            })()}

            {/* Items */}
            <div className="divide-y divide-gray-50" style={{ opacity: isPending || isDelivered || isPaid || isCancelled ? 0.5 : 1 }}>
              {order.items.map(({ id: itemId, quantity, notes, itemStatus, item, modifiers, course, heldUntilFired, firedAt, doneAt }) => {
                const isItemCancelled = itemStatus === "CANCELLED";
                const isHeld = heldUntilFired;
                const nextLabel = !isHeld && !isPending && !isDelivered && !isReady && !isPaid && !isCancelled && !isItemCancelled ? ITEM_NEXT_LABEL[itemStatus] : undefined;
                const isBusy = busy.has(itemId);
                const isCancelBusy = busy.has(itemId + "-cancel");
                const isDone = itemStatus === "DONE" || isDelivered || isReady || isPaid;
                const canCancel = !isPending && !isDelivered && !isReady && !isPaid && !isCancelled && !isItemCancelled && !isDone;

                return (
                  <div
                    key={itemId}
                    className={`flex items-center gap-1.5 px-2 py-1 transition-colors ${isDone || isItemCancelled ? "opacity-50" : ""}`}
                    style={isHeld ? { background: "#faf5ff", opacity: 0.75 } : undefined}
                  >
                    <span className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold shrink-0 ${isItemCancelled ? "bg-red-50 text-red-400" : isHeld ? "bg-purple-50 text-purple-500" : "bg-gray-100 text-gray-600"}`}>
                      {quantity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {course > 1 && (
                          <span className="text-xs shrink-0" title={`קורס ${COURSE_LABEL[course] ?? course}`}>
                            {COURSE_EMOJI[course] ?? "🍽"}
                          </span>
                        )}
                        <span className={`text-sm font-semibold truncate ${isDone || isItemCancelled ? "line-through text-gray-600" : isHeld ? "text-purple-700" : "text-gray-900"}`}>
                          {item.name}
                          {isHeld && <span className="text-purple-400 font-normal"> · ממתין להצתה</span>}
                        </span>
                      </div>
                      {/* Course timing */}
                      {firedAt && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          {doneAt
                            ? `⏱ ${Math.round((new Date(doneAt).getTime() - new Date(firedAt).getTime()) / 60000)} דק' להכנה`
                            : `🔥 הוצת לפני ${Math.round((Date.now() - new Date(firedAt).getTime()) / 60000)} דק'`
                          }
                        </div>
                      )}
                      {modifiers && modifiers.length > 0 && !isDone && !isItemCancelled && (
                        <div className="flex gap-1 flex-wrap mt-0.5">
                          {modifiers.map((m, i) => (
                            <span key={i} className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "#1e3a2e", color: "#4ade80" }}>
                              {m.label}{m.priceAdd > 0 ? ` +₪${m.priceAdd}` : ""}
                            </span>
                          ))}
                        </div>
                      )}
                      {notes && !isDone && !isItemCancelled && (
                        <div className="text-xs text-gray-400 italic truncate">{notes}</div>
                      )}
                    </div>
                    {!isDelivered && !isPaid && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${ITEM_STATUS_COLOR[itemStatus] ?? ""}`}>
                        {ITEM_STATUS_LABEL[itemStatus] ?? itemStatus}
                      </span>
                    )}
                    {nextLabel && !isDone ? (
                      <button
                        onClick={() => advanceItem(order.id, itemId)}
                        disabled={isBusy}
                        className="shrink-0 px-2 py-0.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40 transition-all"
                        style={{ background: itemStatus === "PREPARING" ? "#16a34a" : "#c9a84c" }}
                      >
                        {isBusy ? "..." : nextLabel}
                      </button>
                    ) : isDone && !isItemCancelled ? (
                      <span className="shrink-0 text-green-500 text-sm">✓</span>
                    ) : null}
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

      {/* Footer: show bill */}
      {nonCancelledOrders.length > 0 && (() => {
        const isPaidTable = nonCancelledOrders.every(o => o.status === "PAID");
        return (
          <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/50">
            <button
              type="button"
              onClick={showBill}
              disabled={isPaidTable}
              className="w-full py-2 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: isPaidTable ? "#9ca3af" : "#c9a84c" }}
              title={isPaidTable ? "השולחן כבר שולם" : undefined}
            >
              {isPaidTable ? "✓ שולם" : "💳 הצג חשבון ותשלום"}
            </button>
          </div>
        );
      })()}
    </div>
  );
}

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
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [filter, setFilter] = useState<"active" | "all">("active");
  const [restaurantId, setRestaurantId] = useState(defaultRestaurantId ?? "");
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [billTableKey, setBillTableKey] = useState<string | null>(null);
  const [showPosModal, setShowPosModal] = useState(false);
  const [posTable, setPosTable] = useState("");
  const [posNotes, setPosNotes] = useState("");
  const [posItems, setPosItems] = useState<{ name: string; price: number; course: number; qty: number }[]>([]);
  const [posNewItem, setPosNewItem] = useState({ name: "", price: "", course: 1, qty: 1 });
  const [posSubmitting, setPosSubmitting] = useState(false);

  const fetchOrders = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    const params = new URLSearchParams();
    if (restaurantId) params.set("restaurantId", restaurantId);
    if (filter === "active") params.set("activeOnly", "1");
    if (dateFrom) params.set("from", new Date(dateFrom).toISOString());
    if (dateTo) params.set("to", new Date(dateTo).toISOString());
    try {
      const res = await fetch(`/api/admin/orders?${params}`);
      if (res.ok) { setOrders(await res.json()); setLastRefresh(new Date()); }
    } catch { /* ignore */ }
    if (showSpinner) setRefreshing(false);
  }, [restaurantId, filter, dateFrom, dateTo]);

  useEffect(() => {
    fetchOrders();
    const iv = setInterval(() => fetchOrders(), 10000);
    return () => clearInterval(iv);
  }, [fetchOrders]);

  async function advanceItem(orderId: string, itemId: string) {
    const res = await fetch(`/api/admin/orders/${orderId}/items/${itemId}/status`, {
      method: "PATCH",
    });
    if (!res.ok) return;
    const { itemStatus, orderReady } = await res.json();
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      const updatedItems = o.items.map(i => i.id === itemId ? { ...i, itemStatus } : i);
      return { ...o, status: orderReady ? "READY" : o.status, items: updatedItems };
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

  async function createWaiterOrder() {
    if (!posTable || posItems.length === 0) return;
    setPosSubmitting(true);
    const rid = restaurantId || restaurants[0]?.id;
    if (!rid) { setPosSubmitting(false); return; }
    // For waiter orders, we create via admin API with free-text items
    // We need to find matching items by name — simplified: post as notes
    const body = {
      restaurantId: rid,
      tableNumber: posTable,
      notes: posNotes || null,
      items: posItems.map(i => ({
        // We use a placeholder — in real usage would link real item IDs
        name: i.name, price: i.price, course: i.course, qty: i.qty,
      })),
    };
    // Post to a simple waiter-order endpoint with free text
    await fetch("/api/admin/orders/waiter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setShowPosModal(false);
    setPosTable(""); setPosNotes(""); setPosItems([]);
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

  async function deliverOrder(orderId: string) {
    const res = await fetch(`/api/admin/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DELIVERED" }),
    });
    if (!res.ok) return;
    // Keep in state (needed for bill calculation) — table grouping already hides DELIVERED in active mode
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: "DELIVERED" } : o));
  }

  function closeTable(tableNumber: string) {
    const tableOrders = orders.filter(o => (o.tableNumber ?? "–") === tableNumber);
    const rid = tableOrders[0]?.restaurant?.id || restaurantId;
    setBillTableKey(null);
    // Optimistic remove
    setOrders(prev => prev.filter(o => (o.tableNumber ?? "–") !== tableNumber));
    fetch("/api/admin/orders/close-table", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableNumber, restaurantId: rid }),
    }).catch(() => {/* ignore */});
  }

  const activeOrders = filter === "active"
    ? orders.filter(o => o.status !== "CANCELLED" && o.status !== "PAID")
    : orders;

  // Group by table — in active mode exclude PAID/DELIVERED; in all mode show everything
  const byTable = new Map<string, Order[]>();
  [...activeOrders]
    .filter(order =>
      order.tableNumber && order.tableNumber.trim() !== "" &&
      (filter === "all" || (order.status !== "PAID" && order.status !== "DELIVERED"))
    )
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .forEach(order => {
      const key = order.tableNumber!;
      if (!byTable.has(key)) byTable.set(key, []);
      byTable.get(key)!.push(order);
    });

  const totalItems = activeOrders.reduce((s, o) => s + o.items.length, 0);
  const pendingOrders = activeOrders.filter(o => o.status === "PENDING").length;

  // BillModal data
  const billOrders = billTableKey
    ? orders.filter(o => (o.tableNumber ?? "–") === billTableKey)
    : [];

  return (
    <div className="p-4 md:p-8">
      {billTableKey && billOrders.length > 0 && (
        <BillModal
          tableNumber={billTableKey}
          orders={billOrders}
          onConfirm={() => closeTable(billTableKey)}
          onClose={() => setBillTableKey(null)}
        />
      )}

      {/* ── Waiter POS Modal ── */}
      {showPosModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, direction: "rtl" }}>
          <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 520, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ padding: "16px 20px", background: "linear-gradient(135deg,#7c3aed,#a855f7)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: "#fff", fontWeight: 800, fontSize: 18 }}>🧑‍🍳 הזמנה חדשה (POS)</div>
                <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 }}>ישירות למטבח · ללא המתנה לאישור</div>
              </div>
              <button type="button" onClick={() => setShowPosModal(false)} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: 32, height: 32, color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Table + notes */}
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>שולחן *</label>
                  <input
                    value={posTable} onChange={e => setPosTable(e.target.value)}
                    placeholder="מספר שולחן"
                    style={{ width: "100%", border: "2px solid #e5e7eb", borderRadius: 10, padding: "8px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ flex: 2 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>הערות</label>
                  <input
                    value={posNotes} onChange={e => setPosNotes(e.target.value)}
                    placeholder="הערות להזמנה..."
                    style={{ width: "100%", border: "2px solid #e5e7eb", borderRadius: 10, padding: "8px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              {/* Add item row */}
              <div style={{ background: "#f9fafb", borderRadius: 14, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 10 }}>הוסף פריט</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input
                    value={posNewItem.name} onChange={e => setPosNewItem(p => ({ ...p, name: e.target.value }))}
                    placeholder="שם המנה"
                    style={{ flex: 3, minWidth: 120, border: "2px solid #e5e7eb", borderRadius: 8, padding: "6px 10px", fontSize: 13, outline: "none" }}
                  />
                  <input
                    type="number" min="0" step="0.5"
                    value={posNewItem.price} onChange={e => setPosNewItem(p => ({ ...p, price: e.target.value }))}
                    placeholder="₪ מחיר"
                    style={{ flex: 1, minWidth: 70, border: "2px solid #e5e7eb", borderRadius: 8, padding: "6px 10px", fontSize: 13, outline: "none" }}
                  />
                  <select
                    value={posNewItem.course} onChange={e => setPosNewItem(p => ({ ...p, course: Number(e.target.value) }))}
                    style={{ flex: 1, minWidth: 80, border: "2px solid #e5e7eb", borderRadius: 8, padding: "6px 8px", fontSize: 13, outline: "none" }}
                  >
                    <option value={1}>🥗 ראשון</option>
                    <option value={2}>🍖 עיקרי</option>
                    <option value={3}>🍮 קינוח</option>
                  </select>
                  <input
                    type="number" min="1" max="20"
                    value={posNewItem.qty} onChange={e => setPosNewItem(p => ({ ...p, qty: Number(e.target.value) }))}
                    style={{ width: 48, border: "2px solid #e5e7eb", borderRadius: 8, padding: "6px 8px", fontSize: 13, outline: "none", textAlign: "center" }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!posNewItem.name || !posNewItem.price) return;
                      setPosItems(prev => [...prev, { name: posNewItem.name, price: Number(posNewItem.price), course: posNewItem.course, qty: posNewItem.qty }]);
                      setPosNewItem({ name: "", price: "", course: posNewItem.course, qty: 1 });
                    }}
                    style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}
                  >+ הוסף</button>
                </div>
              </div>

              {/* Items list */}
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
                          <span style={{ fontSize: 11, color: "#7c3aed", background: "#ede9fe", padding: "2px 6px", borderRadius: 20 }}>
                            {COURSE_LABEL[item.course]}
                          </span>
                        )}
                        <button type="button" onClick={() => setPosItems(prev => prev.filter((_, i) => i !== idx))}
                          style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
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
              <button
                type="button"
                onClick={createWaiterOrder}
                disabled={posSubmitting || !posTable || posItems.length === 0}
                style={{ flex: 2, padding: "11px 0", borderRadius: 12, border: "none", background: posSubmitting || !posTable || posItems.length === 0 ? "#c4b5fd" : "#7c3aed", color: "#fff", fontWeight: 800, fontSize: 15, cursor: posSubmitting || !posTable || posItems.length === 0 ? "not-allowed" : "pointer" }}
              >
                {posSubmitting ? "שולח..." : "🔥 שלח למטבח"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            🍽 ניהול הזמנות
            {pendingOrders > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold animate-pulse">
                {pendingOrders} ממתינות
              </span>
            )}
          </h1>
          <div className="flex gap-4 mt-0.5">
            <Link href="/admin/orders/stats" className="text-xs text-amber-700 hover:text-amber-900 font-medium">📊 סטטיסטיקות →</Link>
            <Link href="/admin/dashboard" className="text-xs text-cyan-700 hover:text-cyan-900 font-medium">📺 תצוגת מטבח →</Link>
          </div>
          <p className="text-gray-500 mt-0.5 text-sm">
            {byTable.size} שולחנות · {totalItems} מנות · עדכון: {lastRefresh.toLocaleTimeString("he-IL")}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isSuperAdmin && restaurants.length > 0 && (
            <select
              value={restaurantId}
              onChange={e => setRestaurantId(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="">כל המסעדות</option>
              {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}
          <div className="flex rounded-xl overflow-hidden border border-gray-200">
            {(["active", "all"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${filter === f ? "text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                style={filter === f ? { background: "#c9a84c", boxShadow: "0 2px 8px rgba(201,168,76,0.35)" } : undefined}>
                {f === "active" ? "פעילות" : "הכל"}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowPosModal(true)}
            className="px-3 py-2 rounded-xl text-sm font-bold text-white transition-all"
            style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow: "0 2px 8px rgba(124,58,237,0.3)" }}
          >
            🧑‍🍳 הזמנה חדשה
          </button>
          <button onClick={() => fetchOrders(true)} disabled={refreshing}
            className="p-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            <svg className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
        {/* Date range filter */}
        <div className="flex items-center gap-2 flex-wrap mt-3">
          <span className="text-xs text-gray-500 font-medium">סינון תאריך:</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400">מ-</span>
            <input
              type="datetime-local"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400">עד-</span>
            <input
              type="datetime-local"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              ✕ נקה
            </button>
          )}
        </div>
      </div>

      {/* Status summary */}
      {activeOrders.length > 0 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {(filter === "active"
            ? (["PENDING","CONFIRMED","PREPARING","READY"] as const)
            : (["PENDING","CONFIRMED","PREPARING","READY","DELIVERED","PAID","CANCELLED"] as const)
          ).map(s => {
            const count = activeOrders.filter(o => o.status === s).length;
            if (!count) return null;
            const label: Record<string, string> = {
              PENDING: "ממתינות", CONFIRMED: "מאושרות", PREPARING: "בהכנה",
              READY: "מוכנות", DELIVERED: "סופקו", PAID: "שולמו", CANCELLED: "בוטלו",
            };
            return (
              <div key={s} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${ORDER_STATUS_BADGE[s]}`}>
                {count} {label[s]}
              </div>
            );
          })}
        </div>
      )}

      {/* Tables grid */}
      {byTable.size === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center text-gray-400">
          <div className="text-5xl mb-3">🍽</div>
          <div className="font-medium text-lg">אין הזמנות {filter === "active" ? "פעילות" : ""}</div>
          <div className="text-sm mt-1">הדף מתרענן אוטומטית כל 10 שניות</div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 items-start">
          {Array.from(byTable.entries()).map(([table, tableOrders]) => (
            <TableCard
              key={table}
              tableNumber={table}
              orders={tableOrders}
              isSuperAdmin={isSuperAdmin}
              showAll={filter === "all"}
              onItemAdvance={advanceItem}
              onItemCancel={cancelItem}
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
  );
}
