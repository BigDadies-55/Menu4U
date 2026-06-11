"use client";

import { T } from "@/lib/ui";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";

type OrderItemModifier = { groupName: string; label: string; priceAdd: number };

type OrderItem = {
  id: string;
  quantity: number;
  price: number;
  notes: string | null;
  itemStatus: string;
  course: number;
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
  restaurant: { id: string; name: string };
  items: OrderItem[];
  loyaltyDiscountAmount: number | null;
  loyaltyMemberName: string | null;
  loyaltyDiscountType: string | null;
};

type Restaurant = { id: string; name: string };

function timeSince(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return "עכשיו";
  if (diff < 60) return `${diff} דק'`;
  return `${Math.floor(diff / 60)}ש'`;
}

function fmtDateTime(d: Date) {
  return d.toLocaleString("he-IL", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
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
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = 1100;
      gain2.gain.setValueAtTime(0.3, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc2.start();
      osc2.stop(ctx.currentTime + 0.3);
    }, 200);
  } catch { /* ignore */ }
}

/* ── Table Card ── */
function TableCard({
  tableNumber,
  orders,
  onShowBill,
}: {
  tableNumber: string;
  orders: Order[];
  onShowBill: (tableNumber: string) => void;
}) {
  const validOrders = orders.filter(o => !["CANCELLED", "PAID"].includes(o.status));
  const allItems = validOrders.flatMap(o => o.items);
  const total = validOrders.reduce((s, o) => s + o.totalAmount, 0);
  const oldest = orders.reduce((a, b) =>
    new Date(a.createdAt) < new Date(b.createdAt) ? a : b
  );

  const MAX_SHOW = 4;
  const extraCount = allItems.length - MAX_SHOW;
  const shownItems = allItems.slice(0, MAX_SHOW);

  return (
    <div style={{
      background: "#fff",
      borderRadius: 16,
      border: "2px solid #c9a84c",
      overflow: "hidden",
      boxShadow: "0 2px 12px rgba(201,168,76,0.15)",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg,#fdf8ec,#fef3c7)",
        padding: "12px 14px 8px",
        borderBottom: "1px solid #fde68a",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: T.gold, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: 15, flexShrink: 0,
          }}>
            {tableNumber === "–" ? "?" : tableNumber}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: T.text }}>
              {tableNumber === "–" ? "ללא שולחן" : `שולחן ${tableNumber}`}
            </div>
            <div style={{ fontSize: 12, color: T.gold, display: "flex", gap: 6, marginTop: 1 }}>
              <span>⏱ {timeSince(oldest.createdAt)}</span>
              <span>·</span>
              <span>{allItems.length} מנות</span>
            </div>
          </div>
          <div style={{ fontWeight: 900, fontSize: 22, color: T.text, flexShrink: 0 }}>
            ₪{total.toFixed(0)}
          </div>
        </div>
      </div>

      {/* Item list */}
      <div style={{ padding: "10px 14px", flex: 1 }}>
        {shownItems.map((item, idx) => (
          <div key={idx} style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "center", gap: 8,
            padding: "3px 0",
            borderBottom: idx < shownItems.length - 1 ? "1px solid #f9fafb" : "none",
          }}>
            <span style={{ fontSize: 13, color: T.sub, flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 700, color: T.muted }}>{item.quantity}×</span>
              {" "}{item.item.name}
            </span>
            <span style={{ fontSize: 13, color: T.muted, flexShrink: 0 }}>
              ₪{(item.price * item.quantity).toFixed(0)}
            </span>
          </div>
        ))}
        {extraCount > 0 && (
          <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>
            ...ועוד {extraCount} מנות
          </div>
        )}
      </div>

      {/* Footer button */}
      <div style={{ padding: "10px 14px", borderTop: "1px solid #fde68a" }}>
        <button
          type="button"
          onClick={() => onShowBill(tableNumber)}
          style={{
            width: "100%", padding: "10px 0",
            background: T.gold, color: "#fff",
            border: "none", borderRadius: 12,
            fontWeight: 800, fontSize: 14,
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
        >
          💳 הצג חשבון
        </button>
      </div>
    </div>
  );
}

