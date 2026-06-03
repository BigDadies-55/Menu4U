"use client";

import { useState, useEffect, useCallback } from "react";
import { T } from "@/lib/ui";

type DurationStat = { avg: number; median: number; count: number };

type Stats = {
  period: number;
  totalOrders: number;
  uniqueTables: number;
  totalCovers: number;
  avgRevenuePerCover: number;
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

/* ── Helpers ─────────────────────────────────────────────── */
const fmt = (n: number) =>
  new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);
const fmtMin = (m: number) =>
  m < 1 ? "< 1 דק'" : m < 60 ? `${Math.round(m)} דק'` : `${Math.floor(m / 60)}ש' ${Math.round(m % 60)}דק'`;
function todayStr() { return new Date().toISOString().slice(0, 10); }

/* ── Gradient dark-stops (no T equivalent) ───────────────── */
const C = {
  blueDk:   T.blue,
  greenDk:  T.green,
  yellowDk: T.gold,
  redDk:    T.red,
  purpleDk: T.purple,
  pink:     "#f06595",
  pinkDk:   "#a61e4d",
};

const GRAD = {
  blue:   `linear-gradient(135deg,${C.blueDk},${T.blue})`,
  green:  `linear-gradient(135deg,${C.greenDk},${T.green})`,
  yellow: `linear-gradient(135deg,${C.yellowDk},${T.yellow})`,
  red:    `linear-gradient(135deg,${C.redDk},${T.red})`,
  purple: `linear-gradient(135deg,${C.purpleDk},${T.purple})`,
  pink:   `linear-gradient(135deg,${C.pinkDk},${C.pink})`,
};

const STAGE_COLORS: Record<string, string> = {
  PENDING:   T.yellow,
  CONFIRMED: T.blue,
  PREPARING: "#f97316",
  READY:     T.green,
  DELIVERED: T.gold,
};
const STAGE_LABELS: Record<string, string> = {
  PENDING:   "המתנה לאישור",
  CONFIRMED: "ציפייה לתחילת הכנה",
  PREPARING: "זמן הכנה",
  READY:     "מוכן — המתנה למסירה",
  DELIVERED: "נמסר — המתנה לתשלום",
};
const SOURCE_LABELS: Record<string, string> = {
  ONLINE: "תפריט דיגיטלי",
  WAITER: "מלצר",
  POS:    "קופה",
};

/* ── Card ────────────────────────────────────────────────── */
function Card({ title, sub, children, style }: { title: React.ReactNode; sub?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden", ...style }}>
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>{sub}</div>}
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

/* ── KPI card ────────────────────────────────────────────── */
function KpiCard({ color, icon, value, label, sub }: { color: keyof typeof GRAD; icon: string; value: string; label: string; sub: string }) {
  return (
    <div style={{ background: GRAD[color], borderRadius: 12, padding: "20px 18px 0", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-60%)", fontSize: 52, opacity: 0.15 }}>{icon}</div>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em", color: "rgba(255,255,255,.75)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,.6)", marginTop: 4 }}>{sub}</div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,.18)", marginTop: 12, padding: "9px 0", fontSize: 11, color: "rgba(255,255,255,.7)" }}>
        פרטים נוספים →
      </div>
    </div>
  );
}

