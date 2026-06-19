"use client";
import React, { useState, useEffect, useCallback } from "react";
import { AssistantWidget } from "@/components/admin/AssistantWidget";

interface Props {
  restaurants: { id: string; name: string }[];
}

type AttRoleCfg = { code: string; label: string; payCode: string; color: string; hourlyRate?: number };

// ── Design tokens (shared look with the attendance manager) ──────────────────
const GB = "rgba(255,255,255,0.14)";
const GC = "rgba(255,255,255,0.04)";
const GM = "rgba(255,255,255,0.55)";
const ACCENT_GRAD = "linear-gradient(135deg,#D97706,#F59E0B)";
const MODAL_BG = "rgba(18,18,30,0.98)";
const MODAL_BORDER = "rgba(255,255,255,0.18)";
const PRESET_COLORS = ["#f59e0b", "#3b82f6", "#a855f7", "#6b7280", "#ef4444", "#10b981", "#f97316", "#ec4899"];
const MONTHS_HE = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

function getWeekDates(offset: number): Date[] {
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay() + offset * 7);
  sunday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(sunday); d.setDate(sunday.getDate() + i); return d; });
}
function formatDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function weekLabel(dates: Date[]): string {
  const f = dates[0], l = dates[6];
  return f.getMonth() === l.getMonth()
    ? `${f.getDate()}–${l.getDate()} ${MONTHS_HE[f.getMonth()]} ${f.getFullYear()}`
    : `${f.getDate()} ${MONTHS_HE[f.getMonth()]} – ${l.getDate()} ${MONTHS_HE[l.getMonth()]} ${l.getFullYear()}`;
}

// ── BI data shapes (mirror /api/admin/attendance/bi) ─────────────────────────
type BiDay = { date: string; revenue: number; laborCost: number; hours: number; laborPct: number | null };
type BiHour = { hour: number; revenue: number; laborCost: number; laborPct: number | null };
type BiOt = { userId: string; name: string; regular: number; ot125: number; ot150: number; otHours: number; laborCost: number; otCost: number; planned: number; actual: number; overPlanned: number };
type BiPunct = { userId: string; name: string; shifts: number; onTime: number; late: number; early: number; lateMinutes: number; earlyMinutes: number };
type BiData = {
  rateConfigured: boolean;
  totals: { revenue: number; laborCost: number; hours: number; laborPct: number | null };
  byDay: BiDay[]; byHour: BiHour[]; overtime: BiOt[]; punctuality: BiPunct[];
};

