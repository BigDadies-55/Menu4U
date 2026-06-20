"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { computeDailyHoursByRole, sumBreakdowns } from "@/lib/hours";
import { buildPayrollFile, VENDOR_LABELS, type PayrollVendor, type PayrollEmployee } from "@/lib/payrollFormats";
import { GB, GM, ACCENT_GRAD, monthRange, MONTHS_HE, type AttRecord, type StaffMember } from "./attendanceShared";

interface Props {
  restaurantId: string;
  staff: StaffMember[];
  showToast: (msg: string) => void;
}

type Profile = { userId: string; employeeNo: string; idNumber: string; department: string; project: string };
type Settings = { regularCode: string; ot125Code: string; ot150Code: string };
type Cut = "employee" | "department" | "project";

function download(content: string, filename: string, mime = "text/csv;charset=utf-8;") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = filename;
  a.click();
}

// Step 6 — Payroll export generator. Builds bureau movement files (Hilan / Malam /
// Synel / Michpal / generic) and manager reports (Excel/PDF) sliced by employee,
// department or project.
export default function GeneratorsTab({ restaurantId, staff, showToast }: Props) {
  const [month, setMonth] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`; });
  const [records, setRecords] = useState<AttRecord[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [settings, setSettings] = useState<Settings>({ regularCode: "1", ot125Code: "2", ot150Code: "3" });
  const [canEdit, setCanEdit] = useState(false);
  const [vendor, setVendor] = useState<PayrollVendor>("GENERIC");
  const [cut, setCut] = useState<Cut>("employee");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    const { from, to } = monthRange(month);
    setLoading(true);
    try {
      const [attRes, payRes] = await Promise.all([
        fetch(`/api/admin/attendance?restaurantId=${restaurantId}&from=${from}&to=${to}`),
        fetch(`/api/admin/payroll?restaurantId=${restaurantId}`),
      ]);
      const attData = await attRes.json();
      const payData = await payRes.json();
      setRecords((attData.records ?? []).filter((r: AttRecord) => r.type !== "DELETED"));
      const map: Record<string, Profile> = {};
      for (const p of (payData.profiles ?? []) as Profile[]) map[p.userId] = p;
      setProfiles(map);
      if (payData.settings) setSettings(payData.settings);
      setCanEdit(!!payData.canEdit);
      setDirty(false);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [restaurantId, month]);

  useEffect(() => { load(); }, [load]);

  const prof = (userId: string): Profile => profiles[userId] ?? { userId, employeeNo: "", idNumber: "", department: "", project: "" };
  const setProf = (userId: string, patch: Partial<Profile>) => {
    setProfiles(prev => ({ ...prev, [userId]: { ...prof(userId), ...patch } }));
    setDirty(true);
  };

  // Per-employee monthly hour breakdown.
  const employees = useMemo<PayrollEmployee[]>(() => {
    return staff.map(member => {
      const mine = records.filter(r => r.userId === member.id);
      const byDate: Record<string, AttRecord[]> = {};
      for (const r of mine) (byDate[r.date] ??= []).push(r);
      const total = sumBreakdowns(Object.values(byDate).map(recs => computeDailyHoursByRole(recs)));
      const p = prof(member.id);
      return {
        employeeNo: p.employeeNo || member.id.slice(0, 8), idNumber: p.idNumber, name: member.name,
        department: p.department || "כללי", project: p.project || "—",
        regularHours: total.regularHours, ot125Hours: total.overtime125Hours, ot150Hours: total.overtime150Hours,
      };
    }).filter(e => e.regularHours + e.ot125Hours + e.ot150Hours > 0.01);
  }, [staff, records, profiles]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/payroll", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, profiles: Object.values(profiles), settings }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); showToast(e.error ?? "שגיאה בשמירה"); return; }
      showToast("✓ הגדרות שכר נשמרו"); setDirty(false);
    } finally { setSaving(false); }
  }

  function generatePayrollFile() {
    if (employees.length === 0) { showToast("אין נתונים לחודש זה"); return; }
    const { content, ext } = buildPayrollFile(vendor, employees, settings, month);
    download(content, `שכר-${VENDOR_LABELS[vendor]}-${month}.${ext}`, ext === "txt" ? "text/plain;charset=utf-8;" : undefined);
  }

  // Group employees by the chosen cut for the report exports.
  const groups = useMemo(() => {
    const key = (e: PayrollEmployee) => cut === "department" ? e.department : cut === "project" ? e.project : e.name;
    const m: Record<string, PayrollEmployee[]> = {};
    for (const e of employees) (m[key(e)] ??= []).push(e);
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b, "he"));
  }, [employees, cut]);

  const cutLabel = cut === "department" ? "מחלקה" : cut === "project" ? "פרויקט" : "עובד";
  const fmtH = (n: number) => n.toFixed(1);

  function exportExcel() {
    if (employees.length === 0) { showToast("אין נתונים לחודש זה"); return; }
    const rows: (string | number)[][] = [[`דוח שכר ${month} — לפי ${cutLabel}`], [], ["מספר עובד", 'ת"ז', "שם", cutLabel, "רגיל 100%", "נוספות 125%", "נוספות 150%", 'סה"כ שעות']];
    for (const [groupName, list] of groups) {
      for (const e of list) {
        rows.push([e.employeeNo, e.idNumber, e.name, groupName, fmtH(e.regularHours), fmtH(e.ot125Hours), fmtH(e.ot150Hours), fmtH(e.regularHours + e.ot125Hours + e.ot150Hours)]);
      }
      const gr = list.reduce((a, e) => a + e.regularHours, 0), g125 = list.reduce((a, e) => a + e.ot125Hours, 0), g150 = list.reduce((a, e) => a + e.ot150Hours, 0);
      rows.push(["", "", `סיכום ${groupName}`, "", fmtH(gr), fmtH(g125), fmtH(g150), fmtH(gr + g125 + g150)]);
    }
    const csv = "﻿" + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    download(csv, `דוח-שכר-${cutLabel}-${month}.csv`);
  }

  function exportPdf() {
    if (employees.length === 0) { showToast("אין נתונים לחודש זה"); return; }
    const monLabel = `${MONTHS_HE[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;
    const sections = groups.map(([groupName, list]) => {
      const body = list.map(e => `<tr><td>${e.employeeNo}</td><td>${e.name}</td><td>${fmtH(e.regularHours)}</td><td>${fmtH(e.ot125Hours)}</td><td>${fmtH(e.ot150Hours)}</td><td><b>${fmtH(e.regularHours + e.ot125Hours + e.ot150Hours)}</b></td></tr>`).join("");
      const gr = list.reduce((a, e) => a + e.regularHours, 0), g125 = list.reduce((a, e) => a + e.ot125Hours, 0), g150 = list.reduce((a, e) => a + e.ot150Hours, 0);
      return `<h3>${cutLabel}: ${groupName}</h3><table><thead><tr><th>מס׳</th><th>שם</th><th>רגיל</th><th>125%</th><th>150%</th><th>סה"כ</th></tr></thead><tbody>${body}<tr class="tot"><td colspan="2">סיכום</td><td>${fmtH(gr)}</td><td>${fmtH(g125)}</td><td>${fmtH(g150)}</td><td>${fmtH(gr + g125 + g150)}</td></tr></tbody></table>`;
    }).join("");
    const html = `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>דוח שכר ${monLabel}</title>
      <style>body{font-family:Arial,sans-serif;direction:rtl;padding:24px;color:#111}h1{font-size:20px}h3{margin:18px 0 6px;font-size:15px}table{width:100%;border-collapse:collapse;margin-bottom:10px}th,td{border:1px solid #ccc;padding:5px 8px;font-size:12px;text-align:center}th{background:#f3f3f3}.tot{background:#fafafa;font-weight:bold}@media print{body{padding:0}}</style></head>
      <body><h1>דוח נוכחות לשכר — ${monLabel}</h1><div style="font-size:12px;color:#666;margin-bottom:14px">חתך לפי ${cutLabel} · הופק ${new Date().toLocaleDateString("he-IL")}</div>${sections}
      <script>window.onload=function(){window.print()}</script></body></html>`;
    const w = window.open("", "_blank");
    if (!w) { showToast("חלון ההדפסה נחסם"); return; }
    w.document.write(html); w.document.close();
  }

  const btn = (bg: string, brd: string, col: string): React.CSSProperties => ({ padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", borderRadius: 9, background: bg, border: `1px solid ${brd}`, color: col, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 });
  const codeInput: React.CSSProperties = { background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, borderRadius: 7, color: "#fff", fontSize: 12, padding: "4px 8px", width: 56, fontFamily: "inherit", outline: "none", textAlign: "center" };
  const cell: React.CSSProperties = { padding: "5px 8px", fontSize: 12 };
  const pInput: React.CSSProperties = { background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, borderRadius: 6, color: "#fff", fontSize: 12, padding: "3px 6px", width: 90, fontFamily: "inherit", outline: "none" };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${GB}`, borderRadius: 8, color: "#fff", padding: "5px 10px", fontSize: 12, fontFamily: "inherit", cursor: "pointer", colorScheme: "dark" }} />
        {loading && <span style={{ fontSize: 11, color: GM }}>טוען...</span>}
      </div>

      {/* Payroll bureau file */}
      <div style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${GB}`, borderRadius: 16, padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 12 }}>🧾 קובץ שכר לתוכנת שכר</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: GM }}>פורמט:</span>
          <select value={vendor} onChange={e => setVendor(e.target.value as PayrollVendor)} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, borderRadius: 8, color: "#fff", padding: "6px 12px", fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}>
            {(Object.keys(VENDOR_LABELS) as PayrollVendor[]).map(v => <option key={v} value={v} style={{ background: "#1a1a2e" }}>{VENDOR_LABELS[v]}</option>)}
          </select>
          <button onClick={generatePayrollFile} style={btn(ACCENT_GRAD, "transparent", "#fff")}>⬇️ הפק קובץ ({employees.length} עובדים)</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap", fontSize: 12, color: GM }}>
          <span>קודי רכיב שכר:</span>
          <span>רגיל</span><input value={settings.regularCode} onChange={e => { setSettings(s => ({ ...s, regularCode: e.target.value })); setDirty(true); }} style={codeInput} />
          <span style={{ color: "#FB923C" }}>125%</span><input value={settings.ot125Code} onChange={e => { setSettings(s => ({ ...s, ot125Code: e.target.value })); setDirty(true); }} style={codeInput} />
          <span style={{ color: "#F87171" }}>150%</span><input value={settings.ot150Code} onChange={e => { setSettings(s => ({ ...s, ot150Code: e.target.value })); setDirty(true); }} style={codeInput} />
        </div>
        <div style={{ fontSize: 10, color: GM, marginTop: 10, lineHeight: 1.6 }}>הקודים הם רכיבי השכר כפי שמוגדרים אצל לשכת השכר. מומלץ לאמת את מבנה הקובץ מול מפרט הקליטה של התוכנה לפני הרצת שכר.</div>
      </div>

      {/* Manager reports by cut */}
      <div style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${GB}`, borderRadius: 16, padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 12 }}>📑 דוחות מנהלים</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: GM }}>חתך:</span>
          {(["employee", "department", "project"] as Cut[]).map(c => (
            <button key={c} onClick={() => setCut(c)} style={{ padding: "5px 13px", fontSize: 12, fontWeight: 700, cursor: "pointer", borderRadius: 8, background: cut === c ? "rgba(245,158,11,0.2)" : "transparent", border: cut === c ? "1px solid rgba(245,158,11,0.45)" : `1px solid ${GB}`, color: cut === c ? "#FBBF24" : GM, fontFamily: "inherit" }}>
              {c === "employee" ? "לפי עובד" : c === "department" ? "לפי מחלקה" : "לפי פרויקט"}
            </button>
          ))}
          <button onClick={exportExcel} style={{ ...btn("rgba(34,197,94,0.15)", "rgba(34,197,94,0.35)", "#4ade80"), marginRight: "auto" }}>📊 Excel</button>
          <button onClick={exportPdf} style={btn("rgba(239,68,68,0.15)", "rgba(239,68,68,0.35)", "#F87171")}>📄 PDF</button>
        </div>
      </div>

      {/* Employee payroll profiles */}
      <div style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${GB}`, borderRadius: 16, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>👥 פרטי עובדים לשכר</div>
          {canEdit && <button onClick={save} disabled={!dirty || saving} style={{ ...btn(dirty ? ACCENT_GRAD : "rgba(255,255,255,0.06)", "transparent", "#fff"), marginRight: "auto", opacity: !dirty || saving ? 0.5 : 1 }}>{saving ? "שומר..." : "💾 שמור"}</button>}
        </div>
        {!canEdit && <div style={{ fontSize: 11, color: "#FBBF24", marginBottom: 10 }}>👁️ תצוגה בלבד — אין לך הרשאה לעריכה</div>}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>{["עובד", "מספר עובד", 'ת"ז', "מחלקה", "פרויקט"].map(h => (
                <th key={h} style={{ fontSize: 11, fontWeight: 700, color: GM, textAlign: "right", padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {staff.map(member => {
                const p = prof(member.id);
                return (
                  <tr key={member.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ ...cell, color: "#fff", fontWeight: 600, whiteSpace: "nowrap" }}>{member.name}</td>
                    <td style={cell}><input value={p.employeeNo} disabled={!canEdit} onChange={e => setProf(member.id, { employeeNo: e.target.value })} style={pInput} placeholder="—" /></td>
                    <td style={cell}><input value={p.idNumber} disabled={!canEdit} onChange={e => setProf(member.id, { idNumber: e.target.value })} style={pInput} placeholder="—" /></td>
                    <td style={cell}><input value={p.department} disabled={!canEdit} onChange={e => setProf(member.id, { department: e.target.value })} style={pInput} placeholder="כללי" /></td>
                    <td style={cell}><input value={p.project} disabled={!canEdit} onChange={e => setProf(member.id, { project: e.target.value })} style={pInput} placeholder="—" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
