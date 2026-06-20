"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { GB, GM, ACCENT_GRAD, formatDateISO, fmtTime, nowWallMs, type AttRecord, type StaffMember, type AttRoleCfg } from "./attendanceShared";
import { type AttRequest, kindLabel, reqWhen } from "./RequestsTab";

interface Props {
  restaurantId: string;
  staff: StaffMember[];
  attRoles: AttRoleCfg[];
  showToast: (msg: string) => void;
}

// Hours of continuous presence after which we raise an alert.
const LONG_SHIFT_ALERT_HOURS = 11;

// Step 4 — Manager dashboard: real-time presence, alerts, and request approvals.
export default function ManagerDashboardTab({ restaurantId, staff, attRoles, showToast }: Props) {
  const [records, setRecords] = useState<AttRecord[]>([]);
  const [requests, setRequests] = useState<AttRequest[]>([]);
  const [canApprove, setCanApprove] = useState(false);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => nowWallMs());
  const [decideTarget, setDecideTarget] = useState<{ req: AttRequest; status: "APPROVED" | "REJECTED" } | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [saving, setSaving] = useState(false);

  const nameById = useMemo(() => Object.fromEntries(staff.map(s => [s.id, s.name])), [staff]);
  const roleByCode = useMemo(() => Object.fromEntries(attRoles.map(r => [r.code, r])), [attRoles]);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    const today = formatDateISO(new Date());
    setLoading(true);
    try {
      const [attRes, reqRes] = await Promise.all([
        fetch(`/api/admin/attendance?restaurantId=${restaurantId}&from=${today}&to=${today}`),
        fetch(`/api/admin/attendance/requests?restaurantId=${restaurantId}`),
      ]);
      const attData = await attRes.json();
      const reqData = await reqRes.json();
      setRecords((attData.records ?? []).filter((r: AttRecord) => r.type !== "DELETED"));
      setRequests(reqData.requests ?? []);
      setCanApprove(!!reqData.canApprove);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);
  // Live clock: refresh elapsed every 30s + auto-reload presence every 60s.
  useEffect(() => {
    const t = setInterval(() => setNow(nowWallMs()), 30_000);
    const r = setInterval(load, 60_000);
    return () => { clearInterval(t); clearInterval(r); };
  }, [load]);

  // Build per-user presence from today's punches.
  type Presence = { userId: string; name: string; sinceTs: string; roleCode: string | null; elapsedH: number };
  const presence = useMemo<Presence[]>(() => {
    const byUser: Record<string, AttRecord[]> = {};
    for (const r of records) (byUser[r.userId] ??= []).push(r);
    const list: Presence[] = [];
    for (const [userId, recs] of Object.entries(byUser)) {
      const sorted = recs.slice().sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      const last = sorted[sorted.length - 1];
      if (last?.type === "IN") {
        const lastIn = sorted.filter(r => r.type === "IN").pop()!;
        list.push({
          userId, name: nameById[userId] ?? userId, sinceTs: lastIn.timestamp,
          roleCode: lastIn.roleCode ?? null,
          elapsedH: (now - new Date(lastIn.timestamp).getTime()) / 3_600_000,
        });
      }
    }
    return list.sort((a, b) => b.elapsedH - a.elapsedH);
  }, [records, nameById, now]);

  // Alerts: long continuous shifts + flagged (unscheduled/out-of-window) check-ins.
  const alerts = useMemo(() => {
    const out: { id: string; level: "high" | "warn"; text: string }[] = [];
    for (const p of presence) {
      if (p.elapsedH >= LONG_SHIFT_ALERT_HOURS) {
        out.push({ id: `long-${p.userId}`, level: "high", text: `${p.name} נמצא/ת ${p.elapsedH.toFixed(1)} שעות עבודה ברציפות היום` });
      }
    }
    for (const r of records) {
      if (r.type === "IN" && (r.unscheduled || r.outOfWindow)) {
        out.push({
          id: `flag-${r.id}`, level: "warn",
          text: `${nameById[r.userId] ?? r.userId} — החתמה ${r.unscheduled ? "ללא שיבוץ" : "מחוץ לחלון המשמרת"} ב-${fmtTime(r.timestamp)}`,
        });
      }
    }
    return out;
  }, [presence, records, nameById]);

  const pending = requests.filter(r => r.status === "PENDING");

  async function decide() {
    if (!decideTarget || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/attendance/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: decideTarget.req.id, status: decideTarget.status, decisionNote: decisionNote.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "שגיאה"); return; }
      showToast(decideTarget.status === "APPROVED" ? "✓ הבקשה אושרה" : "הבקשה נדחתה");
      setDecideTarget(null); setDecisionNote("");
      load();
    } finally { setSaving(false); }
  }

  const card: React.CSSProperties = { background: "rgba(255,255,255,0.04)", border: `1px solid ${GB}`, borderRadius: 16, padding: 18, marginBottom: 18 };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <button onClick={load} style={{ padding: "5px 13px", fontSize: 12, fontWeight: 700, cursor: "pointer", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, color: "#fff", fontFamily: "inherit" }}>🔄 רענון</button>
        {loading && <span style={{ fontSize: 11, color: GM }}>טוען...</span>}
        <span style={{ fontSize: 11, color: GM, marginRight: "auto" }}>מתעדכן אוטומטית כל דקה</span>
      </div>

      {/* Real-time presence */}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#34D399", boxShadow: "0 0 8px #34D399" }} />
          מי נמצא בעסק כרגע <span style={{ fontSize: 12, color: GM, fontWeight: 500 }}>({presence.length})</span>
        </div>
        {presence.length === 0 ? (
          <div style={{ color: GM, fontSize: 13, padding: "10px 0" }}>אין עובדים מחתימים כעת</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {presence.map(p => {
              const role = p.roleCode ? roleByCode[p.roleCode] : undefined;
              const long = p.elapsedH >= LONG_SHIFT_ALERT_HOURS;
              return (
                <div key={p.userId} style={{ background: "rgba(0,0,0,0.2)", border: `1px solid ${long ? "rgba(248,113,113,0.45)" : "rgba(52,211,153,0.3)"}`, borderRadius: 12, padding: "10px 14px", minWidth: 160 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: 6 }}>
                    {p.name}
                    {role && <span style={{ background: `${role.color}33`, color: role.color, borderRadius: 4, padding: "0 5px", fontSize: 10, fontWeight: 700 }}>{role.label}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: GM, marginTop: 4 }}>מאז {fmtTime(p.sinceTs)}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: long ? "#F87171" : "#34D399", marginTop: 2 }}>{p.elapsedH.toFixed(1)} ש׳ {long && "⚠"}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Alerts */}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 12 }}>🚨 התראות</div>
        {alerts.length === 0 ? (
          <div style={{ color: GM, fontSize: 13 }}>אין התראות פעילות</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {alerts.map(a => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, background: a.level === "high" ? "rgba(248,113,113,0.1)" : "rgba(251,191,36,0.1)", border: `1px solid ${a.level === "high" ? "rgba(248,113,113,0.35)" : "rgba(251,191,36,0.35)"}`, borderRadius: 10, padding: "9px 13px" }}>
                <span style={{ fontSize: 16 }}>{a.level === "high" ? "⏰" : "⚠️"}</span>
                <span style={{ fontSize: 13, color: a.level === "high" ? "#F87171" : "#FBBF24", fontWeight: 600 }}>{a.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Request approvals */}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 4 }}>📥 אישור תיקוני שעות ובקשות חופשה <span style={{ fontSize: 12, color: GM, fontWeight: 500 }}>({pending.length} ממתינות)</span></div>
        {!canApprove && <div style={{ fontSize: 11, color: "#FBBF24", marginBottom: 10 }}>👁️ תצוגה בלבד — אין לך הרשאה לאשר בקשות</div>}
        {pending.length === 0 ? (
          <div style={{ color: GM, fontSize: 13, marginTop: 8 }}>אין בקשות ממתינות</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
            <thead>
              <tr>{["עובד", "סוג", "מועד", "פרטים", "סיבה", canApprove ? "פעולה" : "סטטוס"].map(h => (
                <th key={h} style={{ fontSize: 11, fontWeight: 700, color: GM, textAlign: "right", padding: "6px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {pending.map(r => {
                let det = "";
                try { const d = r.details ? JSON.parse(r.details) : null; det = d?.requestedTime ? `${d.requestedType === "IN" ? "כניסה" : "יציאה"} ${d.requestedTime}` : d?.leaveType ?? ""; } catch { /* ignore */ }
                return (
                  <tr key={r.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "6px 10px", fontSize: 13, color: "#fff", fontWeight: 600, whiteSpace: "nowrap" }}>{r.userName ?? nameById[r.userId] ?? r.userId}</td>
                    <td style={{ padding: "6px 10px", fontSize: 12, color: GM, whiteSpace: "nowrap" }}>{kindLabel(r.kind)}</td>
                    <td style={{ padding: "6px 10px", fontSize: 12, color: GM, whiteSpace: "nowrap" }}>{reqWhen(r)}</td>
                    <td style={{ padding: "6px 10px", fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{det || "–"}</td>
                    <td style={{ padding: "6px 10px", fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{r.reason}</td>
                    <td style={{ padding: "6px 10px", whiteSpace: "nowrap" }}>
                      {canApprove ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => { setDecideTarget({ req: r, status: "APPROVED" }); setDecisionNote(""); }} style={{ padding: "4px 12px", borderRadius: 7, border: "none", background: "rgba(52,211,153,0.2)", color: "#34D399", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>אשר</button>
                          <button onClick={() => { setDecideTarget({ req: r, status: "REJECTED" }); setDecisionNote(""); }} style={{ padding: "4px 12px", borderRadius: 7, border: "none", background: "rgba(248,113,113,0.2)", color: "#F87171", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>דחה</button>
                        </div>
                      ) : (
                        <span style={{ background: "rgba(251,191,36,0.18)", color: "#FBBF24", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>ממתין</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Decision modal */}
      {decideTarget && (
        <div onClick={() => setDecideTarget(null)} style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "rgba(18,17,28,0.98)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 16, padding: 24, width: 340, maxWidth: "92vw", direction: "rtl", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 6 }}>{decideTarget.status === "APPROVED" ? "אישור בקשה" : "דחיית בקשה"}</div>
            <div style={{ fontSize: 13, color: GM, marginBottom: 14 }}>{decideTarget.req.userName ?? ""} · {kindLabel(decideTarget.req.kind)} · {reqWhen(decideTarget.req)}</div>
            <label style={{ fontSize: 12, color: GM, display: "block", marginBottom: 5 }}>הערה (אופציונלי)</label>
            <input value={decisionNote} onChange={e => setDecisionNote(e.target.value)} autoFocus placeholder="הערת מנהל לעובד" style={{ width: "100%", padding: "8px 11px", borderRadius: 9, background: "rgba(255,255,255,0.07)", border: `1px solid ${GB}`, color: "#fff", fontSize: 13, outline: "none", marginBottom: 14, fontFamily: "inherit", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={decide} disabled={saving} style={{ flex: 1, padding: "9px", borderRadius: 9, border: "none", background: decideTarget.status === "APPROVED" ? ACCENT_GRAD : "#ef4444", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", opacity: saving ? 0.6 : 1 }}>{saving ? "..." : decideTarget.status === "APPROVED" ? "אשר בקשה" : "דחה בקשה"}</button>
              <button onClick={() => setDecideTarget(null)} style={{ padding: "9px 16px", borderRadius: 9, background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, color: GM, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