export default function MyBusinessClient({ restaurants }: Props) {
  const [restaurantId, setRestaurantId] = useState(restaurants[0]?.id ?? "");
  const [mode, setMode] = useState<"weekly" | "monthly" | "range">("monthly");
  const [weekOffset, setWeekOffset] = useState(0);
  const [month, setMonth] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`; });
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [biData, setBiData] = useState<BiData | null>(null);
  const [loading, setLoading] = useState(false);

  // Role hourly-rate config (needed for labor cost)
  const [roles, setRoles] = useState<AttRoleCfg[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editRoles, setEditRoles] = useState<AttRoleCfg[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (m: string) => { if (toastTimer.current) clearTimeout(toastTimer.current); setToast(m); toastTimer.current = setTimeout(() => setToast(null), 3000); };

  const weekDates = getWeekDates(weekOffset);

  useEffect(() => {
    if (!restaurantId) return;
    fetch(`/api/admin/attendance?config=1&restaurantId=${restaurantId}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.roles)) setRoles(d.roles); })
      .catch(() => {});
  }, [restaurantId]);

  const loadBi = useCallback(async () => {
    if (!restaurantId) return;
    let f = "", t = "";
    if (mode === "weekly") { f = formatDateISO(weekDates[0]); t = formatDateISO(weekDates[6]); }
    else if (mode === "monthly") { const [y, m] = month.split("-").map(Number); f = `${month}-01`; t = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`; }
    else { if (!from || !to) return; f = from; t = to; }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/attendance/bi?restaurantId=${restaurantId}&from=${f}&to=${t}`);
      setBiData(res.ok ? await res.json() : null);
    } catch { setBiData(null); }
    finally { setLoading(false); }
  }, [restaurantId, mode, month, from, to, weekOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadBi(); }, [loadBi]);

  async function saveRates() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/attendance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: true, restaurantId, roles: editRoles }),
      });
      if (res.ok) { setRoles(editRoles); setSettingsOpen(false); showToast("✓ תעריפים נשמרו"); loadBi(); }
      else showToast("שגיאה בשמירה");
    } finally { setSaving(false); }
  }

  // ── Formatting helpers ──────────────────────────────────────────────────────
  const money = (n: number) => `₪${Math.round(n).toLocaleString("he-IL")}`;
  const pct = (n: number | null) => (n == null ? "—" : `${n.toFixed(0)}%`);
  const pctColor = (n: number | null) => (n == null ? GM : n > 45 ? "#F87171" : n > 30 ? "#FB923C" : "#34D399");

  const modeBtn = (m: typeof mode, label: string) => (
    <button onClick={() => setMode(m)} style={{
      padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", borderRadius: 8,
      background: mode === m ? "rgba(245,158,11,0.2)" : "transparent",
      border: mode === m ? "1px solid rgba(245,158,11,0.45)" : `1px solid ${GB}`,
      color: mode === m ? "#FBBF24" : GM, fontFamily: "inherit",
    }}>{label}</button>
  );

  const card: React.CSSProperties = { background: GC, border: `1px solid ${GB}`, borderRadius: 16, padding: 18, marginBottom: 16 };
  const th: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: GM, padding: "6px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" };
  const td: React.CSSProperties = { fontSize: 12, padding: "5px 10px", whiteSpace: "nowrap" };
  const maxDayVal = biData ? Math.max(1, ...biData.byDay.map(d => Math.max(d.revenue, d.laborCost))) : 1;

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700;900&display=swap');`}</style>
      <div style={{ minHeight: "100vh", color: "#fff", fontFamily: "'Heebo', sans-serif", direction: "rtl", padding: 20 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

          {toast && (
            <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 2000, background: MODAL_BG, border: `1px solid ${MODAL_BORDER}`, borderRadius: 14, color: "#fff", fontSize: 14, fontWeight: 600, padding: "10px 18px", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>{toast}</div>
          )}

          {/* Header */}
          <header style={{ background: GC, backdropFilter: "blur(20px)", border: `1px solid ${GB}`, borderRadius: 18, padding: "14px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 900 }}>📈 העסק שלי</div>
              {restaurants.length > 1 && (
                <select value={restaurantId} onChange={e => setRestaurantId(e.target.value)}
                  style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, color: "#fff", padding: "6px 12px", borderRadius: 9, fontFamily: "Heebo, sans-serif", fontSize: 13, cursor: "pointer", minWidth: 150 }}>
                  {restaurants.map(r => <option key={r.id} value={r.id} style={{ background: "#1a1a2e" }}>{r.name}</option>)}
                </select>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {modeBtn("weekly", "שבועי")}
              {modeBtn("monthly", "חודשי")}
              {modeBtn("range", "טווח")}
              {mode === "weekly" && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(0,0,0,0.25)", border: `1px solid ${GB}`, borderRadius: 10, padding: "4px 6px" }}>
                  <button onClick={() => setWeekOffset(w => w - 1)} style={{ background: "none", border: "none", color: GM, cursor: "pointer", fontSize: 16, padding: "2px 8px" }}>‹</button>
                  <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>{weekLabel(weekDates)}</span>
                  <button onClick={() => setWeekOffset(w => w + 1)} style={{ background: "none", border: "none", color: GM, cursor: "pointer", fontSize: 16, padding: "2px 8px" }}>›</button>
                </div>
              )}
              {mode === "monthly" && (
                <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                  style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${GB}`, borderRadius: 8, color: "#fff", padding: "6px 10px", fontSize: 13, fontFamily: "inherit" }} />
              )}
              {mode === "range" && (<>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${GB}`, borderRadius: 8, color: "#fff", padding: "6px 10px", fontSize: 13, fontFamily: "inherit" }} />
                <span style={{ color: GM }}>—</span>
                <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${GB}`, borderRadius: 8, color: "#fff", padding: "6px 10px", fontSize: 13, fontFamily: "inherit" }} />
              </>)}
              <button onClick={() => { setEditRoles(roles); setSettingsOpen(true); }}
                style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, color: "#fff", padding: "7px 13px", borderRadius: 9, fontFamily: "inherit", fontSize: 13, cursor: "pointer" }}>⚙️ תעריפים</button>
              <button onClick={loadBi}
                style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, color: "#fff", padding: "7px 13px", borderRadius: 9, fontFamily: "inherit", fontSize: 13, cursor: "pointer" }}>🔄 רענון</button>
            </div>
          </header>

          {/* Body */}
          <div>
            {loading && !biData ? (
              <div style={{ textAlign: "center", padding: 60, color: GM, fontSize: 16 }}>טוען...</div>
            ) : !biData ? (
              <div style={{ textAlign: "center", padding: 60, color: GM, fontSize: 16 }}>אין נתונים לתקופה זו</div>
            ) : (<>
              {!biData.rateConfigured && (
                <div style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.35)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#FBBF24" }}>
                  ⚠️ לא הוגדר תעריף שעתי לתפקידים — עלות העבודה תוצג כ-0. הגדר ₪/ש׳ ב-⚙️ תעריפים.
                </div>
              )}

              {/* KPIs */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 16 }}>
                {[
                  { label: "פדיון", value: money(biData.totals.revenue), color: "#34D399" },
                  { label: "עלות עבודה", value: money(biData.totals.laborCost), color: "#60A5FA" },
                  { label: "Labor Cost %", value: pct(biData.totals.laborPct), color: pctColor(biData.totals.laborPct) },
                  { label: "שעות עבודה", value: biData.totals.hours.toFixed(1), color: "#FBBF24" },
                ].map(k => (
                  <div key={k.label} style={{ ...card, marginBottom: 0, padding: 14 }}>
                    <div style={{ fontSize: 11, color: GM, marginBottom: 4 }}>{k.label}</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: k.color }}>{k.value}</div>
                  </div>
                ))}
              </div>

              {/* A. Labor Cost vs Sales — by day */}
              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>📊 עלות עבודה מול פדיון — לפי יום</div>
                {biData.byDay.length === 0 ? <div style={{ color: GM, fontSize: 13 }}>אין נתונים</div> : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {biData.byDay.map(d => (
                      <div key={d.date} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 11, color: GM, width: 54, flexShrink: 0 }}>{d.date.slice(5).replace("-", "/")}</span>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                          <div style={{ height: 9, background: "rgba(52,211,153,0.7)", width: `${(d.revenue / maxDayVal) * 100}%`, borderRadius: 3, minWidth: d.revenue > 0 ? 4 : 0 }} />
                          <div style={{ height: 9, background: "rgba(96,165,250,0.7)", width: `${(d.laborCost / maxDayVal) * 100}%`, borderRadius: 3, minWidth: d.laborCost > 0 ? 4 : 0 }} />
                        </div>
                        <span style={{ fontSize: 11, color: GM, width: 150, flexShrink: 0, textAlign: "left" }}>{money(d.revenue)} / {money(d.laborCost)}</span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: pctColor(d.laborPct), width: 48, flexShrink: 0, textAlign: "left" }}>{pct(d.laborPct)}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: 16, fontSize: 10, color: GM, marginTop: 4 }}>
                      <span><span style={{ display: "inline-block", width: 9, height: 9, background: "rgba(52,211,153,0.7)", borderRadius: 2, marginLeft: 4 }} />פדיון</span>
                      <span><span style={{ display: "inline-block", width: 9, height: 9, background: "rgba(96,165,250,0.7)", borderRadius: 2, marginLeft: 4 }} />עלות עבודה</span>
                    </div>
                  </div>
                )}
              </div>

              {/* A2. By hour */}
              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>🕐 לפי שעה ביום — זיהוי "שעות מתות"</div>
                <div style={{ fontSize: 11, color: GM, marginBottom: 12 }}>עלות עבודה שעתית בתעריף בסיס מול פדיון. אחוז גבוה = יותר מדי עובדים מול מעט מכירות.</div>
                {biData.byHour.length === 0 ? <div style={{ color: GM, fontSize: 13 }}>אין נתונים</div> : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr>
                      <th style={{ ...th, textAlign: "right" }}>שעה</th>
                      <th style={{ ...th, textAlign: "left" }}>פדיון</th>
                      <th style={{ ...th, textAlign: "left" }}>עלות עבודה</th>
                      <th style={{ ...th, textAlign: "left" }}>Labor %</th>
                    </tr></thead>
                    <tbody>
                      {biData.byHour.map(h => (
                        <tr key={h.hour} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: (h.laborPct ?? 0) > 45 ? "rgba(248,113,113,0.07)" : "transparent" }}>
                          <td style={{ ...td, textAlign: "right", color: "#fff", fontWeight: 700 }}>{String(h.hour).padStart(2, "0")}:00</td>
                          <td style={{ ...td, textAlign: "left", color: "#34D399" }}>{money(h.revenue)}</td>
                          <td style={{ ...td, textAlign: "left", color: "#60A5FA" }}>{money(h.laborCost)}</td>
                          <td style={{ ...td, textAlign: "left", fontWeight: 800, color: pctColor(h.laborPct) }}>{pct(h.laborPct)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* B. Overtime */}
              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>⏰ שעות נוספות וחריגות תקן</div>
                {biData.overtime.length === 0 ? <div style={{ color: GM, fontSize: 13 }}>אין נתונים</div> : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr>
                      <th style={{ ...th, textAlign: "right" }}>עובד</th>
                      <th style={{ ...th, textAlign: "center", color: "#FB923C" }}>125%</th>
                      <th style={{ ...th, textAlign: "center", color: "#F87171" }}>150%</th>
                      <th style={{ ...th, textAlign: "center" }}>סה״כ נוספות</th>
                      <th style={{ ...th, textAlign: "left" }}>עלות נוספות</th>
                      <th style={{ ...th, textAlign: "center" }}>תקן/בפועל</th>
                      <th style={{ ...th, textAlign: "center" }}>חריגה</th>
                    </tr></thead>
                    <tbody>
                      {biData.overtime.map(o => (
                        <tr key={o.userId} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ ...td, color: "#fff", fontWeight: 700 }}>{o.name}</td>
                          <td style={{ ...td, textAlign: "center", color: o.ot125 > 0 ? "#FB923C" : GM }}>{o.ot125 > 0 ? o.ot125.toFixed(1) : "–"}</td>
                          <td style={{ ...td, textAlign: "center", color: o.ot150 > 0 ? "#F87171" : GM }}>{o.ot150 > 0 ? o.ot150.toFixed(1) : "–"}</td>
                          <td style={{ ...td, textAlign: "center", fontWeight: 700, color: o.otHours > 0 ? "#FBBF24" : GM }}>{o.otHours.toFixed(1)}</td>
                          <td style={{ ...td, textAlign: "left", color: "#60A5FA" }}>{money(o.otCost)}</td>
                          <td style={{ ...td, textAlign: "center", color: GM }}>{o.planned.toFixed(0)} / {o.actual.toFixed(0)}</td>
                          <td style={{ ...td, textAlign: "center", fontWeight: 700, color: o.overPlanned > 0 ? "#F87171" : "#34D399" }}>{o.overPlanned >= 0 ? "+" : ""}{o.overPlanned.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* C. Punctuality */}
              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>⏱️ עמידה בזמנים ואיחורים</div>
                {biData.punctuality.length === 0 ? <div style={{ color: GM, fontSize: 13 }}>אין שיבוצים לתקופה</div> : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr>
                      <th style={{ ...th, textAlign: "right" }}>עובד</th>
                      <th style={{ ...th, textAlign: "center" }}>משמרות</th>
                      <th style={{ ...th, textAlign: "center", color: "#34D399" }}>בזמן</th>
                      <th style={{ ...th, textAlign: "center", color: "#F87171" }}>איחורים</th>
                      <th style={{ ...th, textAlign: "center" }}>דק׳ איחור</th>
                      <th style={{ ...th, textAlign: "center", color: "#FBBF24" }}>מוקדם</th>
                      <th style={{ ...th, textAlign: "center" }}>דק׳ מוקדם</th>
                    </tr></thead>
                    <tbody>
                      {biData.punctuality.map(p => (
                        <tr key={p.userId} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ ...td, color: "#fff", fontWeight: 700 }}>{p.name}</td>
                          <td style={{ ...td, textAlign: "center", color: GM }}>{p.shifts}</td>
                          <td style={{ ...td, textAlign: "center", color: "#34D399", fontWeight: 700 }}>{p.onTime}</td>
                          <td style={{ ...td, textAlign: "center", color: p.late > 0 ? "#F87171" : GM, fontWeight: 700 }}>{p.late}</td>
                          <td style={{ ...td, textAlign: "center", color: p.lateMinutes > 0 ? "#F87171" : GM }}>{p.lateMinutes}</td>
                          <td style={{ ...td, textAlign: "center", color: p.early > 0 ? "#FBBF24" : GM, fontWeight: 700 }}>{p.early}</td>
                          <td style={{ ...td, textAlign: "center", color: p.earlyMinutes > 0 ? "#FBBF24" : GM }}>{p.earlyMinutes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>)}
          </div>
        </div>
      </div>

      {/* Rates settings modal */}
      {settingsOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "6vh 0", direction: "rtl" }}>
          <div style={{ background: MODAL_BG, border: `1px solid ${MODAL_BORDER}`, borderRadius: 18, padding: "18px 20px", width: 680, maxWidth: "95vw", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>🎭 תפקידים וקודי שכר</div>
            {editRoles.map((r, idx) => (
              <div key={idx} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${GB}`, borderRadius: 10, padding: "8px 12px", marginBottom: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <input value={r.label} onChange={e => setEditRoles(prev => prev.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))}
                  placeholder="שם תפקיד" style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, borderRadius: 7, color: "#fff", fontSize: 13, fontWeight: 700, padding: "3px 7px", width: 90, fontFamily: "inherit", outline: "none" }} />
                <input value={r.code} onChange={e => setEditRoles(prev => prev.map((x, i) => i === idx ? { ...x, code: e.target.value.toUpperCase() } : x))}
                  placeholder="CODE" style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, borderRadius: 7, color: GM, fontSize: 12, padding: "3px 7px", width: 80, fontFamily: "inherit", outline: "none" }} />
                <span style={{ fontSize: 11, color: GM }}>קוד שכר</span>
                <input value={r.payCode} onChange={e => setEditRoles(prev => prev.map((x, i) => i === idx ? { ...x, payCode: e.target.value } : x))}
                  placeholder="100" style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, borderRadius: 7, color: "#fff", fontSize: 12, padding: "3px 7px", width: 60, fontFamily: "inherit", outline: "none", textAlign: "center" }} />
                <span style={{ fontSize: 11, color: GM }}>₪/ש׳</span>
                <input type="number" min={0} value={r.hourlyRate ?? 0} onChange={e => setEditRoles(prev => prev.map((x, i) => i === idx ? { ...x, hourlyRate: Math.max(0, Number(e.target.value) || 0) } : x))}
                  placeholder="0" style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, borderRadius: 7, color: "#fff", fontSize: 12, padding: "3px 7px", width: 56, fontFamily: "inherit", outline: "none", textAlign: "center" }} />
                <div style={{ display: "flex", gap: 4, flex: 1, justifyContent: "center" }}>
                  {PRESET_COLORS.map(c => (
                    <button key={c} onClick={() => setEditRoles(prev => prev.map((x, i) => i === idx ? { ...x, color: c } : x))}
                      style={{ width: 16, height: 16, borderRadius: "50%", background: c, border: r.color === c ? "2px solid #fff" : "2px solid transparent", cursor: "pointer", boxSizing: "border-box", flexShrink: 0 }} title={c} />
                  ))}
                </div>
                <button onClick={() => setEditRoles(prev => prev.filter((_, i) => i !== idx))}
                  style={{ background: "transparent", border: "none", color: "#F87171", fontSize: 14, cursor: "pointer", padding: "0 2px", flexShrink: 0 }} title="הסר">✕</button>
              </div>
            ))}
            <button onClick={() => setEditRoles(prev => [...prev, { code: `ROLE_${Date.now()}`, label: "תפקיד חדש", payCode: "", color: "#10b981", hourlyRate: 0 }])}
              style={{ width: "100%", background: "transparent", border: `1.5px dashed ${GB}`, borderRadius: 9, color: GM, fontSize: 13, padding: "7px", cursor: "pointer", fontFamily: "inherit", marginTop: 4 }}>＋ הוסף תפקיד</button>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={saveRates} disabled={saving}
                style={{ flex: 1, background: ACCENT_GRAD, border: "none", borderRadius: 9, color: "#fff", fontSize: 14, fontWeight: 800, padding: 10, cursor: "pointer", fontFamily: "inherit", opacity: saving ? 0.6 : 1 }}>{saving ? "שומר..." : "שמור"}</button>
              <button onClick={() => setSettingsOpen(false)}
                style={{ flex: 1, background: "rgba(255,255,255,0.07)", border: `1px solid ${GB}`, borderRadius: 9, color: GM, fontSize: 14, padding: 10, cursor: "pointer", fontFamily: "inherit" }}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      <AssistantWidget page="my-business" />
    </>
  );
}