/* ── Ring Gauge ──────────────────────────────────────────── */
function RingGauge({ value, max, label, sublabel, displayValue, color }: {
  value: number; max: number; label: string; sublabel?: string;
  displayValue?: string; color: string;
}) {
  const pct = Math.min(1, Math.max(0, max > 0 ? value / max : 0));
  const size = 140;
  const cx = size / 2, cy = size / 2;
  const strokeW = 11;
  const r = cx - strokeW / 2 - 2;
  const circ = 2 * Math.PI * r;
  const GAP = 90;
  const arcFrac = (360 - GAP) / 360;
  const dashTotal = circ * arcFrac;
  const dashFill = dashTotal * pct;
  const rot = 90 + GAP / 2;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={`rg-${label.replace(/\s/g,"")}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity=".6" />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.border} strokeWidth={strokeW}
          strokeDasharray={`${dashTotal} ${circ}`} strokeLinecap="round"
          transform={`rotate(${rot} ${cx} ${cy})`} />
        {/* Fill */}
        {pct > 0 && (
          <circle cx={cx} cy={cy} r={r} fill="none"
            stroke={`url(#rg-${label.replace(/\s/g,"")})`} strokeWidth={strokeW}
            strokeDasharray={`${dashFill} ${circ}`} strokeLinecap="round"
            transform={`rotate(${rot} ${cx} ${cy})`}
            style={{ transition: "stroke-dasharray .7s cubic-bezier(.4,0,.2,1)" }} />
        )}
        {/* BG fill */}
        <circle cx={cx} cy={cy} r={r - strokeW / 2 - 2} fill={`${color}08`} />
        {/* Center text */}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="18" fontWeight="800" fill={T.text}>
          {displayValue ?? (Number.isFinite(value) ? String(Math.round(value)) : "—")}
        </text>
        {/* Mini bar */}
        <rect x={cx - 22} y={cy + 14} width={44} height={3} rx={2} fill={T.border} />
        <rect x={cx - 22} y={cy + 14} width={44 * pct} height={3} rx={2} fill={color} />
      </svg>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.sub }}>{label}</div>
        {sublabel && <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{sublabel}</div>}
      </div>
    </div>
  );
}

/* ── Bar ─────────────────────────────────────────────────── */
function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: 6, background: T.border, borderRadius: 99, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.max(2, pct)}%`, background: color, borderRadius: 99, transition: "width .5s" }} />
    </div>
  );
}

/* ── Recommendations ─────────────────────────────────────── */
function genRecommendations(s: Stats): { icon: string; text: string; sev: "warn" | "info" | "ok" }[] {
  const r: { icon: string; text: string; sev: "warn" | "info" | "ok" }[] = [];
  if (!s.hasLogs || s.totalOrders < 3) {
    r.push({ icon: "📊", text: "אין עדיין מספיק נתוני הזמנות לייצור המלצות. ההמלצות יופיעו לאחר מספר הזמנות.", sev: "info" });
    return r;
  }
  const { PENDING, PREPARING, READY } = s.durations;
  if (PENDING?.count > 0 && PENDING.avg > 4) r.push({ icon: "⏰", text: `ממוצע המתנה לאישור: ${fmtMin(PENDING.avg)}. מומלץ לאשר תוך 2-3 דק'.`, sev: PENDING.avg > 8 ? "warn" : "info" });
  else if (PENDING?.count > 0) r.push({ icon: "✅", text: `זמן אישור הזמנות מצוין — ${fmtMin(PENDING.avg)} בממוצע.`, sev: "ok" });

  if (PREPARING?.count > 0 && s.avgExpectedPrepTime > 0) {
    const ov = PREPARING.avg - s.avgExpectedPrepTime;
    if (ov > 8) r.push({ icon: "👨‍🍳", text: `זמן הכנה (${fmtMin(PREPARING.avg)}) גבוה ב-${fmtMin(ov)} מהמוגדר (${fmtMin(s.avgExpectedPrepTime)}).`, sev: "warn" });
    else if (ov < -5) r.push({ icon: "🚀", text: `הצוות מהיר יותר מהצפוי! ${fmtMin(PREPARING.avg)} לעומת ${fmtMin(s.avgExpectedPrepTime)}.`, sev: "ok" });
  }
  if (s.totalTime?.count > 0) {
    if (s.totalTime.avg > 40) r.push({ icon: "⚡", text: `זמן שירות כולל: ${fmtMin(s.totalTime.avg)}. יעד: פחות מ-30 דק'.`, sev: "warn" });
    else r.push({ icon: "🏆", text: `זמן שירות ממוצע: ${fmtMin(s.totalTime.avg)} — תוצאה טובה.`, sev: "ok" });
  }
  if (READY?.count > 0 && READY.avg > 5) r.push({ icon: "🔔", text: `הזמנות מחכות ${fmtMin(READY.avg)} לאחר שמוכנות. שקול לשפר תהליך הגשה.`, sev: READY.avg > 10 ? "warn" : "info" });
  if (s.deliveredToPayTime?.count > 0) {
    if (s.deliveredToPayTime.avg > 10) r.push({ icon: "💳", text: `זמן ממוצע מהגשה לתשלום: ${fmtMin(s.deliveredToPayTime.avg)}. שקול לשפר זרימת הקאשייר.`, sev: s.deliveredToPayTime.avg > 20 ? "warn" : "info" });
    else r.push({ icon: "💳", text: `סגירת חשבון מהירה: ${fmtMin(s.deliveredToPayTime.avg)} — יעיל.`, sev: "ok" });
  }
  if (s.paidRate > 0) r.push({ icon: "🏦", text: `${s.paidRate.toFixed(0)}% מהזמנות עברו סגירת חשבון דיגיטלית (${fmt(s.paidRevenue)}).`, sev: "info" });
  if (s.cancelRate > 15) r.push({ icon: "⚠️", text: `שיעור ביטולים גבוה: ${s.cancelRate.toFixed(1)}%.`, sev: "warn" });
  else if (s.cancelRate > 0) r.push({ icon: "📋", text: `שיעור ביטולים: ${s.cancelRate.toFixed(1)}% — תקין.`, sev: "ok" });
  const peakCount = s.byHour[s.peakHour];
  if (peakCount > 0) r.push({ icon: "📈", text: `שעת שיא: ${s.peakHour}:00–${s.peakHour + 1}:00 עם ${peakCount} הזמנות.`, sev: "info" });
  if (s.totalRevenue > 0) r.push({ icon: "💰", text: `סה״כ הכנסות: ${fmt(s.totalRevenue)} ב-${s.period} ימים. ממוצע ${fmt(s.avgOrderValue)} להזמנה.`, sev: "info" });
  return r;
}