/* ── Bill Modal ── */
function BillModal({
  tableNumber,
  orders,
  restaurantId,
  onConfirm,
  onClose,
  onOrdersRefresh,
}: {
  tableNumber: string;
  orders: Order[];
  restaurantId: string;
  onConfirm: () => void;
  onClose: () => void;
  onOrdersRefresh: () => Promise<void>;
}) {
  // Receipt is always paper — fixed, theme-independent
  const INK = "#1a1208";
  const INK_SUB = "#6b5040";
  const PAPER = "#fffdf5";

  const [tipPct, setTipPct] = useState<number>(0);
  const [customTip, setCustomTip] = useState("");
  const [payMethod, setPayMethod] = useState<"cash" | "card" | "app">("card");
  const [paying, setPaying] = useState(false);

  // Loyalty club flow
  type ClubStep = "idle" | "phone" | "searching" | "found" | "not_found" | "redeeming" | "done";
  type LoyaltyCoupon = { id: string; code: string; type: string; value: number; description: string | null; expiresAt: string | null };
  type LoyaltyMember = { id: string; name: string; points: number; coupons?: LoyaltyCoupon[] };
  type LoyaltySettings = { shekelPerPoint: number; minRedeemPoints: number };
  // "points" | "coupon" — which redemption mode the cashier has selected
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
        // Default to coupon mode if member has active coupons, else points
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

  const validOrders = orders.filter(o => !["CANCELLED", "PAID"].includes(o.status));
  const allItems = validOrders.flatMap(o => o.items);
  // totalAmount already has the discount baked in
  const subtotal = validOrders.reduce((s, o) => s + o.totalAmount, 0);
  const loyaltyDiscount = validOrders.reduce((s, o) => s + (o.loyaltyDiscountAmount ?? 0), 0);
  const loyaltyMemberNames = [...new Set(validOrders.filter(o => o.loyaltyMemberName).map(o => o.loyaltyMemberName!))];
  const tipAmount = tipPct === -1
    ? (parseFloat(customTip) || 0)
    : Math.round(subtotal * tipPct) / 100;
  const total = subtotal + tipAmount;
  const VAT_RATE = 0.18;
  const vatAmount = Math.round((total * VAT_RATE / (1 + VAT_RATE)) * 100) / 100;

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

  const PAY_METHOD_LABEL: Record<string, string> = {
    card: "כרטיס אשראי",
    cash: "מזומן",
    app: "אפליקציה",
  };

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

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16, direction: "rtl",
    }}>
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
              {/* Restaurant name */}
              <div style={{ textAlign: "center", fontWeight: 900, fontSize: 16, marginBottom: 2, color: INK }}>
                {restaurantName}
              </div>
              <div style={{ textAlign: "center", color: INK_SUB, marginBottom: 8 }}>חשבון</div>
              <div style={{ borderTop: "1px dashed #9ca3af", margin: "6px 0" }} />
              {/* Table + date */}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: INK }}>
                <span>שולחן: {tableNumber}</span>
                <span style={{ direction: "ltr" }}>{dateStr}</span>
              </div>
              <div style={{ borderTop: "1px dashed #9ca3af", margin: "6px 0" }} />

              {/* Items */}
              {allItems.map((item, idx) => (
                <div key={idx}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 4, color: INK }}>
                    <span style={{ flex: 1 }}>{item.quantity}× {item.item.name}</span>
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

              {/* Subtotal / discount lines */}
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
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: INK }}>
                <span>{loyaltyDiscount > 0 ? "לאחר הנחה" : "סה\"כ"}</span>
                <span style={{ direction: "ltr" }}>₪{subtotal.toFixed(2)}</span>
              </div>
              {tipAmount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: INK }}>
                  <span>טיפ {tipPct === -1 ? "" : `${tipPct}%`}</span>
                  <span style={{ direction: "ltr" }}>₪{tipAmount.toFixed(2)}</span>
                </div>
              )}

              <div style={{ borderTop: "2px solid #111827", margin: "8px 0" }} />

              {/* Grand total */}
              <div style={{
                display: "flex", justifyContent: "space-between",
                fontWeight: 900, fontSize: 17, color: INK,
              }}>
                <span>סה&quot;כ לתשלום</span>
                <span style={{ color: T.gold, direction: "ltr" }}>₪{total.toFixed(2)}</span>
              </div>

              {/* VAT included */}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.muted, marginTop: 4 }}>
                <span>מתוכם מע&quot;מ 18%</span>
                <span style={{ direction: "ltr" }}>₪{vatAmount.toFixed(2)}</span>
              </div>

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
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>טיפ</div>
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
                    style={{
                      border: "2px solid #c9a84c", borderRadius: 10,
                      padding: "6px 12px", fontSize: 14, width: 110, outline: "none",
                    }}
                  />
                </div>
              )}
            </div>

            {/* Summary box */}
            <div style={{
              background: T.raised, borderRadius: 14, padding: "14px 16px", marginBottom: 20,
            }}>
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

            {/* Payment method */}
            <div style={{ marginBottom: 24 }}>
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

            {/* Loyalty club panel */}
            {loyaltyDiscount === 0 && clubStep !== "idle" && clubStep !== "done" && (
              <div style={{ marginBottom: 16, background: T.raised, borderRadius: 10, padding: "12px 14px", border: "1px solid #fde68a" }}>
                {/* Phone search */}
                {(clubStep === "phone" || clubStep === "searching") && (
                  <>
                    <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                      <input
                        type="tel" value={clubPhone}
                        onChange={e => setClubPhone(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && searchMember()}
                        placeholder="מספר טלפון"
                        autoFocus
                        style={{
                          flex: 1, padding: "7px 10px", borderRadius: 7,
                          border: "1px solid #fde68a", background: "#fff",
                          fontSize: 13, color: T.text, outline: "none",
                        }}
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

                {/* Not found */}
                {clubStep === "not_found" && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: T.red, fontSize: 12 }}>לא נמצא חבר מועדון</span>
                    <button type="button" onClick={() => { setClubPhone(""); setClubStep("phone"); }}
                      style={{ fontSize: 11, color: T.gold, background: "none", border: "none", cursor: "pointer" }}>נסה שוב</button>
                  </div>
                )}

                {/* Member found */}
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
                      {/* Member header */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{clubMember.name}</span>
                          <span style={{ fontSize: 12, color: T.gold, marginRight: 8 }}>{clubMember.points} ⭐</span>
                          {hasCoupons && <span style={{ fontSize: 12, color: T.green, marginRight: 4 }}>· {activeCoupons.length} קופונים</span>}
                        </div>
                        <button type="button" onClick={() => setClubStep("idle")}
                          style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 14, lineHeight: 1 }}>✕</button>
                      </div>

                      {/* Mode toggle — only if both options available */}
                      {hasCoupons && hasPoints && (
                        <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 8, padding: 3, gap: 2, marginBottom: 10 }}>
                          {([
                            { v: "coupon" as RedeemMode, label: "🎟 קופון" },
                            { v: "points" as RedeemMode, label: "⭐ נקודות" },
                          ]).map(opt => (
                            <button key={opt.v} type="button" onClick={() => setRedeemMode(opt.v)}
                              style={{
                                flex: 1, padding: "5px 0", borderRadius: 6, border: "none",
                                background: redeemMode === opt.v ? T.gold : "transparent",
                                color: redeemMode === opt.v ? "#fff" : T.muted,
                                fontWeight: 700, fontSize: 12, cursor: "pointer",
                              }}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Coupon mode */}
                      {redeemMode === "coupon" && (
                        hasCoupons ? (
                          <div style={{ marginBottom: 8 }}>
                            {activeCoupons.map(c => {
                              const val = c.type === "DISCOUNT_PERCENT"
                                ? `${c.value}% הנחה (≈ ₪${(subtotal * c.value / 100).toFixed(0)})`
                                : `₪${c.value} הנחה`;
                              return (
                                <div
                                  key={c.id}
                                  onClick={() => setSelectedCouponId(c.id)}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 8,
                                    padding: "7px 10px", borderRadius: 7, marginBottom: 5,
                                    border: `2px solid ${selectedCouponId === c.id ? T.gold : "#e5e7eb"}`,
                                    background: selectedCouponId === c.id ? T.goldSub : "#fff",
                                    cursor: "pointer",
                                  }}>
                                  <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: T.gold, flexShrink: 0 }}>{c.code}</span>
                                  <span style={{ fontSize: 12, color: T.sub, flex: 1 }}>{val}{c.description ? ` · ${c.description}` : ""}</span>
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

                      {/* Points mode */}
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
                              style={{
                                width: 90, padding: "6px 10px", borderRadius: 7,
                                border: "1px solid #fde68a", background: "#fff",
                                fontSize: 13, color: T.text, outline: "none",
                              }}
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
                        style={{
                          width: "100%", padding: "8px 0", borderRadius: 7, border: "none",
                          background: T.gold, color: "#fff", fontWeight: 700, fontSize: 13,
                          cursor: (clubStep === "redeeming" || !canRedeem) ? "not-allowed" : "pointer",
                          opacity: (clubStep === "redeeming" || !canRedeem) ? 0.55 : 1,
                        }}>
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
                  disabled={paying}
                  style={{
                    flex: 1, padding: "13px 0", borderRadius: 12,
                    border: "none",
                    background: paying ? T.gold : T.gold,
                    color: "#fff", fontWeight: 900, fontSize: 16,
                    cursor: paying ? "wait" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}
                >
                  {paying ? "מעבד..." : "✓ אשר תשלום"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ── */
export default function CashierClient({
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
  const searchParams = useSearchParams();
  const router = useRouter();
  const waiterTable = searchParams.get("tableNumber");   // set when coming from waiter POS
  const waiterMode  = searchParams.get("waiter") === "1";
  const waiterRid   = searchParams.get("restaurantId");

  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [selectedTable, setSelectedTable] = useState<string | null>(waiterTable ?? null);
  const [restaurantId, setRestaurantId] = useState(waiterRid ?? defaultRestaurantId ?? "");
  const [refreshing, setRefreshing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const knownTableKeys = useRef<Set<string>>(
    new Set(
      initialOrders
        .map(o => o.tableNumber ?? "–")
        .filter((v, i, a) => a.indexOf(v) === i)
    )
  );

  const fetchOrders = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    const params = new URLSearchParams();
    if (restaurantId) params.set("restaurantId", restaurantId);
    // Fetch DELIVERED + READY orders via the general orders API
    // We filter on client since the API doesn't have a dedicated cashier endpoint
    try {
      const res = await fetch(`/api/admin/orders?${params}`);
      if (res.ok) {
        const allOrders: Order[] = await res.json();
        const cashierOrders = allOrders.filter(o =>
          ["DELIVERED", "READY", "BILL_REQUESTED", "PREPARING", "CONFIRMED", "PENDING"].includes(o.status)
        );

        // Detect new DELIVERED tables for sound alert
        const newTableKeys = new Set<string>(
          cashierOrders.map(o => o.tableNumber ?? "–")
        );
        const newTables = [...newTableKeys].filter(k => !knownTableKeys.current.has(k));
        if (newTables.length > 0 && soundEnabled) playBeep();
        knownTableKeys.current = newTableKeys;

        setOrders(cashierOrders);
      }
    } catch { /* ignore */ }
    if (showSpinner) setRefreshing(false);
  }, [restaurantId, soundEnabled]);

  useEffect(() => {
    fetchOrders();
    const iv = setInterval(() => fetchOrders(), 15000);
    return () => clearInterval(iv);
  }, [fetchOrders]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (e.key === "f" || e.key === "F") setIsFullscreen(prev => !prev);
      if (e.key === "Escape") setIsFullscreen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const orderTableKey = (o: Order) =>
    (o.tableNumber && o.tableNumber.trim() !== "") ? o.tableNumber : "–";

  async function closeTable(tableNumber: string) {
    const tableOrders = orders.filter(o => orderTableKey(o) === tableNumber);
    const rid = tableOrders[0]?.restaurant?.id || restaurantId || restaurants[0]?.id;
    // "–" is the UI fallback for orders without a tableNumber (null in DB)
    const apiTableNumber = tableNumber === "–" ? null : tableNumber;

    // Optimistically remove table from UI
    setSelectedTable(null);
    setOrders(prev => prev.filter(o => orderTableKey(o) !== tableNumber));
    setErrorMsg(null);

    console.log("[closeTable] sending", { tableNumber, apiTableNumber, rid, orderCount: tableOrders.length, orderIds: tableOrders.map(o => o.id) });

    try {
      const res = await fetch("/api/admin/orders/close-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableNumber: apiTableNumber, restaurantId: rid }),
      });

      const resBody = await res.json().catch(() => ({}));
      console.log("[closeTable] response", res.status, resBody);

      if (!res.ok) {
        // API failed → restore the table in state so user can retry
        const msg = resBody?.error ?? `שגיאת שרת ${res.status}`;
        setErrorMsg(`שגיאה בסגירת שולחן: ${msg}`);
        setOrders(prev => [...prev, ...tableOrders]);
        return;
      }

      // Warn if no orders were actually closed (tableNumber mismatch or already paid)
      if (resBody.closed === 0) {
        console.warn("[closeTable] API returned closed:0 — no orders found in DB for this table");
        setErrorMsg(`לא נמצאו הזמנות פתוחות לשולחן זה (tableNumber=${JSON.stringify(apiTableNumber)}, rid=${rid})`);
        setOrders(prev => [...prev, ...tableOrders]);
        return;
      }

      // Success → re-sync from DB to confirm and avoid race with polling
      await fetchOrders();
      // In waiter mode: go back to waiter POS after payment
      if (waiterMode) {
        router.push("/admin/waiter-pos");
        return;
      }
    } catch (err) {
      // Network error → restore orders and show message
      setErrorMsg("שגיאת תקשורת — נא לנסות שוב");
      setOrders(prev => [...prev, ...tableOrders]);
      console.error("[closeTable]", err);
    }
  }

  // Group orders by table
  const tableMap = new Map<string, Order[]>();
  for (const o of orders) {
    if (!["CANCELLED", "PAID"].includes(o.status)) {
      const key = (o.tableNumber && o.tableNumber.trim() !== "") ? o.tableNumber : "–";
      if (!tableMap.has(key)) tableMap.set(key, []);
      tableMap.get(key)!.push(o);
    }
  }

  // Sort tables by oldest order (most urgent first)
  const tableEntries = [...tableMap.entries()]
    .map(([table, tableOrds]) => {
      const oldest = tableOrds.reduce((a, b) =>
        new Date(a.createdAt) < new Date(b.createdAt) ? a : b
      );
      return { table, tableOrds, ageMin: Math.floor((Date.now() - new Date(oldest.createdAt).getTime()) / 60000) };
    })
    .sort((a, b) => b.ageMin - a.ageMin); // longest waiting first

  const tableKey = (o: Order) =>
    (o.tableNumber && o.tableNumber.trim() !== "") ? o.tableNumber : "–";

  const selectedOrders = selectedTable
    ? orders.filter(o => tableKey(o) === selectedTable)
    : [];

  // ── Waiter mode: show only the payment modal, no cashier UI ──
  if (waiterMode && waiterTable) {
    if (selectedOrders.length === 0) {
      // Orders not loaded yet — show spinner
      return (
        <div dir="rtl" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100dvh", fontSize: 15, color: "#888" }}>
          טוען הזמנה...
        </div>
      );
    }
    return (
      <div dir="rtl">
        {errorMsg && (
          <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 500, background: "#ef4444", color: "#fff", padding: "14px 20px", borderRadius: 14, fontWeight: 700, fontSize: 14 }}>
            ⚠️ {errorMsg}
            <button type="button" onClick={() => setErrorMsg(null)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 18, marginRight: 12 }}>✕</button>
          </div>
        )}
        <BillModal
          tableNumber={waiterTable}
          orders={selectedOrders}
          restaurantId={restaurantId}
          onConfirm={() => closeTable(waiterTable)}
          onClose={() => router.push("/admin/waiter-pos")}
          onOrdersRefresh={fetchOrders}
        />
      </div>
    );
  }

  return (
    <div
      style={isFullscreen ? {
        position: "fixed", inset: 0, zIndex: 999,
        background: T.bg, overflowY: "auto",
        padding: "12px 16px",
      } : { padding: "16px 20px" }}
      dir="rtl"
    >
      {/* Error toast */}
      {errorMsg && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 500,
          background: T.red, color: "#fff",
          padding: "14px 20px", borderRadius: 14,
          fontWeight: 700, fontSize: 14,
          boxShadow: "0 8px 32px rgba(239,68,68,0.35)",
          display: "flex", alignItems: "center", gap: 12,
          direction: "rtl",
        }}>
          <span>⚠️ {errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 18, lineHeight: 1 }}
          >✕</button>
        </div>
      )}

      {/* Bill Modal */}
      {selectedTable && selectedOrders.length > 0 && (
        <BillModal
          tableNumber={selectedTable}
          orders={selectedOrders}
          restaurantId={restaurantId || selectedOrders[0]?.restaurant?.id || ""}
          onConfirm={() => closeTable(selectedTable)}
          onClose={() => setSelectedTable(null)}
          onOrdersRefresh={fetchOrders}
        />
      )}

      {/* ── Control Bar ── */}
      <div style={{
        display: "flex", flexWrap: "wrap", alignItems: "center",
        gap: 10, marginBottom: 16, direction: "rtl",
      }}>
        {/* Restaurant selector */}
        {isSuperAdmin && restaurants.length > 0 && (
          <select
            value={restaurantId}
            onChange={e => setRestaurantId(e.target.value)}
            style={{
              fontSize: 13, border: "1px solid #e5e7eb", borderRadius: 12,
              padding: "8px 12px", background: "#fff", outline: "none",
            }}
          >
            <option value="">כל המסעדות</option>
            {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}

        {/* Sound toggle */}
        <button
          type="button"
          onClick={() => setSoundEnabled(p => !p)}
          title={soundEnabled ? "כבה צליל" : "הפעל צליל"}
          style={{
            padding: "8px 10px", borderRadius: 12,
            border: "1px solid #e5e7eb", background: "#fff",
            fontSize: 16, cursor: "pointer",
          }}
        >
          {soundEnabled ? "🔔" : "🔕"}
        </button>

        {/* Refresh */}
        <button
          type="button"
          onClick={() => fetchOrders(true)}
          disabled={refreshing}
          title="רענן"
          style={{
            padding: "8px 10px", borderRadius: 12,
            border: "1px solid #e5e7eb", background: "#fff",
            cursor: refreshing ? "wait" : "pointer",
            opacity: refreshing ? 0.5 : 1,
          }}
        >
          <svg
            width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
            style={{ display: "block", animation: refreshing ? "spin 1s linear infinite" : undefined }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        {/* Fullscreen */}
        <button
          type="button"
          onClick={() => setIsFullscreen(p => !p)}
          title={isFullscreen ? "יציאה ממסך מלא (Esc)" : "מסך מלא (F)"}
          style={{
            padding: "8px 10px", borderRadius: 12,
            border: "1px solid #e5e7eb", background: "#fff",
            cursor: "pointer",
          }}
        >
          {isFullscreen ? (
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
            </svg>
          ) : (
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
          )}
        </button>

        {/* Title + count */}
        <div style={{ marginRight: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: T.text }}>💳 קאשייר</span>
          <span style={{ fontSize: 13, color: T.muted }}>
            · {tableEntries.length} שולחנות ממתינים
          </span>
        </div>
      </div>

      {/* ── Table grid / empty state ── */}
      {tableEntries.length === 0 ? (
        <div style={{
          background: "#fff", borderRadius: 20,
          border: "1px solid #f1f5f9",
          padding: "64px 24px", textAlign: "center", color: T.muted,
        }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
          <div style={{ fontWeight: 700, fontSize: 18, color: T.sub, marginBottom: 4 }}>
            אין שולחנות ממתינים לתשלום
          </div>
          <div style={{ fontSize: 14 }}>כל השולחנות מסולקים</div>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 16,
          alignItems: "start",
        }}>
          {tableEntries.map(({ table, tableOrds }) => (
            <TableCard
              key={table}
              tableNumber={table}
              orders={tableOrds}
              onShowBill={setSelectedTable}
            />
          ))}
        </div>
      )}

      {/* Spin animation */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
