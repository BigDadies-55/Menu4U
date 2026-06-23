"use client";

import { T } from "@/lib/ui";
import { useState, useEffect } from "react";
import { ManagerPinModal } from "@/app/admin/waiter-pos/ManagerPinModal";
import type { Order, OrderItem } from "./types";

export type { Order, OrderItem, OrderItemModifier } from "./types";

function fmtDateTime(d: Date) {
  return d.toLocaleString("he-IL", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

type SplitPayment = { id: string; amount: number; method: string; createdByName: string | null; createdAt: string };
type ActivePanel = "discount" | "price" | "split" | null;
type PinPrompt = { title: string; description?: string; run: (token: string) => Promise<void> };

const PAY_METHOD_LABEL: Record<string, string> = {
  card: "כרטיס אשראי",
  cash: "מזומן",
  app: "אפליקציה",
};

export function PaymentPanel({
  tableNumber,
  orders,
  restaurantId,
  onConfirm,
  onClose,
  onOrdersRefresh,
  onPaid,
}: {
  tableNumber: string;
  orders: Order[];
  restaurantId: string;
  onConfirm: () => void;
  onClose: () => void;
  onOrdersRefresh: () => Promise<void>;
  /** Called after the table is fully settled via split payment (already PAID server-side). */
  onPaid?: () => void;
}) {
  // Receipt is always paper — fixed, theme-independent
  const INK = "#1a1208";
  const INK_SUB = "#6b5040";
  const PAPER = "#fffdf5";

  // "–" is the UI fallback for orders without a tableNumber (null in DB)
  const apiTableNumber = tableNumber === "–" ? null : tableNumber;

  const [tipPct, setTipPct] = useState<number>(0);
  const [customTip, setCustomTip] = useState("");
  const [payMethod, setPayMethod] = useState<"cash" | "card" | "app">("card");
  const [paying, setPaying] = useState(false);

  // ── Manager-approved actions (discount / on-house / price override) ──
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [pinPrompt, setPinPrompt] = useState<PinPrompt | null>(null);

  // Discount inputs
  const [discMode, setDiscMode] = useState<"AMOUNT" | "PERCENT">("PERCENT");
  const [discValue, setDiscValue] = useState("");
  const [discReason, setDiscReason] = useState("");
  // Price override
  const [priceItemId, setPriceItemId] = useState<string | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [priceReason, setPriceReason] = useState("");

  // ── Split payment ──
  const [splitPayments, setSplitPayments] = useState<SplitPayment[]>([]);
  const [splitAmount, setSplitAmount] = useState("");
  const [splitMethod, setSplitMethod] = useState<"cash" | "card" | "app">("cash");
  const [splitBusy, setSplitBusy] = useState(false);
  const [splitErr, setSplitErr] = useState<string | null>(null);

  // Loyalty club flow
  type ClubStep = "idle" | "phone" | "searching" | "found" | "not_found" | "redeeming" | "done";
  type LoyaltyCoupon = { id: string; code: string; type: string; value: number; description: string | null; expiresAt: string | null };
  type LoyaltyMember = { id: string; name: string; points: number; coupons?: LoyaltyCoupon[] };
  type LoyaltySettings = { shekelPerPoint: number; minRedeemPoints: number };
  type RedeemMode = "points" | "coupon";
  const [clubStep, setClubStep] = useState<ClubStep>("idle");
  const [clubPhone, setClubPhone] = useState("");
  const [clubMember, setClubMember] = useState<LoyaltyMember | null>(null);
  const [clubSettings, setClubSettings] = useState<LoyaltySettings>({ shekelPerPoint: 0.1, minRedeemPoints: 100 });
  const [clubPoints, setClubPoints] = useState<number>(0);
  const [clubError, setClubError] = useState<string | null>(null);
  const [redeemMode, setRedeemMode] = useState<RedeemMode>("points");
  const [selectedCouponId, setSelectedCouponId] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const validOrders = orders.filter(o => !["CANCELLED", "PAID"].includes(o.status));
  // Exclude voided/comped items from display — they don't contribute to bill amount
  const allItems = validOrders.flatMap(o => o.items).filter(i => !i.voidedAt && !i.isComped);
  // totalAmount already has discounts (loyalty / manager adjustments) baked in
  const subtotal = validOrders.reduce((s, o) => s + o.totalAmount, 0);
  const loyaltyDiscount = validOrders.reduce((s, o) => s + (o.loyaltyDiscountAmount ?? 0), 0);
  const loyaltyMemberNames = [...new Set(validOrders.filter(o => o.loyaltyMemberName).map(o => o.loyaltyMemberName!))];
  // Track voids/comps for display in receipt (all items before filtering)
  const allItemsIncludingVoided = validOrders.flatMap(o => o.items);
  const voidedItems = allItemsIncludingVoided.filter(i => i.voidedAt || i.isComped);
  const itemsSubtotal = allItems.reduce((s, i) => s + (i.price * i.quantity), 0);
  const hasManagerAdjustment = itemsSubtotal !== subtotal + loyaltyDiscount;
  const tipAmount = tipPct === -1
    ? (parseFloat(customTip) || 0)
    : Math.round(subtotal * tipPct) / 100;
  const total = subtotal + tipAmount;
  const VAT_RATE = 0.18;
  const vatAmount = Math.round((total * VAT_RATE / (1 + VAT_RATE)) * 100) / 100;

  const splitPaid = Math.round(splitPayments.reduce((s, p) => s + p.amount, 0) * 100) / 100;
  const splitBalance = Math.max(0, Math.round((total - splitPaid) * 100) / 100);
  const hasPartialPayments = splitPayments.length > 0;

  const restaurantName = orders[0]?.restaurant?.name ?? "";
  const now = new Date();
  const dateStr = fmtDateTime(now);

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

  async function searchMember() {
    if (!clubPhone.trim()) return;
    setClubStep("searching");
    setClubError(null);
    try {
      const [mRes, sRes] = await Promise.all([
        fetch(`/api/loyalty/${restaurantId}/member?phone=${encodeURIComponent(clubPhone.trim())}`),
        fetch(`/api/loyalty/${restaurantId}/settings`),
      ]);
      const member = mRes.ok ? await mRes.json() : null;
      const settings = sRes.ok ? await sRes.json() : null;
      if (member?.id) {
        setClubMember(member);
        if (settings) setClubSettings({ shekelPerPoint: settings.shekelPerPoint ?? 0.1, minRedeemPoints: settings.minRedeemPoints ?? 100 });
        setClubPoints(Math.min(member.points, settings?.minRedeemPoints ?? 100));
        const activeCoupons = (member.coupons ?? []).filter((c: LoyaltyCoupon) => !c.expiresAt || new Date(c.expiresAt) > new Date());
        setRedeemMode(activeCoupons.length > 0 ? "coupon" : "points");
        setSelectedCouponId(activeCoupons[0]?.id ?? null);
        setClubStep("found");
      } else {
        setClubStep("not_found");
      }
    } catch {
      setClubStep("not_found");
    }
  }

  async function redeem() {
    if (!clubMember) return;
    const targetOrder = validOrders[0];
    if (!targetOrder) return;
    if (redeemMode === "coupon" && !selectedCouponId) return;
    if (redeemMode === "points" && clubPoints <= 0) return;
    setClubStep("redeeming");
    setClubError(null);
    try {
      const body = redeemMode === "coupon"
        ? { orderId: targetOrder.id, memberId: clubMember.id, type: "COUPON", couponId: selectedCouponId }
        : { orderId: targetOrder.id, memberId: clubMember.id, type: "POINTS", pointsToRedeem: clubPoints };
      const res = await fetch(`/api/loyalty/${restaurantId}/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error === "already_redeemed" ? "הזמנה זו כבר מומשה"
          : data.error === "coupon_invalid" ? "הקופון אינו תקף"
          : data.error === "coupon_expired" ? "הקופון פג תוקף"
          : data.error ?? "שגיאה";
        setClubError(msg);
        setClubStep("found");
        return;
      }
      await onOrdersRefresh();
      setClubStep("done");
    } catch {
      setClubError("שגיאת תקשורת");
      setClubStep("found");
    }
  }

  // ── Manager-approved adjustment helpers ──
  function requestAdjust(prompt: PinPrompt) {
    setActionError(null);
    setPinPrompt(prompt);
  }

  async function postAdjust(token: string, payload: Record<string, unknown>): Promise<boolean> {
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await fetch("/api/admin/orders/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, tableNumber: apiTableNumber, managerToken: token, ...payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setActionError(data.error ?? "שגיאה"); return false; }
      await onOrdersRefresh();
      return true;
    } catch {
      setActionError("שגיאת תקשורת");
      return false;
    } finally {
      setActionBusy(false);
    }
  }

  function submitDiscount() {
    const value = parseFloat(discValue);
    if (!(value > 0)) { setActionError("הזן ערך הנחה"); return; }
    requestAdjust({
      title: "אישור הנחה",
      description: discMode === "PERCENT" ? `הנחה ${value}%` : `הנחה ₪${value}`,
      run: async (token) => {
        const ok = await postAdjust(token, {
          type: discMode === "PERCENT" ? "DISCOUNT_PERCENT" : "DISCOUNT_AMOUNT",
          value, reason: discReason.trim() || undefined,
        });
        if (ok) { setActivePanel(null); setDiscValue(""); setDiscReason(""); }
      },
    });
  }

  function submitPriceOverride() {
    if (!priceItemId) { setActionError("בחר פריט"); return; }
    const value = parseFloat(newPrice);
    if (!(value >= 0)) { setActionError("הזן מחיר חדש"); return; }
    requestAdjust({
      title: "אישור שינוי מחיר",
      description: `מחיר חדש ₪${value}`,
      run: async (token) => {
        const ok = await postAdjust(token, { type: "PRICE_OVERRIDE", itemId: priceItemId, value, reason: priceReason.trim() || undefined });
        if (ok) { setActivePanel(null); setPriceItemId(null); setNewPrice(""); setPriceReason(""); }
      },
    });
  }

  // ── Split payment ──
  async function loadSplit() {
    setSplitErr(null);
    try {
      const res = await fetch(`/api/admin/orders/pay-partial?restaurantId=${encodeURIComponent(restaurantId)}&tableNumber=${encodeURIComponent(apiTableNumber ?? "")}`);
      if (res.ok) {
        const data = await res.json();
        setSplitPayments(data.payments ?? []);
      }
    } catch { /* ignore */ }
  }

  function openSplit() {
    setActivePanel("split");
    setSplitAmount("");
    loadSplit();
  }

  async function submitPartial() {
    const amount = parseFloat(splitAmount);
    if (!(amount > 0)) { setSplitErr("הזן סכום"); return; }
    setSplitBusy(true);
    setSplitErr(null);
    try {
      const res = await fetch("/api/admin/orders/pay-partial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, tableNumber: apiTableNumber, amount, method: splitMethod, tipAmount }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setSplitErr(data.error ?? "שגיאה"); return; }
      setSplitAmount("");
      if (data.closed) {
        if (onPaid) onPaid(); else { await onOrdersRefresh(); onClose(); }
        return;
      }
      await loadSplit();
    } catch {
      setSplitErr("שגיאת תקשורת");
    } finally {
      setSplitBusy(false);
    }
  }

  function printReceipt() {
    const itemRows = allItems.map(item => {
      const lineTotal = (item.price * item.quantity).toFixed(2);
      const mods = item.modifiers && item.modifiers.length > 0
        ? item.modifiers.map(m => `<div class="indent">${m.label}${m.priceAdd > 0 ? ` +₪${m.priceAdd}` : ""}</div>`).join("")
        : "";
      return `
        <div class="row">
          <span>${item.quantity}× ${item.item.name}</span>
          <span>₪${lineTotal}</span>
        </div>
        ${mods}
      `;
    }).join("");

    const tipRow = tipAmount > 0
      ? `<div class="row"><span>טיפ ${tipPct === -1 ? "" : `${tipPct}%`}</span><span>₪${tipAmount.toFixed(2)}</span></div>`
      : "";

    const discountRows = loyaltyDiscount > 0
      ? `<div class="row"><span>סה"כ לפני הנחה</span><span>₪${(subtotal + loyaltyDiscount).toFixed(2)}</span></div>
         <div class="row discount-row"><span>⭐ הנחת מועדון${loyaltyMemberNames.length > 0 ? ` (${loyaltyMemberNames[0]})` : ""}</span><span>-₪${loyaltyDiscount.toFixed(2)}</span></div>
         <div class="row"><span>לאחר הנחה</span><span>₪${subtotal.toFixed(2)}</span></div>`
      : `<div class="row"><span>סה"כ</span><span>₪${subtotal.toFixed(2)}</span></div>`;

    const receiptHtml = `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="utf-8">
        <title>חשבון - שולחן ${tableNumber}</title>
        <style>
          @page { size: 80mm auto; margin: 4mm; }
          body { font-family: 'Courier New', monospace; font-size: 12px; width: 72mm; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .large { font-size: 16px; }
          .divider { border-top: 1px dashed #000; margin: 4px 0; }
          .double { border-top: 2px solid #000; margin: 4px 0; }
          .row { display: flex; justify-content: space-between; margin: 2px 0; }
          .indent { padding-right: 8px; color: #555; font-size: 11px; }
          .total-row { font-weight: bold; font-size: 14px; }
          .discount-row { font-weight: bold; }
          .vat-row { font-size: 10px; color: #555; }
        </style>
      </head>
      <body>
        <div class="center bold large">${restaurantName}</div>
        <div class="center">חשבון</div>
        <div class="divider"></div>
        <div class="row"><span>שולחן: ${tableNumber}</span><span>${dateStr}</span></div>
        <div class="divider"></div>
        ${itemRows}
        <div class="divider"></div>
        ${discountRows}
        ${tipRow}
        <div class="double"></div>
        <div class="row total-row"><span>סה"כ לתשלום</span><span>₪${total.toFixed(2)}</span></div>
        <div class="row vat-row"><span>מתוכם מע"מ 18%</span><span>₪${vatAmount.toFixed(2)}</span></div>
        <div class="row"><span>אמצעי תשלום</span><span>${PAY_METHOD_LABEL[payMethod]}</span></div>
        <div class="divider"></div>
        <div class="center">תודה על ביקורכם! 🙏</div>
      </body>
      </html>
    `;
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) return;
    w.document.write(receiptHtml);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 300);
  }

  async function handleConfirm() {
    setPaying(true);
    await onConfirm();
    setPaying(false);
  }

  const actionBtnStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: "8px 0", borderRadius: 10, fontSize: 12, fontWeight: 700,
    border: `2px solid ${active ? T.gold : "#e5e7eb"}`,
    background: active ? T.goldSub : "#fff",
    color: active ? T.gold : T.muted,
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
  });

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16, direction: "rtl",
    }}>
      {pinPrompt && (
        <ManagerPinModal
          restaurantId={restaurantId}
          title={pinPrompt.title}
          description={pinPrompt.description}
          onApproved={(token) => { const run = pinPrompt.run; setPinPrompt(null); void run(token); }}
          onCancel={() => setPinPrompt(null)}
        />
      )}
      <div style={{
        background: "#fff", borderRadius: 20, width: "100%", maxWidth: 780,
        maxHeight: "92vh", display: "flex", flexDirection: "column",
        boxShadow: "0 24px 80px rgba(0,0,0,0.35)", overflow: "hidden",
      }}>
        {/* Modal header */}
        <div style={{
          padding: "14px 20px",
          background: T.gold,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexShrink: 0,
        }}>
          <div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 18 }}>
              💳 חשבון — {tableNumber === "–" ? "ללא שולחן" : `שולחן ${tableNumber}`}
            </div>
            <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 2 }}>
              {validOrders.length} הזמנות · {allItems.length} מנות
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.2)", border: "none",
              borderRadius: "50%", width: 34, height: 34,
              color: "#fff", fontSize: 18, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >✕</button>
        </div>

        {/* Body: receipt + controls */}
        <div style={{
          flex: 1, overflowY: "auto",
          display: "flex", flexWrap: "wrap", gap: 0,
        }}>
          {/* LEFT — Receipt preview */}
          <div style={{
            flex: "1 1 280px", minWidth: 260,
            padding: "20px 20px",
            borderLeft: "1px solid #f1f5f9",
            background: PAPER,
          }}>
            <div style={{
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              padding: "16px 18px",
              fontFamily: "'Courier New', monospace",
              fontSize: 13,
              lineHeight: 1.6,
              color: INK,
            }}>
              <div style={{ textAlign: "center", fontWeight: 900, fontSize: 16, marginBottom: 2, color: INK }}>
                {restaurantName}
              </div>
              <div style={{ textAlign: "center", color: INK_SUB, marginBottom: 8 }}>חשבון</div>
              <div style={{ borderTop: "1px dashed #9ca3af", margin: "6px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: INK }}>
                <span>שולחן: {tableNumber}</span>
                <span style={{ direction: "ltr" }}>{dateStr}</span>
              </div>
              <div style={{ borderTop: "1px dashed #9ca3af", margin: "6px 0" }} />

              {allItemsIncludingVoided.map((item, idx) => (
                <div key={idx} style={{ opacity: (item.voidedAt || item.isComped) ? 0.5 : 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 4, color: (item.voidedAt || item.isComped) ? INK_SUB : INK, textDecoration: (item.voidedAt || item.isComped) ? "line-through" : "none" }}>
                    <span style={{ flex: 1 }}>{item.quantity}× {item.item.name}{item.voidedAt ? " ❌ מבוטל" : item.isComped ? " 🎁 חינם" : ""}</span>
                    <span style={{ flexShrink: 0, direction: "ltr" }}>₪{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                  {item.modifiers && item.modifiers.map((m, mi) => (
                    <div key={mi} style={{ paddingRight: 12, fontSize: 11, color: INK_SUB }}>
                      {m.label}{m.priceAdd > 0 ? ` +₪${m.priceAdd}` : ""}
                    </div>
                  ))}
                  {item.notes && (
                    <div style={{ paddingRight: 12, fontSize: 11, color: INK_SUB, fontStyle: "italic" }}>
                      💬 {item.notes}
                    </div>
                  )}
                </div>
              ))}

              <div style={{ borderTop: "1px dashed #9ca3af", margin: "8px 0" }} />

              {loyaltyDiscount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: INK_SUB }}>
                  <span>סה&quot;כ לפני הנחה</span>
                  <span style={{ direction: "ltr" }}>₪{(subtotal + loyaltyDiscount).toFixed(2)}</span>
                </div>
              )}
              {loyaltyDiscount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: T.green, fontWeight: 700 }}>
                  <span>⭐ הנחת מועדון{loyaltyMemberNames.length > 0 ? ` (${loyaltyMemberNames.join(", ")})` : ""}</span>
                  <span style={{ direction: "ltr" }}>−₪{loyaltyDiscount.toFixed(2)}</span>
                </div>
              )}
              {(hasManagerAdjustment || voidedItems.length > 0) && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: INK_SUB }}>
                  <span>💬 {voidedItems.length > 0 && hasManagerAdjustment ? "בטוח מנות + הנחה" : voidedItems.length > 0 ? `${voidedItems.length} פריט מבוטל` : "הנחה/שינוי"}</span>
                  <span style={{ direction: "ltr" }}>−₪{(allItems.reduce((s, i) => s + (i.price * i.quantity), 0) - subtotal - loyaltyDiscount).toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: INK }}>
                <span>{loyaltyDiscount > 0 || hasManagerAdjustment ? "לאחר הנחות" : "סה\"כ"}</span>
                <span style={{ direction: "ltr" }}>₪{subtotal.toFixed(2)}</span>
              </div>
              {tipAmount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: INK }}>
                  <span>טיפ {tipPct === -1 ? "" : `${tipPct}%`}</span>
                  <span style={{ direction: "ltr" }}>₪{tipAmount.toFixed(2)}</span>
                </div>
              )}

              <div style={{ borderTop: "2px solid #111827", margin: "8px 0" }} />

              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: 17, color: INK }}>
                <span>סה&quot;כ לתשלום</span>
                <span style={{ color: T.gold, direction: "ltr" }}>₪{total.toFixed(2)}</span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.muted, marginTop: 4 }}>
                <span>מתוכם מע&quot;מ 18%</span>
                <span style={{ direction: "ltr" }}>₪{vatAmount.toFixed(2)}</span>
              </div>

              {hasPartialPayments && (
                <>
                  <div style={{ borderTop: "1px dashed #9ca3af", margin: "8px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: INK_SUB, fontWeight: 700 }}>
                    <span>שולם עד כה</span>
                    <span style={{ direction: "ltr" }}>₪{splitPaid.toFixed(2)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.gold, fontWeight: 700 }}>
                    <span>נשאר לתשלום</span>
                    <span style={{ direction: "ltr" }}>₪{splitBalance.toFixed(2)}</span>
                  </div>
                </>
              )}

              <div style={{ borderTop: "1px dashed #9ca3af", margin: "8px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.muted }}>
                <span>אמצעי תשלום</span>
                <span>{PAY_METHOD_LABEL[payMethod]}</span>
              </div>
              <div style={{ textAlign: "center", marginTop: 12, fontSize: 13, color: T.muted }}>
                תודה על ביקורכם! 🙏
              </div>
            </div>
          </div>

          {/* RIGHT — Controls */}
          <div style={{ flex: "1 1 260px", minWidth: 240, padding: "20px 20px" }}>
            {/* Tip selector */}
            <div style={{ marginBottom: 20, opacity: hasPartialPayments ? 0.5 : 1, pointerEvents: hasPartialPayments ? "none" : "auto" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>
                טיפ {hasPartialPayments && <span style={{ fontWeight: 400, color: T.muted }}>· ננעל (פיצול פעיל)</span>}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {TIP_OPTS.map(opt => (
                  <button
                    key={opt.pct}
                    type="button"
                    onClick={() => { setTipPct(opt.pct); if (opt.pct !== -1) setCustomTip(""); }}
                    style={{
                      padding: "7px 16px", borderRadius: 22, fontSize: 13, fontWeight: 600,
                      border: `2px solid ${tipPct === opt.pct ? T.gold : T.sub}`,
                      background: tipPct === opt.pct ? T.goldSub : "#fff",
                      color: tipPct === opt.pct ? T.gold : T.muted,
                      cursor: "pointer",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {tipPct === -1 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
                  <span style={{ fontSize: 13, color: T.muted }}>₪</span>
                  <input
                    type="number" min="0" step="1"
                    value={customTip} onChange={e => setCustomTip(e.target.value)}
                    placeholder="סכום טיפ"
                    style={{ border: "2px solid #c9a84c", borderRadius: 10, padding: "6px 12px", fontSize: 14, width: 110, outline: "none" }}
                  />
                </div>
              )}
            </div>

            {/* Summary box */}
            <div style={{ background: T.raised, borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
              {loyaltyDiscount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: T.muted, marginBottom: 6 }}>
                  <span>סכום לפני הנחה</span>
                  <span style={{ fontWeight: 700, color: T.text, direction: "ltr" }}>₪{(subtotal + loyaltyDiscount).toFixed(2)}</span>
                </div>
              )}
              {loyaltyDiscount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6, alignItems: "center" }}>
                  <span style={{ color: T.green, fontWeight: 600 }}>
                    ⭐ הנחת מועדון{loyaltyMemberNames.length > 0 ? ` (${loyaltyMemberNames.join(", ")})` : ""}
                  </span>
                  <span style={{ fontWeight: 700, color: T.green, direction: "ltr" }}>−₪{loyaltyDiscount.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: T.muted, marginBottom: 6 }}>
                <span>{loyaltyDiscount > 0 ? "לאחר הנחה" : "סכום"}</span>
                <span style={{ fontWeight: 700, color: T.text, direction: "ltr" }}>₪{subtotal.toFixed(2)}</span>
              </div>
              {tipAmount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: T.muted, marginBottom: 6 }}>
                  <span>טיפ</span>
                  <span style={{ fontWeight: 700, color: T.text, direction: "ltr" }}>₪{tipAmount.toFixed(2)}</span>
                </div>
              )}
              <div style={{
                display: "flex", justifyContent: "space-between",
                fontSize: 20, fontWeight: 900, color: T.text,
                borderTop: `1px solid ${T.border}`, paddingTop: 10, marginTop: 4,
              }}>
                <span>סה&quot;כ</span>
                <span style={{ color: T.gold, direction: "ltr" }}>₪{total.toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.muted, marginTop: 4 }}>
                <span>מתוכם מע&quot;מ 18%</span>
                <span style={{ direction: "ltr" }}>₪{vatAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment method — permanent, hidden only while the split panel is open */}
            {activePanel !== "split" && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>אמצעי תשלום</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {PAY_METHODS.map(m => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setPayMethod(m.value)}
                      style={{
                        flex: 1, padding: "9px 0", borderRadius: 12, fontSize: 13, fontWeight: 600,
                        border: `2px solid ${payMethod === m.value ? T.gold : T.sub}`,
                        background: payMethod === m.value ? T.goldSub : "#fff",
                        color: payMethod === m.value ? T.gold : T.muted,
                        cursor: "pointer",
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Action toolbar: discount / price / split ── */}
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              <button type="button" style={actionBtnStyle(activePanel === "discount")}
                onClick={() => { setActionError(null); setActivePanel(activePanel === "discount" ? null : "discount"); }}>
                🏷 הנחה
              </button>
              <button type="button" style={actionBtnStyle(activePanel === "price")}
                onClick={() => { setActionError(null); setActivePanel(activePanel === "price" ? null : "price"); }}>
                ✏️ שינויי מחיר
              </button>
              <button type="button" style={actionBtnStyle(activePanel === "split")}
                onClick={() => { if (activePanel === "split") setActivePanel(null); else openSplit(); }}>
                🧾 פיצול
              </button>
            </div>

            {/* Discount panel */}
            {activePanel === "discount" && (
              <div style={{ background: T.raised, borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
                <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 8, padding: 3, gap: 2, marginBottom: 8 }}>
                  {([{ v: "PERCENT" as const, label: "% אחוז" }, { v: "AMOUNT" as const, label: "₪ סכום" }]).map(o => (
                    <button key={o.v} type="button" onClick={() => setDiscMode(o.v)}
                      style={{ flex: 1, padding: "5px 0", borderRadius: 6, border: "none", background: discMode === o.v ? T.gold : "transparent", color: discMode === o.v ? "#fff" : T.muted, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                      {o.label}
                    </button>
                  ))}
                </div>
                <input type="number" min="0" value={discValue} onChange={e => setDiscValue(e.target.value)}
                  placeholder={discMode === "PERCENT" ? "אחוז הנחה" : "סכום הנחה ₪"}
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13, outline: "none", marginBottom: 8 }} />
                <input type="text" value={discReason} onChange={e => setDiscReason(e.target.value)} placeholder="סיבה (לא חובה)"
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13, outline: "none", marginBottom: 8 }} />
                {actionError && <div style={{ color: T.red, fontSize: 11, marginBottom: 6 }}>{actionError}</div>}
                <button type="button" onClick={submitDiscount} disabled={actionBusy}
                  style={{ width: "100%", padding: "8px 0", borderRadius: 8, border: "none", background: T.gold, color: "#fff", fontWeight: 700, fontSize: 13, cursor: actionBusy ? "wait" : "pointer" }}>
                  🔐 אשר הנחה (PIN מנהל)
                </button>
              </div>
            )}

            {/* Price override panel */}
            {activePanel === "price" && (
              <div style={{ background: T.raised, borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
                <div style={{ maxHeight: 140, overflowY: "auto", marginBottom: 8 }}>
                  {allItems.map((item: OrderItem) => (
                    <div key={item.id} onClick={() => { setPriceItemId(item.id); setNewPrice(String(item.price)); }}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", borderRadius: 7, marginBottom: 4, cursor: "pointer",
                        border: `2px solid ${priceItemId === item.id ? T.gold : "#e5e7eb"}`, background: priceItemId === item.id ? T.goldSub : "#fff" }}>
                      <span style={{ fontSize: 12, color: T.text }}>{item.quantity}× {item.item.name}</span>
                      <span style={{ fontSize: 12, color: T.muted, direction: "ltr" }}>₪{item.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: T.muted }}>מחיר חדש ₪</span>
                  <input type="number" min="0" step="0.5" value={newPrice} onChange={e => setNewPrice(e.target.value)} disabled={!priceItemId}
                    style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13, outline: "none" }} />
                </div>
                <input type="text" value={priceReason} onChange={e => setPriceReason(e.target.value)} placeholder="סיבה (לא חובה)"
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13, outline: "none", marginBottom: 8 }} />
                {actionError && <div style={{ color: T.red, fontSize: 11, marginBottom: 6 }}>{actionError}</div>}
                <button type="button" onClick={submitPriceOverride} disabled={actionBusy || !priceItemId}
                  style={{ width: "100%", padding: "8px 0", borderRadius: 8, border: "none", background: T.gold, color: "#fff", fontWeight: 700, fontSize: 13, cursor: (actionBusy || !priceItemId) ? "not-allowed" : "pointer", opacity: !priceItemId ? 0.55 : 1 }}>
                  🔐 אשר שינוי מחיר (PIN מנהל)
                </button>
              </div>
            )}

            {/* Split payment panel */}
            {activePanel === "split" && (
              <div style={{ background: T.raised, borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: T.muted }}>סה&quot;כ לתשלום</span>
                  <span style={{ fontWeight: 700, color: T.text, direction: "ltr" }}>₪{total.toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: T.muted }}>שולם</span>
                  <span style={{ fontWeight: 700, color: T.text, direction: "ltr" }}>₪{splitPaid.toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 900, marginBottom: 10, borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
                  <span style={{ color: T.text }}>נשאר</span>
                  <span style={{ color: T.gold, direction: "ltr" }}>₪{splitBalance.toFixed(2)}</span>
                </div>

                {splitPayments.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    {splitPayments.map((p, i) => (
                      <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.sub, padding: "3px 0" }}>
                        <span>#{i + 1} · {PAY_METHOD_LABEL[p.method] ?? p.method}{p.createdByName ? ` · ${p.createdByName}` : ""}</span>
                        <span style={{ direction: "ltr", fontWeight: 700 }}>₪{p.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  {PAY_METHODS.map(m => (
                    <button key={m.value} type="button" onClick={() => setSplitMethod(m.value)}
                      style={{ flex: 1, padding: "6px 0", borderRadius: 8, fontSize: 12, fontWeight: 600,
                        border: `2px solid ${splitMethod === m.value ? T.gold : "#e5e7eb"}`,
                        background: splitMethod === m.value ? T.goldSub : "#fff",
                        color: splitMethod === m.value ? T.gold : T.muted, cursor: "pointer" }}>
                      {m.label}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  <input type="number" min="0" step="1" value={splitAmount} onChange={e => setSplitAmount(e.target.value)}
                    placeholder="סכום לתשלום ₪"
                    style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14, outline: "none" }} />
                  <button type="button" onClick={() => setSplitAmount(String(splitBalance))}
                    style={{ padding: "0 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", color: T.muted, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                    כל היתרה
                  </button>
                </div>
                {splitErr && <div style={{ color: T.red, fontSize: 11, marginBottom: 6 }}>{splitErr}</div>}
                <button type="button" onClick={submitPartial} disabled={splitBusy || splitBalance <= 0}
                  style={{ width: "100%", padding: "9px 0", borderRadius: 8, border: "none", background: T.gold, color: "#fff", fontWeight: 800, fontSize: 14, cursor: splitBusy ? "wait" : "pointer", opacity: splitBalance <= 0 ? 0.55 : 1 }}>
                  {splitBusy ? "מעבד..." : "✓ קבל תשלום"}
                </button>
              </div>
            )}

            {/* Loyalty club panel */}
            {loyaltyDiscount === 0 && clubStep !== "idle" && clubStep !== "done" && (
              <div style={{ marginBottom: 16, background: T.raised, borderRadius: 14, padding: "14px 16px", border: `1px solid ${T.border}` }}>
                {(clubStep === "phone" || clubStep === "searching") && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>⭐ הנחת מועדון לקוחות</div>
                    <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                      <input
                        type="tel" value={clubPhone}
                        onChange={e => setClubPhone(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && searchMember()}
                        placeholder="מספר טלפון"
                        autoFocus
                        style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, fontSize: 13, color: T.text, outline: "none" }}
                      />
                      <button type="button" onClick={searchMember} disabled={clubStep === "searching"}
                        style={{ padding: "7px 12px", borderRadius: 7, border: "none", background: T.gold, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                        {clubStep === "searching" ? "..." : "חפש"}
                      </button>
                    </div>
                    <button type="button" onClick={() => { setClubStep("idle"); setClubPhone(""); }}
                      style={{ fontSize: 11, color: T.muted, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      ביטול
                    </button>
                  </>
                )}

                {clubStep === "not_found" && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: T.red, fontSize: 12 }}>לא נמצא חבר מועדון</span>
                    <button type="button" onClick={() => { setClubPhone(""); setClubStep("phone"); }}
                      style={{ fontSize: 11, color: T.gold, background: "none", border: "none", cursor: "pointer" }}>נסה שוב</button>
                  </div>
                )}

                {(clubStep === "found" || clubStep === "redeeming") && clubMember && (() => {
                  const activeCoupons = (clubMember.coupons ?? []).filter(c => !c.expiresAt || new Date(c.expiresAt) > new Date());
                  const hasCoupons = activeCoupons.length > 0;
                  const hasPoints = clubMember.points >= clubSettings.minRedeemPoints;
                  const selectedCoupon = activeCoupons.find(c => c.id === selectedCouponId) ?? null;
                  const couponDiscount = selectedCoupon
                    ? selectedCoupon.type === "DISCOUNT_PERCENT"
                      ? subtotal * selectedCoupon.value / 100
                      : selectedCoupon.value
                    : 0;
                  const canRedeem = redeemMode === "coupon" ? !!selectedCouponId : hasPoints && clubPoints >= clubSettings.minRedeemPoints;
                  return (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                        <div>
                          <span style={{ fontWeight: 900, fontSize: 15, color: T.text }}>{clubMember.name}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: T.gold, marginRight: 8 }}>{clubMember.points} ⭐</span>
                          {hasCoupons && <span style={{ fontSize: 12, color: T.green, marginRight: 4 }}>· {activeCoupons.length} קופונים</span>}
                        </div>
                        <button type="button" onClick={() => setClubStep("idle")}
                          style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", fontSize: 16, lineHeight: 1 }}>✕</button>
                      </div>

                      {hasCoupons && hasPoints && (
                        <div style={{ display: "flex", background: T.overlay, borderRadius: 8, padding: 3, gap: 2, marginBottom: 10 }}>
                          {([
                            { v: "coupon" as RedeemMode, label: "🎟 קופון" },
                            { v: "points" as RedeemMode, label: "⭐ נקודות" },
                          ]).map(opt => (
                            <button key={opt.v} type="button" onClick={() => setRedeemMode(opt.v)}
                              style={{ flex: 1, padding: "5px 0", borderRadius: 6, border: "none",
                                background: redeemMode === opt.v ? T.gold : "transparent",
                                color: redeemMode === opt.v ? "#fff" : T.sub, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {redeemMode === "coupon" && (
                        hasCoupons ? (
                          <div style={{ marginBottom: 8 }}>
                            {activeCoupons.map(c => {
                              const val = c.type === "DISCOUNT_PERCENT"
                                ? `${c.value}% הנחה (≈ ₪${(subtotal * c.value / 100).toFixed(0)})`
                                : `₪${c.value} הנחה`;
                              return (
                                <div key={c.id} onClick={() => setSelectedCouponId(c.id)}
                                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 7, marginBottom: 5,
                                    border: `2px solid ${selectedCouponId === c.id ? T.gold : T.border}`,
                                    background: selectedCouponId === c.id ? T.goldSub : T.surface, cursor: "pointer" }}>
                                  <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: T.gold, flexShrink: 0 }}>{c.code}</span>
                                  <span style={{ fontSize: 12, color: T.text, flex: 1 }}>{val}{c.description ? ` · ${c.description}` : ""}</span>
                                  {selectedCouponId === c.id && <span style={{ fontSize: 14, color: T.gold }}>✓</span>}
                                </div>
                              );
                            })}
                            {selectedCoupon && (
                              <div style={{ fontSize: 12, color: T.green, fontWeight: 700, textAlign: "center", marginTop: 2 }}>
                                הנחה: ₪{couponDiscount.toFixed(2)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>אין קופונים פעילים</div>
                        )
                      )}

                      {redeemMode === "points" && (
                        hasPoints ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <input
                              type="number"
                              min={clubSettings.minRedeemPoints}
                              max={clubMember.points}
                              value={clubPoints}
                              onChange={e => {
                                const v = Math.min(Math.max(Number(e.target.value) || 0, 0), clubMember!.points);
                                setClubPoints(v);
                              }}
                              style={{ width: 90, padding: "6px 10px", borderRadius: 7, border: `1px solid ${T.border}`, background: T.surface, fontSize: 13, color: T.text, outline: "none" }}
                            />
                            <span style={{ fontSize: 12, color: T.sub }}>נקודות</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: T.green, marginRight: "auto" }}>
                              = ₪{(clubPoints * clubSettings.shekelPerPoint).toFixed(2)} הנחה
                            </span>
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>אין מספיק נקודות (מינימום {clubSettings.minRedeemPoints})</div>
                        )
                      )}

                      {clubError && <div style={{ color: T.red, fontSize: 11, marginBottom: 6 }}>{clubError}</div>}

                      <button type="button" onClick={redeem}
                        disabled={clubStep === "redeeming" || !canRedeem}
                        style={{ width: "100%", padding: "8px 0", borderRadius: 7, border: "none", background: T.gold, color: "#fff", fontWeight: 700, fontSize: 13,
                          cursor: (clubStep === "redeeming" || !canRedeem) ? "not-allowed" : "pointer",
                          opacity: (clubStep === "redeeming" || !canRedeem) ? 0.55 : 1 }}>
                        {clubStep === "redeeming" ? "מממש..." : redeemMode === "coupon" ? "✓ ממש קופון" : "✓ ממש נקודות"}
                      </button>
                    </>
                  );
                })()}
              </div>
            )}

            {clubStep === "done" && (
              <div style={{ marginBottom: 12, background: T.raised, borderRadius: 8, padding: "8px 12px", border: "1px solid #86efac", display: "flex", alignItems: "center", gap: 6 }}>
                <span>✅</span>
                <span style={{ fontWeight: 600, color: T.green, fontSize: 12 }}>הנחת מועדון הוחלה</span>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                type="button"
                onClick={printReceipt}
                style={{
                  width: "100%", padding: "10px 0", borderRadius: 12,
                  border: "2px solid #e5e7eb", background: "#fff",
                  color: T.text, fontWeight: 700, fontSize: 14, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                🖨 הדפס חשבון
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                {loyaltyDiscount === 0 && (clubStep === "idle" || clubStep === "done") && (
                  <button
                    type="button"
                    onClick={() => { setClubStep("phone"); setClubPhone(""); setClubError(null); }}
                    style={{
                      width: 46, height: 46, flexShrink: 0, borderRadius: 12,
                      border: "2px solid #fde68a", background: T.raised,
                      color: T.gold, fontSize: 18, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                    title="הנחת מועדון לקוחות"
                  >
                    ⭐
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={paying || hasPartialPayments}
                  title={hasPartialPayments ? "השלם את היתרה דרך פיצול התשלום" : undefined}
                  style={{
                    flex: 1, padding: "13px 0", borderRadius: 12, border: "none",
                    background: T.gold, color: "#fff", fontWeight: 900, fontSize: 16,
                    cursor: paying ? "wait" : hasPartialPayments ? "not-allowed" : "pointer",
                    opacity: hasPartialPayments ? 0.55 : 1,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}
                >
                  {paying ? "מעבד..." : hasPartialPayments ? "השלם יתרה בפיצול" : "✓ אשר תשלום"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
