"use client";
import React, { useState, useEffect, useCallback } from "react";
import { GB, GM, ACCENT_GRAD } from "./attendanceShared";

interface Props {
  restaurantId: string;
  showToast: (msg: string) => void;
}

export type AttRequest = {
  id: string; userId: string; userName: string | null; kind: string;
  fromDate: string; toDate: string | null; details: string | null; reason: string;
  status: string; decidedByName: string | null; decisionNote: string | null;
  decidedAt: string | null; createdAt: string;
};

const STATUS_LABEL: Record<string, string> = { PENDING: "ממתין", APPROVED: "אושר", REJECTED: "נדחה" };
const STATUS_COLOR: Record<string, string> = { PENDING: "#FBBF24", APPROVED: "#34D399", REJECTED: "#F87171" };

export function kindLabel(kind: string) { return kind === "CORRECTION" ? "תיקון שעות" : "בקשת חופשה"; }
export function reqWhen(r: AttRequest) {
  if (r.kind === "LEAVE" && r.toDate && r.toDate !== r.fromDate) return `${r.fromDate} — ${r.toDate}`;
  return r.fromDate;
}

// Employee view: file a time-correction or leave request and track its status.
export default function RequestsTab({ restaurantId, showToast }: Props) {
  const [requests, setRequests] = useState<AttRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [kind, setKind] = useState<"CORRECTION" | "LEAVE">("CORRECTION");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [punchType, setPunchType] = useState<"IN" | "OUT">("IN");
  const [punchTime, setPunchTime] = useState("");
  const [leaveType, setLeaveType] = useState("חופשה שנתית");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/attendance/requests?restaurantId=${restaurantId}`);
      const data = await res.json();
      setRequests(data.requests ?? []);
    } catch { setRequests([]); }
    finally { setLoading(false); }
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!fromDate || !reason.trim() || saving) return;
    if (kind === "CORRECTION" && !punchTime) { showToast("יש להזין שעה מבוקשת"); return; }
    setSaving(true);
    try {
      const details = kind === "CORRECTION"
        ? { requestedType: punchType, requestedTime: punchTime }
        : { leaveType };
      const res = await fetch("/api/admin/attendance/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, kind, fromDate, toDate: kind === "LEAVE" ? (toDate || fromDate) : undefined, details, reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "שגיאה בשליחה"); return; }
      showToast("✓ הבקשה נשלחה לאישור");
      setFromDate(""); setToDate(""); setPunchTime(""); setReason("");
      load();
    } finally { setSaving(false); }
  }

  const inputBox: React.CSSProperties = { background: "rgba(255,255,255,0.07)", border: `1px solid ${GB}`, borderRadius: 8, color: "#fff", padding: "7px 10px", fontSize: 13, fontFamily: "inherit", outline: "none", colorScheme: "dark" };
  const tabBtn = (k: typeof kind, label: string) => (
    <button onClick={() => setKind(k)} style={{ padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", borderRadius: 8, background: kind === k ? "rgba(245,158,11,0.2)" : "transparent", border: kind === k ? "1px solid rgba(245,158,11,0.45)" : `1px solid ${GB}`, color: kind === k ? "#FBBF24" : GM, fontFamily: "inherit" }}>{label}</button>
  );

  return (
    <div>
      {/* New request form */}
      <div style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${GB}`, borderRadius: 16, padding: 18, marginBottom: 20, maxWidth: 640 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 12 }}>📤 בקשה חדשה</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>{tabBtn("CORRECTION", "🕐 תיקון שעות")}{tabBtn("LEAVE", "🏖️ חופשה")}</div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ flex: "1 1 150px" }}>
            <div style={{ fontSize: 11, color: GM, marginBottom: 4 }}>{kind === "LEAVE" ? "מתאריך" : "תאריך"}</div>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ ...inputBox, width: "100%", boxSizing: "border-box" }} />
          </div>
          {kind === "LEAVE" && (
            <div style={{ flex: "1 1 150px" }}>
              <div style={{ fontSize: 11, color: GM, marginBottom: 4 }}>עד תאריך</div>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ ...inputBox, width: "100%", boxSizing: "border-box" }} />
            </div>
          )}
          {kind === "CORRECTION" && (<>
            <div style={{ flex: "1 1 120px" }}>
              <div style={{ fontSize: 11, color: GM, marginBottom: 4 }}>סוג</div>
              <select value={punchType} onChange={e => setPunchType(e.target.value as "IN" | "OUT")} style={{ ...inputBox, width: "100%", boxSizing: "border-box", cursor: "pointer" }}>
                <option value="IN" style={{ background: "#1a1a2e" }}>כניסה</option>
                <option value="OUT" style={{ background: "#1a1a2e" }}>יציאה</option>
              </select>
            </div>
            <div style={{ flex: "1 1 120px" }}>
              <div style={{ fontSize: 11, color: GM, marginBottom: 4 }}>שעה מבוקשת</div>
              <input type="time" value={punchTime} onChange={e => setPunchTime(e.target.value)} style={{ ...inputBox, width: "100%", boxSizing: "border-box" }} />
            </div>
          </>)}
          {kind === "LEAVE" && (
            <div style={{ flex: "1 1 150px" }}>
              <div style={{ fontSize: 11, color: GM, marginBottom: 4 }}>סוג חופשה</div>
              <select value={leaveType} onChange={e => setLeaveType(e.target.value)} style={{ ...inputBox, width: "100%", boxSizing: "border-box", cursor: "pointer" }}>
                {["חופשה שנתית", "מחלה", "מילואים", "חופשה ללא תשלום", "אחר"].map(t => <option key={t} value={t} style={{ background: "#1a1a2e" }}>{t}</option>)}
              </select>
            </div>
          )}
        </div>

        <div style={{ fontSize: 11, color: GM, marginBottom: 4 }}>סיבה / הערה <span style={{ color: "#F87171" }}>*</span></div>
        <input value={reason} onChange={e => setReason(e.target.value)} placeholder={kind === "CORRECTION" ? "למשל: שכחתי להחתים כניסה" : "פירוט הבקשה"} style={{ ...inputBox, width: "100%", boxSizing: "border-box", marginBottom: 14 }} />

        <button onClick={submit} disabled={!fromDate || !reason.trim() || saving} style={{ padding: "9px 22px", borderRadius: 10, border: "none", background: ACCENT_GRAD, color: "#fff", fontWeight: 800, fontSize: 14, cursor: fromDate && reason.trim() ? "pointer" : "not-allowed", fontFamily: "inherit", opacity: (!fromDate || !reason.trim() || saving) ? 0.5 : 1 }}>
          {saving ? "שולח..." : "שלח בקשה"}
        </button>
      </div>

      {/* My requests */}
      <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginBottom: 8 }}>הבקשות שלי {loading && <span style={{ fontSize: 11, color: GM, fontWeight: 400 }}>· טוען...</span>}</div>
      {requests.length === 0 ? (
        <div style={{ textAlign: "center", padding: 30, color: GM, fontSize: 14 }}>טרם הוגשו בקשות</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>{["סוג", "מועד", "פרטים", "סיבה", "סטטוס", "הערת מנהל"].map(h => (
              <th key={h} style={{ fontSize: 11, fontWeight: 700, color: GM, textAlign: "right", padding: "6px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {requests.map(r => {
              let det = "";
              try { const d = r.details ? JSON.parse(r.details) : null; det = d?.requestedTime ? `${d.requestedType === "IN" ? "כניסה" : "יציאה"} ${d.requestedTime}` : d?.leaveType ?? ""; } catch { /* ignore */ }
              return (
                <tr key={r.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td style={{ padding: "6px 10px", fontSize: 12, color: "#fff", whiteSpace: "nowrap" }}>{kindLabel(r.kind)}</td>
                  <td style={{ padding: "6px 10px", fontSize: 12, color: GM, whiteSpace: "nowrap" }}>{reqWhen(r)}</td>
                  <td style={{ padding: "6px 10px", fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{det || "–"}</td>
                  <td style={{ padding: "6px 10px", fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{r.reason}</td>
                  <td style={{ padding: "6px 10px", whiteSpace: "nowrap" }}>
                    <span style={{ background: `${STATUS_COLOR[r.status]}22`, color: STATUS_COLOR[r.status], borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{STATUS_LABEL[r.status] ?? r.status}</span>
                  </td>
                  <td style={{ padding: "6px 10px", fontSize: 12, color: GM }}>{r.decisionNote ?? (r.decidedByName ? "—" : "")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
