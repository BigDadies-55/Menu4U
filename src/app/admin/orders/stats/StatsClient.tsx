"use client";

import { useState, useEffect, useCallback } from "react";

type DurationStat = { avg: number; median: number; count: number };

type Stats = {
  period: number;
  totalOrders: number;
  totalRevenue: number;
  paidRevenue: number;
  avgOrderValue: number;
  avgItems: number;
  statusCounts: Record<string, number>;
  bySource: Record<string, number>;
  cancelRate: number;
  completionRate: number;
  paidRate: number;
  durations: Record<"PENDING" | "CONFIRMED" | "PREPARING" | "READY" | "DELIVERED", DurationStat>;
  deliveredToPayTime: DurationStat;
  totalTime: DurationStat;
  avgExpectedPrepTime: number;
  byHour: number[];
  byDay: { date: string; count: number; revenue: number }[];
  peakHour: number;
  hasLogs: boolean;
};

type Restaurant = { id: string; name: string };

const fmt = (n: number) =>
  new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);
const fmtMin = (m: number) =>
  m < 1 ? "< 1 דק'" : m < 60 ? `${Math.round(m)} דק'` : `${Math.floor(m / 60)}ש' ${Math.round(m % 60)}דק'`;

const STAGE_LABELS: Record<string, string> = {
  PENDING:   "המתנה לאישור",
  CONFIRMED: "ציפייה לתחילת הכנה",
  PREPARING: "זמן הכנה",
  READY:     "מוכן — המתנה למסירה",
  DELIVERED: "נמסר — המתנה לתשלום",
};

const STAGE_COLORS: Record<string, string> = {
  PENDING:   "#f59e0b",
  CONFIRMED: "#3b82f6",
  PREPARING: "#f97316",
  READY:     "#22c55e",
  DELIVERED: "#c9a84c",
};

const SOURCE_LABELS: Record<string, string> = {
  ONLINE: "תפריט דיגיטלי",
  WAITER: "מלצר",
  POS:    "קופה",
};

