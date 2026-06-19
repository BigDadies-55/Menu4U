"use client";
import React, { useState, useEffect, useCallback } from "react";
import { AssistantWidget } from "@/components/admin/AssistantWidget";

// ── Types ──────────────────────────────────────────────────────────────────────
type ShiftRow = {
  id: string;
  userId: string;
  userName: string;
  date: string;
  shiftType: string;
  startTime: string;
  endTime: string;
  role: string | null;
  notes: string | null;
  status: string;
};

interface Props {
  restaurants: { id: string; name: string; openingHours?: string | null }[];
  currentUserId: string;
  currentUserRole: string;
  currentUserName: string;
}

// ── Shift type config ─────────────────────────────────────────────────────────
type ShiftTypeCfg = {
  key: string;
  label: string;
  startTime: string;
  endTime: string;
  color: string;
  visible: boolean;
};

const COLOR_BG: Record<string, string> = {
  "#f59e0b": "#fffbeb",
  "#3b82f6": "#eff6ff",
  "#a855f7": "#faf5ff",
  "#6b7280": "#f9fafb",
  "#ef4444": "#fef2f2",
  "#10b981": "#ecfdf5",
  "#f97316": "#fff7ed",
  "#ec4899": "#fdf2f8",
};
const PRESET_COLORS = Object.keys(COLOR_BG);

const DEFAULT_CFG: ShiftTypeCfg[] = [
  { key: "MORNING",   label: "בוקר",    startTime: "07:00", endTime: "15:00", color: "#f59e0b", visible: true },
  { key: "AFTERNOON", label: "צהריים",  startTime: "12:00", endTime: "20:00", color: "#3b82f6", visible: true },
  { key: "EVENING",   label: "ערב",     startTime: "17:00", endTime: "01:00", color: "#a855f7", visible: true },
  { key: "NIGHT",     label: "לילה",    startTime: "22:00", endTime: "06:00", color: "#6b7280", visible: true },
];

// Glass shift color map — maps hex color → glass theme bg/text/border
const GLASS_SHIFT: Record<string, { bg: string; text: string; border: string }> = {
  "#f59e0b": { bg: "rgba(245,158,11,0.15)",  text: "#FCD34D", border: "rgba(245,158,11,0.3)"  },
  "#3b82f6": { bg: "rgba(59,130,246,0.15)",  text: "#60A5FA", border: "rgba(59,130,246,0.3)"  },
  "#a855f7": { bg: "rgba(168,85,247,0.15)",  text: "#C084FC", border: "rgba(168,85,247,0.3)"  },
  "#6b7280": { bg: "rgba(107,114,128,0.15)", text: "#9CA3AF", border: "rgba(107,114,128,0.3)" },
  "#ef4444": { bg: "rgba(239,68,68,0.15)",   text: "#F87171", border: "rgba(239,68,68,0.3)"   },
  "#10b981": { bg: "rgba(16,185,129,0.15)",  text: "#34D399", border: "rgba(16,185,129,0.3)"  },
  "#f97316": { bg: "rgba(249,115,22,0.15)",  text: "#FB923C", border: "rgba(249,115,22,0.3)"  },
  "#ec4899": { bg: "rgba(236,72,153,0.15)",  text: "#F472B6", border: "rgba(236,72,153,0.3)"  },
};
function glassShift(color: string) {
  return GLASS_SHIFT[color] ?? { bg: "rgba(255,255,255,0.08)", text: "#fff", border: "rgba(255,255,255,0.2)" };
}

function cfgToDisplay(cfg: ShiftTypeCfg[]): Record<string, { label: string; time: string; color: string; bg: string }> {
  return Object.fromEntries(
    cfg.filter(c => c.visible).map(c => [
      c.key,
      {
        label: c.label,
        time: `${c.startTime.slice(0, 5)}–${c.endTime.slice(0, 5)}`,
        color: c.color,
        bg: COLOR_BG[c.color] ?? "#f9fafb",
      },
    ])
  );
}

const MONTHS_HE = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

// ── Week helpers ──────────────────────────────────────────────────────────────
function getWeekDates(offset: number): Date[] {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - day + offset * 7);
  sunday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return d;
  });
}

function formatDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function weekLabel(dates: Date[]): string {
  const first = dates[0];
  const last = dates[6];
  const sameMonth = first.getMonth() === last.getMonth();
  if (sameMonth) {
    return `${first.getDate()}–${last.getDate()} ${MONTHS_HE[first.getMonth()]} ${first.getFullYear()}`;
  }
  return `${first.getDate()} ${MONTHS_HE[first.getMonth()]} – ${last.getDate()} ${MONTHS_HE[last.getMonth()]} ${last.getFullYear()}`;
}

function calcHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  let startMins = sh * 60 + (sm || 0);
  let endMins = eh * 60 + (em || 0);
  if (endMins <= startMins) endMins += 24 * 60;
  return (endMins - startMins) / 60;
}

// ── Glass design tokens ───────────────────────────────────────────────────────
const GB          = "rgba(255,255,255,0.14)";   // glass border
const GC          = "rgba(255,255,255,0.04)";   // glass card bg
const GM          = "rgba(255,255,255,0.55)";   // glass muted text
const ACCENT_GRAD = "linear-gradient(135deg,#D97706,#F59E0B)";
const MODAL_BG    = "rgba(18,18,30,0.98)";
const MODAL_BORDER = "rgba(255,255,255,0.18)";

