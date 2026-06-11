"use client";
import React, { useState, useEffect, useCallback } from "react";
import { T } from "@/lib/ui";

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

type RequestRow = {
  id: string;
  shiftId: string;
  type: string;
  reason: string | null;
  status: string;
  fromUserName: string;
  toUserName: string | null;
  shiftDate: string;
  shiftType: string;
  createdAt: string;
};

interface Props {
  restaurants: { id: string; name: string }[];
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

const DAYS_HE = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "שבת"];
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

function formatDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
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

// ── Main Component ────────────────────────────────────────────────────────────
export default function ShiftsClient({
  restaurants,
  currentUserId,
  currentUserRole,
  currentUserName,
}: Props) {
  const isManager = ["SUPER_ADMIN", "ADMIN", "OWNER", "SHIFT_MANAGER"].includes(currentUserRole);

  const [restaurantId, setRestaurantId] = useState(restaurants[0]?.id ?? "");
  const [weekOffset, setWeekOffset] = useState(0);
  const [activeTab, setActiveTab] = useState<"schedule" | "myshifts" | "requests" | "summary" | "ops">("schedule");
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [shiftCfgList, setShiftCfgList] = useState<ShiftTypeCfg[]>(DEFAULT_CFG);
  const SHIFT_CFG = cfgToDisplay(shiftCfgList);

  // Settings modal state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editCfg, setEditCfg] = useState<ShiftTypeCfg[]>(DEFAULT_CFG);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Add shift modal state
  const [addModal, setAddModal] = useState<{ userId: string; userName: string; date: string } | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  // Swap request state
  const [swapModal, setSwapModal] = useState<ShiftRow | null>(null);
  const [swapReason, setSwapReason] = useState("");
  const [swapLoading, setSwapLoading] = useState(false);

  // SMS modal
  const [smsModal, setSmsModal] = useState(false);
  const [smsTarget, setSmsTarget] = useState<"all" | string>("all");
  const [smsSending, setSmsSending] = useState(false);

  // Operational tab data
  type SmsLog = { id: string; recipientName: string; phone: string; message: string; status: string; sentAt: string; weekFrom: string; weekTo: string };
  type SmsStat = { week: string; total: number; failed: number };
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
  const [smsStats, setSmsStats] = useState<SmsStat[]>([]);
  const [smsConfigured, setSmsConfigured] = useState(true);
  const [opsLoading, setOpsLoading] = useState(false);

  const [toast, setToast] = useState<{ msg: string; undo?: () => void } | null>(null);
  const toastTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [undoShifts, setUndoShifts] = useState<ShiftRow[] | null>(null);

  const weekDates = getWeekDates(weekOffset);

  const showToast = (msg: string, undo?: () => void) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, undo });
    toastTimer.current = setTimeout(() => { setToast(null); }, undo ? 6000 : 3000);
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
        setStaff(items.map(ru => ({ id: ru.user.id, name: ru.user.name || ru.user.email })));
      })
      .catch(() => setStaff([]));
  }, [restaurantId]);

  // Load shifts
  const loadShifts = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const from = formatDateISO(weekDates[0]);
      const to = formatDateISO(weekDates[6]);
      const res = await fetch(`/api/admin/shifts?restaurantId=${restaurantId}&from=${from}&to=${to}`);
      const data = await res.json();
      setShifts(data.shifts ?? []);
    } catch {
      setShifts([]);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, weekOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadShifts(); }, [loadShifts]);

  // Load requests
  const loadRequests = useCallback(async () => {
    if (!restaurantId) return;
    setRequestsLoading(true);
    try {
      const statusParam = isManager ? "PENDING" : "";
      const res = await fetch(
        `/api/admin/shifts/requests?restaurantId=${restaurantId}${statusParam ? `&status=${statusParam}` : ""}`
      );
      const data = await res.json();
      setRequests(data.requests ?? data ?? []);
    } catch {
      setRequests([]);
    } finally {
      setRequestsLoading(false);
    }
  }, [restaurantId, isManager]);

  useEffect(() => {
    if (activeTab === "requests") loadRequests();
  }, [activeTab, loadRequests]);

  // Delete shift
  async function deleteShift(id: string) {
    if (!confirm("למחוק משמרת זו?")) return;
    const res = await fetch(`/api/admin/shifts/${id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("✓ משמרת נמחקה");
      loadShifts();
    } else {
      showToast("שגיאה במחיקה");
    }
  }

  // Add shift
  async function addShift(shiftType: string) {
    if (!addModal || addLoading) return;
    setAddLoading(true);
    try {
      const res = await fetch("/api/admin/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          userId: addModal.userId,
          date: addModal.date,
          shiftType,
        }),
      });
      if (res.ok) {
        showToast("✓ משמרת נוספה");
        setAddModal(null);
        loadShifts();
      } else {
        const err = await res.json();
        showToast(err.error ?? "שגיאה בהוספה");
      }
    } finally {
      setAddLoading(false);
    }
  }

  // Submit swap request
  async function submitSwap() {
    if (!swapModal || swapLoading) return;
    setSwapLoading(true);
    try {
      const res = await fetch("/api/admin/shifts/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftId: swapModal.id,
          type: "SWAP",
          reason: swapReason || null,
          restaurantId,
        }),
      });
      if (res.ok) {
        showToast("✓ בקשת החלפה נשלחה");
        setSwapModal(null);
        setSwapReason("");
      } else {
        const err = await res.json();
        showToast(err.error ?? "שגיאה בשליחת בקשה");
      }
    } finally {
      setSwapLoading(false);
    }
  }

  // Approve / reject request
  async function respondRequest(id: string, status: "APPROVED" | "REJECTED") {
    const res = await fetch("/api/admin/shifts/requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      showToast(status === "APPROVED" ? "✓ בקשה אושרה" : "✓ בקשה נדחתה");
      loadRequests();
    } else {
      showToast("שגיאה");
    }
  }

  const loadOps = useCallback(async () => {
    if (!restaurantId) return;
    setOpsLoading(true);
    try {
      const r = await fetch(`/api/admin/shifts/sms?restaurantId=${restaurantId}`);
      const d = await r.json();
      setSmsLogs(d.logs ?? []);
      setSmsStats(d.stats ?? []);
      setSmsConfigured(d.smsConfigured ?? false);
    } catch { /* ignore */ } finally { setOpsLoading(false); }
  }, [restaurantId]);

  useEffect(() => { if (activeTab === "ops") loadOps(); }, [activeTab, loadOps]);

  // Build SMS preview for a given target
  function buildPreview(targetId: "all" | string): string {
    const weekShifts = shifts.filter(s => {
      const d = String(s.date).slice(0, 10);
      return d >= formatDateISO(weekDates[0]) && d <= formatDateISO(weekDates[6]);
    });
    const target = targetId === "all" ? weekShifts : weekShifts.filter(s => s.userId === targetId);
    if (!target.length) return "(אין משמרות לשלוח)";
    const first = target[0];
    const name = targetId === "all" ? "[שם]" : (staff.find(s => s.id === targetId)?.name?.split(" ")[0] ?? "[שם]");
    const from = formatDateISO(weekDates[0]);
    const to   = formatDateISO(weekDates[6]);
    const fmtDate = (iso: string) => iso.slice(8) + "/" + iso.slice(5, 7);
    const DAY_S = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
    const lines = (targetId === "all" ? target.slice(0, 2) : target).map(s => {
      const cfg = shiftCfgList.find(c => c.key === s.shiftType);
      const label = cfg?.label ?? s.shiftType;
      const d = new Date(s.date + "T00:00:00");
      return `${DAY_S[d.getDay()]} ${fmtDate(String(s.date).slice(0,10))} ${label} ${s.startTime.slice(0,5)}-${s.endTime.slice(0,5)}`;
    });
    if (targetId === "all" && target.length > 2) lines.push(`...ועוד ${target.length - 2}`);
    return `${name}, משמרות (${fmtDate(from)}-${fmtDate(to)}):\n${lines.join("\n")}`;
  }

  async function sendSms() {
    if (smsSending) return;
    setSmsSending(true);
    try {
      const res = await fetch("/api/admin/shifts/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          weekFrom: formatDateISO(weekDates[0]),
          weekTo:   formatDateISO(weekDates[6]),
          targetUserId: smsTarget === "all" ? undefined : smsTarget,
          shiftCfg: shiftCfgList.map(c => ({ key: c.key, label: c.label })),
        }),
      });
      const d = await res.json();
      if (!res.ok) { showToast(d.error ?? "שגיאה"); return; }
      setSmsModal(false);
      showToast(`✓ SMS נשלח ל-${d.sent} עובד${d.sent !== 1 ? "ים" : ""}${d.failed ? ` (${d.failed} נכשלו)` : ""}${d.skipped ? ` (${d.skipped} ללא טלפון)` : ""}`);
    } finally { setSmsSending(false); }
  }

  async function clearWeek() {
    const weekShifts = shifts.filter(s => {
      const d = String(s.date).slice(0, 10);
      return d >= formatDateISO(weekDates[0]) && d <= formatDateISO(weekDates[6]);
    });
    if (weekShifts.length === 0) { showToast("אין משמרות לניקוי השבוע"); return; }

    // Optimistic delete — remove from state immediately
    setShifts(prev => prev.filter(s => !weekShifts.some(ws => ws.id === s.id)));
    setUndoShifts(weekShifts);

    showToast(`🗑️ נמחקו ${weekShifts.length} משמרות`, async () => {
      // Restore client-side state
      setShifts(prev => [...prev, ...weekShifts].sort((a, b) => a.date.localeCompare(b.date)));
      setUndoShifts(null);
      // Re-create via API
      for (const s of weekShifts) {
        await fetch("/api/admin/shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ restaurantId, userId: s.userId, date: s.date, shiftType: s.shiftType }),
        });
      }
    });

    // Fire actual deletes in background
    await Promise.all(weekShifts.map(s =>
      fetch(`/api/admin/shifts/${s.id}`, { method: "DELETE" })
    ));
  }

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

  const pendingCount = requests.filter(r => r.status === "PENDING").length;

  // ── Styles ──────────────────────────────────────────────────────────────────
  const S = {
    wrap: {
      minHeight: "100vh",
      background: T.bg,
      color: T.text,
      fontFamily: T.fontSans,
      direction: "rtl" as const,
      padding: "24px 20px",
    } as React.CSSProperties,
    header: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap" as const,
      gap: 12,
      marginBottom: 20,
    } as React.CSSProperties,
    title: {
      fontSize: T.f2xl,
      fontWeight: 800,
      color: T.gold,
      margin: 0,
    } as React.CSSProperties,
    weekNav: {
      display: "flex",
      alignItems: "center",
      gap: 4,
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: T.rLg,
      padding: "4px 8px",
    } as React.CSSProperties,
    weekNavBtn: {
      background: "transparent",
      border: "none",
      borderRadius: T.rMd,
      color: T.muted,
      fontSize: T.fsm,
      padding: "3px 7px",
      cursor: "pointer",
      fontFamily: "inherit",
    } as React.CSSProperties,
    weekLabel: {
      fontSize: T.fsm,
      fontWeight: 600,
      color: T.text,
      minWidth: 160,
      textAlign: "center" as const,
      padding: "0 4px",
    } as React.CSSProperties,
    restSelect: {
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: T.rMd,
      color: T.text,
      fontSize: T.fmd,
      padding: "6px 12px",
      fontFamily: "inherit",
      cursor: "pointer",
      marginBottom: 16,
    } as React.CSSProperties,
    tabBar: {
      display: "flex",
      gap: 4,
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: T.rLg,
      padding: 4,
      marginBottom: 20,
      overflowX: "auto" as const,
    } as React.CSSProperties,
    tabContent: {
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: T.rLg,
      padding: 20,
      minHeight: 300,
    } as React.CSSProperties,
  };

  function tabBtn(id: typeof activeTab, label: React.ReactNode): React.ReactElement {
    const active = activeTab === id;
    return (
      <button
        key={id}
        onClick={() => setActiveTab(id)}
        style={{
          background: active ? T.gold : "transparent",
          color: active ? "#fff" : T.muted,
          border: "none",
          borderRadius: T.rMd,
          padding: "8px 16px",
          fontSize: T.fmd,
          fontWeight: active ? 700 : 500,
          cursor: "pointer",
          fontFamily: "inherit",
          whiteSpace: "nowrap",
          display: "flex",
          alignItems: "center",
          gap: 6,
          transition: "all 0.15s",
        }}
      >
        {label}
      </button>
    );
  }

  // ── Tab: Schedule ──────────────────────────────────────────────────────────
  function ScheduleTab() {
    const displayStaff = staff.length > 0 ? staff : Array.from(
      new Map(shifts.map(s => [s.userId, { id: s.userId, name: s.userName }])).values()
    );

    return (
      <div>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: T.muted, fontSize: T.flg }}>טוען...</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
              <thead>
                <tr>
                  <th style={{ padding: "8px 12px", textAlign: "right", color: T.muted, fontSize: T.fsm, fontWeight: 600, borderBottom: `1px solid ${T.border}`, minWidth: 100 }}>עובד</th>
                  {weekDates.map((d, i) => {
                    const iso = formatDateISO(d);
                    const todayIso = formatDateISO(new Date());
                    const isToday = iso === todayIso;
                    const isPast  = iso < todayIso;
                    return (
                      <th key={i} style={{ padding: "6px 8px", textAlign: "center", fontSize: T.fsm, fontWeight: 600, borderBottom: `2px solid ${isToday ? T.gold : T.border}`, minWidth: 90, background: isToday ? T.gold + "12" : isPast ? "rgba(0,0,0,0.06)" : "transparent", opacity: isPast ? 0.55 : 1 }}>
                        <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                          <span style={{ color: isToday ? T.gold : isPast ? T.muted : T.text, fontWeight: isToday ? 900 : 700 }}>{DAYS_HE[i]}</span>
                          {isToday
                            ? <span style={{ background: T.gold, color: "#1a1208", borderRadius: 99, fontSize: T.fxs, fontWeight: 800, padding: "1px 7px" }}>{formatDate(d)}</span>
                            : <span style={{ color: T.muted, fontSize: T.fxs }}>{formatDate(d)}</span>
                          }
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {displayStaff.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: 32, color: T.muted }}>אין עובדים להצגה</td>
                  </tr>
                ) : displayStaff.map(member => (
                  <tr key={member.id} style={{ borderBottom: `1px solid ${T.borderSub}` }}>
                    <td style={{ padding: "8px 12px", color: T.text, fontSize: T.fmd, fontWeight: 600, whiteSpace: "nowrap" }}>
                      {member.name}
                    </td>
                    {weekDates.map((d, di) => {
                      const iso = formatDateISO(d);
                      const todayIso = formatDateISO(new Date());
                      const isToday = iso === todayIso;
                      const isPast  = iso < todayIso;
                      const dayShifts = shifts.filter(s => s.userId === member.id && String(s.date).slice(0, 10) === iso);
                      const canAdd = isManager && !isPast;
                      return (
                        <td
                          key={di}
                          style={{ padding: "4px 6px", verticalAlign: "top", cursor: canAdd && dayShifts.length === 0 ? "pointer" : "default", background: isToday ? T.gold + "08" : isPast ? "rgba(0,0,0,0.04)" : "transparent", opacity: isPast ? 0.5 : 1 }}
                          onClick={() => {
                            if (canAdd && dayShifts.length === 0) {
                              setAddModal({ userId: member.id, userName: member.name, date: iso });
                            }
                          }}
                        >
                          <div style={{ display: "flex", flexDirection: "column", gap: 3, minHeight: 36 }}>
                            {dayShifts.map(sh => {
                              const cfg = SHIFT_CFG[sh.shiftType] ?? { label: sh.shiftType, time: `${sh.startTime}–${sh.endTime}`, color: T.muted, bg: T.panel };
                              return (
                                <div
                                  key={sh.id}
                                  style={{
                                    background: cfg.bg,
                                    border: `1px solid ${cfg.color}44`,
                                    borderRadius: T.rMd,
                                    padding: "2px 6px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 4,
                                  }}
                                >
                                  <span style={{ color: cfg.color, fontSize: T.fxs, fontWeight: 700 }}>
                                    {cfg.label}
                                    <span style={{ color: cfg.color + "99", fontSize: 9, marginRight: 2 }}>{cfg.time}</span>
                                  </span>
                                  {isManager && (
                                    <button
                                      onClick={e => { e.stopPropagation(); deleteShift(sh.id); }}
                                      style={{ background: "transparent", border: "none", color: T.red, fontSize: 11, cursor: "pointer", padding: "0 2px", lineHeight: 1, fontWeight: 700 }}
                                      title="מחק"
                                    >✕</button>
                                  )}
                                </div>
                              );
                            })}
                            {isManager && dayShifts.length === 0 && (
                              <div style={{ color: T.borderSub, fontSize: T.fxs, textAlign: "center", paddingTop: 8 }}>＋</div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add Shift Modal */}
        {addModal && (
          <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.rLg, padding: 24, width: 340, maxWidth: "90vw", direction: "rtl", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
              <div style={{ fontSize: T.flg, fontWeight: 700, color: T.text, marginBottom: 4 }}>הוסף משמרת</div>
              <div style={{ fontSize: T.fsm, color: T.muted, marginBottom: 20 }}>
                {addModal.userName} — {addModal.date.split("-").reverse().join("/")}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {Object.entries(SHIFT_CFG).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => addShift(key)}
                    disabled={addLoading}
                    style={{
                      background: cfg.bg,
                      border: `2px solid ${cfg.color}55`,
                      borderRadius: T.rMd,
                      padding: "12px 8px",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                      opacity: addLoading ? 0.6 : 1,
                    }}
                  >
                    <span style={{ color: cfg.color, fontWeight: 700, fontSize: T.fmd }}>{cfg.label}</span>
                    <span style={{ color: cfg.color + "99", fontSize: T.fxs }}>{cfg.time}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setAddModal(null)}
                style={{ marginTop: 16, width: "100%", background: "transparent", border: `1px solid ${T.border}`, borderRadius: T.rMd, color: T.muted, padding: "8px", cursor: "pointer", fontFamily: "inherit", fontSize: T.fmd }}
              >
                ביטול
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Tab: My Shifts ─────────────────────────────────────────────────────────
  function MyShiftsTab() {
    const now = new Date();
    const in14 = new Date(now);
    in14.setDate(now.getDate() + 14);

    const myShifts = shifts
      .filter(s => {
        const d = new Date(s.date);
        return s.userId === currentUserId && d >= now && d <= in14;
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    const statusBadge = (status: string) => {
      const map: Record<string, { label: string; color: string }> = {
        SCHEDULED: { label: "מתוכנן", color: T.blue },
        COMPLETED: { label: "הושלם", color: T.green },
        CANCELLED: { label: "בוטל", color: T.red },
      };
      const s = map[status] ?? { label: status, color: T.muted };
      return (
        <span style={{ background: s.color + "20", border: `1px solid ${s.color}44`, borderRadius: T.rFull, color: s.color, fontSize: T.fxs, fontWeight: 700, padding: "2px 8px" }}>
          {s.label}
        </span>
      );
    };

    if (myShifts.length === 0) {
      return (
        <div style={{ textAlign: "center", padding: 60, color: T.muted, fontSize: T.flg }}>
          אין משמרות קרובות
        </div>
      );
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {myShifts.map(sh => {
          const cfg = SHIFT_CFG[sh.shiftType] ?? { label: sh.shiftType, time: `${sh.startTime}–${sh.endTime}`, color: T.muted, bg: T.panel };
          const d = new Date(sh.date);
          const dayName = DAYS_HE[d.getDay()];
          return (
            <div key={sh.id} style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: T.rLg, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div style={{ minWidth: 56, textAlign: "center" }}>
                <div style={{ fontSize: T.fmd, fontWeight: 700, color: T.text }}>{dayName}</div>
                <div style={{ fontSize: T.fsm, color: T.muted }}>{formatDate(d)}</div>
              </div>
              <div style={{ background: cfg.bg, border: `1px solid ${cfg.color}44`, borderRadius: T.rMd, padding: "6px 14px" }}>
                <div style={{ color: cfg.color, fontWeight: 700, fontSize: T.fmd }}>{cfg.label}</div>
                <div style={{ color: cfg.color + "99", fontSize: T.fxs }}>{cfg.time}</div>
              </div>
              <div style={{ flex: 1 }} />
              {statusBadge(sh.status)}
              <button
                onClick={() => { setSwapModal(sh); setSwapReason(""); }}
                style={{ background: T.blue + "18", border: `1px solid ${T.blue}44`, borderRadius: T.rMd, color: T.blue, fontSize: T.fsm, fontWeight: 700, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit" }}
              >
                🔄 בקש החלפה
              </button>
            </div>
          );
        })}

        {/* Swap Modal */}
        {swapModal && (
          <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.rLg, padding: 24, width: 360, maxWidth: "90vw", direction: "rtl", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
              <div style={{ fontSize: T.flg, fontWeight: 700, color: T.text, marginBottom: 4 }}>🔄 בקשת החלפת משמרת</div>
              <div style={{ fontSize: T.fsm, color: T.muted, marginBottom: 16 }}>
                {SHIFT_CFG[swapModal.shiftType]?.label ?? swapModal.shiftType} — {swapModal.date.slice(0, 10).split("-").reverse().join("/")}
              </div>
              <label style={{ fontSize: T.fsm, color: T.muted, display: "block", marginBottom: 4 }}>סיבה (אופציונלי)</label>
              <textarea
                value={swapReason}
                onChange={e => setSwapReason(e.target.value)}
                rows={3}
                placeholder="כתוב סיבה..."
                style={{ background: T.overlay ?? T.panel, border: `1px solid ${T.border}`, borderRadius: T.rMd, color: T.text, fontSize: T.fmd, padding: "7px 10px", width: "100%", outline: "none", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button
                  onClick={submitSwap}
                  disabled={swapLoading}
                  style={{ flex: 1, background: T.blue, border: "none", borderRadius: T.rMd, color: "#fff", fontSize: T.fmd, fontWeight: 700, padding: "10px", cursor: "pointer", fontFamily: "inherit", opacity: swapLoading ? 0.6 : 1 }}
                >
                  {swapLoading ? "שולח..." : "שלח בקשה"}
                </button>
                <button
                  onClick={() => setSwapModal(null)}
                  style={{ flex: 1, background: "transparent", border: `1px solid ${T.border}`, borderRadius: T.rMd, color: T.muted, fontSize: T.fmd, padding: "10px", cursor: "pointer", fontFamily: "inherit" }}
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Tab: Requests ──────────────────────────────────────────────────────────
  function RequestsTab() {
    const displayRequests = isManager
      ? requests.filter(r => r.status === "PENDING")
      : requests.filter(r => r.fromUserName === currentUserName);

    const typeLabelMap: Record<string, string> = { SWAP: "החלפה", COVER: "כיסוי" };
    const statusColorMap: Record<string, string> = {
      PENDING: T.orange,
      APPROVED: T.green,
      REJECTED: T.red,
    };
    const statusLabelMap: Record<string, string> = {
      PENDING: "ממתין",
      APPROVED: "אושר",
      REJECTED: "נדחה",
    };

    if (requestsLoading) {
      return <div style={{ textAlign: "center", padding: 40, color: T.muted }}>טוען...</div>;
    }

    if (displayRequests.length === 0) {
      return <div style={{ textAlign: "center", padding: 60, color: T.muted, fontSize: T.flg }}>אין בקשות להצגה</div>;
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {displayRequests.map(req => {
          const shiftCfg = SHIFT_CFG[req.shiftType] ?? { label: req.shiftType, color: T.muted };
          const sc = statusColorMap[req.status] ?? T.muted;
          return (
            <div key={req.id} style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: T.rLg, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                <span style={{ fontWeight: 700, color: T.text, fontSize: T.fmd }}>{req.fromUserName}</span>
                <span style={{ color: T.muted, fontSize: T.fsm }}>←</span>
                <span style={{ background: shiftCfg.color + "20", color: shiftCfg.color, border: `1px solid ${shiftCfg.color}44`, borderRadius: T.rFull, fontSize: T.fxs, fontWeight: 700, padding: "2px 8px" }}>
                  {shiftCfg.label} {req.shiftDate?.slice(0, 10).split("-").reverse().join("/")}
                </span>
                <span style={{ background: T.blue + "18", color: T.blue, border: `1px solid ${T.blue}44`, borderRadius: T.rFull, fontSize: T.fxs, fontWeight: 700, padding: "2px 8px" }}>
                  {typeLabelMap[req.type] ?? req.type}
                </span>
                <div style={{ flex: 1 }} />
                <span style={{ background: sc + "18", color: sc, border: `1px solid ${sc}44`, borderRadius: T.rFull, fontSize: T.fxs, fontWeight: 700, padding: "2px 8px" }}>
                  {statusLabelMap[req.status] ?? req.status}
                </span>
              </div>
              {req.reason && (
                <div style={{ fontSize: T.fsm, color: T.muted, marginBottom: 10 }}>סיבה: {req.reason}</div>
              )}
              {isManager && req.status === "PENDING" && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => respondRequest(req.id, "APPROVED")}
                    style={{ background: T.green + "18", border: `1px solid ${T.green}44`, borderRadius: T.rMd, color: T.green, fontSize: T.fsm, fontWeight: 700, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit" }}
                  >
                    ✓ אשר
                  </button>
                  <button
                    onClick={() => respondRequest(req.id, "REJECTED")}
                    style={{ background: T.red + "18", border: `1px solid ${T.red}44`, borderRadius: T.rMd, color: T.red, fontSize: T.fsm, fontWeight: 700, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit" }}
                  >
                    ✗ דחה
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Tab: Summary ───────────────────────────────────────────────────────────
  function SummaryTab() {
    const displayStaff = staff.length > 0 ? staff : Array.from(
      new Map(shifts.map(s => [s.userId, { id: s.userId, name: s.userName }])).values()
    );

    type MemberSummary = {
      id: string;
      name: string;
      count: number;
      hours: number;
      byType: Record<string, number>;
    };

    const summaries: MemberSummary[] = displayStaff.map(member => {
      const memberShifts = shifts.filter(s => s.userId === member.id);
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

    if (summaries.length === 0) {
      return <div style={{ textAlign: "center", padding: 60, color: T.muted, fontSize: T.flg }}>אין נתונים לשבוע זה</div>;
    }

    return (
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${T.border}` }}>
              <th style={{ padding: "10px 12px", textAlign: "right", color: T.muted, fontSize: T.fsm, fontWeight: 600 }}>עובד</th>
              <th style={{ padding: "10px 8px", textAlign: "center", color: T.muted, fontSize: T.fsm, fontWeight: 600 }}>משמרות</th>
              <th style={{ padding: "10px 8px", textAlign: "center", color: T.muted, fontSize: T.fsm, fontWeight: 600 }}>סה"כ שעות</th>
              {Object.entries(SHIFT_CFG).map(([key, cfg]) => (
                <th key={key} style={{ padding: "10px 8px", textAlign: "center", color: cfg.color, fontSize: T.fxs, fontWeight: 600 }}>{cfg.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summaries.map(s => (
              <tr key={s.id} style={{ borderBottom: `1px solid ${T.borderSub}` }}>
                <td style={{ padding: "10px 12px", color: T.text, fontSize: T.fmd, fontWeight: 600 }}>{s.name}</td>
                <td style={{ padding: "10px 8px", textAlign: "center", color: T.text, fontSize: T.fmd }}>{s.count}</td>
                <td style={{ padding: "10px 8px", textAlign: "center", color: T.gold, fontSize: T.fmd, fontWeight: 700 }}>{s.hours.toFixed(1)}</td>
                {Object.keys(SHIFT_CFG).map(key => (
                  <td key={key} style={{ padding: "10px 8px", textAlign: "center", color: T.muted, fontSize: T.fsm }}>
                    {s.byType[key] ? s.byType[key].toFixed(1) : "–"}
                  </td>
                ))}
              </tr>
            ))}
            <tr style={{ borderTop: `2px solid ${T.border}`, background: T.raised }}>
              <td style={{ padding: "10px 12px", color: T.text, fontSize: T.fmd, fontWeight: 700 }}>סה"כ</td>
              <td style={{ padding: "10px 8px", textAlign: "center", color: T.text, fontSize: T.fmd, fontWeight: 700 }}>
                {summaries.reduce((a, s) => a + s.count, 0)}
              </td>
              <td style={{ padding: "10px 8px", textAlign: "center", color: T.gold, fontSize: T.flg, fontWeight: 800 }}>
                {grandTotal.toFixed(1)}
              </td>
              {Object.keys(SHIFT_CFG).map(key => (
                <td key={key} style={{ padding: "10px 8px", textAlign: "center", color: T.muted, fontSize: T.fsm }}>
                  {summaries.reduce((a, s) => a + (s.byType[key] ?? 0), 0).toFixed(1)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  // ── Tab: Ops ───────────────────────────────────────────────────────────────
  function OpsTab() {
    if (opsLoading) return <div style={{ textAlign: "center", padding: 40, color: T.muted }}>טוען...</div>;
    const totalSent   = smsLogs.filter(l => l.status === "SENT").length;
    const totalFailed = smsLogs.filter(l => l.status === "FAILED").length;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Summary cards */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { label: "SMS נשלחו", value: totalSent,   color: T.green },
            { label: "נכשלו",     value: totalFailed,  color: T.red   },
            { label: "שבועות",    value: smsStats.length, color: T.blue },
          ].map(c => (
            <div key={c.label} style={{ flex: 1, minWidth: 100, background: T.panel, border: `1px solid ${T.border}`, borderRadius: T.rLg, padding: "14px 18px" }}>
              <div style={{ fontSize: T.f2xl, fontWeight: 900, color: c.color }}>{c.value}</div>
              <div style={{ fontSize: T.fsm, color: T.muted, marginTop: 2 }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Per-week stats */}
        {smsStats.length > 0 && (
          <div>
            <div style={{ fontSize: T.fsm, fontWeight: 700, color: T.muted, marginBottom: 8 }}>לפי שבוע</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {smsStats.map((s, i) => (
                <div key={i} style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: T.rMd, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, color: T.text, fontSize: T.fmd, flex: 1 }}>{s.week}</span>
                  <span style={{ background: T.green + "20", color: T.green, borderRadius: T.rFull, fontSize: T.fxs, fontWeight: 700, padding: "2px 10px" }}>✓ {s.total - s.failed} נשלחו</span>
                  {s.failed > 0 && <span style={{ background: T.red + "20", color: T.red, borderRadius: T.rFull, fontSize: T.fxs, fontWeight: 700, padding: "2px 10px" }}>✗ {s.failed} נכשלו</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Log table */}
        {smsLogs.length > 0 && (
          <div>
            <div style={{ fontSize: T.fsm, fontWeight: 700, color: T.muted, marginBottom: 8 }}>יומן שליחות</div>
            <div style={{ overflowX: "auto", borderRadius: T.rMd, border: `1px solid ${T.border}` }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: T.panel }}>
                    {["שם", "טלפון", "שבוע", "הודעה", "סטטוס", "נשלח"].map(h => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "right", fontSize: T.fxs, color: T.muted, fontWeight: 600, borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {smsLogs.map(l => (
                    <tr key={l.id} style={{ borderBottom: `1px solid ${T.borderSub}` }}>
                      <td style={{ padding: "8px 12px", fontSize: T.fsm, color: T.text, whiteSpace: "nowrap" }}>{l.recipientName}</td>
                      <td style={{ padding: "8px 12px", fontSize: T.fsm, color: T.muted }}>{l.phone}</td>
                      <td style={{ padding: "8px 12px", fontSize: T.fxs, color: T.muted, whiteSpace: "nowrap" }}>{l.weekFrom?.slice(5).split("-").reverse().join("/")}–{l.weekTo?.slice(5).split("-").reverse().join("/")}</td>
                      <td style={{ padding: "8px 12px", fontSize: T.fxs, color: T.muted, maxWidth: 200 }}>
                        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.message}</span>
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        <span style={{ background: l.status === "SENT" ? T.green + "20" : T.red + "20", color: l.status === "SENT" ? T.green : T.red, borderRadius: T.rFull, fontSize: T.fxs, fontWeight: 700, padding: "2px 8px" }}>
                          {l.status === "SENT" ? "✓ נשלח" : "✗ נכשל"}
                        </span>
                      </td>
                      <td style={{ padding: "8px 12px", fontSize: T.fxs, color: T.muted, whiteSpace: "nowrap" }}>
                        {new Date(l.sentAt).toLocaleDateString("he-IL")} {new Date(l.sentAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {smsLogs.length === 0 && !opsLoading && (
          <div style={{ textAlign: "center", padding: 60, color: T.muted, fontSize: T.flg }}>טרם נשלחו הודעות SMS</div>
        )}
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={S.wrap}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 2000,
          background: T.raised, border: `1px solid ${T.border}`, borderRadius: T.rLg,
          color: T.text, fontSize: T.fmd, fontWeight: 600, padding: "10px 18px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)", whiteSpace: "nowrap",
          display: "flex", alignItems: "center", gap: 12, direction: "rtl",
        }}>
          <span>{toast.msg}</span>
          {toast.undo && (
            <button
              onClick={() => { toast.undo!(); setToast(null); }}
              style={{ background: T.gold, border: "none", borderRadius: T.rMd, color: "#1a1208", fontSize: T.fsm, fontWeight: 800, padding: "4px 12px", cursor: "pointer", fontFamily: "inherit" }}
            >
              ↩ בטל
            </button>
          )}
        </div>
      )}

      {/* Settings modal */}
      {settingsOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.rLg, padding: 28, width: 480, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto", direction: "rtl", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <div style={{ fontSize: T.flg, fontWeight: 800, color: T.text, marginBottom: 20 }}>⚙️ הגדרות סוגי משמרת</div>

            {editCfg.map((cfg, idx) => (
              <div key={cfg.key} style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: T.rMd, padding: "12px 14px", marginBottom: 10 }}>
                {/* Row 1: switch + label + times */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  {/* Switch */}
                  <div
                    onClick={() => setEditCfg(prev => prev.map((c, i) => i === idx ? { ...c, visible: !c.visible } : c))}
                    style={{ position: "relative", width: 40, height: 22, borderRadius: 11, background: cfg.visible ? cfg.color : T.borderSub, cursor: "pointer", flexShrink: 0, transition: "background 0.2s" }}
                  >
                    <div style={{ position: "absolute", top: 3, right: cfg.visible ? 3 : undefined, left: cfg.visible ? undefined : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.3)", transition: "all 0.2s" }} />
                  </div>

                  {/* Label */}
                  <input
                    value={cfg.label}
                    onChange={e => setEditCfg(prev => prev.map((c, i) => i === idx ? { ...c, label: e.target.value } : c))}
                    style={{ background: T.overlay ?? T.panel, border: `1px solid ${T.border}`, borderRadius: T.rMd, color: T.text, fontSize: T.fmd, fontWeight: 700, padding: "4px 8px", width: 80, fontFamily: "inherit", outline: "none" }}
                    placeholder="שם"
                  />

                  {/* Times on same row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                    <span style={{ fontSize: T.fxs, color: T.muted }}>מ-</span>
                    <input
                      type="time"
                      value={cfg.startTime}
                      onChange={e => setEditCfg(prev => prev.map((c, i) => i === idx ? { ...c, startTime: e.target.value } : c))}
                      style={{ background: T.overlay ?? T.panel, border: `1px solid ${T.border}`, borderRadius: T.rMd, color: T.text, fontSize: T.fsm, padding: "4px 6px", fontFamily: "inherit", outline: "none" }}
                    />
                    <span style={{ fontSize: T.fxs, color: T.muted }}>עד-</span>
                    <input
                      type="time"
                      value={cfg.endTime}
                      onChange={e => setEditCfg(prev => prev.map((c, i) => i === idx ? { ...c, endTime: e.target.value } : c))}
                      style={{ background: T.overlay ?? T.panel, border: `1px solid ${T.border}`, borderRadius: T.rMd, color: T.text, fontSize: T.fsm, padding: "4px 6px", fontFamily: "inherit", outline: "none" }}
                    />
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => setEditCfg(prev => prev.filter((_, i) => i !== idx))}
                    style={{ background: "transparent", border: "none", color: T.red, fontSize: 16, cursor: "pointer", padding: "0 2px", lineHeight: 1, flexShrink: 0 }}
                    title="הסר"
                  >✕</button>
                </div>

                {/* Row 2: color dots */}
                <div style={{ display: "flex", gap: 6, marginTop: 10, paddingRight: 50 }}>
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setEditCfg(prev => prev.map((cf, i) => i === idx ? { ...cf, color: c } : cf))}
                      style={{ width: 20, height: 20, borderRadius: "50%", background: c, border: cfg.color === c ? "2px solid #fff" : "2px solid transparent", cursor: "pointer", outline: cfg.color === c ? `2px solid ${c}` : "none", boxSizing: "border-box" }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* Add new shift type */}
            <button
              onClick={() => {
                const key = `CUSTOM_${Date.now()}`;
                setEditCfg(prev => [...prev, { key, label: "משמרת חדשה", startTime: "08:00", endTime: "16:00", color: "#10b981", visible: true }]);
              }}
              style={{ width: "100%", background: "transparent", border: `1.5px dashed ${T.border}`, borderRadius: T.rMd, color: T.muted, fontSize: T.fsm, padding: "9px", cursor: "pointer", fontFamily: "inherit", marginTop: 4 }}
            >
              ＋ הוסף סוג משמרת
            </button>

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button
                onClick={saveConfig}
                disabled={settingsSaving}
                style={{ flex: 1, background: T.gold, border: "none", borderRadius: T.rMd, color: "#1a1208", fontSize: T.fmd, fontWeight: 800, padding: 12, cursor: "pointer", fontFamily: "inherit", opacity: settingsSaving ? 0.6 : 1 }}
              >
                {settingsSaving ? "שומר..." : "שמור"}
              </button>
              <button
                onClick={() => setSettingsOpen(false)}
                style={{ flex: 1, background: "transparent", border: `1px solid ${T.border}`, borderRadius: T.rMd, color: T.muted, fontSize: T.fmd, padding: 12, cursor: "pointer", fontFamily: "inherit" }}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={S.header}>
        <h1 style={S.title}>📅 ניהול משמרות</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isManager && (
            <>
              <button
                onClick={() => setSmsModal(true)}
                style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: T.rMd, color: T.muted, fontSize: T.fsm, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
              >
                📱 שלח SMS
              </button>
              <button
                onClick={clearWeek}
                style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: T.rMd, color: T.muted, fontSize: T.fsm, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
              >
                🗑️ נקה שבוע
              </button>
              <button
                onClick={() => { setEditCfg(shiftCfgList); setSettingsOpen(true); }}
                style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: T.rMd, color: T.muted, fontSize: T.fsm, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
              >
                ⚙️ הגדרות
              </button>
            </>
          )}
          <div style={S.weekNav}>
            <button style={S.weekNavBtn} onClick={() => setWeekOffset(w => w - 1)}>→</button>
            <span style={S.weekLabel}>{weekLabel(weekDates)}</span>
            <button style={S.weekNavBtn} onClick={() => setWeekOffset(w => w + 1)}>←</button>
          </div>
        </div>
      </div>

      {/* Restaurant selector */}
      {restaurants.length > 1 && (
        <select
          value={restaurantId}
          onChange={e => setRestaurantId(e.target.value)}
          style={S.restSelect}
        >
          {restaurants.map(r => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      )}

      {/* Tab bar */}
      <div style={S.tabBar}>
        {tabBtn("schedule", "📅 שבועון")}
        {tabBtn("myshifts", "👤 המשמרות שלי")}
        {tabBtn("requests", (
          <>
            🔔 בקשות
            {pendingCount > 0 && (
              <span style={{ background: T.red, color: "#fff", borderRadius: T.rFull, fontSize: T.fxs, fontWeight: 700, padding: "1px 6px", lineHeight: "16px" }}>
                {pendingCount}
              </span>
            )}
          </>
        ))}
        {tabBtn("summary", "📊 סיכום שעות")}
        {isManager && tabBtn("ops", "📱 תפעולי")}
      </div>

      {/* Tab content */}
      <div style={S.tabContent}>
        {activeTab === "schedule" && <ScheduleTab />}
        {activeTab === "myshifts" && <MyShiftsTab />}
        {activeTab === "requests" && <RequestsTab />}
        {activeTab === "summary" && <SummaryTab />}
        {activeTab === "ops" && <OpsTab />}
      </div>

      {/* SMS Modal */}
      {smsModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.rLg, padding: 28, width: 440, maxWidth: "95vw", direction: "rtl", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <div style={{ fontSize: T.flg, fontWeight: 800, color: T.text, marginBottom: 4 }}>📱 שלח SMS משמרות</div>
            <div style={{ fontSize: T.fsm, color: T.muted, marginBottom: 20 }}>שבוע {weekLabel(weekDates)}</div>

            {/* Target selector */}
            <label style={{ fontSize: T.fsm, color: T.muted, display: "block", marginBottom: 6 }}>שלח ל:</label>
            <select
              value={smsTarget}
              onChange={e => setSmsTarget(e.target.value)}
              style={{ background: T.overlay ?? T.panel, border: `1px solid ${T.border}`, borderRadius: T.rMd, color: T.text, fontSize: T.fmd, padding: "7px 10px", width: "100%", fontFamily: "inherit", outline: "none", marginBottom: 16 }}
            >
              <option value="all">כל העובדים עם משמרת השבוע</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            {/* Preview */}
            <label style={{ fontSize: T.fsm, color: T.muted, display: "block", marginBottom: 6 }}>תצוגה מקדימה:</label>
            <pre style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: T.rMd, padding: "10px 14px", fontSize: 13, color: T.text, fontFamily: "inherit", whiteSpace: "pre-wrap", marginBottom: 20, lineHeight: 1.6 }}>
              {buildPreview(smsTarget)}
            </pre>

            {!smsConfigured && (
              <div style={{ background: T.red + "18", border: `1px solid ${T.red}44`, borderRadius: T.rMd, color: T.red, fontSize: T.fsm, padding: "8px 12px", marginBottom: 14 }}>
                ⚠️ SMS לא מוגדר — נדרש INFORU_USERNAME ו-INFORU_API_TOKEN
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={sendSms}
                disabled={smsSending || !smsConfigured}
                style={{ flex: 1, background: T.gold, border: "none", borderRadius: T.rMd, color: "#1a1208", fontSize: T.fmd, fontWeight: 800, padding: 12, cursor: "pointer", fontFamily: "inherit", opacity: smsSending || !smsConfigured ? 0.6 : 1 }}
              >
                {smsSending ? "שולח..." : "📤 שלח"}
              </button>
              <button
                onClick={() => setSmsModal(false)}
                style={{ flex: 1, background: "transparent", border: `1px solid ${T.border}`, borderRadius: T.rMd, color: T.muted, fontSize: T.fmd, padding: 12, cursor: "pointer", fontFamily: "inherit" }}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