/* ── Modern ring gauge ─────────────────────────────────────── */
function RingGauge({
  value,
  max,
  label,
  sublabel,
  displayValue,
  thresholds,
  size = 148,
}: {
  value: number;
  max: number;
  label: string;
  sublabel?: string;
  displayValue?: string;
  thresholds: { at: number; color: string; bg: string }[];
  size?: number;
}) {
  const pct = Math.min(1, Math.max(0, max > 0 ? value / max : 0));

  // Pick color tier
  let color = thresholds[0].color;
  let bgLight = thresholds[0].bg;
  for (const t of [...thresholds].sort((a, b) => a.at - b.at)) {
    if (pct >= t.at) { color = t.color; bgLight = t.bg; }
  }

  // SVG ring geometry
  const cx = size / 2, cy = size / 2;
  const strokeW = 10;
  const r = cx - strokeW / 2 - 2;
  const circumference = 2 * Math.PI * r;
  // 270° arc: starts at 135° (bottom-left), goes clockwise 270°
  const GAP = 90; // degrees left open (at the bottom)
  const arcFraction = (360 - GAP) / 360;
  const dashTotal = circumference * arcFraction;
  const dashFill  = dashTotal * pct;
  // rotate so arc starts at 135° (bottom-left gap)
  const rotateAngle = 90 + GAP / 2; // 135°

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <defs>
            <linearGradient id={`rg-${label}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.6" />
              <stop offset="100%" stopColor={color} stopOpacity="1" />
            </linearGradient>
          </defs>
          {/* Track */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={strokeW}
            strokeDasharray={`${dashTotal} ${circumference}`}
            strokeLinecap="round"
            transform={`rotate(${rotateAngle} ${cx} ${cy})`}
          />
          {/* Fill */}
          {pct > 0 && (
            <circle
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={`url(#rg-${label})`}
              strokeWidth={strokeW}
              strokeDasharray={`${dashFill} ${circumference}`}
              strokeLinecap="round"
              transform={`rotate(${rotateAngle} ${cx} ${cy})`}
              style={{ transition: "stroke-dasharray 0.7s cubic-bezier(.4,0,.2,1)" }}
            />
          )}
        </svg>

        {/* Center content */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          paddingBottom: 8,
        }}>
          {/* Colored dot */}
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: color, marginBottom: 4,
            boxShadow: `0 0 8px ${color}80`,
          }} />
          {/* Value */}
          <div style={{
            fontSize: size * 0.175,
            fontWeight: 800,
            lineHeight: 1,
            color: "#0f172a",
            letterSpacing: "-0.03em",
            fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
          }}>
            {displayValue ?? (Number.isFinite(value) ? String(Math.round(value)) : "—")}
          </div>
          {/* Light percentage bar */}
          <div style={{
            marginTop: 6,
            width: size * 0.36,
            height: 3,
            borderRadius: 99,
            background: "#f1f5f9",
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${pct * 100}%`,
              background: color,
              borderRadius: 99,
              transition: "width 0.7s cubic-bezier(.4,0,.2,1)",
            }} />
          </div>
          {/* Subtle bg tint */}
          <div style={{
            position: "absolute", inset: strokeW + 6,
            borderRadius: "50%",
            background: bgLight,
            zIndex: -1,
          }} />
        </div>
      </div>

      {/* Label */}
      <div style={{ textAlign: "center", lineHeight: 1.3 }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: "#1e293b",
          fontFamily: "'Inter', system-ui, sans-serif",
          letterSpacing: "-0.01em",
        }}>
          {label}
        </div>
        {sublabel && (
          <div style={{
            fontSize: 11, color: "#94a3b8", marginTop: 3,
            fontFamily: "'Inter', system-ui, sans-serif",
          }}>
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Mini bar ─────────────────────────────────────────────── */
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(4, (value / max) * 100) : 4;
  return (
    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

/* ── Recommendations ─────────────────────────────────────── */
function genRecommendations(s: Stats): { icon: string; text: string; severity: "warn" | "info" | "ok" }[] {
  const recs: { icon: string; text: string; severity: "warn" | "info" | "ok" }[] = [];

  if (!s.hasLogs || s.totalOrders < 3) {
    recs.push({ icon: "📊", text: "אין עדיין מספיק נתוני הזמנות לייצור המלצות. ההמלצות יופיעו לאחר מספר הזמנות.", severity: "info" });
    return recs;
  }

  const { PENDING, PREPARING, READY } = s.durations;

  if (PENDING.count > 0 && PENDING.avg > 4) {
    recs.push({
      icon: "⏰",
      text: `ממוצע המתנה לאישור הזמנה: ${fmtMin(PENDING.avg)}. מומלץ לאשר תוך 2-3 דק'.`,
      severity: PENDING.avg > 8 ? "warn" : "info",
    });
  } else if (PENDING.count > 0) {
    recs.push({ icon: "✅", text: `זמן אישור הזמנות מצוין — ${fmtMin(PENDING.avg)} בממוצע.`, severity: "ok" });
  }

  if (PREPARING.count > 0 && s.avgExpectedPrepTime > 0) {
    const overrun = PREPARING.avg - s.avgExpectedPrepTime;
    if (overrun > 8) {
      recs.push({
        icon: "👨‍🍳",
        text: `זמן הכנה ממוצע (${fmtMin(PREPARING.avg)}) גבוה ב-${fmtMin(overrun)} מהמוגדר (${fmtMin(s.avgExpectedPrepTime)}).`,
        severity: "warn",
      });
    } else if (overrun < -5) {
      recs.push({ icon: "🚀", text: `הצוות מהיר יותר מהצפוי! ${fmtMin(PREPARING.avg)} לעומת ${fmtMin(s.avgExpectedPrepTime)} מוגדר.`, severity: "ok" });
    }
  }

  if (s.totalTime.count > 0) {
    if (s.totalTime.avg > 40)
      recs.push({ icon: "⚡", text: `זמן שירות כולל ממוצע: ${fmtMin(s.totalTime.avg)}. יעד מומלץ: פחות מ-30 דק'.`, severity: "warn" });
    else
      recs.push({ icon: "🏆", text: `זמן שירות ממוצע מלא: ${fmtMin(s.totalTime.avg)} — תוצאה טובה.`, severity: "ok" });
  }

  if (READY.count > 0 && READY.avg > 5)
    recs.push({ icon: "🔔", text: `הזמנות מחכות ${fmtMin(READY.avg)} בממוצע לאחר שמוכנות. שקול לשפר תהליך הגשה.`, severity: READY.avg > 10 ? "warn" : "info" });

  if (s.deliveredToPayTime.count > 0) {
    if (s.deliveredToPayTime.avg > 10)
      recs.push({ icon: "💳", text: `זמן ממוצע מהגשה לתשלום: ${fmtMin(s.deliveredToPayTime.avg)}. שקול לשפר זרימת הקאשייר.`, severity: s.deliveredToPayTime.avg > 20 ? "warn" : "info" });
    else
      recs.push({ icon: "💳", text: `סגירת חשבון מהירה: ${fmtMin(s.deliveredToPayTime.avg)} בממוצע — יעיל.`, severity: "ok" });
  }

  if (s.paidRate > 0)
    recs.push({ icon: "🏦", text: `${s.paidRate.toFixed(0)}% מהזמנות עברו סגירת חשבון דיגיטלית (${fmt(s.paidRevenue)}).`, severity: "info" });

  if (s.cancelRate > 15)
    recs.push({ icon: "⚠️", text: `שיעור ביטולים גבוה: ${s.cancelRate.toFixed(1)}%. בדוק אם הזמנות מגיעות בשעות סגורות.`, severity: "warn" });
  else if (s.cancelRate > 0)
    recs.push({ icon: "📋", text: `שיעור ביטולים: ${s.cancelRate.toFixed(1)}% — תקין.`, severity: "ok" });

  const peakCount = s.byHour[s.peakHour];
  if (peakCount > 0)
    recs.push({ icon: "📈", text: `שעת שיא: ${s.peakHour}:00–${s.peakHour + 1}:00 עם ${peakCount} הזמנות. וודא שיש מספיק צוות.`, severity: "info" });

  if (s.totalRevenue > 0)
    recs.push({ icon: "💰", text: `סה"כ הכנסות: ${fmt(s.totalRevenue)} ב-${s.period} ימים. ממוצע ${fmt(s.avgOrderValue)} להזמנה.`, severity: "info" });

  return recs;
}

