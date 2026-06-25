"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useModuleEnabled } from "@/hooks/useModuleEnabled";

type AttRec = { id: string; type: string; timestamp: string };
type AttRoleCfg = { code: string; label: string; payCode: string; color: string };

interface Props {
  restaurantId: string;
  userId: string;
  /** Hide the built-in trigger button (use when opened from an external menu). */
  hideTrigger?: boolean;
  /** Each time this number changes, the attendance panel opens. */
  openSignal?: number;
  /** Called when a record (IN or OUT) is successfully logged. */
  onRecord?: (type: "IN" | "OUT") => void;
}

const G_CARD     = "rgba(255,255,255,0.06)";
const G_BORDER_C = "rgba(255,255,255,0.15)";

function fmtT(ts: string) {
  // Punch timestamps are stored as wall-clock-as-UTC → render with timeZone:"UTC".
  return new Date(ts).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

export default function AttendanceWidget({ restaurantId, userId, hideTrigger = false, openSignal, onRecord }: Props) {
  const moduleOn = useModuleEnabled(restaurantId, "attendance");
  const [records,    setRecords]    = useState<AttRec[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [note,       setNote]       = useState("");
  const [noteOpen,   setNoteOpen]   = useState<"IN" | "OUT" | null>(null);
  const [panelOpen,  setPanelOpen]  = useState(false);
  const [roles,      setRoles]      = useState<AttRoleCfg[]>([]);
  const [roleCode,   setRoleCode]   = useState("");
  const [timezone,   setTimezone]   = useState("Asia/Jerusalem");

  const firstIn  = records.find(r => r.type === "IN");
  const firstOut = records.find(r => r.type === "OUT");
  const hasIn    = !!firstIn;
  const hasOut   = !!firstOut;

  const loadToday = useCallback(async () => {
    if (!userId) return;
    try {
      // Pass restaurantId so "today" is resolved in the venue's timezone.
      const res  = await fetch(`/api/admin/attendance?userId=${userId}${restaurantId ? `&restaurantId=${restaurantId}` : ""}`);
      const data = await res.json();
      setRecords((data.records ?? []).filter((r: AttRec) => r.type !== "DELETED"));
    } catch { /* ignore */ }
  }, [userId, restaurantId]);

  useEffect(() => { loadToday(); }, [loadToday]);

  // Allow a parent (menu item / first-entry prompt) to open the panel.
  useEffect(() => { if (openSignal !== undefined && openSignal > 0) setPanelOpen(true); }, [openSignal]);

  // Load the restaurant's role / pay-code list for the check-in picker.
  useEffect(() => {
    if (!restaurantId) return;
    fetch(`/api/admin/attendance?config=1&restaurantId=${restaurantId}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data.roles)) setRoles(data.roles); if (typeof data.timezone === "string") setTimezone(data.timezone); })
      .catch(() => {});
  }, [restaurantId]);

  async function record(type: "IN" | "OUT") {
    if (!userId || !restaurantId || loading) return;
    if (type === "IN" && roles.length > 0 && !roleCode) return; // role is required on check-in
    setLoading(true);
    try {
      const res = await fetch("/api/admin/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, type, note: note || undefined, roleCode: type === "IN" ? (roleCode || undefined) : undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        setRecords(prev => [...prev, { id: data.id, type, timestamp: data.timestamp }]);
        onRecord?.(type);
      }
    } finally { setLoading(false); setNote(""); setNoteOpen(null); setRoleCode(""); }
  }

  if (!moduleOn) return null;

  return (
    <>
      {/* ── Trigger button ── */}
      {!hideTrigger && <button
        onClick={() => setPanelOpen(true)}
        title="נוכחות"
        style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "5px 12px", borderRadius: 10, fontSize: 12, fontWeight: 600,
          cursor: "pointer",
          background: hasOut ? "rgba(248,113,113,0.15)" : hasIn ? "rgba(52,211,153,0.15)" : G_CARD,
          border: `1px solid ${hasOut ? "rgba(248,113,113,0.4)" : hasIn ? "rgba(52,211,153,0.4)" : G_BORDER_C}`,
          color: hasOut ? "#F87171" : hasIn ? "#34D399" : "#fff",
          transition: "background 0.15s, border 0.15s",
          fontFamily: "inherit",
        }}
      >
        ⏱ {hasOut ? fmtT(firstOut!.timestamp) : hasIn ? fmtT(firstIn!.timestamp) : "נוכחות"}
      </button>}

      {/* ── Panel modal ── */}
      {panelOpen && createPortal(
        <div
          onClick={() => setPanelOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "rgba(15,15,30,0.98)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 18, padding: 28, width: 300, maxWidth: "90vw", direction: "rtl", boxShadow: "0 16px 48px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column", gap: 14 }}
          >
            <div style={{ fontSize: 17, fontWeight: 800, textAlign: "center", color: "#fff", marginBottom: 4 }}>⏱ נוכחות</div>

            <button
              disabled={hasIn}
              onClick={() => { setPanelOpen(false); setNoteOpen("IN"); }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "13px 12px", borderRadius: 10, fontSize: 15, fontWeight: 700,
                cursor: hasIn ? "default" : "pointer", border: "none", fontFamily: "inherit",
                background: hasIn ? "rgba(52,211,153,0.08)" : "rgba(52,211,153,0.2)",
                color: hasIn ? "rgba(52,211,153,0.45)" : "#34D399",
                opacity: hasIn ? 0.7 : 1,
              }}
            >
              ✅ כניסה
              {hasIn && <span style={{ fontSize: 12, marginRight: 4 }}>{fmtT(firstIn!.timestamp)}</span>}
            </button>

            <button
              disabled={!hasIn || hasOut}
              onClick={() => { setPanelOpen(false); setNoteOpen("OUT"); }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "13px 12px", borderRadius: 10, fontSize: 15, fontWeight: 700,
                cursor: (!hasIn || hasOut) ? "default" : "pointer", border: "none", fontFamily: "inherit",
                background: hasOut ? "rgba(248,113,113,0.08)" : !hasIn ? "rgba(255,255,255,0.04)" : "rgba(248,113,113,0.2)",
                color: hasOut ? "rgba(248,113,113,0.45)" : !hasIn ? "rgba(255,255,255,0.25)" : "#F87171",
                opacity: (!hasIn || hasOut) ? 0.7 : 1,
              }}
            >
              🚪 יציאה
              {hasOut && <span style={{ fontSize: 12, marginRight: 4 }}>{fmtT(firstOut!.timestamp)}</span>}
            </button>

            <button
              onClick={() => setPanelOpen(false)}
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
            >
              ביטול
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* ── Note popup ── */}
      {noteOpen && createPortal(
        <div
          onClick={() => setNoteOpen(null)}
          style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "rgba(15,15,30,0.98)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 16, padding: 24, width: 300, maxWidth: "90vw", direction: "rtl", boxShadow: "0 16px 48px rgba(0,0,0,0.6)" }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4, color: "#fff" }}>
              {noteOpen === "IN" ? "✅ רישום כניסה" : "🚪 רישום יציאה"}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 16 }}>
              {new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: timezone })}
            </div>
            {noteOpen === "IN" && roles.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 6 }}>באיזה תפקיד אתה נכנס? <span style={{ color: "#F87171" }}>*</span></div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {roles.map(r => {
                    const sel = roleCode === r.code;
                    return (
                      <button
                        key={r.code}
                        onClick={() => setRoleCode(r.code)}
                        style={{
                          padding: "6px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                          background: sel ? `${r.color}33` : "rgba(255,255,255,0.05)",
                          border: `1px solid ${sel ? r.color : "rgba(255,255,255,0.15)"}`,
                          color: sel ? r.color : "rgba(255,255,255,0.7)",
                        }}
                      >{r.label}</button>
                    );
                  })}
                </div>
              </div>
            )}
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="הערה (אופציונלי)"
              autoFocus
              onKeyDown={e => { if (e.key === "Enter") record(noteOpen); }}
              style={{ width: "100%", padding: "9px 12px", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 9, fontSize: 13, outline: "none", background: "rgba(255,255,255,0.07)", color: "#fff", boxSizing: "border-box", marginBottom: 14, fontFamily: "inherit" }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => record(noteOpen)}
                disabled={loading || (noteOpen === "IN" && roles.length > 0 && !roleCode)}
                style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "none", background: noteOpen === "IN" ? "#22c55e" : "#ef4444", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit", opacity: (loading || (noteOpen === "IN" && roles.length > 0 && !roleCode)) ? 0.6 : 1 }}
              >
                {loading ? "..." : "אישור"}
              </button>
              <button
                onClick={() => setNoteOpen(null)}
                style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
