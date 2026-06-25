"use client";
import type { OrderDetail } from "./TableOverlay";

interface ReceiptProps {
  order: OrderDetail;
  tableNum: string;
  restaurantName: string;
  waiterName: string;
  onClose: () => void;
  autoPrint?: boolean;
}

const VAT_RATE = 0.18;

function formatTime(d: Date): string {
  return d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}
function formatDate(d: Date): string {
  return d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function buildReceiptHtml(params: {
  restaurantName: string;
  tableNum: string;
  orderNumber: number | null;
  waiterName: string;
  coversCount: number | null;
  now: Date;
  printableItems: OrderDetail["items"];
  subtotalExVat: number;
  vatAmount: number;
  subtotalInclVat: number;
  notes: string | null;
}): string {
  const { restaurantName, tableNum, orderNumber, waiterName, coversCount,
          now, printableItems, subtotalExVat, vatAmount, subtotalInclVat, notes } = params;

  const itemRows = printableItems.map(item => `
    <div class="row${item.isComped ? " comped" : ""}">
      <span class="name">${item.quantity}× ${item.itemName}${item.isComped ? " (מתנה)" : ""}</span>
      <span class="price">${item.isComped ? "₪0" : "₪" + (item.price * item.quantity).toFixed(2)}</span>
    </div>`).join("");

  const notesRow = notes ? `<div class="small" style="margin-top:4px">הערה: ${notes}</div>` : "";

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8">
<title>חשבון — שולחן ${tableNum}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 13px;
    width: 80mm;
    padding: 6mm 4mm;
    color: #000;
    direction: rtl;
  }
  .center { text-align: center; }
  .bold   { font-weight: bold; }
  .big    { font-size: 16px; font-weight: bold; }
  .small  { font-size: 11px; }
  .dash   { border: none; border-top: 1px dashed #000; margin: 5px 0; }
  .row    { display: flex; justify-content: space-between; margin: 2px 0; }
  .name   { flex: 1; padding-left: 6px; }
  .price  { flex-shrink: 0; }
  .comped { opacity: 0.5; text-decoration: line-through; }
  .feed   { height: 12mm; }
</style>
</head>
<body>
  <div class="center bold" style="font-size:17px; margin-bottom:2px">${restaurantName}</div>
  <div class="center small">חשבון</div>
  <hr class="dash">

  <div class="row small">
    <span>תאריך: ${formatDate(now)}</span>
    <span>שעה: ${formatTime(now)}</span>
  </div>
  <div class="row small">
    <span>שולחן: ${tableNum}</span>
    ${orderNumber ? `<span>הזמנה: #${orderNumber}</span>` : ""}
  </div>
  <div class="row small" style="margin-bottom:4px">
    <span>מלצר: ${waiterName}</span>
    ${coversCount ? `<span>סועדים: ${coversCount}</span>` : ""}
  </div>
  <hr class="dash">

  ${itemRows}

  <hr class="dash">
  <div class="row"><span>לפני מע"מ:</span><span>₪${subtotalExVat.toFixed(2)}</span></div>
  <div class="row"><span>מע"מ (18%):</span><span>₪${vatAmount.toFixed(2)}</span></div>
  <hr class="dash">
  <div class="row big"><span>לתשלום:</span><span>₪${subtotalInclVat.toFixed(2)}</span></div>
  <hr class="dash">

  ${notesRow}

  <div class="center small" style="margin-top:8px">תודה על ביקורכם!</div>
  <div class="center small">נשמח לראותכם שוב</div>
  <div class="feed"></div>
</body>
</html>`;
}

function printInNewWindow(html: string) {
  const win = window.open("", "_blank", "width=400,height=650,menubar=no,toolbar=no,location=no");
  if (!win) { alert("אנא אפשר חלונות קופצים בדפדפן"); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  // Wait for fonts/layout then print
  win.onload = () => { win.print(); };
  // Fallback if onload doesn't fire (doc.write finishes synchronously)
  setTimeout(() => { try { win.print(); } catch { /* already printed */ } }, 400);
}

export default function Receipt({ order, tableNum, restaurantName, waiterName, onClose }: ReceiptProps) {
  const now = new Date();

  const printableItems = order.items.filter(i => !i.voidedAt && i.itemStatus !== "CANCELLED");

  const subtotalInclVat = printableItems
    .filter(i => !i.isComped)
    .reduce((s, i) => s + i.price * i.quantity, 0);

  const vatAmount     = subtotalInclVat - subtotalInclVat / (1 + VAT_RATE);
  const subtotalExVat = subtotalInclVat - vatAmount;

  function handlePrint() {
    const html = buildReceiptHtml({
      restaurantName, tableNum,
      orderNumber: order.orderNumber,
      waiterName, coversCount: order.coversCount,
      now, printableItems,
      subtotalExVat, vatAmount, subtotalInclVat,
      notes: order.notes,
    });
    printInNewWindow(html);
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
        zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 16, padding: 24, width: 320,
          maxHeight: "90vh", overflowY: "auto", direction: "rtl",
          fontFamily: "'Courier New', monospace", fontSize: 13, color: "#000",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", fontWeight: 900, fontSize: 18, marginBottom: 2 }}>{restaurantName}</div>
        <div style={{ textAlign: "center", fontSize: 11, marginBottom: 8 }}>חשבון</div>
        <hr style={{ border: "none", borderTop: "1px dashed #999", margin: "6px 0" }} />

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
          <span>תאריך: {formatDate(now)}</span>
          <span>שעה: {formatTime(now)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
          <span>שולחן: {tableNum}</span>
          {order.orderNumber && <span>הזמנה: #{order.orderNumber}</span>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 8 }}>
          <span>מלצר: {waiterName}</span>
          {order.coversCount ? <span>סועדים: {order.coversCount}</span> : null}
        </div>
        <hr style={{ border: "none", borderTop: "1px dashed #999", margin: "6px 0" }} />

        {/* Items */}
        <div style={{ marginBottom: 8 }}>
          {printableItems.map((item, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", fontSize: 12, margin: "3px 0",
              opacity: item.isComped ? 0.45 : 1,
              textDecoration: item.isComped ? "line-through" : "none",
            }}>
              <span style={{ flex: 1, paddingLeft: 8 }}>
                {item.quantity}× {item.itemName}
                {item.isComped && <span style={{ fontSize: 10, color: "#888" }}> (מתנה)</span>}
              </span>
              <span style={{ flexShrink: 0, fontWeight: 700 }}>
                {item.isComped ? "₪0" : `₪${(item.price * item.quantity).toFixed(2)}`}
              </span>
            </div>
          ))}
        </div>

        <hr style={{ border: "none", borderTop: "1px dashed #999", margin: "6px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <span>לפני מע&quot;מ:</span><span>₪{subtotalExVat.toFixed(2)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <span>מע&quot;מ (18%):</span><span>₪{vatAmount.toFixed(2)}</span>
        </div>
        <hr style={{ border: "none", borderTop: "1px dashed #999", margin: "6px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 900 }}>
          <span>לתשלום:</span><span>₪{subtotalInclVat.toFixed(2)}</span>
        </div>
        <hr style={{ border: "none", borderTop: "1px dashed #999", margin: "6px 0" }} />

        {order.notes && (
          <div style={{ fontSize: 11, color: "#555", marginBottom: 8 }}>הערה: {order.notes}</div>
        )}

        <div style={{ textAlign: "center", fontSize: 11, color: "#777", marginTop: 8 }}>
          תודה על ביקורכם!<br />נשמח לראותכם שוב
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button
            onClick={handlePrint}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 10, border: "none",
              background: "#1a1612", color: "#fff", fontSize: 13, fontWeight: 800,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            🖨️ הדפס
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 10,
              border: "1.5px solid #ddd", background: "#f5f5f5",
              color: "#444", fontSize: 13, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}