// ── Main Component ────────────────────────────────────────────────────────────
export default function AttendanceManagerClient({
  restaurants,
  currentUserRole,
}: Props) {
  const isManager = ["SUPER_ADMIN", "ADMIN", "OWNER", "SHIFT_MANAGER"].includes(currentUserRole);

  const [restaurantId, setRestaurantId] = useState(restaurants[0]?.id ?? "");
  const [weekOffset, setWeekOffset] = useState(0);
  const [activeTab, setActiveTab] = useState<"attendance" | "summary" | "audit">(isManager ? "attendance" : "summary");
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [staff, setStaff] = useState<{ id: string; name: string; email?: string }[]>([]);
  const [shiftCfgList, setShiftCfgList] = useState<ShiftTypeCfg[]>(DEFAULT_CFG);
  const SHIFT_CFG = cfgToDisplay(shiftCfgList);

  // Settings modal state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editCfg, setEditCfg] = useState<ShiftTypeCfg[]>(DEFAULT_CFG);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Attendance tab
  type AttRecord = { id: string; userId: string; type: string; date: string; timestamp: string; note: string | null };
  const [attRecords, setAttRecords] = useState<AttRecord[]>([]);
  const [attMode, setAttMode] = useState<"weekly" | "monthly" | "range">("weekly");
  const [attMonth, setAttMonth] = useState(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`; });
  const [attFrom, setAttFrom] = useState("");
  const [attTo,   setAttTo]   = useState("");
  const [attLoading, setAttLoading] = useState(false);

  // Audit trail tab
  type AuditRecord = { id: string; recordId: string; changedByUserId: string; changedByName: string | null; action: string; oldValue: string | null; newValue: string | null; reason: string; createdAt: string };
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Summary tab
  const [summaryMode, setSummaryMode] = useState<"weekly" | "monthly" | "range">("weekly");
  const [summaryMonth, setSummaryMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [summaryFrom, setSummaryFrom] = useState("");
  const [summaryTo,   setSummaryTo]   = useState("");
  const [summaryShifts, setSummaryShifts] = useState<ShiftRow[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [toast, setToast] = useState<{ msg: string } | null>(null);
  const toastTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const weekDates = getWeekDates(weekOffset);

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg });
    toastTimer.current = setTimeout(() => { setToast(null); }, 3000);
  };

  // Load shift config
  useEffect(() => {
    if (!restaurantId) return;
    fetch(`/api/admin/shifts/config?restaurantId=${restaurantId}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.config)) setShiftCfgList(data.config);
      })
      .catch(() => {});
  }, [restaurantId]);

  // Load staff
  useEffect(() => {
    if (!restaurantId) return;
    fetch(`/api/admin/restaurants/${restaurantId}/users`)
      .then(r => r.json())
      .then(data => {
        const items: { user: { id: string; name: string | null; email: string } }[] = Array.isArray(data) ? data : [];
        setStaff(items.map(ru => ({ id: ru.user.id, name: ru.user.name || ru.user.email, email: ru.user.email })));
      })
      .catch(() => setStaff([]));
  }, [restaurantId]);

  // Load shifts for the current week (used as planned hours in weekly mode)
  const loadShifts = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const from = formatDateISO(weekDates[0]);
      const to = formatDateISO(weekDates[6]);
      const res = await fetch(`/api/admin/shifts?restaurantId=${restaurantId}&from=${from}&to=${to}`);
      const data = await res.json();
      setShifts(data.shifts ?? []);
    } catch {
      setShifts([]);
    }
  }, [restaurantId, weekOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadShifts(); }, [loadShifts]);

  // Load summary shifts (separate range from weekly view)
  const loadSummaryShifts = useCallback(async () => {
    if (!restaurantId) return;
    let from = "", to = "";
    if (summaryMode === "weekly") {
      from = formatDateISO(weekDates[0]);
      to   = formatDateISO(weekDates[6]);
    } else if (summaryMode === "monthly") {
      const [y, m] = summaryMonth.split("-").map(Number);
      const last = new Date(y, m, 0).getDate();
      from = `${summaryMonth}-01`;
      to   = `${summaryMonth}-${String(last).padStart(2, "0")}`;
    } else {
      if (!summaryFrom || !summaryTo) return;
      from = summaryFrom;
      to   = summaryTo;
    }
    setSummaryLoading(true);
    try {
      const res = await fetch(`/api/admin/shifts?restaurantId=${restaurantId}&from=${from}&to=${to}`);
      const data = await res.json();
      setSummaryShifts(data.shifts ?? []);
    } catch { setSummaryShifts([]); }
    finally { setSummaryLoading(false); }
  }, [restaurantId, summaryMode, summaryMonth, summaryFrom, summaryTo, weekOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (activeTab === "summary") loadSummaryShifts(); }, [activeTab, loadSummaryShifts]);

  // Load attendance
  const loadAttendance = useCallback(async () => {
    if (!restaurantId) return;
    let from = "", to = "";
    if (attMode === "weekly") {
      from = formatDateISO(weekDates[0]);
      to   = formatDateISO(weekDates[6]);
    } else if (attMode === "monthly") {
      const [y, m] = attMonth.split("-").map(Number);
      const last = new Date(y, m, 0).getDate();
      from = `${attMonth}-01`;
      to   = `${attMonth}-${String(last).padStart(2,"0")}`;
    } else {
      if (!attFrom || !attTo) return;
      from = attFrom; to = attTo;
    }
    setAttLoading(true);
    try {
      const res = await fetch(`/api/admin/attendance?restaurantId=${restaurantId}&from=${from}&to=${to}`);
      const data = await res.json();
      setAttRecords(data.records ?? []);
    } catch { setAttRecords([]); }
    finally { setAttLoading(false); }
  }, [restaurantId, attMode, attMonth, attFrom, attTo, weekOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (activeTab === "attendance") loadAttendance(); }, [activeTab, loadAttendance]);

  // Load audit trail
  const loadAudit = useCallback(async () => {
    if (!restaurantId) return;
    setAuditLoading(true);
    try {
      const res = await fetch(`/api/admin/attendance?audit=1&restaurantId=${restaurantId}`);
      const data = await res.json();
      setAuditRecords(data.audit ?? []);
    } catch { setAuditRecords([]); }
    finally { setAuditLoading(false); }
  }, [restaurantId]);

  useEffect(() => { if (activeTab === "audit") loadAudit(); }, [activeTab, loadAudit]);

  async function saveConfig() {
    setSettingsSaving(true);
    try {
      const res = await fetch("/api/admin/shifts/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, config: editCfg }),
      });
      if (res.ok) {
        setShiftCfgList(editCfg);
        setSettingsOpen(false);
        showToast("✓ הגדרות נשמרו");
      } else {
        showToast("שגיאה בשמירה");
      }
    } finally {
      setSettingsSaving(false);
    }
  }

  // ── Tab button ─────────────────────────────────────────────────────────────
  function tabBtn(id: typeof activeTab, label: React.ReactNode): React.ReactElement {
    const active = activeTab === id;
    return (
      <button
        key={id}
        onClick={() => setActiveTab(id)}
        style={{
          background: active ? ACCENT_GRAD : "none",
          color: active ? "#fff" : GM,
          border: "none",
          borderRadius: 10,
          padding: "8px 18px",
          fontSize: 13,
          fontWeight: active ? 700 : 500,
          cursor: "pointer",
          fontFamily: "inherit",
          whiteSpace: "nowrap",
          display: "flex",
          alignItems: "center",
          gap: 7,
          transition: "all 0.15s",
          boxShadow: active ? "0 4px 14px rgba(217,119,6,0.3)" : "none",
        }}
      >
        {label}
      </button>
    );
  }

  // ── Excel export helper ────────────────────────────────────────────────────
  function exportCsv(rows: string[][], filename: string) {
    const csv = "﻿" + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = filename;
    a.click();
  }

  // ── Tab: Summary ───────────────────────────────────────────────────────────
  function SummaryTab() {
    const srcShifts = summaryMode === "weekly" ? shifts : summaryShifts;
    const displayStaff = staff.length > 0 ? staff : Array.from(
      new Map(srcShifts.map(s => [s.userId, { id: s.userId, name: s.userName }])).values()
    );

    type MemberSummary = { id: string; name: string; count: number; hours: number; byType: Record<string, number> };

    const summaries: MemberSummary[] = displayStaff.map(member => {
      const memberShifts = srcShifts.filter(s => s.userId === member.id);
      let totalHours = 0;
      const byType: Record<string, number> = {};
      for (const sh of memberShifts) {
        const h = calcHours(sh.startTime, sh.endTime);
        totalHours += h;
        byType[sh.shiftType] = (byType[sh.shiftType] ?? 0) + h;
      }
      return { id: member.id, name: member.name, count: memberShifts.length, hours: totalHours, byType };
    }).filter(s => s.count > 0);

    const grandTotal = summaries.reduce((a, s) => a + s.hours, 0);

    const modeBtn = (mode: typeof summaryMode, label: string) => (
      <button onClick={() => setSummaryMode(mode)} style={{
        padding: "5px 13px", fontSize: 12, fontWeight: 700, cursor: "pointer", borderRadius: 8,
        background: summaryMode === mode ? "rgba(245,158,11,0.2)" : "transparent",
        border: summaryMode === mode ? "1px solid rgba(245,158,11,0.45)" : `1px solid ${GB}`,
        color: summaryMode === mode ? "#FBBF24" : GM, transition: "0.15s", fontFamily: "inherit",
      }}>{label}</button>
    );

    return (
      <div>
        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {modeBtn("weekly",  "שבועי")}
          {modeBtn("monthly", "חודשי")}
          {modeBtn("range",   "טווח")}
          {summaryMode === "monthly" && (
            <input type="month" value={summaryMonth} onChange={e => setSummaryMonth(e.target.value)}
              style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${GB}`, borderRadius: 8, color: "#fff", padding: "5px 10px", fontSize: 12, fontFamily: "inherit", cursor: "pointer" }} />
          )}
          {summaryMode === "range" && (<>
            <input type="date" value={summaryFrom} onChange={e => setSummaryFrom(e.target.value)}
              style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${GB}`, borderRadius: 8, color: "#fff", padding: "5px 10px", fontSize: 12, fontFamily: "inherit" }} />
            <span style={{ color: GM, fontSize: 12 }}>—</span>
            <input type="date" value={summaryTo} onChange={e => setSummaryTo(e.target.value)}
              style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${GB}`, borderRadius: 8, color: "#fff", padding: "5px 10px", fontSize: 12, fontFamily: "inherit" }} />
          </>)}
          {summaryLoading && <span style={{ fontSize: 11, color: GM }}>טוען...</span>}
          <button
            onClick={() => {
              const header = ["עובד", ...Object.values(SHIFT_CFG).map(c => c.label), 'סה"כ שעות'];
              const dataRows = summaries.map(s => [s.name, ...Object.keys(SHIFT_CFG).map(k => s.byType[k] ? s.byType[k].toFixed(1) : "0"), s.hours.toFixed(1)]);
              const totals = ["סה\"כ", ...Object.keys(SHIFT_CFG).map(k => summaries.reduce((a,s)=>a+(s.byType[k]??0),0).toFixed(1)), summaries.reduce((a,s)=>a+s.hours,0).toFixed(1)];
              exportCsv([header, ...dataRows, totals], `סיכום-שעות-${summaryMode === "monthly" ? summaryMonth : summaryFrom + "_" + summaryTo}.csv`);
            }}
            style={{ marginRight: "auto", padding: "5px 13px", fontSize: 12, fontWeight: 700, cursor: "pointer", borderRadius: 8, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)", color: "#4ade80", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}
          >
            📊 ייצא Excel
          </button>
        </div>

        {summaries.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: GM, fontSize: 14 }}>אין נתונים לתקופה זו</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ fontSize: 11, fontWeight: 700, color: GM, textAlign: "right", padding: "6px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>עובד</th>
                {Object.entries(SHIFT_CFG).map(([key, cfg]) => {
                  const gs = glassShift(cfg.color);
                  return <th key={key} style={{ fontSize: 11, fontWeight: 700, color: gs.text, textAlign: "center", padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>{cfg.label}</th>;
                })}
                <th style={{ fontSize: 11, fontWeight: 700, color: GM, textAlign: "center", padding: "6px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>סה"כ</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map(s => (
                <tr key={s.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td style={{ padding: "5px 10px", fontSize: 13, color: "#fff", fontWeight: 700 }}>{s.name}</td>
                  {Object.keys(SHIFT_CFG).map(key => (
                    <td key={key} style={{ padding: "5px 8px", fontSize: 12, color: "rgba(255,255,255,0.65)", textAlign: "center" }}>
                      {s.byType[key] ? s.byType[key].toFixed(1) : "–"}
                    </td>
                  ))}
                  <td style={{ padding: "5px 10px", textAlign: "center" }}>
                    <span style={{ background: "rgba(251,191,36,0.15)", color: "#FBBF24", borderRadius: 6, padding: "2px 8px", fontWeight: 700, fontSize: 12 }}>
                      {s.hours.toFixed(1)} ש׳
                    </span>
                  </td>
                </tr>
              ))}
              <tr style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                <td style={{ padding: "5px 10px", fontSize: 13, color: "#fff", fontWeight: 800 }}>סה"כ</td>
                {Object.keys(SHIFT_CFG).map(key => (
                  <td key={key} style={{ padding: "5px 8px", fontSize: 12, color: GM, textAlign: "center" }}>
                    {summaries.reduce((a, s) => a + (s.byType[key] ?? 0), 0).toFixed(1)}
                  </td>
                ))}
                <td style={{ padding: "5px 10px", textAlign: "center" }}>
                  <span style={{ background: "rgba(251,191,36,0.15)", color: "#FBBF24", borderRadius: 6, padding: "2px 8px", fontWeight: 800, fontSize: 13 }}>
                    {grandTotal.toFixed(1)} ש׳
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    );
  }

  // ── Tab: Attendance ────────────────────────────────────────────────────────
  function AttendanceTab() {
    const [deleteConfirm, setDeleteConfirm] = React.useState<{ id: string; label: string } | null>(null);
    const [deleteNote, setDeleteNote] = React.useState("");
    const [editTarget, setEditTarget] = React.useState<{ id: string; type: string; timestamp: string } | null>(null);
    const [editTime, setEditTime] = React.useState("");
    const [editReason, setEditReason] = React.useState("");
    const [saving, setSaving] = React.useState(false);

    const fmtT = (ts: string) => new Date(ts).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
    const typeLabel = (type: string) => (type === "IN" ? "כניסה" : "יציאה");

    async function deleteRecord(id: string, oldValue: string) {
      const reason = deleteNote.trim();
      if (!reason) return;
      setSaving(true);
      try {
        const res = await fetch(`/api/admin/attendance?id=${encodeURIComponent(id)}&note=${encodeURIComponent(reason)}&oldValue=${encodeURIComponent(oldValue)}`, { method: "DELETE" });
        if (!res.ok) { const e = await res.json().catch(() => ({})); showToast(e.error ?? "שגיאה במחיקה"); return; }
        setDeleteConfirm(null); setDeleteNote("");
        showToast("✓ הרשומה נמחקה ותועדה בלוג");
        loadAttendance();
      } finally { setSaving(false); }
    }

    async function saveEdit() {
      if (!editTarget) return;
      const reason = editReason.trim();
      if (!editTime || !reason) return;
      const d = new Date(editTarget.timestamp);
      const [h, m] = editTime.split(":").map(Number);
      d.setHours(h, m ?? 0, 0, 0);
      const oldValue = `${typeLabel(editTarget.type)} ${fmtT(editTarget.timestamp)}`;
      const newValue = `${typeLabel(editTarget.type)} ${editTime}`;
      setSaving(true);
      try {
        const res = await fetch("/api/admin/attendance", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editTarget.id, newTimestamp: d.toISOString(), reason, oldValue, newValue }),
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); showToast(e.error ?? "שגיאה בעדכון"); return; }
        setEditTarget(null); setEditTime(""); setEditReason("");
        showToast("✓ השעה עודכנה ותועדה בלוג");
        loadAttendance();
      } finally { setSaving(false); }
    }

    const displayStaff = staff.length > 0 ? staff : Array.from(
      new Map(attRecords.filter(r => r.type !== "DELETED").map(r => [r.userId, { id: r.userId, name: r.userId }])).values()
    );

    // Group all records by userId → date → sorted list
    const activeRecords = attRecords.filter(r => r.type !== "DELETED");
    type DayRecs = { id: string; type: string; timestamp: string; note: string | null }[];
    const byUserDate: Record<string, Record<string, DayRecs>> = {};
    for (const r of activeRecords) {
      if (!byUserDate[r.userId]) byUserDate[r.userId] = {};
      if (!byUserDate[r.userId][r.date]) byUserDate[r.userId][r.date] = [];
      byUserDate[r.userId][r.date].push(r);
    }

    // Calculate actual hours as sum of IN/OUT pairs per day
    function calcPairHours(recs: DayRecs): number {
      const ins  = recs.filter(r => r.type === "IN").sort((a,b) => a.timestamp.localeCompare(b.timestamp));
      const outs = recs.filter(r => r.type === "OUT").sort((a,b) => a.timestamp.localeCompare(b.timestamp));
      let total = 0;
      ins.forEach((inRec, i) => {
        const outRec = outs[i];
        if (!outRec) return;
        const diff = (new Date(outRec.timestamp).getTime() - new Date(inRec.timestamp).getTime()) / 3600000;
        if (diff > 0 && diff < 24) total += diff;
      });
      return total;
    }

    // Determine date range
    let fromDate = "", toDate = "";
    if (attMode === "weekly") { fromDate = formatDateISO(weekDates[0]); toDate = formatDateISO(weekDates[6]); }
    else if (attMode === "monthly") { const [y,m]=attMonth.split("-").map(Number); fromDate=`${attMonth}-01`; toDate=`${attMonth}-${String(new Date(y,m,0).getDate()).padStart(2,"0")}`; }
    else { fromDate = attFrom; toDate = attTo; }

    type AttSummary = { id: string; name: string; actualHours: number; plannedHours: number; dates: { date: string; recs: DayRecs; hours: number }[] };
    const summaries: AttSummary[] = displayStaff.map(member => {
      const memberShifts = (attMode === "weekly" ? shifts : summaryShifts).filter(s => s.userId === member.id);
      const plannedHours = memberShifts.reduce((a, s) => a + calcHours(s.startTime, s.endTime), 0);
      const userDates = byUserDate[member.id] ?? {};
      let totalActual = 0;
      const dates = Object.entries(userDates).sort(([a],[b]) => a.localeCompare(b)).map(([date, recs]) => {
        const hours = calcPairHours(recs);
        totalActual += hours;
        return { date, recs, hours };
      });
      return { id: member.id, name: member.name, actualHours: totalActual, plannedHours, dates };
    }).filter(s => s.dates.length > 0 || s.plannedHours > 0);

    const modeBtn = (mode: typeof attMode, label: string) => (
      <button onClick={() => setAttMode(mode)} style={{
        padding: "5px 13px", fontSize: 12, fontWeight: 700, cursor: "pointer", borderRadius: 8,
        background: attMode === mode ? "rgba(245,158,11,0.2)" : "transparent",
        border: attMode === mode ? "1px solid rgba(245,158,11,0.45)" : `1px solid ${GB}`,
        color: attMode === mode ? "#FBBF24" : GM, transition: "0.15s", fontFamily: "inherit",
      }}>{label}</button>
    );

    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {modeBtn("weekly",  "שבועי")}
          {modeBtn("monthly", "חודשי")}
          {modeBtn("range",   "טווח")}
          {attMode === "monthly" && (
            <input type="month" value={attMonth} onChange={e => setAttMonth(e.target.value)}
              style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${GB}`, borderRadius: 8, color: "#fff", padding: "5px 10px", fontSize: 12, fontFamily: "inherit" }} />
          )}
          {attMode === "range" && (<>
            <input type="date" value={attFrom} onChange={e => setAttFrom(e.target.value)}
              style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${GB}`, borderRadius: 8, color: "#fff", padding: "5px 10px", fontSize: 12, fontFamily: "inherit" }} />
            <span style={{ color: GM, fontSize: 12 }}>—</span>
            <input type="date" value={attTo} onChange={e => setAttTo(e.target.value)}
              style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${GB}`, borderRadius: 8, color: "#fff", padding: "5px 10px", fontSize: 12, fontFamily: "inherit" }} />
          </>)}
          {attLoading && <span style={{ fontSize: 11, color: GM }}>טוען...</span>}
          <button
            onClick={() => {
              const header = ["עובד", "תאריך", "רשומות", "שעות בפועל", "מתוכנן", "הפרש"];
              const rows: string[][] = [];
              for (const member of summaries) {
                const diff = member.actualHours - member.plannedHours;
                member.dates.forEach((d, di) => {
                  const recs = d.recs.map(r => `${r.type === "IN" ? "▶" : "■"}${fmtT(r.timestamp)}`).join(" ");
                  rows.push([di === 0 ? member.name : "", d.date, recs, d.hours.toFixed(1),
                    di === 0 ? member.plannedHours.toFixed(1) : "",
                    di === 0 ? (diff >= 0 ? "+" : "") + diff.toFixed(1) : ""]);
                });
              }
              exportCsv([header, ...rows], `נוכחות-${attMode === "monthly" ? attMonth : attFrom + "_" + attTo}.csv`);
            }}
            style={{ marginRight: "auto", padding: "5px 13px", fontSize: 12, fontWeight: 700, cursor: "pointer", borderRadius: 8, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)", color: "#4ade80", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}
          >📊 ייצא Excel</button>
        </div>

        {summaries.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: GM, fontSize: 14 }}>אין נתוני נוכחות לתקופה זו</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ fontSize: 11, fontWeight: 700, color: GM, textAlign: "right", padding: "6px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>עובד</th>
                <th style={{ fontSize: 11, fontWeight: 700, color: GM, textAlign: "center", padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>תאריך</th>
                <th style={{ fontSize: 11, fontWeight: 700, color: GM, textAlign: "right", padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>רשומות</th>
                <th style={{ fontSize: 11, fontWeight: 700, color: "#FBBF24", textAlign: "center", padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>בפועל</th>
                <th style={{ fontSize: 11, fontWeight: 700, color: GM, textAlign: "center", padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>מתוכנן</th>
                <th style={{ fontSize: 11, fontWeight: 700, color: GM, textAlign: "center", padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>הפרש</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map(member => {
                const diff = member.actualHours - member.plannedHours;
                return (
                  <React.Fragment key={member.id}>
                    {member.dates.map((d, di) => (
                      <tr key={d.date} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        {di === 0 && (
                          <td rowSpan={member.dates.length} style={{ padding: "5px 10px", fontSize: 13, color: "#fff", fontWeight: 700, verticalAlign: "middle", borderLeft: "2px solid rgba(255,255,255,0.08)" }}>
                            {member.name}
                            {member.dates.length > 1 && (
                              <div style={{ fontSize: 10, color: GM, marginTop: 2 }}>סה"כ: {member.actualHours.toFixed(1)} ש׳</div>
                            )}
                          </td>
                        )}
                        <td style={{ padding: "5px 8px", fontSize: 12, color: GM, textAlign: "center", whiteSpace: "nowrap" }}>{d.date.slice(5).replace("-","/")}</td>
                        <td style={{ padding: "5px 8px", fontSize: 11 }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {d.recs.sort((a,b) => a.timestamp.localeCompare(b.timestamp)).map(r => (
                              <span key={r.id} style={{
                                display: "inline-flex", alignItems: "center", gap: 3,
                                background: r.type === "IN" ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)",
                                color: r.type === "IN" ? "#34D399" : "#F87171",
                                border: `1px solid ${r.type === "IN" ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
                                borderRadius: 5, padding: "1px 6px", fontWeight: 600,
                              }}>
                                {r.type === "IN" ? "▶" : "■"} {fmtT(r.timestamp)}
                                {isManager && (
                                  <>
                                    <button
                                      onClick={() => { setEditTarget({ id: r.id, type: r.type, timestamp: r.timestamp }); setEditTime(fmtT(r.timestamp)); setEditReason(""); }}
                                      title="ערוך שעה"
                                      style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: 10, padding: "0 0 0 2px", lineHeight: 1, fontFamily: "inherit" }}
                                      onMouseEnter={e => (e.currentTarget.style.color = "#FBBF24")}
                                      onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
                                    >✎</button>
                                    <button
                                      onClick={() => { setDeleteConfirm({ id: r.id, label: `${typeLabel(r.type)} ${fmtT(r.timestamp)}` }); setDeleteNote(""); }}
                                      title="מחק רשומה"
                                      style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: 10, padding: "0 0 0 2px", lineHeight: 1, fontFamily: "inherit" }}
                                      onMouseEnter={e => (e.currentTarget.style.color = "#F87171")}
                                      onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
                                    >✕</button>
                                  </>
                                )}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: "5px 8px", textAlign: "center", whiteSpace: "nowrap" }}>
                          {d.hours > 0
                            ? <span style={{ background: "rgba(251,191,36,0.15)", color: "#FBBF24", borderRadius: 6, padding: "2px 7px", fontSize: 11, fontWeight: 700 }}>{d.hours.toFixed(1)} ש׳</span>
                            : <span style={{ color: GM, fontSize: 11 }}>—</span>}
                        </td>
                        {di === 0 && (
                          <>
                            <td rowSpan={member.dates.length} style={{ padding: "5px 8px", textAlign: "center", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                              <span style={{ background: "rgba(255,255,255,0.06)", color: GM, borderRadius: 6, padding: "2px 7px", fontSize: 11 }}>{member.plannedHours.toFixed(1)} ש׳</span>
                            </td>
                            <td rowSpan={member.dates.length} style={{ padding: "5px 8px", textAlign: "center", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                              <span style={{ background: diff >= 0 ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)", color: diff >= 0 ? "#34D399" : "#F87171", borderRadius: 6, padding: "2px 7px", fontSize: 11, fontWeight: 700 }}>
                                {diff >= 0 ? "+" : ""}{diff.toFixed(1)} ש׳
                              </span>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
        {fromDate && <div style={{ fontSize: 10, color: GM, marginTop: 10, textAlign: "center" }}>{fromDate} — {toDate}</div>}

        {/* Manager delete confirmation */}
        {deleteConfirm && (
          <div onClick={() => setDeleteConfirm(null)} style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "rgba(18,17,28,0.98)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 16, padding: 24, width: 320, maxWidth: "92vw", direction: "rtl", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 6 }}>מחיקת רשומת נוכחות</div>
              <div style={{ fontSize: 13, color: GM, marginBottom: 14 }}>{deleteConfirm.label}</div>
              <label style={{ fontSize: 12, color: GM, display: "block", marginBottom: 5 }}>סיבת השינוי <span style={{ color: "#F87171" }}>*</span></label>
              <input
                type="text" value={deleteNote} onChange={e => setDeleteNote(e.target.value)}
                placeholder="למשל: שכחתי להחתים"
                autoFocus
                style={{ width: "100%", padding: "8px 11px", borderRadius: 9, background: "rgba(255,255,255,0.07)", border: `1px solid ${GB}`, color: "#fff", fontSize: 13, outline: "none", marginBottom: 14, fontFamily: "inherit", boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => deleteRecord(deleteConfirm.id, deleteConfirm.label)} disabled={saving || !deleteNote.trim()} style={{ flex: 1, padding: "9px", borderRadius: 9, border: "none", background: "#ef4444", color: "#fff", fontWeight: 700, fontSize: 13, cursor: deleteNote.trim() ? "pointer" : "not-allowed", fontFamily: "inherit", opacity: saving || !deleteNote.trim() ? 0.5 : 1 }}>אשר מחיקה</button>
                <button onClick={() => setDeleteConfirm(null)} style={{ padding: "9px 16px", borderRadius: 9, background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, color: GM, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>ביטול</button>
              </div>
            </div>
          </div>
        )}

        {/* Manager edit (manual time correction) */}
        {editTarget && (
          <div onClick={() => setEditTarget(null)} style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "rgba(18,17,28,0.98)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 16, padding: 24, width: 320, maxWidth: "92vw", direction: "rtl", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 6 }}>עריכת שעת {typeLabel(editTarget.type)}</div>
              <div style={{ fontSize: 13, color: GM, marginBottom: 14 }}>שעה מקורית: {fmtT(editTarget.timestamp)}</div>
              <label style={{ fontSize: 12, color: GM, display: "block", marginBottom: 5 }}>שעה חדשה <span style={{ color: "#F87171" }}>*</span></label>
              <input
                type="time" value={editTime} onChange={e => setEditTime(e.target.value)}
                style={{ width: "100%", padding: "8px 11px", borderRadius: 9, background: "rgba(255,255,255,0.07)", border: `1px solid ${GB}`, color: "#fff", fontSize: 13, outline: "none", marginBottom: 12, fontFamily: "inherit", boxSizing: "border-box", colorScheme: "dark" }}
              />
              <label style={{ fontSize: 12, color: GM, display: "block", marginBottom: 5 }}>סיבת השינוי <span style={{ color: "#F87171" }}>*</span></label>
              <input
                type="text" value={editReason} onChange={e => setEditReason(e.target.value)}
                placeholder="למשל: שכחתי להחתים"
                style={{ width: "100%", padding: "8px 11px", borderRadius: 9, background: "rgba(255,255,255,0.07)", border: `1px solid ${GB}`, color: "#fff", fontSize: 13, outline: "none", marginBottom: 14, fontFamily: "inherit", boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={saveEdit} disabled={saving || !editTime || !editReason.trim()} style={{ flex: 1, padding: "9px", borderRadius: 9, border: "none", background: ACCENT_GRAD, color: "#fff", fontWeight: 700, fontSize: 13, cursor: editTime && editReason.trim() ? "pointer" : "not-allowed", fontFamily: "inherit", opacity: saving || !editTime || !editReason.trim() ? 0.5 : 1 }}>{saving ? "שומר..." : "שמור שינוי"}</button>
                <button onClick={() => setEditTarget(null)} style={{ padding: "9px 16px", borderRadius: 9, background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, color: GM, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>ביטול</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Tab: Audit Trail ───────────────────────────────────────────────────────
  function AuditTab() {
    const fmtDT = (ts: string) => new Date(ts).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const actionLabel = (a: string) => (a === "DELETE" ? "מחיקה" : a === "EDIT" ? "עריכת שעה" : a);
    const actionColor = (a: string) => (a === "DELETE" ? "#F87171" : "#FBBF24");

    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: GM }}>
            לוג שינויים — 500 הרשומות האחרונות
          </div>
          {auditLoading && <span style={{ fontSize: 11, color: GM }}>טוען...</span>}
          <button
            onClick={() => {
              const header = ["מתי", "פעולה", "מי ביצע", "ערך קודם", "ערך חדש", "סיבה", "מזהה רשומה"];
              const rows = auditRecords.map(a => [fmtDT(a.createdAt), actionLabel(a.action), a.changedByName ?? a.changedByUserId, a.oldValue ?? "", a.newValue ?? "", a.reason, a.recordId]);
              exportCsv([header, ...rows], `לוג-שינויים-נוכחות.csv`);
            }}
            style={{ marginRight: "auto", padding: "5px 13px", fontSize: 12, fontWeight: 700, cursor: "pointer", borderRadius: 8, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)", color: "#4ade80", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}
          >📊 ייצא Excel</button>
        </div>

        {auditRecords.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: GM, fontSize: 14 }}>לא תועדו שינויים עדיין</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["מתי", "פעולה", "מי ביצע", "ערך קודם", "ערך חדש", "סיבה"].map(h => (
                    <th key={h} style={{ fontSize: 11, fontWeight: 700, color: GM, textAlign: "right", padding: "6px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {auditRecords.map(a => (
                  <tr key={a.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "6px 10px", fontSize: 12, color: GM, whiteSpace: "nowrap" }}>{fmtDT(a.createdAt)}</td>
                    <td style={{ padding: "6px 10px", whiteSpace: "nowrap" }}>
                      <span style={{ background: `${actionColor(a.action)}22`, color: actionColor(a.action), borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{actionLabel(a.action)}</span>
                    </td>
                    <td style={{ padding: "6px 10px", fontSize: 13, color: "#fff", whiteSpace: "nowrap" }}>{a.changedByName ?? a.changedByUserId}</td>
                    <td style={{ padding: "6px 10px", fontSize: 12, color: "rgba(255,255,255,0.65)", whiteSpace: "nowrap" }}>{a.oldValue ?? "–"}</td>
                    <td style={{ padding: "6px 10px", fontSize: 12, color: "rgba(255,255,255,0.65)", whiteSpace: "nowrap" }}>{a.newValue ?? "–"}</td>
                    <td style={{ padding: "6px 10px", fontSize: 12, color: "#fff" }}>{a.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700;900&display=swap');
    `}</style>
    <div style={{
      minHeight: "100vh",
      color: "#fff",
      fontFamily: "'Heebo', sans-serif",
      direction: "rtl",
      padding: 20,
    }}>
      <div style={{ maxWidth: 1500, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Toast */}
        {toast && (
          <div style={{
            position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 2000,
            background: MODAL_BG, border: `1px solid ${MODAL_BORDER}`, borderRadius: 14,
            color: "#fff", fontSize: 14, fontWeight: 600, padding: "10px 18px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)", whiteSpace: "nowrap",
            display: "flex", alignItems: "center", gap: 12, direction: "rtl",
          }}>
            <span>{toast.msg}</span>
          </div>
        )}

        {/* Settings modal */}
        {settingsOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "5vh 0 5vh" }}>
            <div style={{ background: MODAL_BG, border: `1px solid ${MODAL_BORDER}`, borderRadius: 18, padding: "18px 20px", width: 520, maxWidth: "95vw", direction: "rtl", boxShadow: "0 24px 64px rgba(0,0,0,0.6)", flexShrink: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 12 }}>⚙️ הגדרות סוגי משמרת</div>

              {editCfg.map((cfg, idx) => (
                <div key={cfg.key} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${GB}`, borderRadius: 10, padding: "8px 12px", marginBottom: 6 }}>
                  {/* Single row: switch + label + times + colors + remove */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {/* Switch */}
                    <div
                      onClick={() => setEditCfg(prev => prev.map((c, i) => i === idx ? { ...c, visible: !c.visible } : c))}
                      style={{ position: "relative", width: 34, height: 19, borderRadius: 10, background: cfg.visible ? cfg.color : "rgba(255,255,255,0.15)", cursor: "pointer", flexShrink: 0, transition: "background 0.2s" }}
                    >
                      <div style={{ position: "absolute", top: 2, right: cfg.visible ? 2 : undefined, left: cfg.visible ? undefined : 2, width: 15, height: 15, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.3)", transition: "all 0.2s" }} />
                    </div>

                    {/* Label */}
                    <input
                      value={cfg.label}
                      onChange={e => setEditCfg(prev => prev.map((c, i) => i === idx ? { ...c, label: e.target.value } : c))}
                      style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, borderRadius: 7, color: "#fff", fontSize: 13, fontWeight: 700, padding: "3px 7px", width: 70, fontFamily: "inherit", outline: "none" }}
                      placeholder="שם"
                    />

                    {/* Times */}
                    <span style={{ fontSize: 11, color: GM }}>מ-</span>
                    <input
                      type="text"
                      value={cfg.startTime}
                      onChange={e => setEditCfg(prev => prev.map((c, i) => i === idx ? { ...c, startTime: e.target.value } : c))}
                      placeholder="HH:MM"
                      maxLength={5}
                      style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, borderRadius: 7, color: "#fff", fontSize: 12, padding: "3px 5px", fontFamily: "inherit", outline: "none", width: 54, textAlign: "center" }}
                    />
                    <span style={{ fontSize: 11, color: GM }}>עד-</span>
                    <input
                      type="text"
                      value={cfg.endTime}
                      onChange={e => setEditCfg(prev => prev.map((c, i) => i === idx ? { ...c, endTime: e.target.value } : c))}
                      placeholder="HH:MM"
                      maxLength={5}
                      style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, borderRadius: 7, color: "#fff", fontSize: 12, padding: "3px 5px", fontFamily: "inherit", outline: "none", width: 54, textAlign: "center" }}
                    />

                    {/* Color dots */}
                    <div style={{ display: "flex", gap: 4, flex: 1, justifyContent: "center" }}>
                      {PRESET_COLORS.map(c => (
                        <button
                          key={c}
                          onClick={() => setEditCfg(prev => prev.map((cf, i) => i === idx ? { ...cf, color: c } : cf))}
                          style={{ width: 16, height: 16, borderRadius: "50%", background: c, border: cfg.color === c ? "2px solid #fff" : "2px solid transparent", cursor: "pointer", outline: cfg.color === c ? `2px solid ${c}` : "none", boxSizing: "border-box", flexShrink: 0 }}
                          title={c}
                        />
                      ))}
                    </div>

                    {/* Remove */}
                    <button
                      onClick={() => setEditCfg(prev => prev.filter((_, i) => i !== idx))}
                      style={{ background: "transparent", border: "none", color: "#F87171", fontSize: 14, cursor: "pointer", padding: "0 2px", lineHeight: 1, flexShrink: 0 }}
                      title="הסר"
                    >✕</button>
                  </div>
                </div>
              ))}

              {/* Add new shift type */}
              <button
                onClick={() => {
                  const key = `CUSTOM_${Date.now()}`;
                  setEditCfg(prev => [...prev, { key, label: "משמרת חדשה", startTime: "08:00", endTime: "16:00", color: "#10b981", visible: true }]);
                }}
                style={{ width: "100%", background: "transparent", border: `1.5px dashed ${GB}`, borderRadius: 9, color: GM, fontSize: 13, padding: "7px", cursor: "pointer", fontFamily: "inherit", marginTop: 4 }}
              >
                ＋ הוסף סוג משמרת
              </button>

              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button
                  onClick={saveConfig}
                  disabled={settingsSaving}
                  style={{ flex: 1, background: ACCENT_GRAD, border: "none", borderRadius: 9, color: "#fff", fontSize: 14, fontWeight: 800, padding: 10, cursor: "pointer", fontFamily: "inherit", opacity: settingsSaving ? 0.6 : 1, boxShadow: "0 4px 14px rgba(217,119,6,0.35)" }}
                >
                  {settingsSaving ? "שומר..." : "שמור"}
                </button>
                <button
                  onClick={() => setSettingsOpen(false)}
                  style={{ flex: 1, background: "rgba(255,255,255,0.07)", border: `1px solid ${GB}`, borderRadius: 9, color: GM, fontSize: 14, padding: 10, cursor: "pointer", fontFamily: "inherit" }}
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── NAVBAR ── */}
        <header style={{
          background: GC,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: `1px solid ${GB}`,
          borderRadius: 18,
          padding: "14px 22px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}>
          {/* Right: title + restaurant selector */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 22, fontWeight: 900, display: "flex", alignItems: "center", gap: 8 }}>
              🕐 ניהול נוכחות
            </div>
            {restaurants.length > 1 && (
              <select
                value={restaurantId}
                onChange={e => setRestaurantId(e.target.value)}
                style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, color: "#fff", padding: "6px 12px", borderRadius: 9, fontFamily: "Heebo, sans-serif", fontSize: 13, cursor: "pointer", appearance: "none", WebkitAppearance: "none", minWidth: 150 }}
              >
                {restaurants.map(r => (
                  <option key={r.id} value={r.id} style={{ background: "#1a1a2e" }}>{r.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Left: date nav + action buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Date nav */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(0,0,0,0.25)", border: `1px solid ${GB}`, borderRadius: 10, padding: "4px 6px" }}>
              <button
                onClick={() => setWeekOffset(w => w - 1)}
                style={{ background: "none", border: "none", color: GM, cursor: "pointer", padding: "4px 8px", borderRadius: 7, display: "flex", alignItems: "center", transition: "0.15s", fontSize: 16 }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#fff"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = GM; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
              >‹</button>
              <span style={{ fontSize: 14, fontWeight: 700, padding: "0 10px", whiteSpace: "nowrap" }}>{weekLabel(weekDates)}</span>
              <button
                onClick={() => setWeekOffset(w => w + 1)}
                style={{ background: "none", border: "none", color: GM, cursor: "pointer", padding: "4px 8px", borderRadius: 7, display: "flex", alignItems: "center", transition: "0.15s", fontSize: 16 }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#fff"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = GM; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
              >›</button>
            </div>

            {isManager && (
              <>
                <button
                  onClick={() => { setEditCfg(shiftCfgList); setSettingsOpen(true); }}
                  style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, color: "#fff", padding: "7px 13px", borderRadius: 9, fontFamily: "inherit", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "0.15s" }}
                >
                  ⚙️ הגדרות
                </button>
                <button
                  onClick={() => {
                    if (activeTab === "summary") loadSummaryShifts();
                    else if (activeTab === "attendance") loadAttendance();
                    else if (activeTab === "audit") loadAudit();
                    loadShifts();
                  }}
                  style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, color: "#fff", padding: "7px 13px", borderRadius: 9, fontFamily: "inherit", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "0.15s" }}
                >
                  🔄 רענון
                </button>
              </>
            )}
          </div>
        </header>

        {/* ── TAB BAR ── */}
        <div style={{
          background: "rgba(0,0,0,0.18)",
          border: `1px solid ${GB}`,
          borderRadius: 14,
          padding: 5,
          display: "flex",
          gap: 5,
          alignSelf: "flex-start",
          overflowX: "auto",
        }}>
          {isManager && tabBtn("attendance", "🕐 נוכחות")}
          {tabBtn("summary", "📊 סיכום שעות")}
          {isManager && tabBtn("audit", "📜 לוג שינויים")}
        </div>

        {/* ── TAB PANEL ── */}
        <div style={{
          background: "rgba(255,255,255,0.025)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: `1px solid ${GB}`,
          borderRadius: 22,
          padding: 22,
          boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
          minHeight: 300,
        }}>
          {activeTab === "attendance" && <AttendanceTab />}
          {activeTab === "summary"    && <SummaryTab />}
          {activeTab === "audit"      && <AuditTab />}
        </div>

      </div>
    </div>
    <AssistantWidget page="attendance" />
    </>
  );
}
