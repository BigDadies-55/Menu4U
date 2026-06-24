"use client";

import { T } from "@/lib/ui";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PaymentPanel } from "@/components/payment/PaymentPanel";
import type { Order } from "@/components/payment/types";

type Restaurant = { id: string; name: string };

function timeSince(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return "עכשיו";
  if (diff < 60) return `${diff} דק'`;
  return `${Math.floor(diff / 60)}ש'`;
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
  const waiterTable  = searchParams.get("tableNumber");   // set when coming from waiter POS
  const waiterMode   = searchParams.get("waiter") === "1";
  const waiterRid    = searchParams.get("restaurantId");
  const waiterReturn = searchParams.get("returnTo") ?? "/admin/waiter-pos";

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
        router.push(waiterReturn);
        return;
      }
    } catch (err) {
      // Network error → restore orders and show message
      setErrorMsg("שגיאת תקשורת — נא לנסות שוב");
      setOrders(prev => [...prev, ...tableOrders]);
      console.error("[closeTable]", err);
    }
  }

  // Called after a table is fully settled via split payment (already PAID server-side).
  function afterPaid(tableNumber: string) {
    setSelectedTable(null);
    setOrders(prev => prev.filter(o => orderTableKey(o) !== tableNumber));
    setErrorMsg(null);
    void fetchOrders();
    if (waiterMode) router.push(waiterReturn);
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
        <PaymentPanel
          tableNumber={waiterTable}
          orders={selectedOrders}
          restaurantId={restaurantId}
          onConfirm={() => closeTable(waiterTable)}
          onClose={() => router.push(waiterReturn)}
          onOrdersRefresh={fetchOrders}
          onPaid={() => afterPaid(waiterTable)}
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
        <PaymentPanel
          tableNumber={selectedTable}
          orders={selectedOrders}
          restaurantId={restaurantId || selectedOrders[0]?.restaurant?.id || ""}
          onConfirm={() => closeTable(selectedTable)}
          onClose={() => setSelectedTable(null)}
          onOrdersRefresh={fetchOrders}
          onPaid={() => afterPaid(selectedTable)}
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
