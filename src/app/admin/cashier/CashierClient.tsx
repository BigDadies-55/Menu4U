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
            background: "#c9a84c", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: 15, flexShrink: 0,
          }}>
            {tableNumber === "–" ? "?" : tableNumber}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>
              {tableNumber === "–" ? "ללא שולחן" : `שולחן ${tableNumber}`}
            </div>
            <div style={{ fontSize: 12, color: "#92400e", display: "flex", gap: 6, marginTop: 1 }}>
              <span>⏱ {timeSince(oldest.createdAt)}</span>
              <span>·</span>
              <span>{allItems.length} מנות</span>
            </div>
          </div>
          <div style={{ fontWeight: 900, fontSize: 22, color: "#111827", flexShrink: 0 }}>
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
            <span style={{ fontSize: 13, color: "#374151", flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 700, color: "#6b7280" }}>{item.quantity}×</span>
              {" "}{item.item.name}
            </span>
            <span style={{ fontSize: 13, color: "#6b7280", flexShrink: 0 }}>
              ₪{(item.price * item.quantity).toFixed(0)}
            </span>
          </div>
        ))}
        {extraCount > 0 && (
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
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
            background: "#c9a84c", color: "#fff",
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
  onConfirm,
  onClose,
}: {
  tableNumber: string;
  orders: Order[];
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [tipPct, setTipPct] = useState<number>(0);
  const [customTip, setCustomTip] = useState("");
  const [payMethod, setPayMethod] = useState<"cash" | "card" | "app">("card");
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const validOrders = orders.filter(o => !["CANCELLED", "PAID"].includes(o.status));
  const allItems = validOrders.flatMap(o => o.items);
  const subtotal = validOrders.reduce((s, o) => s + o.totalAmount, 0);
  const tipAmount = tipPct === -1
    ? (parseFloat(customTip) || 0)
    : Math.round(subtotal * tipPct) / 100;
  const total = subtotal + tipAmount;

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
        <div class="row"><span>סה"כ</span><span>₪${subtotal.toFixed(2)}</span></div>
        ${tipRow}
        <div class="double"></div>
        <div class="row total-row"><span>סה"כ לתשלום</span><span>₪${total.toFixed(2)}</span></div>
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
    onConfirm();
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 60,
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
          background: "#c9a84c",
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
            background: "#fafafa",
          }}>
            <div style={{
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              padding: "16px 18px",
              fontFamily: "'Courier New', monospace",
              fontSize: 13,
              lineHeight: 1.6,
            }}>
              {/* Restaurant name */}
              <div style={{ textAlign: "center", fontWeight: 900, fontSize: 16, marginBottom: 2 }}>
                {restaurantName}
              </div>
              <div style={{ textAlign: "center", color: "#6b7280", marginBottom: 8 }}>חשבון</div>
              <div style={{ borderTop: "1px dashed #d1d5db", margin: "6px 0" }} />
              {/* Table + date */}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#374151" }}>
                <span>שולחן: {tableNumber}</span>
                <span style={{ direction: "ltr" }}>{dateStr}</span>
              </div>
              <div style={{ borderTop: "1px dashed #d1d5db", margin: "6px 0" }} />

              {/* Items */}
              {allItems.map((item, idx) => (
                <div key={idx}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
                    <span style={{ flex: 1 }}>{item.quantity}× {item.item.name}</span>
                    <span style={{ flexShrink: 0, direction: "ltr" }}>₪{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                  {item.modifiers && item.modifiers.map((m, mi) => (
                    <div key={mi} style={{ paddingRight: 12, fontSize: 11, color: "#6b7280" }}>
                      {m.label}{m.priceAdd > 0 ? ` +₪${m.priceAdd}` : ""}
                    </div>
                  ))}
                  {item.notes && (
                    <div style={{ paddingRight: 12, fontSize: 11, color: "#9ca3af", fontStyle: "italic" }}>
                      💬 {item.notes}
                    </div>
                  )}
                </div>
              ))}

              <div style={{ borderTop: "1px dashed #d1d5db", margin: "8px 0" }} />

              {/* Subtotal */}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span>סה&quot;כ</span>
                <span style={{ direction: "ltr" }}>₪{subtotal.toFixed(2)}</span>
              </div>
              {tipAmount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span>טיפ {tipPct === -1 ? "" : `${tipPct}%`}</span>
                  <span style={{ direction: "ltr" }}>₪{tipAmount.toFixed(2)}</span>
                </div>
              )}

              <div style={{ borderTop: "2px solid #111827", margin: "8px 0" }} />

              {/* Grand total */}
              <div style={{
                display: "flex", justifyContent: "space-between",
                fontWeight: 900, fontSize: 17, color: "#111827",
              }}>
                <span>סה&quot;כ לתשלום</span>
                <span style={{ color: "#c9a84c", direction: "ltr" }}>₪{total.toFixed(2)}</span>
              </div>

              <div style={{ borderTop: "1px dashed #d1d5db", margin: "8px 0" }} />

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7280" }}>
                <span>אמצעי תשלום</span>
                <span>{PAY_METHOD_LABEL[payMethod]}</span>
              </div>

              <div style={{ textAlign: "center", marginTop: 12, fontSize: 13, color: "#6b7280" }}>
                תודה על ביקורכם! 🙏
              </div>
            </div>
          </div>

          {/* RIGHT — Controls */}
          <div style={{ flex: "1 1 260px", minWidth: 240, padding: "20px 20px" }}>
            {/* Tip selector */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>טיפ</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {TIP_OPTS.map(opt => (
                  <button
                    key={opt.pct}
                    type="button"
                    onClick={() => { setTipPct(opt.pct); if (opt.pct !== -1) setCustomTip(""); }}
                    style={{
                      padding: "7px 16px", borderRadius: 22, fontSize: 13, fontWeight: 600,
                      border: `2px solid ${tipPct === opt.pct ? "#c9a84c" : "#e5e7eb"}`,
                      background: tipPct === opt.pct ? "#fdf8ec" : "#fff",
                      color: tipPct === opt.pct ? "#8B6914" : "#6b7280",
                      cursor: "pointer",
                    }}
                  >
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
              background: "#f9fafb", borderRadius: 14, padding: "14px 16px", marginBottom: 20,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6b7280", marginBottom: 6 }}>
                <span>סכום מקורי</span>
                <span style={{ fontWeight: 700, color: "#111827", direction: "ltr" }}>₪{subtotal.toFixed(2)}</span>
              </div>
              {tipAmount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6b7280", marginBottom: 6 }}>
                  <span>טיפ</span>
                  <span style={{ fontWeight: 700, color: "#111827", direction: "ltr" }}>₪{tipAmount.toFixed(2)}</span>
                </div>
              )}
              <div style={{
                display: "flex", justifyContent: "space-between",
                fontSize: 20, fontWeight: 900, color: "#111827",
                borderTop: "1px solid #e5e7eb", paddingTop: 10, marginTop: 4,
              }}>
                <span>סה&quot;כ</span>
                <span style={{ color: "#c9a84c", direction: "ltr" }}>₪{total.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment method */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>אמצעי תשלום</div>
              <div style={{ display: "flex", gap: 8 }}>
                {PAY_METHODS.map(m => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setPayMethod(m.value)}
                    style={{
                      flex: 1, padding: "9px 0", borderRadius: 12, fontSize: 13, fontWeight: 600,
                      border: `2px solid ${payMethod === m.value ? "#c9a84c" : "#e5e7eb"}`,
                      background: payMethod === m.value ? "#fdf8ec" : "#fff",
                      color: payMethod === m.value ? "#8B6914" : "#6b7280",
                      cursor: "pointer",
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                onClick={printReceipt}
                style={{
                  width: "100%", padding: "11px 0", borderRadius: 12,
                  border: "2px solid #e5e7eb", background: "#fff",
                  color: "#374151", fontWeight: 700, fontSize: 14, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                🖨 הדפס חשבון
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={paying}
                style={{
                  width: "100%", padding: "13px 0", borderRadius: 12,
                  border: "none",
                  background: paying ? "#d4b96a" : "#c9a84c",
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
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [restaurantId, setRestaurantId] = useState(defaultRestaurantId ?? "");
  const [refreshing, setRefreshing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
          ["DELIVERED", "READY"].includes(o.status)
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

  async function closeTable(tableNumber: string) {
    const tableOrders = orders.filter(o => (o.tableNumber ?? "–") === tableNumber);
    const rid = tableOrders[0]?.restaurant?.id || restaurantId || restaurants[0]?.id;
    setSelectedTable(null);
    setOrders(prev => prev.filter(o => (o.tableNumber ?? "–") !== tableNumber));
    try {
      await fetch("/api/admin/orders/close-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableNumber, restaurantId: rid }),
      });
    } catch { /* ignore */ }
  }

  // Group orders by table
  const tableMap = new Map<string, Order[]>();
  for (const o of orders) {
    if (["DELIVERED", "READY"].includes(o.status)) {
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

  const selectedOrders = selectedTable
    ? orders.filter(o => (o.tableNumber ?? "–") === selectedTable)
    : [];

  return (
    <div
      style={isFullscreen ? {
        position: "fixed", inset: 0, zIndex: 999,
        background: "#f8fafc", overflowY: "auto",
        padding: "12px 16px",
      } : { padding: "16px 20px" }}
      dir="rtl"
    >
      {/* Bill Modal */}
      {selectedTable && selectedOrders.length > 0 && (
        <BillModal
          tableNumber={selectedTable}
          orders={selectedOrders}
          onConfirm={() => closeTable(selectedTable)}
          onClose={() => setSelectedTable(null)}
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
          <span style={{ fontSize: 20, fontWeight: 900, color: "#111827" }}>💳 קאשייר</span>
          <span style={{ fontSize: 13, color: "#6b7280" }}>
            · {tableEntries.length} שולחנות ממתינים
          </span>
        </div>
      </div>

      {/* ── Table grid / empty state ── */}
      {tableEntries.length === 0 ? (
        <div style={{
          background: "#fff", borderRadius: 20,
          border: "1px solid #f1f5f9",
          padding: "64px 24px", textAlign: "center", color: "#9ca3af",
        }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
          <div style={{ fontWeight: 700, fontSize: 18, color: "#374151", marginBottom: 4 }}>
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
