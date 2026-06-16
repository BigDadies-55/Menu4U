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

const DAYS_HE = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "שבת"];
const MONTHS_HE = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

// ── Opening hours helpers ─────────────────────────────────────────────────────
const DAY_KEYS = ["sun","mon","tue","wed","thu","fri","sat"];
function getDayStatus(openingHours: string | null | undefined, date: Date): { closed: boolean; holiday?: string } {
  if (!openingHours) return { closed: false };
  try {
    const data = JSON.parse(openingHours);
    const iso = date.toISOString().slice(0, 10);
    const holiday = data.holidays?.find((h: { date: string; reason: string }) => h.date === iso);
    if (holiday) return { closed: true, holiday: holiday.reason };
    const key = DAY_KEYS[date.getDay()];
    return { closed: !data[key] };
  } catch { return { closed: false }; }
}

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

// ── Glass design tokens ───────────────────────────────────────────────────────
const BG_PAGE     = `linear-gradient(rgba(12,12,20,0.80),rgba(12,12,20,0.80)), url('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=2070') no-repeat center center / cover fixed`;
const GB          = "rgba(255,255,255,0.14)";   // glass border
const GC          = "rgba(255,255,255,0.04)";   // glass card bg
const GM          = "rgba(255,255,255,0.55)";   // glass muted text
const ACCENT      = "#D97706";
const ACCENT_GRAD = "linear-gradient(135deg,#D97706,#F59E0B)";
const MODAL_BG    = "rgba(18,18,30,0.98)";
const MODAL_BORDER = "rgba(255,255,255,0.18)";

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
  const [activeTab, setActiveTab] = useState<"schedule" | "myshifts" | "requests" | "monthly" | "summary" | "attendance" | "ops">("schedule");
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [staff, setStaff] = useState<{ id: string; name: string; email?: string }[]>([]);
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

  // Email modal
  const [emailModal, setEmailModal] = useState(false);
  const [emailMode, setEmailMode] = useState<"all" | "single">("all");
  const [emailUserId, setEmailUserId] = useState("");
  const [emailOverride, setEmailOverride] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<string | null>(null);
  // period selection inside modal
  const [emailPeriodType, setEmailPeriodType] = useState<"weekly" | "monthly">("weekly");
  const [emailWeekOffset, setEmailWeekOffset] = useState(0);
  const [emailMonth, setEmailMonth] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`; });

  function openEmailModal() {
    setEmailPeriodType(activeTab === "monthly" ? "monthly" : "weekly");
    setEmailWeekOffset(weekOffset);
    setEmailMonth(monthlyMonth);
    setEmailResult(null); setEmailOverride(""); setEmailUserId("");
    setEmailModal(true);
  }

  async function sendShiftsEmail() {
    if (emailSending) return;
    setEmailSending(true); setEmailResult(null);
    const emailWeekDates = getWeekDates(emailWeekOffset);
    let from = "", to = "", periodLabel = "";
    if (emailPeriodType === "monthly") {
      const [y, m] = emailMonth.split("-").map(Number);
      const last = new Date(y, m, 0).getDate();
      from = `${emailMonth}-01`;
      to   = `${emailMonth}-${String(last).padStart(2,"0")}`;
      periodLabel = `${MONTHS_HE[m-1]} ${y}`;
    } else {
      from = formatDateISO(emailWeekDates[0]);
      to   = formatDateISO(emailWeekDates[6]);
      periodLabel = weekLabel(emailWeekDates);
    }
    try {
      const res = await fetch("/api/admin/shifts/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, from, to, periodLabel, mode: emailMode, userId: emailUserId || undefined, overrideEmail: emailOverride || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setEmailResult(`✅ נשלח ל-${data.sent} נמען${data.failed > 0 ? ` | ❌ נכשל: ${data.failed}` : ""}`);
      } else {
        setEmailResult(`❌ שגיאה: ${data.error ?? "unknown"}`);
      }
    } catch { setEmailResult("❌ שגיאת רשת"); }
    finally { setEmailSending(false); }
  }

  // SMS modal
  const [smsModal, setSmsModal] = useState(false);
  const [smsTarget, setSmsTarget] = useState<"all" | string>("all");
  const [smsShort, setSmsShort] = useState(false);
  const [smsSending, setSmsSending] = useState(false);

  // Operational tab data
  type SmsLog = { id: string; recipientName: string; phone: string; message: string; status: string; sentAt: string; weekFrom: string; weekTo: string; charCount?: number; smsCount?: number; restaurantName?: string };
  type SmsStat = { week: string; total: number; failed: number };
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
  const [smsStats, setSmsStats] = useState<SmsStat[]>([]);
  const [smsConfigured, setSmsConfigured] = useState(true);
  const [opsLoading, setOpsLoading] = useState(false);

  // Ops filter
  type OpsPreset = "all" | "week" | "month" | "custom";
  const [opsPreset, setOpsPreset] = useState<OpsPreset>("all");
  const [opsFrom, setOpsFrom] = useState("");
  const [opsTo,   setOpsTo]   = useState("");

  // Attendance tab
  type AttRecord = { id: string; userId: string; type: string; date: string; timestamp: string; note: string | null };
  const [attRecords, setAttRecords] = useState<AttRecord[]>([]);
  const [attMode, setAttMode] = useState<"weekly" | "monthly" | "range">("weekly");
  const [attMonth, setAttMonth] = useState(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`; });
  const [attFrom, setAttFrom] = useState("");
  const [attTo,   setAttTo]   = useState("");
  const [attLoading, setAttLoading] = useState(false);

  // Monthly tab
  const [monthlyMonth, setMonthlyMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [monthlyShifts, setMonthlyShifts] = useState<ShiftRow[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

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
  function applyPreset(preset: OpsPreset) {
    setOpsPreset(preset);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (preset === "week") {
      const sun = new Date(now); sun.setDate(now.getDate() - now.getDay()); sun.setHours(0,0,0,0);
      setOpsFrom(fmt(sun)); setOpsTo(fmt(now));
    } else if (preset === "month") {
      const first = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      setOpsFrom(fmt(first)); setOpsTo(fmt(now));
    } else if (preset === "all") {
      setOpsFrom(""); setOpsTo("");
    }
  }

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
        setStaff(items.map(ru => ({ id: ru.user.id, name: ru.user.name || ru.user.email, email: ru.user.email })));
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

  // Load monthly shifts
  const loadMonthlyShifts = useCallback(async () => {
    if (!restaurantId) return;
    const [y, m] = monthlyMonth.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    const from = `${monthlyMonth}-01`;
    const to   = `${monthlyMonth}-${String(last).padStart(2, "0")}`;
    setMonthlyLoading(true);
    try {
      const res = await fetch(`/api/admin/shifts?restaurantId=${restaurantId}&from=${from}&to=${to}`);
      const data = await res.json();
      setMonthlyShifts(data.shifts ?? []);
    } catch { setMonthlyShifts([]); }
    finally { setMonthlyLoading(false); }
  }, [restaurantId, monthlyMonth]);

  useEffect(() => { if (activeTab === "monthly") loadMonthlyShifts(); }, [activeTab, loadMonthlyShifts]);

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
      if (activeTab === "monthly") loadMonthlyShifts(); else loadShifts();
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
        if (activeTab === "monthly") loadMonthlyShifts(); else loadShifts();
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
  function buildPreview(targetId: "all" | string, short = false): string {
    const weekShifts = shifts.filter(s => {
      const d = String(s.date).slice(0, 10);
      return d >= formatDateISO(weekDates[0]) && d <= formatDateISO(weekDates[6]);
    });
    const target = targetId === "all" ? weekShifts : weekShifts.filter(s => s.userId === targetId);
    if (!target.length) return "(אין משמרות לשלוח)";
    const name = targetId === "all" ? "[שם]" : (staff.find(s => s.id === targetId)?.name?.split(" ")[0] ?? "[שם]");
    const from = formatDateISO(weekDates[0]);
    const to   = formatDateISO(weekDates[6]);
    const fmtDate = (iso: string) => iso.slice(8) + "/" + iso.slice(5, 7);
    const DAY_S = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
    const lines = (targetId === "all" ? target.slice(0, 3) : target).map(s => {
      const cfg = shiftCfgList.find(c => c.key === s.shiftType);
      const label = cfg?.label ?? s.shiftType;
      const d = new Date(String(s.date).slice(0,10) + "T00:00:00");
      const ft = (t: string) => { const [h,m] = t.slice(0,5).split(":").map(Number); return m === 0 ? String(h) : `${h}:${String(m).padStart(2,"0")}`; };
      return short
        ? `${DAY_S[d.getDay()]} ${fmtDate(String(s.date).slice(0,10))} ${label}`
        : `${DAY_S[d.getDay()]} ${fmtDate(String(s.date).slice(0,10))} ${label} ${ft(s.startTime)}-${ft(s.endTime)}`;
    });
    if (targetId === "all" && target.length > 3) lines.push(`...ועוד ${target.length - 3}`);
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
          shortFormat: smsShort,
        }),
      });
      const d = await res.json();
      if (!res.ok) { showToast(d.error ?? "שגיאה"); return; }
      setSmsModal(false);
      const debugStr = d.debug?.map((x: {phone:string;ok:boolean;response?:string}) =>
        `${x.phone}: ${x.ok ? "✓" : "✗ " + (x.response ?? "")}`
      ).join(" | ") ?? "";
      const summary = `SMS: ${d.sent} נשלחו${d.failed ? `, ${d.failed} נכשלו` : ""}${d.skipped ? `, ${d.skipped} ללא טלפון` : ""}`;
      console.log("[SMS debug]", debugStr);
      showToast(d.sent === 0 && d.failed === 0 ? `⚠️ לא נמצאו עובדים עם טלפון — ${d.skipped ?? 0} ללא טלפון` : summary);
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

  async function clearUserWeek(userId: string, userName: string) {
    const userWeekShifts = shifts.filter(s => {
      const d = String(s.date).slice(0, 10);
      return s.userId === userId && d >= formatDateISO(weekDates[0]) && d <= formatDateISO(weekDates[6]);
    });
    if (userWeekShifts.length === 0) { showToast(`אין משמרות ל${userName} השבוע`); return; }

    setShifts(prev => prev.filter(s => !userWeekShifts.some(ws => ws.id === s.id)));
    setUndoShifts(userWeekShifts);

    showToast(`🗑️ נמחקו משמרות של ${userName}`, async () => {
      setShifts(prev => [...prev, ...userWeekShifts].sort((a, b) => a.date.localeCompare(b.date)));
      setUndoShifts(null);
      for (const s of userWeekShifts) {
        await fetch("/api/admin/shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ restaurantId, userId: s.userId, date: s.date, shiftType: s.shiftType }),
        });
      }
    });

    await Promise.all(userWeekShifts.map(s =>
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

  // ── Tab: Schedule ──────────────────────────────────────────────────────────
  function ScheduleTab() {
    const displayStaff = staff.length > 0 ? staff : Array.from(
      new Map(shifts.map(s => [s.userId, { id: s.userId, name: s.userName }])).values()
    );
    const todayIso = formatDateISO(new Date());

    return (
      <div>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: GM, fontSize: 16 }}>טוען...</div>
        ) : (
          <div>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", direction: "rtl" }}>
              <thead>
                <tr>
                  <th style={{ padding: "8px 6px", color: GM, fontWeight: 500, fontSize: 12, borderBottom: "1px solid rgba(255,255,255,0.08)", textAlign: "right", width: "12%" }}>עובד</th>
                  {weekDates.map((d, i) => {
                    const iso = formatDateISO(d);
                    const isToday = iso === todayIso;
                    const selectedRestaurant = restaurants.find(r => r.id === restaurantId);
                    const dayStatus = getDayStatus(selectedRestaurant?.openingHours, d);
                    return (
                      <th key={i} style={{ padding: "8px 4px", color: GM, fontWeight: 500, fontSize: 12, borderBottom: "1px solid rgba(255,255,255,0.08)", textAlign: "center", width: "12.57%" }}>
                        <div style={{
                          display: "inline-flex", flexDirection: "column", alignItems: "center",
                          padding: "6px 10px",
                          borderRadius: isToday ? 999 : 0,
                          background: isToday ? "rgba(96,165,250,0.15)" : "transparent",
                          border: isToday ? "2px solid #60A5FA" : "2px solid transparent",
                          minWidth: isToday ? 52 : "unset",
                          boxShadow: isToday ? "0 0 14px rgba(96,165,250,0.2)" : "none",
                          transition: "all 0.2s",
                        }}>
                          <span style={{ fontSize: 15, fontWeight: 900, color: isToday ? "#60A5FA" : "#fff", lineHeight: 1 }}>{DAYS_HE[i]}</span>
                          <span style={{ fontSize: 11, color: isToday ? "#93C5FD" : "rgba(255,255,255,0.65)", marginTop: 3, lineHeight: 1 }}>{formatDate(d)}</span>
                          {dayStatus.closed && (
                            <span style={{ fontSize: 9, color: dayStatus.holiday ? "#FBBF24" : "rgba(248,113,113,0.8)", marginTop: 3, lineHeight: 1 }}>
                              {dayStatus.holiday ? `חג` : "סגור"}
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {displayStaff.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: 32, color: GM }}>אין עובדים להצגה</td>
                  </tr>
                ) : displayStaff.map(member => (
                  <tr key={member.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "8px 4px", color: "#fff", fontSize: 13, fontWeight: 700, verticalAlign: "middle" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{member.name}</span>
                        {isManager && (
                          <button
                            onClick={() => clearUserWeek(member.id, member.name)}
                            title={`נקה שבוע של ${member.name}`}
                            style={{ background: "none", border: "none", color: "rgba(248,113,113,0.5)", cursor: "pointer", padding: "2px 3px", fontSize: 12, lineHeight: 1, borderRadius: 5, flexShrink: 0, transition: "color 0.15s" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#F87171"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(248,113,113,0.5)"; }}
                          >🗑️</button>
                        )}
                      </div>
                    </td>
                    {weekDates.map((d, di) => {
                      const iso = formatDateISO(d);
                      const isPast  = iso < todayIso;
                      const selectedRestaurant = restaurants.find(r => r.id === restaurantId);
                      const dayStatus = getDayStatus(selectedRestaurant?.openingHours, d);
                      const isClosed = dayStatus.closed;
                      const dayShifts = shifts.filter(s => s.userId === member.id && String(s.date).slice(0, 10) === iso);
                      const canAdd = isManager && !isPast && !isClosed;
                      return (
                        <td
                          key={di}
                          style={{ padding: "4px 3px", verticalAlign: "middle", cursor: canAdd && dayShifts.length === 0 ? "pointer" : "default", background: isClosed ? "rgba(255,255,255,0.02)" : "transparent" }}
                          onClick={() => {
                            if (canAdd && dayShifts.length === 0) {
                              setAddModal({ userId: member.id, userName: member.name, date: iso });
                            }
                          }}
                        >
                          {dayShifts.length > 0 ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              {dayShifts.map(sh => {
                                const cfg = SHIFT_CFG[sh.shiftType] ?? { label: sh.shiftType, time: `${sh.startTime}–${sh.endTime}`, color: "#6b7280" };
                                const gs = glassShift(cfg.color);
                                return (
                                  <div
                                    key={sh.id}
                                    style={{
                                      background: gs.bg,
                                      border: `1px solid ${gs.border}`,
                                      borderRadius: 9,
                                      padding: "6px 24px 6px 8px",
                                      minHeight: 42,
                                      position: "relative",
                                      transition: "transform 0.15s, box-shadow 0.15s",
                                      display: "flex",
                                      flexDirection: "column",
                                      justifyContent: "center",
                                    }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "scale(1.02)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.25)"; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "scale(1)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
                                  >
                                    <span style={{ color: gs.text, fontSize: 12, fontWeight: 700 }}>{cfg.label}</span>
                                    <span style={{ color: gs.text, fontSize: 10, opacity: 0.8, marginTop: 1 }}>{cfg.time}</span>
                                    {isManager && (
                                      <button
                                        onClick={e => { e.stopPropagation(); deleteShift(sh.id); }}
                                        className="shift-del-btn"
                                        style={{
                                          position: "absolute", left: 6, top: "50%", transform: "translateY(-50%)",
                                          background: "none", border: "none", color: gs.text, opacity: 0,
                                          cursor: "pointer", padding: 4, display: "flex", alignItems: "center",
                                          borderRadius: 5, transition: "opacity 0.15s", fontSize: 12,
                                        }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.1)"; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0"; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                                        title="מחק"
                                      >✕</button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 42 }}>
                              {isClosed ? (
                                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", userSelect: "none" }}>—</span>
                              ) : canAdd ? (
                                <button
                                  style={{
                                    background: "none", border: "1px dashed rgba(255,255,255,0.12)",
                                    color: GM, width: 32, height: 32, borderRadius: 8,
                                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                                    opacity: 0, transition: "0.15s", fontSize: 16,
                                  }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.3)"; (e.currentTarget as HTMLButtonElement).style.color = "#fff"; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)"; (e.currentTarget as HTMLButtonElement).style.color = GM; }}
                                  onClick={e => { e.stopPropagation(); setAddModal({ userId: member.id, userName: member.name, date: iso }); }}
                                >+</button>
                              ) : null}
                            </div>
                          )}
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
          <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: MODAL_BG, border: `1px solid ${MODAL_BORDER}`, borderRadius: 18, padding: 26, width: 340, maxWidth: "90vw", direction: "rtl", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", marginBottom: 4 }}>הוסף משמרת</div>
              <div style={{ fontSize: 13, color: GM, marginBottom: addModal.userId ? 20 : 10 }}>
                {addModal.userId ? addModal.userName : addModal.date.split("-").reverse().join("/")}
                {addModal.userId ? ` — ${addModal.date.split("-").reverse().join("/")}` : ""}
              </div>
              {!addModal.userId && (
                <select
                  value={addModal.userId}
                  onChange={e => {
                    const sel = staff.find(s => s.id === e.target.value);
                    if (sel) setAddModal(prev => prev ? { ...prev, userId: sel.id, userName: sel.name } : prev);
                  }}
                  style={{ width: "100%", marginBottom: 16, padding: "8px 10px", borderRadius: 9, background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", colorScheme: "dark" }}
                >
                  <option value="">— בחר עובד —</option>
                  {staff.map(s => <option key={s.id} value={s.id} style={{ background: "#1a1a2e" }}>{s.name}</option>)}
                </select>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {Object.entries(SHIFT_CFG).map(([key, cfg]) => {
                  const gs = glassShift(cfg.color);
                  return (
                    <button
                      key={key}
                      onClick={() => addShift(key)}
                      disabled={addLoading}
                      style={{
                        background: gs.bg, border: `2px solid ${gs.border}`, borderRadius: 11,
                        padding: "12px 8px", cursor: "pointer", display: "flex", flexDirection: "column",
                        alignItems: "center", gap: 4, opacity: addLoading ? 0.6 : 1, transition: "0.15s",
                      }}
                    >
                      <span style={{ color: gs.text, fontWeight: 700, fontSize: 14 }}>{cfg.label}</span>
                      <span style={{ color: gs.text, fontSize: 11, opacity: 0.8 }}>{cfg.time}</span>
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setAddModal(null)}
                style={{ marginTop: 16, width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, borderRadius: 9, color: GM, padding: "8px", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}
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
      const map: Record<string, { label: string; bg: string; color: string; border: string }> = {
        SCHEDULED: { label: "מתוכנן", bg: "rgba(59,130,246,0.15)", color: "#60A5FA", border: "rgba(59,130,246,0.3)" },
        COMPLETED: { label: "הושלם",  bg: "rgba(16,185,129,0.15)", color: "#34D399", border: "rgba(16,185,129,0.3)" },
        CANCELLED: { label: "בוטל",   bg: "rgba(239,68,68,0.15)",  color: "#F87171", border: "rgba(239,68,68,0.3)"  },
      };
      const s = map[status] ?? { label: status, bg: "rgba(255,255,255,0.08)", color: "#fff", border: GB };
      return (
        <span style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 99, color: s.color, fontSize: 11, fontWeight: 700, padding: "3px 10px" }}>
          {s.label}
        </span>
      );
    };

    if (myShifts.length === 0) {
      return (
        <div style={{ textAlign: "center", padding: 60, color: GM, fontSize: 16 }}>
          אין משמרות קרובות
        </div>
      );
    }

    return (
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: GM, marginBottom: 12 }}>
          המשמרות שלי — 14 הימים הקרובים
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {myShifts.map(sh => {
            const cfg = SHIFT_CFG[sh.shiftType] ?? { label: sh.shiftType, time: `${sh.startTime}–${sh.endTime}`, color: "#6b7280" };
            const gs = glassShift(cfg.color);
            const d = new Date(sh.date);
            const dayName = DAYS_HE[d.getDay()];
            return (
              <div key={sh.id} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${GB}`, borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <div style={{ minWidth: 52, textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{dayName}</div>
                  <div style={{ fontSize: 11, color: GM, marginTop: 2 }}>{formatDate(d)}</div>
                </div>
                <div style={{ background: gs.bg, border: `1px solid ${gs.border}`, borderRadius: 11, padding: "8px 14px", flexShrink: 0 }}>
                  <div style={{ color: gs.text, fontWeight: 700, fontSize: 13 }}>{cfg.label}</div>
                  <div style={{ color: gs.text, fontSize: 11, opacity: 0.8, marginTop: 1 }}>{cfg.time}</div>
                </div>
                <div style={{ flex: 1 }} />
                {statusBadge(sh.status)}
                <button
                  onClick={() => { setSwapModal(sh); setSwapReason(""); }}
                  style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 9, color: "#60A5FA", fontSize: 12, fontWeight: 700, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit" }}
                >
                  🔄 בקש החלפה
                </button>
              </div>
            );
          })}
        </div>

        {/* Swap Modal */}
        {swapModal && (
          <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: MODAL_BG, border: `1px solid ${MODAL_BORDER}`, borderRadius: 18, padding: 26, width: 360, maxWidth: "90vw", direction: "rtl", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", marginBottom: 4 }}>🔄 בקשת החלפת משמרת</div>
              <div style={{ fontSize: 13, color: GM, marginBottom: 16 }}>
                {SHIFT_CFG[swapModal.shiftType]?.label ?? swapModal.shiftType} — {swapModal.date.slice(0, 10).split("-").reverse().join("/")}
              </div>
              <label style={{ fontSize: 13, color: GM, display: "block", marginBottom: 4 }}>סיבה (אופציונלי)</label>
              <textarea
                value={swapReason}
                onChange={e => setSwapReason(e.target.value)}
                rows={3}
                placeholder="כתוב סיבה..."
                style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, borderRadius: 9, color: "#fff", fontSize: 14, padding: "7px 10px", width: "100%", outline: "none", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button
                  onClick={submitSwap}
                  disabled={swapLoading}
                  style={{ flex: 1, background: "rgba(59,130,246,0.2)", border: "1px solid rgba(59,130,246,0.4)", borderRadius: 9, color: "#60A5FA", fontSize: 14, fontWeight: 700, padding: "10px", cursor: "pointer", fontFamily: "inherit", opacity: swapLoading ? 0.6 : 1 }}
                >
                  {swapLoading ? "שולח..." : "שלח בקשה"}
                </button>
                <button
                  onClick={() => setSwapModal(null)}
                  style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, borderRadius: 9, color: GM, fontSize: 14, padding: "10px", cursor: "pointer", fontFamily: "inherit" }}
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

    if (requestsLoading) {
      return <div style={{ textAlign: "center", padding: 40, color: GM }}>טוען...</div>;
    }

    if (displayRequests.length === 0) {
      return <div style={{ textAlign: "center", padding: 60, color: GM, fontSize: 16 }}>אין בקשות להצגה</div>;
    }

    return (
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: GM, marginBottom: 12 }}>
          בקשות פתוחות
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {displayRequests.map(req => {
            const shiftCfg = SHIFT_CFG[req.shiftType] ?? { label: req.shiftType, color: "#6b7280" };
            const gs = glassShift(shiftCfg.color);
            return (
              <div key={req.id} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${GB}`, borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
                    {typeLabelMap[req.type] ?? req.type} — {req.fromUserName}
                  </div>
                  <div style={{ fontSize: 12, color: GM, marginTop: 3 }}>
                    משמרת {shiftCfg.label} {req.shiftDate?.slice(0, 10).split("-").reverse().join("/")}
                    {req.reason ? ` · סיבה: ${req.reason}` : " · אין סיבה"}
                  </div>
                </div>
                <span style={{ background: "rgba(251,191,36,0.15)", color: "#FBBF24", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 99, fontSize: 11, fontWeight: 700, padding: "3px 10px", flexShrink: 0 }}>
                  ממתין לאישור
                </span>
                {isManager && req.status === "PENDING" && (
                  <>
                    <button
                      onClick={() => respondRequest(req.id, "APPROVED")}
                      style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 9, color: "#34D399", fontSize: 12, fontWeight: 700, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit" }}
                    >
                      ✓ אשר
                    </button>
                    <button
                      onClick={() => respondRequest(req.id, "REJECTED")}
                      style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 9, color: "#F87171", fontSize: 12, fontWeight: 700, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit" }}
                    >
                      ✕ דחה
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
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

  // ── Tab: Monthly ───────────────────────────────────────────────────────────
  function MonthlyTab() {
    const [y, m] = monthlyMonth.split("-").map(Number);
    const firstDay = new Date(y, m - 1, 1);
    const daysInMonth = new Date(y, m, 0).getDate();
    const todayIso = formatDateISO(new Date());
    const activeRest = restaurants.find(r => r.id === restaurantId);

    // Build weeks (rows of 7, starting Sunday)
    const startOffset = firstDay.getDay(); // 0=Sun
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
    const cells: (Date | null)[] = [];
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - startOffset + 1;
      cells.push(dayNum >= 1 && dayNum <= daysInMonth ? new Date(y, m - 1, dayNum) : null);
    }

    const navBtnStyle: React.CSSProperties = {
      background: "none", border: "none", color: GM, cursor: "pointer",
      padding: "4px 8px", borderRadius: 7, fontSize: 16, display: "flex", alignItems: "center", transition: "0.15s",
    };

    return (
      <div>
        {/* Month navigator */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <button
            style={navBtnStyle}
            onClick={() => {
              const [cy, cm] = monthlyMonth.split("-").map(Number);
              const prev = new Date(cy, cm - 2, 1);
              setMonthlyMonth(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`);
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#fff"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = GM; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
          >‹</button>
          <span style={{ fontSize: 15, fontWeight: 800, minWidth: 130, textAlign: "center" }}>
            {MONTHS_HE[m - 1]} {y}
          </span>
          <button
            style={navBtnStyle}
            onClick={() => {
              const [cy, cm] = monthlyMonth.split("-").map(Number);
              const next = new Date(cy, cm, 1);
              setMonthlyMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#fff"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = GM; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
          >›</button>
          {monthlyLoading && <span style={{ fontSize: 11, color: GM, marginRight: 4 }}>טוען...</span>}
        </div>

        {/* Day headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 4 }}>
          {DAYS_HE.map((d, i) => (
            <div key={d} style={{
              textAlign: "center", fontSize: 11, fontWeight: 700, padding: "4px 0",
              color: i === 5 ? "rgba(248,113,113,0.65)" : i === 6 ? "rgba(148,163,184,0.4)" : GM,
              letterSpacing: "0.3px",
            }}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
          {cells.map((date, idx) => {
            if (!date) return <div key={idx} />;
            const iso = formatDateISO(date);
            const dayStatus = getDayStatus(activeRest?.openingHours, date);
            const isClosed = dayStatus.closed;
            const isToday = iso === todayIso;
            const dayShifts = monthlyShifts.filter(s => s.date.slice(0, 10) === iso);

            return (
              <div key={iso} style={{
                background: isClosed ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.04)",
                border: isToday
                  ? "2px solid #60A5FA"
                  : `1px solid ${isClosed ? "rgba(255,255,255,0.05)" : GB}`,
                borderRadius: 10,
                minHeight: 80,
                padding: "6px 5px",
                boxShadow: isToday ? "0 0 14px rgba(96,165,250,0.18)" : "none",
                cursor: isClosed ? "not-allowed" : "default",
                transition: "background 0.12s",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: isToday ? "#60A5FA" : isClosed ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.65)" }}>
                    {date.getDate()}
                  </span>
                  {isClosed && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.22)" }}>סגור</span>}
                </div>

                {dayShifts.map(sh => {
                  const cfg = SHIFT_CFG[sh.shiftType] ?? { label: sh.shiftType, time: `${sh.startTime}–${sh.endTime}`, color: "#6b7280" };
                  const gs = glassShift(cfg.color);
                  return (
                    <div
                      key={sh.id}
                      title={`${sh.userName} — ${cfg.label} ${sh.startTime.slice(0,5)}–${sh.endTime.slice(0,5)}`}
                      onClick={() => isManager && deleteShift(sh.id)}
                      style={{
                        fontSize: 9, fontWeight: 600, borderRadius: 4, padding: "2px 4px",
                        marginBottom: 2, display: "flex", alignItems: "center", gap: 2,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        background: gs.bg, color: gs.text, border: `1px solid ${gs.border}`,
                        cursor: isManager ? "pointer" : "default",
                      }}
                    >
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                        {sh.userName.split(" ")[0]} {sh.startTime.slice(0,5)}
                      </span>
                    </div>
                  );
                })}

                {isManager && !isClosed && (
                  <button
                    onClick={() => setAddModal({ userId: "", userName: "", date: iso })}
                    style={{
                      width: "100%", marginTop: 2, padding: "2px 0", borderRadius: 4, fontSize: 9,
                      background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.25)", cursor: "pointer", fontFamily: "inherit",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(217,119,6,0.1)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(217,119,6,0.35)"; (e.currentTarget as HTMLButtonElement).style.color = "#FCD34D"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.1)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.25)"; }}
                  >+ הוסף</button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
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

    async function deleteRecord(id: string) {
      await fetch(`/api/admin/attendance?id=${encodeURIComponent(id)}&note=${encodeURIComponent(deleteNote || "תוקן ע\"י מנהל")}`, { method: "DELETE" });
      setDeleteConfirm(null); setDeleteNote("");
      loadAttendance();
    }

    const fmtT = (ts: string) => new Date(ts).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });

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
                                  <button
                                    onClick={() => setDeleteConfirm({ id: r.id, label: `${r.type === "IN" ? "כניסה" : "יציאה"} ${fmtT(r.timestamp)}` })}
                                    title="מחק רשומה"
                                    style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: 10, padding: "0 0 0 2px", lineHeight: 1, fontFamily: "inherit" }}
                                    onMouseEnter={e => (e.currentTarget.style.color = "#F87171")}
                                    onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
                                  >✕</button>
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
              <input
                type="text" value={deleteNote} onChange={e => setDeleteNote(e.target.value)}
                placeholder="סיבת תיקון (אופציונלי)"
                style={{ width: "100%", padding: "8px 11px", borderRadius: 9, background: "rgba(255,255,255,0.07)", border: `1px solid ${GB}`, color: "#fff", fontSize: 13, outline: "none", marginBottom: 14, fontFamily: "inherit", boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => deleteRecord(deleteConfirm.id)} style={{ flex: 1, padding: "9px", borderRadius: 9, border: "none", background: "#ef4444", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>אשר מחיקה</button>
                <button onClick={() => setDeleteConfirm(null)} style={{ padding: "9px 16px", borderRadius: 9, background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, color: GM, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>ביטול</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Tab: Ops ───────────────────────────────────────────────────────────────
  function OpsTab() {
    if (opsLoading) return <div style={{ textAlign: "center", padding: 40, color: GM }}>טוען...</div>;

    const filtered = smsLogs.filter(l => {
      const t = new Date(l.sentAt).getTime();
      if (opsFrom && t < new Date(opsFrom).getTime()) return false;
      if (opsTo   && t > new Date(opsTo).getTime())   return false;
      return true;
    });

    const totalSent     = filtered.filter(l => l.status === "SENT").length;
    const totalFailed   = filtered.filter(l => l.status === "FAILED").length;
    const totalSmsUnits = filtered.filter(l => l.status === "SENT").reduce((acc, l) => acc + (l.smsCount ?? (l.message ? (l.message.length <= 70 ? 1 : Math.ceil(l.message.length / 67)) : 1)), 0);

    const inpStyle: React.CSSProperties = { background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, borderRadius: 9, color: "#fff", fontSize: 13, padding: "6px 10px", fontFamily: "inherit", outline: "none", colorScheme: "dark" };
    const presetBtn = (key: OpsPreset, label: string) => (
      <button key={key} onClick={() => applyPreset(key)} style={{ background: opsPreset === key ? ACCENT_GRAD : "rgba(255,255,255,0.06)", border: `1px solid ${opsPreset === key ? ACCENT : GB}`, borderRadius: 9, color: opsPreset === key ? "#fff" : GM, fontSize: 13, fontWeight: opsPreset === key ? 700 : 400, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit" }}>
        {label}
      </button>
    );

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Filter bar */}
        <div style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${GB}`, borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {presetBtn("all",   "הכל")}
            {presetBtn("week",  "שבוע זה")}
            {presetBtn("month", "החודש")}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: GM }}>מ:</span>
            <input type="datetime-local" value={opsFrom} style={inpStyle}
              onChange={e => { setOpsFrom(e.target.value); setOpsPreset("custom"); }} />
            <span style={{ fontSize: 13, color: GM }}>עד:</span>
            <input type="datetime-local" value={opsTo} style={inpStyle}
              onChange={e => { setOpsTo(e.target.value); setOpsPreset("custom"); }} />
            {(opsFrom || opsTo) && (
              <button onClick={() => applyPreset("all")} style={{ background: "transparent", border: "none", color: GM, fontSize: 13, cursor: "pointer", padding: "0 4px" }}>✕ נקה</button>
            )}
          </div>
        </div>

        {/* Ops 2-column cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* SMS stats card */}
          <div style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${GB}`, borderRadius: 16, padding: 18 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: GM, textTransform: "uppercase", letterSpacing: "0.06em" }}>סטטיסטיקות SMS</h3>
            {[
              { label: "הודעות נשלחו", value: totalSent,      color: "#34D399" },
              { label: "SMS (לתשלום)", value: totalSmsUnits,  color: "#60A5FA" },
              { label: "נכשלו",        value: totalFailed,    color: "#F87171" },
              { label: "שבועות",       value: smsStats.length, color: GM },
            ].map(c => (
              <div key={c.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13, color: "rgba(255,255,255,0.75)" }}>
                <span>{c.label}</span>
                <span style={{ fontWeight: 700, color: c.color }}>{c.value}</span>
              </div>
            ))}
          </div>

          {/* Per-week stats card */}
          <div style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${GB}`, borderRadius: 16, padding: 18 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: GM, textTransform: "uppercase", letterSpacing: "0.06em" }}>לפי שבוע</h3>
            {smsStats.length === 0 ? (
              <div style={{ fontSize: 13, color: GM, padding: "12px 0" }}>טרם נשלחו הודעות</div>
            ) : smsStats.map((s, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13, color: "rgba(255,255,255,0.75)" }}>
                <span>{s.week}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <span style={{ background: "rgba(16,185,129,0.2)", color: "#34D399", borderRadius: 99, fontSize: 11, fontWeight: 700, padding: "2px 10px" }}>✓ {s.total - s.failed}</span>
                  {s.failed > 0 && <span style={{ background: "rgba(239,68,68,0.2)", color: "#F87171", borderRadius: 99, fontSize: 11, fontWeight: 700, padding: "2px 10px" }}>✗ {s.failed}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Log table */}
        {filtered.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: GM, marginBottom: 8 }}>יומן שליחות ({filtered.length})</div>
            <div style={{ overflowX: "auto", borderRadius: 10, border: `1px solid ${GB}` }}>
              <table style={{ width: "100%", borderCollapse: "collapse", direction: "rtl" }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                    {["מסעדה", "שם", "טלפון", "שבוע", "הודעה", "תווים", "SMS", "סטטוס", "נשלח"].map(h => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "right", fontSize: 11, color: GM, fontWeight: 600, borderBottom: `1px solid ${GB}`, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(l => {
                    const chars = l.charCount ?? l.message?.length ?? 0;
                    const units = l.smsCount ?? (chars <= 70 ? 1 : Math.ceil(chars / 67));
                    return (
                      <tr key={l.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "8px 12px", fontSize: 11, color: GM, whiteSpace: "nowrap" }}>{l.restaurantName ?? ""}</td>
                        <td style={{ padding: "8px 12px", fontSize: 13, color: "#fff", whiteSpace: "nowrap" }}>{l.recipientName}</td>
                        <td style={{ padding: "8px 12px", fontSize: 13, color: GM }}>{l.phone}</td>
                        <td style={{ padding: "8px 12px", fontSize: 11, color: GM, whiteSpace: "nowrap" }}>{l.weekFrom?.slice(5).split("-").reverse().join("/")}–{l.weekTo?.slice(5).split("-").reverse().join("/")}</td>
                        <td style={{ padding: "8px 12px", fontSize: 11, color: GM, maxWidth: 200 }}>
                          <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.message}</span>
                        </td>
                        <td style={{ padding: "8px 12px", fontSize: 11, color: GM, textAlign: "right" }}>{chars}</td>
                        <td style={{ padding: "8px 12px", fontSize: 11, fontWeight: 700, color: units === 1 ? "#34D399" : "#FB923C", textAlign: "right" }}>{units}</td>
                        <td style={{ padding: "8px 12px" }}>
                          <span style={{ background: l.status === "SENT" ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)", color: l.status === "SENT" ? "#34D399" : "#F87171", borderRadius: 99, fontSize: 11, fontWeight: 700, padding: "2px 8px" }}>
                            {l.status === "SENT" ? "✓ נשלח" : "✗ נכשל"}
                          </span>
                        </td>
                        <td style={{ padding: "8px 12px", fontSize: 11, color: GM, whiteSpace: "nowrap" }}>
                          {new Date(l.sentAt).toLocaleDateString("he-IL")} {new Date(l.sentAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {filtered.length === 0 && !opsLoading && (
          <div style={{ textAlign: "center", padding: 60, color: GM, fontSize: 16 }}>
            {smsLogs.length === 0 ? "טרם נשלחו הודעות SMS" : "אין תוצאות לטווח התאריכים שנבחר"}
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
            {toast.undo && (
              <button
                onClick={() => { toast.undo!(); setToast(null); }}
                style={{ background: ACCENT_GRAD, border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 800, padding: "4px 12px", cursor: "pointer", fontFamily: "inherit" }}
              >
                ↩ בטל
              </button>
            )}
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
              📅 ניהול משמרות
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
                    if (activeTab === "schedule" || activeTab === "myshifts") loadShifts();
                    else if (activeTab === "monthly") loadMonthlyShifts();
                    else if (activeTab === "summary") loadSummaryShifts();
                    else if (activeTab === "attendance") loadAttendance();
                    else if (activeTab === "requests") loadRequests();
                    else if (activeTab === "ops") loadOps();
                  }}
                  style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, color: "#fff", padding: "7px 13px", borderRadius: 9, fontFamily: "inherit", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "0.15s" }}
                >
                  🔄 רענון
                </button>
                {(activeTab === "schedule" || activeTab === "monthly") && (
                  <button
                    onClick={openEmailModal}
                    style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.35)", color: "#93C5FD", padding: "7px 13px", borderRadius: 9, fontFamily: "inherit", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "0.15s" }}
                  >
                    ✉️ שלח מייל
                  </button>
                )}
                <button
                  onClick={() => setSmsModal(true)}
                  style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.35)", color: "#93C5FD", padding: "7px 13px", borderRadius: 9, fontFamily: "inherit", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "0.15s" }}
                >
                  📱 שלח SMS
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
          {tabBtn("schedule", "📅 שבועי")}
          {isManager && tabBtn("monthly", "📆 חודשי")}
          {tabBtn("myshifts", "👤 המשמרות שלי")}
          {tabBtn("requests", (
            <>
              🔔 בקשות
              {pendingCount > 0 && (
                <span style={{ background: "rgba(239,68,68,0.2)", color: "#F87171", borderRadius: 99, fontSize: 10, fontWeight: 800, padding: "1px 6px" }}>
                  {pendingCount}
                </span>
              )}
            </>
          ))}
          {tabBtn("summary", "📊 סיכום שעות")}
          {isManager && tabBtn("attendance", "🕐 נוכחות")}
          {isManager && tabBtn("ops", "📱 תפעולי")}
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
          {activeTab === "schedule"  && <ScheduleTab />}
          {activeTab === "monthly"   && <MonthlyTab />}
          {activeTab === "myshifts"  && <MyShiftsTab />}
          {activeTab === "requests"  && <RequestsTab />}
          {activeTab === "summary"    && <SummaryTab />}
          {activeTab === "attendance" && <AttendanceTab />}
          {activeTab === "ops"        && <OpsTab />}
        </div>

        {/* ── Email Modal ── */}
        {emailModal && (
          <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: MODAL_BG, border: `1px solid ${MODAL_BORDER}`, borderRadius: 18, padding: 28, width: 420, maxWidth: "95vw", direction: "rtl", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", marginBottom: 14 }}>✉️ שלח מייל משמרות</div>

              {/* Period type toggle */}
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                {(["weekly","monthly"] as const).map(pt => (
                  <button key={pt} onClick={() => setEmailPeriodType(pt)} style={{
                    flex: 1, padding: "7px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600,
                    border: `1px solid ${emailPeriodType === pt ? "rgba(245,158,11,0.45)" : GB}`,
                    background: emailPeriodType === pt ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.04)",
                    color: emailPeriodType === pt ? "#FBBF24" : GM,
                  }}>{pt === "weekly" ? "📅 שבועי" : "📆 חודשי"}</button>
                ))}
              </div>

              {/* Period selector */}
              {emailPeriodType === "weekly" ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, background: "rgba(255,255,255,0.04)", border: `1px solid ${GB}`, borderRadius: 9, padding: "8px 12px" }}>
                  <button onClick={() => setEmailWeekOffset(w => w + 1)} style={{ background: "rgba(255,255,255,0.08)", border: `1px solid ${GB}`, color: "#fff", cursor: "pointer", fontSize: 18, padding: "2px 10px", borderRadius: 7, fontFamily: "inherit", lineHeight: 1 }}>→</button>
                  <span style={{ flex: 1, textAlign: "center", fontSize: 13, color: "#fff", fontWeight: 600 }}>{weekLabel(getWeekDates(emailWeekOffset))}</span>
                  <button onClick={() => setEmailWeekOffset(w => w - 1)} style={{ background: "rgba(255,255,255,0.08)", border: `1px solid ${GB}`, color: "#fff", cursor: "pointer", fontSize: 18, padding: "2px 10px", borderRadius: 7, fontFamily: "inherit", lineHeight: 1 }}>←</button>
                </div>
              ) : (
                <div style={{ marginBottom: 16 }}>
                  <input type="month" value={emailMonth} onChange={e => setEmailMonth(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 9, background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", colorScheme: "dark" }} />
                </div>
              )}

              {/* Mode selector */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {(["all","single"] as const).map(m => (
                  <button key={m} onClick={() => setEmailMode(m)} style={{
                    flex: 1, padding: "9px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit",
                    border: `1px solid ${emailMode === m ? "rgba(59,130,246,0.45)" : GB}`,
                    background: emailMode === m ? "rgba(59,130,246,0.18)" : "rgba(255,255,255,0.05)",
                    color: emailMode === m ? "#93C5FD" : GM, fontWeight: 600, fontSize: 13,
                  }}>
                    {m === "all" ? "👥 כל העובדים" : "👤 עובד ספציפי"}
                  </button>
                ))}
              </div>

              {emailMode === "all" && (
                <div style={{ padding: "10px 14px", background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 9, fontSize: 12, color: "#93C5FD", marginBottom: 16 }}>
                  📨 כל עובד יקבל מייל עם המשמרות שלו בלבד
                </div>
              )}

              {emailMode === "single" && (
                <>
                  <label style={{ fontSize: 12, color: GM, display: "block", marginBottom: 5 }}>בחר עובד</label>
                  <select value={emailUserId} onChange={e => {
                      setEmailUserId(e.target.value);
                      const sel = staff.find(s => s.id === e.target.value);
                      setEmailOverride(sel?.email ?? "");
                    }}
                    style={{ width: "100%", marginBottom: 12, padding: "8px 10px", borderRadius: 9, background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", colorScheme: "dark" }}>
                    <option value="">— בחר עובד —</option>
                    {staff.map(s => <option key={s.id} value={s.id} style={{ background: "#1a1a2e" }}>{s.name}{s.email ? ` (${s.email})` : ""}</option>)}
                  </select>
                  <label style={{ fontSize: 12, color: GM, display: "block", marginBottom: 5 }}>מייל (ניתן לשינוי)</label>
                  <input type="email" value={emailOverride} onChange={e => setEmailOverride(e.target.value)}
                    placeholder="example@email.com"
                    style={{ width: "100%", marginBottom: 16, padding: "8px 10px", borderRadius: 9, background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                </>
              )}

              {emailResult && (
                <div style={{ padding: "9px 14px", borderRadius: 9, marginBottom: 14, fontSize: 13,
                  background: emailResult.startsWith("✅") ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
                  border: `1px solid ${emailResult.startsWith("✅") ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
                  color: emailResult.startsWith("✅") ? "#34D399" : "#F87171" }}>
                  {emailResult}
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={sendShiftsEmail} disabled={emailSending || (emailMode === "single" && !emailUserId && !emailOverride)}
                  style={{ flex: 1, padding: "10px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit", opacity: emailSending ? 0.6 : 1 }}>
                  {emailSending ? "שולח..." : "✉️ שלח עכשיו"}
                </button>
                <button onClick={() => setEmailModal(false)}
                  style={{ padding: "10px 16px", borderRadius: 9, background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, color: GM, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                  סגור
                </button>
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 10, textAlign: "center" }}>נשלח מ-{process.env.NEXT_PUBLIC_GMAIL_USER ?? "menu4u"}</div>
            </div>
          </div>
        )}

        {/* ── SMS Modal ── */}
        {smsModal && (
          <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: MODAL_BG, border: `1px solid ${MODAL_BORDER}`, borderRadius: 18, padding: 28, width: 440, maxWidth: "95vw", direction: "rtl", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", marginBottom: 4 }}>📱 שלח SMS משמרות</div>
              <div style={{ fontSize: 13, color: GM, marginBottom: 20 }}>שבוע {weekLabel(weekDates)}</div>

              <label style={{ fontSize: 13, color: GM, display: "block", marginBottom: 6 }}>שלח ל:</label>
              <select
                value={smsTarget}
                onChange={e => setSmsTarget(e.target.value)}
                style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, borderRadius: 9, color: "#fff", fontSize: 14, padding: "7px 10px", width: "100%", fontFamily: "inherit", outline: "none", marginBottom: 16, colorScheme: "dark" }}
              >
                <option value="all" style={{ background: "#1a1a2e" }}>כל העובדים עם משמרת השבוע</option>
                {staff.map(s => <option key={s.id} value={s.id} style={{ background: "#1a1a2e" }}>{s.name}</option>)}
              </select>

              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <label style={{ fontSize: 13, color: GM }}>פורמט קצר (ללא שעות)</label>
                <div
                  onClick={() => setSmsShort(v => !v)}
                  style={{ width: 40, height: 22, borderRadius: 11, background: smsShort ? ACCENT : "rgba(255,255,255,0.15)", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}
                >
                  <div style={{ position: "absolute", top: 3, left: smsShort ? 20 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                </div>
              </div>

              <label style={{ fontSize: 13, color: GM, display: "block", marginBottom: 6 }}>תצוגה מקדימה:</label>
              {(() => {
                const msg = buildPreview(smsTarget, smsShort);
                const chars = msg.length;
                const smsCount = chars <= 70 ? 1 : Math.ceil(chars / 67);
                const countColor = smsCount === 1 ? "#34D399" : smsCount === 2 ? "#FB923C" : "#F87171";
                return (
                  <>
                    <pre style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${GB}`, borderRadius: 9, padding: "10px 14px", fontSize: 13, color: "#fff", fontFamily: "inherit", whiteSpace: "pre-wrap", marginBottom: 6, lineHeight: 1.6 }}>
                      {msg}
                    </pre>
                    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, marginBottom: 16 }}>
                      <span style={{ fontSize: 11, color: GM }}>{chars} תווים</span>
                      <span style={{ background: `${countColor}20`, color: countColor, borderRadius: 99, fontSize: 11, fontWeight: 700, padding: "2px 10px" }}>
                        {smsCount} SMS
                      </span>
                    </div>
                  </>
                );
              })()}

              {!smsConfigured && (
                <div style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 9, color: "#F87171", fontSize: 13, padding: "8px 12px", marginBottom: 14 }}>
                  ⚠️ SMS לא מוגדר — נדרש INFORU_USERNAME ו-INFORU_API_TOKEN
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={sendSms}
                  disabled={smsSending || !smsConfigured}
                  style={{ flex: 1, background: ACCENT_GRAD, border: "none", borderRadius: 9, color: "#fff", fontSize: 14, fontWeight: 800, padding: 12, cursor: "pointer", fontFamily: "inherit", opacity: smsSending || !smsConfigured ? 0.6 : 1, boxShadow: "0 4px 14px rgba(217,119,6,0.35)" }}
                >
                  {smsSending ? "שולח..." : "📤 שלח"}
                </button>
                <button
                  onClick={() => setSmsModal(false)}
                  style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, borderRadius: 9, color: GM, fontSize: 14, padding: 12, cursor: "pointer", fontFamily: "inherit" }}
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
    <AssistantWidget page="shifts" />
    </>
  );
}