function todayStr() { return new Date().toISOString().slice(0, 10); }

/* ── Main component ─────────────────────────────────────── */
export default function StatsClient({ restaurants, isSuperAdmin }: { restaurants: Restaurant[]; isSuperAdmin: boolean }) {
  const [restaurantId, setRestaurantId] = useState(restaurants[0]?.id ?? "");
  const [period, setPeriod] = useState(30);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateFrom) { params.set("from", dateFrom); if (dateTo) params.set("to", dateTo); }
    else params.set("days", String(period));
    if (restaurantId) params.set("restaurantId", restaurantId);
    const res = await fetch(`/api/admin/orders/stats?${params}`);
    if (res.ok) setStats(await res.json());
    setLoading(false);
  }, [restaurantId, period, dateFrom, dateTo]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const recommendations = stats ? genRecommendations(stats) : [];
  const maxByHour = stats ? Math.max(...stats.byHour, 1) : 1;
  const maxByDay  = stats ? Math.max(...stats.byDay.map(d => d.count), 1) : 1;
  const maxDuration = stats
    ? Math.max(...Object.values(stats.durations).map(d => d.avg), (stats.deliveredToPayTime?.avg ?? 0), 1)
    : 1;

  return (
    <div className="p-4 md:p-8 space-y-6" dir="rtl">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📊 סטטיסטיקות הזמנות</h1>
          <p className="text-gray-500 text-sm mt-0.5">ניתוח זמני סטטוסים, עומסים והמלצות</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {isSuperAdmin && restaurants.length > 1 && (
            <select value={restaurantId} onChange={e => setRestaurantId(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
              {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}
          <div className="flex rounded-xl overflow-hidden border border-gray-200">
            {[7, 30, 90].map(d => (
              <button key={d} onClick={() => { setPeriod(d); setDateFrom(""); setDateTo(""); }}
                className={`px-3 py-2 text-sm font-medium transition-colors ${!dateFrom && period === d ? "text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                style={!dateFrom && period === d ? { background: "linear-gradient(135deg,#8B6914,#C9A84C)" } : undefined}>
                {d} ימים
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-3 py-1.5 bg-white">
            <span className="text-xs text-gray-400">מ-</span>
            <input type="date" value={dateFrom} max={dateTo || todayStr()} onChange={e => setDateFrom(e.target.value)}
              className="text-sm text-gray-700 focus:outline-none bg-transparent" />
            <span className="text-xs text-gray-400 mx-1">עד</span>
            <input type="date" value={dateTo} min={dateFrom || undefined} max={todayStr()} onChange={e => setDateTo(e.target.value)}
              className="text-sm text-gray-700 focus:outline-none bg-transparent" />
            {dateFrom && <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-gray-400 hover:text-gray-700 text-xs mr-1">✕</button>}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-400">
          <svg className="animate-spin w-6 h-6 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          טוען נתונים...
        </div>
      ) : stats && (
        <>
          {/* ── KPI cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: "הזמנות",         value: stats.totalOrders,                                          sub: `${stats.period} ימים`,                                      color: "#f59e0b" },
              { label: "הכנסות",          value: fmt(stats.totalRevenue),                                    sub: `ממוצע ${fmt(stats.avgOrderValue)} להזמנה`,                 color: "#22c55e" },
              { label: "שולמו בקאשייר",   value: fmt(stats.paidRevenue ?? 0),                                sub: `${stats.statusCounts?.PAID ?? 0} הזמנות סגורות`,           color: "#c9a84c" },
              { label: "זמן שירות ממוצע", value: stats.totalTime?.count ? fmtMin(stats.totalTime.avg) : "—", sub: stats.totalTime?.count ? `${stats.totalTime.count} הזמנות` : "אין לוגים עדיין", color: "#3b82f6" },
              { label: "שיעור השלמה",     value: `${stats.completionRate.toFixed(0)}%`,                      sub: `${stats.cancelRate.toFixed(1)}% בוטלו`,                    color: "#a855f7" },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="text-xs text-gray-500 font-medium mb-1">{label}</div>
                <div className="text-2xl font-bold text-gray-900">{value}</div>
                <div className="text-xs text-gray-400 mt-1">{sub}</div>
                <div className="h-1 rounded-full mt-3" style={{ background: `${color}33` }}>
                  <div className="h-full rounded-full w-3/4" style={{ background: color }} />
                </div>
              </div>
            ))}
          </div>

          {/* ── Gauge dashboard ── */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em", fontFamily: "'Inter', system-ui, sans-serif" }}>
                  מדדי ביצוע
                </h2>
                <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 2, fontFamily: "'Inter', system-ui, sans-serif" }}>
                  ביצועי שירות בזמן אמת
                </p>
              </div>
              <span style={{ fontSize: 22 }}>🎯</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 justify-items-center">
              <RingGauge
                value={stats.completionRate}
                max={100}
                label="שיעור השלמה"
                sublabel="DELIVERED + PAID"
                displayValue={`${stats.completionRate.toFixed(0)}%`}
                thresholds={[
                  { at: 0,    color: "#ef4444", bg: "rgba(239,68,68,0.04)" },
                  { at: 0.5,  color: "#f59e0b", bg: "rgba(245,158,11,0.04)" },
                  { at: 0.75, color: "#22c55e", bg: "rgba(34,197,94,0.04)" },
                ]}
              />
              <RingGauge
                value={stats.cancelRate}
                max={30}
                label="שיעור ביטולים"
                sublabel="יעד: פחות מ-5%"
                displayValue={`${stats.cancelRate.toFixed(1)}%`}
                thresholds={[
                  { at: 0,    color: "#22c55e", bg: "rgba(34,197,94,0.04)" },
                  { at: 0.17, color: "#f59e0b", bg: "rgba(245,158,11,0.04)" },
                  { at: 0.33, color: "#ef4444", bg: "rgba(239,68,68,0.04)" },
                ]}
              />
              <RingGauge
                value={stats.totalTime.count > 0 ? stats.totalTime.avg : 0}
                max={60}
                label="זמן שירות ממוצע"
                sublabel="יעד: פחות מ-30 דק׳"
                displayValue={stats.totalTime.count > 0 ? fmtMin(stats.totalTime.avg) : "—"}
                thresholds={[
                  { at: 0,    color: "#22c55e", bg: "rgba(34,197,94,0.04)" },
                  { at: 0.5,  color: "#f59e0b", bg: "rgba(245,158,11,0.04)" },
                  { at: 0.67, color: "#ef4444", bg: "rgba(239,68,68,0.04)" },
                ]}
              />
              <RingGauge
                value={stats.deliveredToPayTime?.count > 0 ? stats.deliveredToPayTime.avg : 0}
                max={30}
                label="המתנה לתשלום"
                sublabel="DELIVERED → PAID"
                displayValue={stats.deliveredToPayTime?.count > 0 ? fmtMin(stats.deliveredToPayTime.avg) : "—"}
                thresholds={[
                  { at: 0,    color: "#22c55e", bg: "rgba(34,197,94,0.04)" },
                  { at: 0.33, color: "#f59e0b", bg: "rgba(245,158,11,0.04)" },
                  { at: 0.67, color: "#ef4444", bg: "rgba(239,68,68,0.04)" },
                ]}
              />
            </div>
          </div>

          {/* ── Order source breakdown ── */}
          {stats.bySource && Object.keys(stats.bySource).length > 1 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-4">📱 מקור הזמנות</h2>
              <div className="flex gap-4 flex-wrap">
                {Object.entries(stats.bySource).map(([src, count]) => {
                  const pct = stats.totalOrders > 0 ? ((count / stats.totalOrders) * 100).toFixed(0) : "0";
                  return (
                    <div key={src} className="flex-1 min-w-28 bg-gray-50 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-gray-900">{count}</div>
                      <div className="text-sm font-medium text-gray-600 mt-1">{SOURCE_LABELS[src] ?? src}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{pct}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Time per stage ── */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-1">⏱ זמן ממוצע בכל שלב</h2>
            <p className="text-xs text-gray-400 mb-5">
              {stats.hasLogs
                ? "על בסיס לוגים של שינויי סטטוס בפועל"
                : "⚠️ אין עדיין לוגי סטטוס — הנתונים יצטברו לאחר שהזמנות יעברו שינוי סטטוס דרך הממשק"}
            </p>
            <div className="space-y-4">
              {(["PENDING", "CONFIRMED", "PREPARING", "READY", "DELIVERED"] as const).map(st => {
                const d = stats.durations[st];
                return (
                  <div key={st}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ background: STAGE_COLORS[st] }} />
                        <span className="text-sm font-medium text-gray-700">{STAGE_LABELS[st]}</span>
                      </div>
                      <div className="text-left text-sm">
                        {d?.count > 0 ? (
                          <>
                            <span className="font-bold text-gray-900">{fmtMin(d.avg)}</span>
                            <span className="text-gray-400 mr-2 text-xs">מדיאן {fmtMin(d.median)}</span>
                            <span className="text-gray-300 text-xs">({d.count})</span>
                          </>
                        ) : <span className="text-gray-300 text-sm">—</span>}
                      </div>
                    </div>
                    <MiniBar value={d?.count > 0 ? d.avg : 0} max={maxDuration} color={STAGE_COLORS[st]} />
                  </div>
                );
              })}

              {/* DELIVERED → PAID */}
              {stats.deliveredToPayTime?.count > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ background: "#10b981" }} />
                      <span className="text-sm font-medium text-gray-700">💳 המתנה לתשלום (נמסר → שולם)</span>
                    </div>
                    <div className="text-left text-sm">
                      <span className="font-bold text-gray-900">{fmtMin(stats.deliveredToPayTime.avg)}</span>
                      <span className="text-gray-400 mr-2 text-xs">מדיאן {fmtMin(stats.deliveredToPayTime.median)}</span>
                      <span className="text-gray-300 text-xs">({stats.deliveredToPayTime.count})</span>
                    </div>
                  </div>
                  <MiniBar value={stats.deliveredToPayTime.avg} max={maxDuration} color="#10b981" />
                </div>
              )}
            </div>

            {stats.totalTime?.count > 0 && (
              <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">⏱ זמן כולל (PENDING → DELIVERED/PAID)</span>
                <span className="font-bold text-gray-900">
                  {fmtMin(stats.totalTime.avg)}
                  <span className="text-xs text-gray-400 font-normal mr-1">({stats.totalTime.count} הזמנות)</span>
                </span>
              </div>
            )}
          </div>

          {/* ── Hourly chart ── */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-1">🕐 הזמנות לפי שעה</h2>
            <p className="text-xs text-gray-400 mb-5">התפלגות ב-{stats.period} ימים האחרונים</p>
            <div className="flex items-end gap-1 h-32">
              {stats.byHour.map((count, h) => {
                const heightPct = Math.max(4, (count / maxByHour) * 100);
                const isPeak = h === stats.peakHour && count > 0;
                return (
                  <div key={h} className="flex-1 flex flex-col items-center gap-1" title={`${h}:00 — ${count} הזמנות`}>
                    <div className="w-full rounded-t transition-all duration-500"
                      style={{ height: `${heightPct}%`, background: isPeak ? "#f59e0b" : "#e5e7eb" }} />
                    {h % 4 === 0 && <span className="text-[9px] text-gray-400">{h}</span>}
                  </div>
                );
              })}
            </div>
            {stats.byHour[stats.peakHour] > 0 && (
              <p className="text-xs text-amber-700 mt-2 font-medium">
                🔶 שעת שיא: {stats.peakHour}:00 – {stats.byHour[stats.peakHour]} הזמנות
              </p>
            )}
          </div>

          {/* ── Daily volume ── */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-1">📅 נפח יומי</h2>
            <p className="text-xs text-gray-400 mb-5">מספר הזמנות לפי יום</p>
            <div className="flex items-end gap-0.5 h-24 overflow-x-auto">
              {stats.byDay.map(({ date, count, revenue }) => {
                const heightPct = Math.max(4, (count / maxByDay) * 100);
                const label = new Date(date).toLocaleDateString("he-IL", { month: "short", day: "numeric" });
                return (
                  <div key={date} className="flex flex-col items-center gap-1 shrink-0"
                    style={{ minWidth: period > 30 ? 8 : 12 }}
                    title={`${label}: ${count} הזמנות · ${fmt(revenue)}`}>
                    <div className="w-full rounded-t" style={{ height: `${heightPct}%`, background: count > 0 ? "#c9a35d" : "#e5e7eb" }} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Recommendations ── */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-4">💡 המלצות</h2>
            <div className="space-y-3">
              {recommendations.map((rec, i) => {
                const bg  = rec.severity === "warn" ? "bg-red-50 border-red-200"   : rec.severity === "ok" ? "bg-green-50 border-green-200" : "bg-blue-50 border-blue-200";
                const dot = rec.severity === "warn" ? "bg-red-400" : rec.severity === "ok" ? "bg-green-400" : "bg-blue-400";
                return (
                  <div key={i} className={`flex gap-3 p-4 rounded-xl border ${bg}`}>
                    <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${dot}`} />
                    <div className="text-sm text-gray-700">
                      <span className="ml-1">{rec.icon}</span>{rec.text}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Status distribution ── */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-4">🍽 פילוג סטטוסים</h2>
            <div className="grid grid-cols-3 sm:grid-cols-7 gap-3">
              {[
                { s: "PENDING",   label: "ממתין", color: "bg-yellow-100 text-yellow-800" },
                { s: "CONFIRMED", label: "אושר",  color: "bg-blue-100 text-blue-800" },
                { s: "PREPARING", label: "בהכנה", color: "bg-amber-100 text-amber-800" },
                { s: "READY",     label: "מוכן",  color: "bg-green-100 text-green-800" },
                { s: "DELIVERED", label: "נמסר",  color: "bg-gray-100 text-gray-700" },
                { s: "PAID",      label: "שולם",  color: "bg-emerald-100 text-emerald-800" },
                { s: "CANCELLED", label: "בוטל",  color: "bg-red-100 text-red-700" },
              ].map(({ s, label, color }) => (
                <div key={s} className={`rounded-xl p-3 text-center ${color}`}>
                  <div className="text-2xl font-bold">{stats.statusCounts[s] ?? 0}</div>
                  <div className="text-xs font-medium mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