/* ── Main ────────────────────────────────────────────────── */
export default function StatsClient({ restaurants, isSuperAdmin }: { restaurants: Restaurant[]; isSuperAdmin: boolean }) {
  const [restaurantId, setRestaurantId] = useState(restaurants[0]?.id ?? "");
  const [period, setPeriod]     = useState(30);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");
  const [stats, setStats]       = useState<Stats | null>(null);
  const [loading, setLoading]   = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (dateFrom) { p.set("from", dateFrom); if (dateTo) p.set("to", dateTo); }
    else p.set("days", String(period));
    if (restaurantId) p.set("restaurantId", restaurantId);
    const res = await fetch(`/api/admin/orders/stats?${p}`);
    if (res.ok) setStats(await res.json());
    setLoading(false);
  }, [restaurantId, period, dateFrom, dateTo]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const s = stats;
  const recs = s ? genRecommendations(s) : [];
  const maxByHour  = s ? Math.max(...s.byHour, 1) : 1;
  const maxByDay   = s ? Math.max(...s.byDay.map(d => d.count), 1) : 1;
  const maxDur     = s ? Math.max(...Object.values(s.durations).map(d => d.avg), s.deliveredToPayTime?.avg ?? 0, 1) : 1;

  /* gauge color by value */
  function gaugeColor(val: number, ranges: { at: number; c: string }[]) {
    let c = ranges[0].c;
    for (const r of ranges.sort((a, b) => a.at - b.at)) if (val >= r.at) c = r.c;
    return c;
  }

  return (
    <div style={{ background: T.bg, minHeight: "100vh", padding: "24px", direction: "rtl" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text, margin: 0 }}>📊 סטטיסטיקות הזמנות</h1>
          <p style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>ניתוח זמני סטטוסים, עומסים והמלצות</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {/* Restaurant select */}
          {(isSuperAdmin && restaurants.length > 1) && (
            <select value={restaurantId} onChange={e => setRestaurantId(e.target.value)}
              style={{ background: T.overlay, border: `1px solid ${T.border}`, color: T.text, borderRadius: 8, padding: "7px 12px", fontSize: 13, outline: "none" }}>
              {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}
          {/* Period */}
          <div style={{ display: "flex", background: T.overlay, borderRadius: 8, border: `1px solid ${T.border}`, overflow: "hidden" }}>
            {[7, 30, 90].map(d => (
              <button key={d} onClick={() => { setPeriod(d); setDateFrom(""); setDateTo(""); }}
                style={{
                  padding: "7px 16px", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
                  background: !dateFrom && period === d ? T.blue : "transparent",
                  color: !dateFrom && period === d ? "#fff" : T.sub,
                  transition: "all .15s",
                }}>
                {d} ימים
              </button>
            ))}
          </div>
          {/* Date range */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: T.overlay, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 12px", fontSize: 12 }}>
            <span style={{ color: T.muted }}>מ-</span>
            <input type="date" value={dateFrom} max={dateTo || todayStr()} onChange={e => setDateFrom(e.target.value)}
              style={{ background: "none", border: "none", color: T.sub, fontSize: 12, outline: "none", width: 120 }} />
            <span style={{ color: T.muted }}>עד</span>
            <input type="date" value={dateTo} min={dateFrom || undefined} max={todayStr()} onChange={e => setDateTo(e.target.value)}
              style={{ background: "none", border: "none", color: T.sub, fontSize: 12, outline: "none", width: 120 }} />
            {dateFrom && (
              <button onClick={() => { setDateFrom(""); setDateTo(""); }}
                style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 14, padding: "0 2px" }}>✕</button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: T.muted, fontSize: 14 }}>
          <svg style={{ animation: "spin 1s linear infinite", width: 20, height: 20, marginLeft: 10 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          טוען נתונים...
        </div>
      ) : s && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* ── 6 KPI cards ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 14 }}>
            <KpiCard color="blue"   icon="🛒" value={String(s.totalOrders)}                       label="הזמנות"          sub={`${s.period} ימים`} />
            <KpiCard color="green"  icon="💰" value={fmt(s.totalRevenue)}                          label="הכנסות"          sub={`ממוצע ${fmt(s.avgOrderValue)} להזמנה`} />
            <KpiCard color="yellow" icon="🪑" value={String(s.uniqueTables)}                       label="שולחנות"         sub="שולחנות ייחודיים" />
            <KpiCard color="pink"   icon="👤" value={s.avgRevenuePerCover > 0 ? fmt(s.avgRevenuePerCover) : "—"} label="ממוצע לסועד" sub={s.totalCovers > 0 ? `${s.totalCovers} סועדים` : "אין נתון"} />
            <KpiCard color="purple" icon="⏱" value={s.totalTime?.count ? fmtMin(s.totalTime.avg) : "—"} label="זמן שירות"  sub={s.totalTime?.count ? `${s.totalTime.count} הזמנות` : "אין לוגים"} />
            <KpiCard color="red"    icon="📈" value={`${s.completionRate.toFixed(0)}%`}            label="שיעור השלמה"     sub={`${s.cancelRate.toFixed(1)}% בוטלו`} />
          </div>

          {/* ── Gauge row ── */}
          <Card title="🎯 מדדי ביצוע" sub="ביצועי שירות בזמן אמת">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20, justifyItems: "center" }}>
              <RingGauge value={s.completionRate} max={100}
                label="שיעור השלמה" sublabel="DELIVERED + PAID"
                displayValue={`${s.completionRate.toFixed(0)}%`}
                color={gaugeColor(s.completionRate, [{ at: 0, c: T.red }, { at: 50, c: T.yellow }, { at: 75, c: T.green }])} />
              <RingGauge value={s.cancelRate} max={30}
                label="שיעור ביטולים" sublabel="יעד: פחות מ-5%"
                displayValue={`${s.cancelRate.toFixed(1)}%`}
                color={gaugeColor(s.cancelRate, [{ at: 0, c: T.green }, { at: 5, c: T.yellow }, { at: 15, c: T.red }])} />
              <RingGauge value={s.totalTime?.count > 0 ? s.totalTime.avg : 0} max={60}
                label="זמן שירות ממוצע" sublabel="יעד: פחות מ-30 דק׳"
                displayValue={s.totalTime?.count > 0 ? fmtMin(s.totalTime.avg) : "—"}
                color={gaugeColor(s.totalTime?.count > 0 ? s.totalTime.avg : 0, [{ at: 0, c: T.green }, { at: 30, c: T.yellow }, { at: 40, c: T.red }])} />
              <RingGauge value={s.deliveredToPayTime?.count > 0 ? s.deliveredToPayTime.avg : 0} max={30}
                label="המתנה לתשלום" sublabel="DELIVERED → PAID"
                displayValue={s.deliveredToPayTime?.count > 0 ? fmtMin(s.deliveredToPayTime.avg) : "—"}
                color={gaugeColor(s.deliveredToPayTime?.count > 0 ? s.deliveredToPayTime.avg : 0, [{ at: 0, c: T.green }, { at: 10, c: T.yellow }, { at: 20, c: T.red }])} />
            </div>
          </Card>

          {/* ── Two columns: stage times + (source + hourly) ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

            {/* Stage times */}
            <Card title="⏱ זמן ממוצע בכל שלב"
              sub={s.hasLogs ? "על בסיס לוגים של שינויי סטטוס בפועל" : "⚠️ אין לוגי סטטוס — יצטברו לאחר שהזמנות יעברו שינוי סטטוס דרך הממשק"}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {(["PENDING","CONFIRMED","PREPARING","READY","DELIVERED"] as const).map(st => {
                  const d = s.durations[st];
                  const pct = maxDur > 0 && d?.count > 0 ? (d.avg / maxDur) * 100 : 0;
                  return (
                    <div key={st}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: T.sub }}>
                          <span style={{ width: 9, height: 9, borderRadius: "50%", background: STAGE_COLORS[st], display: "inline-block", flexShrink: 0 }} />
                          {STAGE_LABELS[st]}
                        </span>
                        <span style={{ fontSize: 13, textAlign: "left" }}>
                          {d?.count > 0 ? (
                            <>
                              <span style={{ fontWeight: 700, color: T.text }}>{fmtMin(d.avg)}</span>
                              <span style={{ color: T.muted, fontSize: 11, marginRight: 6 }}>מדיאן {fmtMin(d.median)}</span>
                              <span style={{ color: T.border, fontSize: 11 }}>({d.count})</span>
                            </>
                          ) : <span style={{ color: T.border }}>—</span>}
                        </span>
                      </div>
                      <Bar pct={pct} color={STAGE_COLORS[st]} />
                    </div>
                  );
                })}
                {/* Pay time */}
                {s.deliveredToPayTime?.count > 0 && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: T.sub }}>
                        <span style={{ width: 9, height: 9, borderRadius: "50%", background: T.green, display: "inline-block", flexShrink: 0 }} />
                        💳 נמסר → שולם
                      </span>
                      <span style={{ fontSize: 13 }}>
                        <span style={{ fontWeight: 700, color: T.text }}>{fmtMin(s.deliveredToPayTime.avg)}</span>
                        <span style={{ color: T.muted, fontSize: 11, marginRight: 6 }}>מדיאן {fmtMin(s.deliveredToPayTime.median)}</span>
                      </span>
                    </div>
                    <Bar pct={maxDur > 0 ? (s.deliveredToPayTime.avg / maxDur) * 100 : 0} color={T.green} />
                  </div>
                )}
                {/* Total */}
                {s.totalTime?.count > 0 && (
                  <div style={{ marginTop: 6, paddingTop: 12, borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.sub }}>⏱ זמן כולל (PENDING → DELIVERED/PAID)</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: T.text }}>
                      {fmtMin(s.totalTime.avg)}{" "}
                      <span style={{ fontSize: 11, color: T.muted, fontWeight: 400 }}>({s.totalTime.count})</span>
                    </span>
                  </div>
                )}
              </div>
            </Card>

            {/* Source + Hourly stacked */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Source */}
              {s.bySource && Object.keys(s.bySource).length > 1 && (
                <Card title="📱 מקור הזמנות">
                  <div style={{ display: "flex", gap: 10 }}>
                    {Object.entries(s.bySource).map(([src, count]) => {
                      const pct = s.totalOrders > 0 ? ((count / s.totalOrders) * 100).toFixed(0) : "0";
                      return (
                        <div key={src} style={{ flex: 1, background: "#2a2e35", border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 10px", textAlign: "center" }}>
                          <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>{count}</div>
                          <div style={{ fontSize: 12, color: T.sub, marginTop: 4 }}>{SOURCE_LABELS[src] ?? src}</div>
                          <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{pct}%</div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
              {/* Hourly */}
              <Card title="🕐 הזמנות לפי שעה" sub={`התפלגות ב-${s.period} ימים האחרונים`} style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 100 }}>
                  {s.byHour.map((count, h) => {
                    const pct = Math.max(4, (count / maxByHour) * 100);
                    const isPeak = h === s.peakHour && count > 0;
                    return (
                      <div key={h} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, height: "100%", justifyContent: "flex-end" }}
                        title={`${h}:00 — ${count} הזמנות`}>
                        <div style={{ width: "100%", borderRadius: "3px 3px 0 0", height: `${pct}%`, background: isPeak ? T.yellow : T.blue, opacity: isPeak ? 1 : 0.55, transition: "height .5s" }} />
                        {h % 4 === 0 && <span style={{ fontSize: 8, color: T.muted }}>{h}</span>}
                      </div>
                    );
                  })}
                </div>
                {s.byHour[s.peakHour] > 0 && (
                  <p style={{ fontSize: 11, color: T.yellow, marginTop: 8, fontWeight: 600 }}>
                    🔶 שעת שיא: {s.peakHour}:00 — {s.byHour[s.peakHour]} הזמנות
                  </p>
                )}
              </Card>
            </div>
          </div>

          {/* ── Daily volume ── */}
          <Card title="📅 נפח יומי" sub={`מספר הזמנות לפי יום`}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 80, overflowX: "auto" }}>
              {s.byDay.map(({ date, count, revenue }) => {
                const pct = Math.max(4, (count / maxByDay) * 100);
                const label = new Date(date).toLocaleDateString("he-IL", { month: "short", day: "numeric" });
                return (
                  <div key={date} style={{ flexShrink: 0, width: period > 30 ? 8 : 12, height: `${pct}%`, background: count > 0 ? T.blue : T.border, borderRadius: "2px 2px 0 0", opacity: count > 0 ? 0.75 : 0.3 }}
                    title={`${label}: ${count} הזמנות · ${fmt(revenue)}`} />
                );
              })}
            </div>
          </Card>

          {/* ── Recommendations + Status distribution ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Recommendations */}
            <Card title="💡 המלצות">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {recs.map((rec, i) => {
                  const cfg = rec.sev === "warn"
                    ? { bg: "rgba(224,49,49,.08)", border: "rgba(224,49,49,.25)", color: "#ff8787", dot: T.red }
                    : rec.sev === "ok"
                    ? { bg: "rgba(55,178,77,.08)", border: "rgba(55,178,77,.25)", color: "#69db7c", dot: T.green }
                    : { bg: "rgba(51,154,240,.08)", border: "rgba(51,154,240,.25)", color: "#74c0fc", dot: T.blue };
                  return (
                    <div key={i} style={{ display: "flex", gap: 10, padding: "10px 12px", borderRadius: 8, border: `1px solid ${cfg.border}`, background: cfg.bg, alignItems: "flex-start" }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.dot, flexShrink: 0, marginTop: 4 }} />
                      <span style={{ fontSize: 13, color: cfg.color }}>
                        <span style={{ marginLeft: 4 }}>{rec.icon}</span>{rec.text}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Status distribution */}
            <Card title="🍽 פילוג סטטוסים" sub="סך כל ההזמנות בתקופה לפי סטטוס אחרון">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {([
                  { k: "PENDING",   label: "ממתין", bg: "rgba(245,158,11,.1)",  border: "rgba(245,158,11,.25)", color: T.gold },
                  { k: "CONFIRMED", label: "אושר",  bg: "rgba(51,154,240,.1)",  border: "rgba(51,154,240,.25)", color: "#74c0fc" },
                  { k: "PREPARING", label: "בהכנה", bg: "rgba(249,115,22,.1)",  border: "rgba(249,115,22,.25)", color: T.orange },
                  { k: "READY",     label: "מוכן",  bg: "rgba(81,207,102,.1)",  border: "rgba(81,207,102,.25)", color: "#69db7c" },
                  { k: "DELIVERED", label: "נמסר",  bg: "rgba(141,153,165,.1)", border: "rgba(141,153,165,.2)", color: T.sub },
                  { k: "PAID",      label: "שולם",  bg: "rgba(32,201,151,.1)",  border: "rgba(32,201,151,.25)", color: "#38d9a9" },
                  { k: "CANCELLED", label: "בוטל",  bg: "rgba(240,62,62,.1)",   border: "rgba(240,62,62,.25)",  color: T.red },
                ] as const).map(({ k, label, bg, border, color }) => (
                  <div key={k} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "12px 8px", textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color }}>{s.statusCounts[k] ?? 0}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color, marginTop: 4 }}>{label}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

        </div>
      )}
    </div>
  );
}
