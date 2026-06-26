"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { outboxList, type OutboxEntry } from "@/lib/outbox";

// A visibility panel for the offline sync queue — the waiter can see every action
// that is waiting to reach the server (queued offline) and trigger a manual sync.

const GB = "rgba(255,255,255,0.15)";
const GM = "rgba(255,255,255,0.55)";

const KIND_ICON: Record<string, string> = {
  "order.create": "🍽️",
  "order.addItems": "➕",
  "order.status": "🪑",
  "table.status": "🪑",
  "order.fire": "🔥",
  "attendance.punch": "⏱️",
};

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

export default function OutboxPanel({
  isOnline, isSyncing, onSync, onClose,
}: {
  isOnline: boolean; isSyncing: boolean; onSync: () => void; onClose: () => void;
}) {
  const [entries, setEntries] = useState<OutboxEntry[]>([]);

  const refresh = useCallback(async () => {
    try { setEntries(await outboxList()); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [refresh]);

  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 10001, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} dir="rtl" style={{
        background: "rgba(15,14,22,0.98)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
        border: `1px solid ${GB}`, borderRadius: 18, width: "100%", maxWidth: 460, maxHeight: "82vh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.6)", fontFamily: "'Heebo', sans-serif", color: "#fff",
      }}>
        <div style={{ padding: "18px 22px 14px", borderBottom: `1px solid ${GB}`, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "rgba(15,14,22,0.98)", borderRadius: "18px 18px 0 0" }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>🔄 תור סנכרון {entries.length > 0 && `(${entries.length})`}</div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: `1px solid ${GB}`, borderRadius: 8, width: 32, height: 32, fontSize: 17, cursor: "pointer", color: "#fff" }}>✕</button>
        </div>

        <div style={{ padding: "14px 18px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: isOnline ? "#34D399" : "#FBBF24" }}>
              {isOnline ? "🟢 מחובר" : "📴 לא מחובר"}
            </span>
            <button onClick={onSync} disabled={!isOnline || isSyncing || entries.length === 0} style={{
              marginRight: "auto", padding: "7px 16px", borderRadius: 10, border: "none",
              background: (!isOnline || entries.length === 0) ? "rgba(255,255,255,0.08)" : "linear-gradient(135deg,#D97706,#F59E0B)",
              color: "#fff", fontWeight: 800, fontSize: 13, cursor: (!isOnline || isSyncing || entries.length === 0) ? "default" : "pointer",
              fontFamily: "inherit", opacity: (!isOnline || isSyncing || entries.length === 0) ? 0.5 : 1,
            }}>{isSyncing ? "מסנכרן..." : "סנכרן עכשיו"}</button>
          </div>

          {entries.length === 0 ? (
            <div style={{ textAlign: "center", color: GM, fontSize: 13, padding: "24px 0" }}>✓ הכל מסונכרן — אין פעולות ממתינות</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {entries.map(e => (
                <div key={e.key} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.05)", border: `1px solid ${GB}`, borderRadius: 10, padding: "10px 12px" }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{KIND_ICON[e.kind] ?? "•"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.label}</div>
                    <div style={{ fontSize: 11, color: GM }}>{fmtTime(e.createdAt)}{e.attempts > 0 ? ` · ${e.attempts} ניסיונות` : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
