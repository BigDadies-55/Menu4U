"use client";

import { useState, useEffect, useCallback } from "react";

type DurationStat = { avg: number; median: number; count: number };

type Stats = {
  period: number;
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  avgItems: number;
  statusCounts: Record<string, number>;
  cancelRate: number;
  completionRate: number;
  durations: Record<"PENDING" | "CONFIRMED" | "PREPARING" | "READY", DurationStat>;
  totalTime: DurationStat;
  avgExpectedPrepTime: number;
  byHour: number[];
  byDay: { date: string; count: number; revenue: number }[];
  peakHour: number;
  hasLogs: boolean;
};

type Restaurant = { id: string; name: string };

const fmt = (n: number) => new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);
const fmtMin = (m: number) => m < 1 ? "< 1 דק'" : m < 60 ? `${Math.round(m)} דק'` : `${Math.floor(m / 60)}ש' ${Math.round(m % 60)}דק'`;

const STAGE_LABELS: Record<string, string> = {
  PENDING: "המתנה לאישור",
  CONFIRMED: "ציפייה לתחילת הכנה",
  PREPARING: "זמן הכנה",
  READY: "מוכן — המתנה למסירה",
};

const STAGE_COLORS: Record<string, string> = {
  PENDING: "#f59e0b",
  CONFIRMED: "#3b82f6",
  PREPARING: "#f97316",
  READY: "#22c55e",
};

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(4, (value / max) * 100) : 4;
  return (
    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function genRecommendations(s: Stats): { icon: string; text: string; severity: "warn" | "info" | "ok" }[] {
  const recs: { icon: string; text: string; severity: "warn" | "info" | "ok" }[] = [];

  if (!s.hasLogs || s.totalOrders < 3) {
    recs.push({ icon: "📊", text: "אין עדיין מספיק נתוני הזמנות לייצור המלצות. ההמלצות יופיעו לאחר מספר הזמנות.", severity: "info" });
    return recs;
  }

  const { PENDING, PREPARING, READY } = s.durations;

  // Pending too long
  if (PENDING.count > 0 && PENDING.avg > 4) {
    recs.push({
      icon: "⏰",
      text: `ממוצע המתנה לאישור הזמנה: ${fmtMin(PENDING.avg)}. מומלץ לאשר תוך 2-3 דק' כדי לשפר חוויית לקוח.`,
      severity: PENDING.avg > 8 ? "warn" : "info",
    });
  } else if (PENDING.count > 0) {
    recs.push({ icon: "✅", text: `זמן אישור הזמנות מצוין — ${fmtMin(PENDING.avg)} בממוצע.`, severity: "ok" });
  }

  // Preparing vs expected
  if (PREPARING.count > 0 && s.avgExpectedPrepTime > 0) {
    const overrun = PREPARING.avg - s.avgExpectedPrepTime;
    if (overrun > 8) {
      recs.push({
        icon: "👨‍🍳",
        text: `זמן ההכנה הממוצע (${fmtMin(PREPARING.avg)}) גבוה ב-${fmtMin(overrun)} מהזמן המוגדר למנות (${fmtMin(s.avgExpectedPrepTime)}). שקול לעדכן את זמני ההכנה בתפריט או לחזק את הצוות בשעות שיא.`,
        severity: "warn",
      });
    } else if (overrun < -5) {
      recs.push({
        icon: "🚀",
        text: `הצוות מהיר יותר מהצפוי! הכנה ממוצעת ${fmtMin(PREPARING.avg)} לעומת ${fmtMin(s.avgExpectedPrepTime)} מוגדר.`,
        severity: "ok",
      });
    }
  }

  // Total completion time
  if (s.totalTime.count > 0) {
    if (s.totalTime.avg > 40) {
      recs.push({
        icon: "⚡",
        text: `זמן השלמה כולל ממוצע: ${fmtMin(s.totalTime.avg)}. לקוחות מצפים לפחות מ-30 דק'. בדוק איפה צווארי הבקבוק.`,
        severity: "warn",
      });
    } else {
      recs.push({
        icon: "🏆",
        text: `זמן שירות ממוצע מלא: ${fmtMin(s.totalTime.avg)} — תוצאה טובה.`,
        severity: "ok",
      });
    }
  }

  // Ready waiting too long
  if (READY.count > 0 && READY.avg > 5) {
    recs.push({
      icon: "🔔",
      text: `הזמנות מחכות ${fmtMin(READY.avg)} בממוצע לאחר שמוכנות. הגדרת התראות לצוות ההגשה תוכל לשפר.`,
      severity: READY.avg > 10 ? "warn" : "info",
    });
  }

  // Cancel rate
  if (s.cancelRate > 15) {
    recs.push({
      icon: "⚠️",
      text: `שיעור ביטולים גבוה: ${s.cancelRate.toFixed(1)}%. בדוק אם הזמנות מגיעות בשעות סגורות או מסיבות תפעוליות.`,
      severity: "warn",
    });
  } else if (s.cancelRate > 0) {
    recs.push({
      icon: "📋",
      text: `שיעור ביטולים: ${s.cancelRate.toFixed(1)}% — תקין.`,
      severity: "ok",
    });
  }

  // Peak hour
  const peakCount = s.byHour[s.peakHour];
  if (peakCount > 0) {
    recs.push({
      icon: "📈",
      text: `שעת השיא שלך היא ${s.peakHour}:00–${s.peakHour + 1}:00 עם ${peakCount} הזמנות ב-${s.period} הימים האחרונים. וודא שיש מספיק צוות בשעה זו.`,
      severity: "info",
    });
  }

  // Revenue
  if (s.totalRevenue > 0) {
    recs.push({
      icon: "💰",
      text: `סה"כ הכנסות מהזמנות דיגיטליות: ${fmt(s.totalRevenue)} ב-${s.period} ימים. ממוצע ${fmt(s.avgOrderValue)} להזמנה.`,
      severity: "info",
    });
  }

  return recs;
}

function SeverityBadge({ s }: { s: "warn" | "info" | "ok" }) {
  const cls = s === "warn" ? "bg-red-50 border-red-200" : s === "ok" ? "bg-green-50 border-green-200" : "bg-blue-50 border-blue-200";
  return <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${s === "warn" ? "bg-red-400" : s === "ok" ? "bg-green-400" : "bg-blue-400"}`} />;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function StatsClient({
  restaurants,
  isSuperAdmin,
}: {
  restaurants: Restaurant[];
  isSuperAdmin: boolean;
}) {
  const [restaurantId, setRestaurantId] = useState(restaurants[0]?.id ?? "");
  const [period, setPeriod] = useState(30);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateFrom) {
      params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
    } else {
      params.set("days", String(period));
    }
    if (restaurantId) params.set("restaurantId", restaurantId);
    const res = await fetch(`/api/admin/orders/stats?${params}`);
    if (res.ok) setStats(await res.json());
    setLoading(false);
  }, [restaurantId, period, dateFrom, dateTo]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const recommendations = stats ? genRecommendations(stats) : [];

  const maxByHour = stats ? Math.max(...stats.byHour, 1) : 1;
  const maxByDay = stats ? Math.max(...stats.byDay.map(d => d.count), 1) : 1;
  const maxDuration = stats
    ? Math.max(...Object.values(stats.durations).map(d => d.avg), 1)
    : 1;

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
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
            <input
              type="date"
              value={dateFrom}
              max={dateTo || todayStr()}
              onChange={e => setDateFrom(e.target.value)}
              className="text-sm text-gray-700 focus:outline-none bg-transparent"
            />
            <span className="text-xs text-gray-400 mx-1">עד</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              max={todayStr()}
              onChange={e => setDateTo(e.target.value)}
              className="text-sm text-gray-700 focus:outline-none bg-transparent"
            />
            {dateFrom && (
              <button onClick={() => { setDateFrom(""); setDateTo(""); }}
                className="text-gray-400 hover:text-gray-700 text-xs mr-1">✕</button>
            )}
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
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "הזמנות", value: stats.totalOrders, sub: `${stats.period} ימים`, color: "#f59e0b" },
              { label: "הכנסות", value: fmt(stats.totalRevenue), sub: `ממוצע ${fmt(stats.avgOrderValue)}`, color: "#22c55e" },
              { label: "זמן שירות ממוצע", value: stats.totalTime.count ? fmtMin(stats.totalTime.avg) : "—", sub: stats.totalTime.count ? `על בסיס ${stats.totalTime.count} הזמנות` : "אין נתוני לוג עדיין", color: "#3b82f6" },
              { label: "שיעור השלמה", value: `${stats.completionRate.toFixed(0)}%`, sub: `${stats.cancelRate.toFixed(1)}% בוטלו`, color: "#a855f7" },
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

          {/* Status flow — time per stage */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-1">⏱ זמן ממוצע בכל שלב</h2>
            <p className="text-xs text-gray-400 mb-5">
              {stats.hasLogs
                ? "על בסיס לוגים של שינויי סטטוס בפועל"
                : "⚠️ אין עדיין לוגי סטטוס — הנתונים יצטברו לאחר שהזמנות יעברו שינוי סטטוס דרך הממשק"}
            </p>
            <div className="space-y-4">
              {(["PENDING", "CONFIRMED", "PREPARING", "READY"] as const).map(s => {
                const d = stats.durations[s];
                return (
                  <div key={s}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ background: STAGE_COLORS[s] }} />
                        <span className="text-sm font-medium text-gray-700">{STAGE_LABELS[s]}</span>
                      </div>
                      <div className="text-left text-sm">
                        {d.count > 0 ? (
                          <>
                            <span className="font-bold text-gray-900">{fmtMin(d.avg)}</span>
                            <span className="text-gray-400 mr-2 text-xs">מדיאן {fmtMin(d.median)}</span>
                            <span className="text-gray-300 text-xs">({d.count})</span>
                          </>
                        ) : (
                          <span className="text-gray-300 text-sm">—</span>
                        )}
                      </div>
                    </div>
                    <MiniBar value={d.count > 0 ? d.avg : 0} max={maxDuration} color={STAGE_COLORS[s]} />
                  </div>
                );
              })}
            </div>

            {/* Total */}
            {stats.totalTime.count > 0 && (
              <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">⏱ זמן כולל (PENDING → DELIVERED)</span>
                <span className="font-bold text-gray-900">
                  {fmtMin(stats.totalTime.avg)}
                  <span className="text-xs text-gray-400 font-normal mr-1">({stats.totalTime.count} הזמנות)</span>
                </span>
              </div>
            )}
          </div>

          {/* Hourly chart */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-1">🕐 הזמנות לפי שעה</h2>
            <p className="text-xs text-gray-400 mb-5">התפלגות ב-{stats.period} ימים האחרונים</p>
            <div className="flex items-end gap-1 h-32">
              {stats.byHour.map((count, h) => {
                const heightPct = Math.max(4, (count / maxByHour) * 100);
                const isPeak = h === stats.peakHour && count > 0;
                return (
                  <div key={h} className="flex-1 flex flex-col items-center gap-1" title={`${h}:00 — ${count} הזמנות`}>
                    <div className="w-full rounded-t transition-all duration-500 cursor-pointer"
                      style={{ height: `${heightPct}%`, background: isPeak ? "#f59e0b" : "#e5e7eb" }}
                    />
                    {(h % 4 === 0) && (
                      <span className="text-[9px] text-gray-400">{h}</span>
                    )}
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

          {/* Daily volume */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-1">📅 נפח יומי</h2>
            <p className="text-xs text-gray-400 mb-5">מספר הזמנות לפי יום</p>
            <div className="flex items-end gap-0.5 h-24 overflow-x-auto">
              {stats.byDay.map(({ date, count }) => {
                const heightPct = Math.max(4, (count / maxByDay) * 100);
                const label = new Date(date).toLocaleDateString("he-IL", { month: "short", day: "numeric" });
                return (
                  <div key={date} className="flex flex-col items-center gap-1 shrink-0" style={{ minWidth: period > 30 ? 8 : 12 }} title={`${label}: ${count} הזמנות`}>
                    <div className="w-full rounded-t" style={{ height: `${heightPct}%`, background: count > 0 ? "#c9a35d" : "#e5e7eb" }} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-4">💡 המלצות</h2>
            <div className="space-y-3">
              {recommendations.map((rec, i) => {
                const bg = rec.severity === "warn" ? "bg-red-50 border-red-200" : rec.severity === "ok" ? "bg-green-50 border-green-200" : "bg-blue-50 border-blue-200";
                const dot = rec.severity === "warn" ? "bg-red-400" : rec.severity === "ok" ? "bg-green-400" : "bg-blue-400";
                return (
                  <div key={i} className={`flex gap-3 p-4 rounded-xl border ${bg}`}>
                    <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${dot}`} />
                    <div className="text-sm text-gray-700">
                      <span className="ml-1">{rec.icon}</span>
                      {rec.text}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status distribution */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-4">🍽 פילוג סטטוסים</h2>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {[
                { s: "PENDING", label: "ממתין", color: "bg-yellow-100 text-yellow-800" },
                { s: "CONFIRMED", label: "אושר", color: "bg-blue-100 text-blue-800" },
                { s: "PREPARING", label: "בהכנה", color: "bg-amber-100 text-amber-800" },
                { s: "READY", label: "מוכן", color: "bg-green-100 text-green-800" },
                { s: "DELIVERED", label: "נמסר", color: "bg-gray-100 text-gray-700" },
                { s: "CANCELLED", label: "בוטל", color: "bg-red-100 text-red-700" },
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
