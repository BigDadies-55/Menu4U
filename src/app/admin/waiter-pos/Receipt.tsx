"use client";
import { useEffect } from "react";
import type { OrderDetail } from "./TableOverlay";

interface ReceiptProps {
  order: OrderDetail;
  tableNum: string;
  restaurantName: string;
  waiterName: string;
  onClose: () => void;
  autoPrint?: boolean;
}

const VAT_RATE = 0.18; // 18% VAT in Israel, included in prices

function formatTime(d: Date): string {
  return d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}
function formatDate(d: Date): string {
  return d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function Receipt({ order, tableNum, restaurantName, waiterName, onClose, autoPrint = true }: ReceiptProps) {
  const now = new Date();

  // Items to show: not voided, not cancelled
  const printableItems = order.items.filter(i => !i.voidedAt && i.itemStatus !== "CANCELLED");

  // Total = sum of non-voided, non-comped items
  const subtotalInclVat = printableItems
    .filter(i => !i.isComped)
    .reduce((s, i) => s + i.price * i.quantity, 0);

  const vatAmount     = subtotalInclVat - subtotalInclVat / (1 + VAT_RATE);
  const subtotalExVat = subtotalInclVat - vatAmount;

  useEffect(() => {
    if (autoPrint) {
      const t = setTimeout(() => window.print(), 300);
      return () => clearTimeout(t);
    }
  }, [autoPrint]);

  return (
    <>
      {/* Print-only receipt */}
      <div id="receipt-print" style={{ display: "none" }}>
        <style>{`
          @media print {
            body > *:not(#receipt-print) { display: none !important; }
            #receipt-print {
              display: block !important;
              width: 80mm;
              font-family: 'Courier New', monospace;
              font-size: 12px;
              color: #000;
              direction: rtl;
            }
            .receipt-line { display: flex; justify-content: space-between; margin: 1px 0; }
            .receipt-center { text-align: center; }
            .receipt-divider { border-bottom: 1px dashed #000; margin: 4px 0; }
            .receipt-bold { font-weight: bold; }
            .receipt-big { font-size: 15px; font-weight: bold; }
            .receipt-small { font-size: 10px; }
            .receipt-comped { text-decoration: line-through; opacity: 0.5; }
          }
        `}</style>

        {/* Header */}
        <div className="receipt-center receipt-bold" style={{ fontSize: 16, marginBottom: 2 }}>
          {restaurantName}
        </div>
        <div className="receipt-center receipt-small">חשבון</div>
        <div className="receipt-divider" />

        <div className="receipt-line receipt-small">
          <span>תאריך: {formatDate(now)}</span>
          <span>שעה: {formatTime(now)}</span>
        </div>
        <div className="receipt-line receipt-small">
          <span>שולחן: {tableNum}</span>
          {order.orderNumber && <span>הזמנה: #{order.orderNumber}</span>}
        </div>
        <div className="receipt-line receipt-small">
          <span>מלצר: {waiterName}</span>
          {order.coversCount ? <span>סועדים: {order.coversCount}</span> : null}
        </div>
        <div className="receipt-divider" />

        {/* Items */}
        <div style={{ marginBottom: 4 }}>
          {printableItems.map((item, i) => (
            <div key={i} className={`receipt-line${item.isComped ? " receipt-comped" : ""}`}>
              <span style={{ flex: 1, marginLeft: 4 }}>
                {item.quantity}× {item.itemName}
                {item.isComped && " (מתנה)"}
              </span>
              <span style={{ flexShrink: 0 }}>
                {item.isComped ? "₪0" : `₪${(item.price * item.quantity).toFixed(2)}`}
              </span>
            </div>
          ))}
        </div>

        <div className="receipt-divider" />

        {/* Totals */}
        <div className="receipt-line">
          <span>לפני מע&quot;מ:</span>
          <span>₪{subtotalExVat.toFixed(2)}</span>
        </div>
        <div className="receipt-line">
          <span>מע&quot;מ (18%):</span>
          <span>₪{vatAmount.toFixed(2)}</span>
        </div>
        <div className="receipt-divider" />
        <div className="receipt-line receipt-big">
          <span>לתשלום:</span>
          <span>₪{subtotalInclVat.toFixed(2)}</span>
        </div>
        <div className="receipt-divider" />

        {order.notes && (
          <div className="receipt-small" style={{ marginBottom: 4 }}>הערה: {order.notes}</div>
        )}

        <div className="receipt-center receipt-small" style={{ marginTop: 8 }}>
          תודה על ביקורכם!
        </div>
        <div className="receipt-center receipt-small">
          נשמח לראותכם שוב
        </div>
        <div style={{ marginTop: 12 }} /> {/* feed lines */}
      </div>

      {/* Screen modal preview */}
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
          <div style={{ textAlign: "center", fontWeight: 900, fontSize: 18, marginBottom: 2 }}>
            {restaurantName}
          </div>
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
                <span style={{ flex: 1, marginLeft: 8 }}>
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
            <span>לפני מע&quot;מ:</span>
            <span>₪{subtotalExVat.toFixed(2)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <span>מע&quot;מ (18%):</span>
            <span>₪{vatAmount.toFixed(2)}</span>
          </div>
          <hr style={{ border: "none", borderTop: "1px dashed #999", margin: "6px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 900 }}>
            <span>לתשלום:</span>
            <span>₪{subtotalInclVat.toFixed(2)}</span>
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
              onClick={() => window.print()}
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
    </>
  );
}
