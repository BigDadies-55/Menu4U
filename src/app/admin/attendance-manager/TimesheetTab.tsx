"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { computeDailyHoursByRole, sumBreakdowns } from "@/lib/hours";
import {
  GB, GM, ACCENT_GRAD, MONTHS_HE, exportCsv, fmtTime, monthRange, inputStyle,
  type AttRecord, type StaffMember, type AttRoleCfg,
} from "./attendanceShared";

interface Props {
  restaurantId: string;
  staff: StaffMember[];
  attRoles: AttRoleCfg[];
  isManager: boolean;
  currentUserId: string;
  employeeNos: Record<string, string>;
}

// Step 5 — Monthly timesheet view. A calendar-style day-by-day table for a single
// employee, with clear regular / overtime totals for the whole month.
export default function TimesheetTab({ restaurantId, staff, attRoles, isManager, currentUserId, employeeNos }: Props) {
  const [month, setMonth] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`; });
  const [selectedUser, setSelectedUser] = useState(isManager ? (staff[0]?.id ?? "") : currentUserId);
  const [records, setRecords] = useState<AttRecord[]>([]);
  const [leaveDays, setLeaveDays] = useState<Record<string, string>>({}); // date → leave type (approved)
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isManager) { setSelectedUser(currentUserId); return; }
    if (!selectedUser && staff.length > 0) setSelectedUser(staff[0].id);
  }, [staff, isManager, currentUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    if (!restaurantId || !selectedUser) return;
    const { from, to } = monthRange(month);
    setLoading(true);
    try {
      const [attRes, reqRes] = await Promise.all([
        fetch(`/api/admin/attendance?restaurantId=${restaurantId}&from=${from}&to=${to}`),
        fetch(`/api/admin/attendance/requests?restaurantId=${restaurantId}`),
      ]);
      const data = await attRes.json();
      setRecords((data.records ?? []).filter((r: AttRecord) => r.type !== "DELETED" && r.userId === selectedUser));
      // Approved leave for this employee → mark the relevant days.
      const reqData = await reqRes.json();
      const leave: Record<string, string> = {};
      for (const r of (reqData.requests ?? []) as { userId: string; kind: string; status: string; fromDate: string; toDate: string | null; details: string | null }[]) {
        if (r.kind !== "LEAVE" || r.status !== "APPROVED" || r.userId !== selectedUser) continue;
        let type = "חופשה";
        try { const d = r.details ? JSON.parse(r.details) : null; if (d?.leaveType) type = d.leaveType; } catch { /* ignore */ }
        const start = r.fromDate, end = r.toDate || r.fromDate;
        for (let dt = new Date(start + "T00:00:00Z"); dt <= new Date(end + "T00:00:00Z"); dt.setUTCDate(dt.getUTCDate() + 1)) {
          leave[dt.toISOString().slice(0, 10)] = type;
        }
      }
      setLeaveDays(leave);
    } catch { setRecords([]); setLeaveDays({}); }
    finally { setLoading(false); }
  }, [restaurantId, selectedUser, month]);

  useEffect(() => { load(); }, [load]);

  const roleByCode = useMemo(() => Object.fromEntries(attRoles.map(r => [r.code, r])), [attRoles]);
  const selectedName = staff.find(s => s.id === selectedUser)?.name ?? "";

  // Build a row for every day of the month (calendar grid), filling in punches.
  const { from, to } = monthRange(month);
  const daysInMonth = Number(to.slice(8, 10));
  const byDate = useMemo(() => {
    const m: Record<string, AttRecord[]> = {};
    for (const r of records) { (m[r.date] ??= []).push(r); }
    return m;
  }, [records]);

  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, "0")}`;
    const recs = (byDate[date] ?? []).slice().sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const bd = computeDailyHoursByRole(recs);
    const dow = new Date(date + "T00:00:00").getDay();
    return { date, day: i + 1, dow, recs, bd };
  }), [month, daysInMonth, byDate]);

  const total = useMemo(() => sumBreakdowns(days.map(d => d.bd)), [days]);
  const workedDays = days.filter(d => d.bd.netHours > 0).length;
  const fmtH = (n: number) => n.toFixed(1);
  const DOW_HE = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

  const cell: React.CSSProperties = { padding: "5px 8px", fontSize: 12, textAlign: "center", whiteSpace: "nowrap" };
  const th: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: GM, padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" };

  function doExport() {
    const header = ["תאריך", "יום", "כניסות/יציאות", "ברוטו", "הפסקה", "נטו", "רגיל", "125%", "150%", 'שווה-ערך'];
    const rows = days.filter(d => d.recs.length > 0).map(d => [
      d.date, DOW_HE[d.dow],
      d.recs.map(r => `${r.type === "IN" ? "▶" : "■"}${fmtTime(r.timestamp)}`).join(" "),
      fmtH(d.bd.grossHours), fmtH(d.bd.breakHours), fmtH(d.bd.netHours),
      fmtH(d.bd.regularHours), fmtH(d.bd.overtime125Hours), fmtH(d.bd.overtime150Hours), fmtH(d.bd.payableUnits),
    ]);
    const totals = ['סה"כ', "", `${workedDays} ימים`, fmtH(total.grossHours), fmtH(total.breakHours), fmtH(total.netHours),
      fmtH(total.regularHours), fmtH(total.overtime125Hours), fmtH(total.overtime150Hours), fmtH(total.payableUnits)];
    exportCsv([header, ...rows, totals], `דוח-נוכחות-${selectedName}-${month}.csv`);
  }

  return (
    <div>
      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ ...inputStyle, cursor: "pointer", colorScheme: "dark" }} />
        {isManager && staff.length > 0 && (
          <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)} style={{ ...inputStyle, cursor: "pointer", minWidth: 150 }}>
            {staff.map(s => <option key={s.id} value={s.id} style={{ background: "#1a1a2e" }}>{s.name}</option>)}
          </select>
        )}
        {selectedUser && employeeNos[selectedUser] && (
          <span title="מספר עובד" style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "#FBBF24", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 6, padding: "4px 8px" }}>#{employeeNos[selectedUser]}</span>
        )}
        {loading && <span style={{ fontSize: 11, color: GM }}>טוען...</span>}
        <button onClick={doExport} style={{ marginRight: "auto", padding: "5px 13px", fontSize: 12, fontWeight: 700, cursor: "pointer", borderRadius: 8, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)", color: "#4ade80", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>📊 ייצא Excel</button>
      </div>

      {/* Monthly totals strip */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        {[
          { label: "ימי עבודה", val: String(workedDays), color: "#fff" },
          { label: 'סה"כ נטו', val: `${fmtH(total.netHours)} ש׳`, color: "#FBBF24" },
          { label: "רגיל 100%", val: `${fmtH(total.regularHours)} ש׳`, color: "#fff" },
          { label: "נוספות 125%", val: `${fmtH(total.overtime125Hours)} ש׳`, color: "#FB923C" },
          { label: "נוספות 150%", val: `${fmtH(total.overtime150Hours)} ש׳`, color: "#F87171" },
          { label: "שווה-ערך לתשלום", val: `${fmtH(total.payableUnits)} ש׳`, color: "#34D399" },
        ].map(c => (
          <div key={c.label} style={{ flex: "1 1 130px", background: "rgba(255,255,255,0.04)", border: `1px solid ${GB}`, borderRadius: 12, padding: "10px 14px" }}>
            <div style={{ fontSize: 11, color: GM, marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: c.color }}>{c.val}</div>
          </div>
        ))}
      </div>

      {(!isManager || selectedUser) && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "center" }}>תאריך</th>
              <th style={{ ...th, textAlign: "right" }}>כניסות / יציאות</th>
              <th style={{ ...th, color: "#FBBF24" }}>נטו</th>
              <th style={th}>רגיל</th>
              <th style={{ ...th, color: "#FB923C" }}>125%</th>
              <th style={{ ...th, color: "#F87171" }}>150%</th>
              <th style={{ ...th, color: "#34D399" }}>סה"כ יומי</th>
            </tr>
          </thead>
          <tbody>
            {days.map(d => {
              const weekend = d.dow === 5 || d.dow === 6;
              const worked = d.recs.length > 0;
              return (
                <tr key={d.date} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: weekend ? "rgba(255,255,255,0.02)" : "transparent" }}>
                  <td style={{ ...cell, color: weekend ? "#FBBF24" : GM, fontWeight: weekend ? 700 : 400 }}>
                    {d.day}/{month.slice(5)} <span style={{ opacity: 0.7 }}>{DOW_HE[d.dow]}</span>
                  </td>
                  <td style={{ ...cell, textAlign: "right" }}>
                    {(worked || leaveDays[d.date]) ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {d.recs.map(r => {
                          const role = r.roleCode ? roleByCode[r.roleCode] : undefined;
                          // Corrections (approved requests) render in a distinct cyan with a ✎ marker.
                          const corr = r.isCorrection;
                          const bg = corr ? "rgba(56,189,248,0.15)" : r.type === "IN" ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)";
                          const col = corr ? "#38BDF8" : r.type === "IN" ? "#34D399" : "#F87171";
                          const brd = corr ? "rgba(56,189,248,0.45)" : r.type === "IN" ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)";
                          return (
                            <span key={r.id} title={corr ? "תיקון מאושר" : undefined} style={{
                              display: "inline-flex", alignItems: "center", gap: 3,
                              background: bg, color: col, border: `1px solid ${brd}`,
                              borderRadius: 5, padding: "1px 6px", fontWeight: 600, fontSize: 11,
                            }}>
                              {corr ? "✎" : r.type === "IN" ? "▶" : "■"} {fmtTime(r.timestamp)}
                              {role && <span style={{ background: `${role.color}33`, color: role.color, borderRadius: 4, padding: "0 4px", fontSize: 9, fontWeight: 700 }}>{role.label}</span>}
                            </span>
                          );
                        })}
                        {leaveDays[d.date] && (
                          <span title="חופשה מאושרת" style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "rgba(168,85,247,0.15)", color: "#C084FC", border: "1px solid rgba(168,85,247,0.45)", borderRadius: 5, padding: "1px 6px", fontWeight: 700, fontSize: 11 }}>
                            🏖️ {leaveDays[d.date]}
                          </span>
                        )}
                      </div>
                    ) : <span style={{ color: "rgba(255,255,255,0.25)" }}>—</span>}
                  </td>
                  <td style={cell}>
                    {d.bd.netHours > 0 ? <span style={{ background: "rgba(251,191,36,0.15)", color: "#FBBF24", borderRadius: 6, padding: "2px 7px", fontSize: 11, fontWeight: 700 }}>{fmtH(d.bd.netHours)}</span> : <span style={{ color: GM }}>–</span>}
                  </td>
                  <td style={{ ...cell, color: "rgba(255,255,255,0.65)" }}>{d.bd.regularHours > 0 ? fmtH(d.bd.regularHours) : "–"}</td>
                  <td style={cell}>{d.bd.overtime125Hours > 0 ? <span style={{ background: "rgba(249,115,22,0.15)", color: "#FB923C", borderRadius: 6, padding: "2px 7px", fontSize: 11, fontWeight: 700 }}>{fmtH(d.bd.overtime125Hours)}</span> : <span style={{ color: GM }}>–</span>}</td>
                  <td style={cell}>{d.bd.overtime150Hours > 0 ? <span style={{ background: "rgba(239,68,68,0.15)", color: "#F87171", borderRadius: 6, padding: "2px 7px", fontSize: 11, fontWeight: 700 }}>{fmtH(d.bd.overtime150Hours)}</span> : <span style={{ color: GM }}>–</span>}</td>
                  <td style={cell}>{d.bd.payableUnits > 0 ? <span title="שווה-ערך לתשלום (כולל תוספת נוספות)" style={{ background: "rgba(52,211,153,0.15)", color: "#34D399", borderRadius: 6, padding: "2px 7px", fontSize: 11, fontWeight: 800 }}>{fmtH(d.bd.payableUnits)}</span> : <span style={{ color: GM }}>–</span>}</td>
                </tr>
              );
            })}
            <tr style={{ borderTop: "2px solid rgba(255,255,255,0.12)" }}>
              <td style={{ ...cell, fontWeight: 800, color: "#fff" }}>סה"כ {MONTHS_HE[Number(month.slice(5)) - 1]}</td>
              <td style={{ ...cell, textAlign: "right", color: GM }}>{workedDays} ימי עבודה</td>
              <td style={cell}><span style={{ background: "rgba(251,191,36,0.15)", color: "#FBBF24", borderRadius: 6, padding: "2px 7px", fontSize: 12, fontWeight: 800 }}>{fmtH(total.netHours)}</span></td>
              <td style={{ ...cell, color: "#fff", fontWeight: 700 }}>{fmtH(total.regularHours)}</td>
              <td style={{ ...cell, color: "#FB923C", fontWeight: 700 }}>{fmtH(total.overtime125Hours)}</td>
              <td style={{ ...cell, color: "#F87171", fontWeight: 700 }}>{fmtH(total.overtime150Hours)}</td>
              <td style={cell}><span style={{ background: "rgba(52,211,153,0.15)", color: "#34D399", borderRadius: 6, padding: "2px 7px", fontSize: 12, fontWeight: 800 }}>{fmtH(total.payableUnits)}</span></td>
            </tr>
          </tbody>
        </table>
      )}
      <div style={{ fontSize: 10, color: GM, marginTop: 10, textAlign: "center", lineHeight: 1.8 }}>
        <div>סה"כ שווה-ערך לתשלום (כולל תוספת נוספות): {fmtH(total.payableUnits)} ש׳ · ניכוי הפסקה אוטומטי</div>
        <div>
          <span style={{ color: "#38BDF8" }}>✎ תיקון מאושר</span> · <span style={{ color: "#C084FC" }}>🏖️ חופשה מאושרת</span>
        </div>
      </div>
    </div>
  );
}
