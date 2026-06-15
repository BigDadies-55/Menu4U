"use client";

import { useState, useEffect } from "react";

/* ─── Types ─────────────────────────────────────────────────── */
type Kpis = {
  todayRevenue: number;
  todayOrderCount: number;
  openOrders: number;
  menuViewsToday: number;
};
type TopItem  = { name: string; quantity: number; revenue: number };
type DayPoint = { date: string; revenue: number; orders: number };
type ExpiringSub = { id: string; name: string; subscriptionTo: string | null };
type RecentOrder = {
  id: string;
  tableNumber: number | null;
  customerName: string | null;
  status: string;
  totalAmount: number;
  createdAt: string;
  restaurant: { name: string };
};
type RestaurantStat = { id: string; name: string; total: number; completed: number; pct: number };
type DashData = {
  kpis: Kpis;
  recentOrders: RecentOrder[];
  topItems: TopItem[];
  revenueChart: DayPoint[];
  expiringSubscriptions: ExpiringSub[];
  statusCounts: Record<string, number>;
  weekStats: { revenue: number; orders: number };
  cancelledToday: number;
  restaurantStats: RestaurantStat[];
};
type Restaurant = { id: string; name: string };

/* ─── Glass design tokens ───────────────────────────────────── */
const G = {
  card:       "rgba(255,255,255,0.08)",
  cardHover:  "rgba(255,255,255,0.12)",
  panel:      "rgba(255,255,255,0.05)",
  border:     "rgba(255,255,255,0.15)",
  border2:    "rgba(255,255,255,0.07)",
  text:       "#FFFFFF",
  muted:      "rgba(255,255,255,0.65)",
  sub:        "rgba(255,255,255,0.85)",
  red:        "#FF4D4D",
  blue:       "#3B82F6",
  green:      "#10B981",
  cyan:       "#06B6D4",
  amber:      "#F59E0B",
  blur:       "blur(20px) saturate(160%)",
  blurHeavy:  "blur(30px)",
};

/* ─── Status config ─────────────────────────────────────────── */
const STATUS_CFG: Record<string, { label: string; badgeBg: string; badgeColor: string; dot: string }> = {
  PENDING:   { label: "ממתין",  badgeBg: "rgba(245,158,11,.18)",  badgeColor: "#FCD34D", dot: "#F59E0B" },
  CONFIRMED: { label: "אושר",   badgeBg: "rgba(59,130,246,.18)",  badgeColor: "#93C5FD", dot: G.blue },
  PREPARING: { label: "בהכנה",  badgeBg: "rgba(249,115,22,.18)",  badgeColor: "#FCA5A5", dot: "#F97316" },
  READY:     { label: "מוכן",   badgeBg: "rgba(16,185,129,.18)",  badgeColor: "#6EE7B7", dot: G.green },
  DELIVERED: { label: "הוגש",   badgeBg: "rgba(167,139,250,.18)", badgeColor: "#C4B5FD", dot: "#8B5CF6" },
  PAID:      { label: "שולם",   badgeBg: "rgba(16,185,129,.18)",  badgeColor: "#34D399", dot: G.green },
  CANCELLED: { label: "בוטל",   badgeBg: "rgba(255,255,255,.08)", badgeColor: "rgba(255,255,255,0.4)", dot: "rgba(255,255,255,0.3)" },
};

/* ─── Helpers ────────────────────────────────────────────────── */
function fmtCurrency(n: number) {
  return `₪${n.toLocaleString("he-IL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function shortDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
}
function minutesAgo(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return "עכשיו";
  if (mins === 1) return "לפני דקה";
  return `לפני ${mins} דק׳`;
}

/* ─── Glass Panel ────────────────────────────────────────────── */
function GlassPanel({ title, icon, children, extra }: { title: string; icon?: React.ReactNode; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div style={{
      background: G.panel,
      backdropFilter: G.blurHeavy,
      WebkitBackdropFilter: G.blurHeavy,
      border: `1px solid ${G.border}`,
      borderRadius: 20,
      padding: 16,
      boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
    }}>
      <div style={{
        fontSize: 13, fontWeight: 700, marginBottom: 12,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        letterSpacing: "0.5px", color: G.text,
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {icon && <span style={{ color: G.amber }}>{icon}</span>}
          {title}
        </span>
        {extra}
      </div>
      {children}
    </div>
  );
}

/* ─── KPI Card ───────────────────────────────────────────────── */
type NeonColor = "red" | "blue" | "green" | "cyan";
const NEON_COLORS: Record<NeonColor, { hex: string; glow: string; icon: string }> = {
  red:  { hex: G.red,   glow: "rgba(255,77,77,0.25)",    icon: "👁" },
  blue: { hex: G.blue,  glow: "rgba(59,130,246,0.25)",   icon: "🕐" },
  green:{ hex: G.green, glow: "rgba(16,185,129,0.25)",   icon: "$" },
  cyan: { hex: G.cyan,  glow: "rgba(6,182,212,0.25)",    icon: "🛒" },
};

function KpiCard({ color, label, value, lucideIcon }: { color: NeonColor; label: string; value: string; lucideIcon: React.ReactNode }) {
  const c = NEON_COLORS[color];
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? G.cardHover : G.card,
        backdropFilter: G.blur,
        WebkitBackdropFilter: G.blur,
        border: `1px solid ${hovered ? c.hex : G.border}`,
        borderRadius: 24,
        padding: 22,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
        boxShadow: hovered ? `0 0 25px ${c.glow}` : "none",
        transition: "all 0.3s ease",
        cursor: "default",
      }}
    >
      <div>
        <span style={{ fontSize: 14, color: G.muted, fontWeight: 500, display: "block", marginBottom: 6 }}>
          {label}
        </span>
        <span style={{ fontSize: 32, fontWeight: 900, color: c.hex, lineHeight: 1 }}>
          {value}
        </span>
      </div>
      <span style={{ color: c.hex, opacity: 0.9 }}>{lucideIcon}</span>
    </div>
  );
}

/* ─── SVG Icons ──────────────────────────────────────────────── */
const EyeIcon = ({ color }: { color: string }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);
const ClockIcon = ({ color }: { color: string }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const DollarIcon = ({ color }: { color: string }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);
const CartIcon = ({ color }: { color: string }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
  </svg>
);
const TrendIcon = ({ color }: { color: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
  </svg>
);
const PieIcon = ({ color }: { color: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>
  </svg>
);
const StarIcon = ({ color }: { color: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);
const HistoryIcon = ({ color }: { color: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
  </svg>
);

/* ─── Donut Chart ─────────────────────────────────────────────── */
function DonutChart({ statusCounts }: { statusCounts: Record<string, number> }) {
  const statuses = ["PENDING", "CONFIRMED", "PREPARING", "READY", "DELIVERED", "PAID", "CANCELLED"];
  const total = statuses.reduce((s, k) => s + (statusCounts[k] ?? 0), 0);
  const R = 60; const CIRC = 2 * Math.PI * R;

  let offset = 0;
  const segments = statuses.map(k => {
    const count = statusCounts[k] ?? 0;
    const frac = total > 0 ? count / total : 0;
    const dash = frac * CIRC;
    const gap  = CIRC - dash;
    const seg  = { key: k, count, dash, gap, offset, color: STATUS_CFG[k]?.dot ?? "#888" };
    offset += dash;
    return seg;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <svg viewBox="0 0 150 150" style={{ width: "100%", maxWidth: 130, height: "auto" }}>
        <circle cx="75" cy="75" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="14"/>
        {total === 0 ? (
          <circle cx="75" cy="75" r={R} fill="none" stroke={G.amber} strokeWidth="14"
            strokeDasharray={`${CIRC} 0`} transform="rotate(-90 75 75)" />
        ) : (
          segments.map(seg => seg.count > 0 && (
            <circle key={seg.key} cx="75" cy="75" r={R} fill="none"
              stroke={seg.color} strokeWidth="14" strokeLinecap="round"
              strokeDasharray={`${seg.dash} ${seg.gap}`}
              strokeDashoffset={-seg.offset}
              transform="rotate(-90 75 75)" />
          ))
        )}
        <text x="75" y="82" fill="#fff" fontSize="26" fontWeight="900" textAnchor="middle" fontFamily="Heebo">
          {total}
        </text>
      </svg>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 4 }}>
        {statuses.map(k => {
          const count = statusCounts[k] ?? 0;
          if (!count) return null;
          const cfg = STATUS_CFG[k];
          return (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: G.muted }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.dot, display: "inline-block", flexShrink: 0 }} />
                {cfg.label}
              </span>
              <span style={{ color: G.text, fontWeight: 700 }}>{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Revenue Chart ───────────────────────────────────────────── */
function RevenueChart({ data, chartPeriod }: { data: DayPoint[]; chartPeriod: "7" | "30" }) {
  const visible = chartPeriod === "7" ? data.slice(-7) : data;
  const maxRev = Math.max(...visible.map(d => d.revenue), 1);
  const maxOrd = Math.max(...visible.map(d => d.orders), 1);
  const W = 700; const H = 100; const PL = 0; const PR = 10; const PT = 10; const PB = 20;
  const cW = W - PL - PR; const cH = H - PT - PB;

  const [hovered, setHovered] = useState<number | null>(null);

  const pts = visible.map((d, i) => ({
    x: visible.length < 2 ? PL + cW / 2 : PL + (i / (visible.length - 1)) * cW,
    yRev: PT + (1 - d.revenue / maxRev) * cH,
    yOrd: PT + (1 - d.orders / maxOrd) * cH,
    ...d,
  }));

  const revLinePts = pts.map(p => `${p.x},${p.yRev}`).join(" ");
  const ordLinePts = pts.map(p => `${p.x},${p.yOrd}`).join(" ");
  const areaPath = pts.length > 0
    ? `M${pts[0].x},${PT + cH} ` + pts.map(p => `L${p.x},${p.yRev}`).join(" ") + ` L${pts[pts.length - 1].x},${PT + cH} Z`
    : "";

  const step = chartPeriod === "7" ? 1 : 5;
  const labelPts = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={G.blue} stopOpacity="0.25" />
            <stop offset="100%" stopColor={G.blue} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#revGrad)" />
        <polyline points={revLinePts} fill="none" stroke={G.blue} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={ordLinePts} fill="none" stroke={G.green} strokeWidth="2.5" strokeDasharray="6,5" strokeLinejoin="round" strokeLinecap="round" />
        {labelPts.map((p, i) => (
          <text key={i} x={p.x} y={H - 4} fontSize="11" fill={G.muted} textAnchor="middle">{shortDate(p.date)}</text>
        ))}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.yRev} r={hovered === i ? 7 : 5} fill={G.blue} stroke="#fff" strokeWidth="2.5" />
            <rect x={p.x - 22} y={0} width={44} height={H} fill="transparent"
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
              style={{ cursor: "crosshair" }}
            />
            {hovered === i && (
              <g>
                <rect x={Math.min(p.x - 60, W - 135)} y={p.yRev - 52} width={130} height={44} rx={8}
                  fill="rgba(0,0,0,0.7)" stroke={G.border} strokeWidth="1" />
                <text x={Math.min(p.x - 60, W - 135) + 65} y={p.yRev - 30} textAnchor="middle"
                  fill={G.blue} fontSize="14" fontWeight="bold">{fmtCurrency(p.revenue)}</text>
                <text x={Math.min(p.x - 60, W - 135) + 65} y={p.yRev - 14} textAnchor="middle"
                  fill={G.muted} fontSize="11">{shortDate(p.date)} · {p.orders} הזמנות</text>
              </g>
            )}
          </g>
        ))}
      </svg>
      <div style={{ display: "flex", gap: 20, marginTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: G.muted }}>
          <div style={{ width: 18, height: 3, background: G.blue, borderRadius: 2 }} /> הכנסות
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: G.muted }}>
          <div style={{ width: 18, height: 2, borderTop: `2px dashed ${G.green}` }} /> הזמנות
        </div>
      </div>
    </div>
  );
}

/* ─── Status Badge ────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { label: status, badgeBg: G.card, badgeColor: G.muted };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "5px 12px", borderRadius: 10,
      fontSize: 13, fontWeight: 700,
      background: cfg.badgeBg, color: cfg.badgeColor,
      border: `1px solid ${cfg.badgeColor}44`,
    }}>
      {cfg.label}
    </span>
  );
}

/* ─── Premium Table ───────────────────────────────────────────── */
const thStyle: React.CSSProperties = {
  padding: "6px 8px", color: G.muted, fontSize: 11, fontWeight: 700,
  borderBottom: `1px solid ${G.border}`, textAlign: "right",
};
const tdStyle: React.CSSProperties = {
  padding: "5px 8px", fontSize: 12, color: G.text,
  borderBottom: `1px solid rgba(255,255,255,0.05)`,
};

/* ─── Skeleton ────────────────────────────────────────────────── */
function GlassSkeleton() {
  return (
    <div style={{ padding: 0 }}>
      <style>{`@keyframes shimmer{0%,100%{opacity:0.4}50%{opacity:0.7}}`}</style>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20, marginBottom: 25 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ background: G.card, borderRadius: 24, height: 100, animation: "shimmer 1.5s ease-in-out infinite" }} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 25, marginBottom: 25 }}>
        <div style={{ background: G.card, borderRadius: 28, height: 200, animation: "shimmer 1.5s ease-in-out infinite" }} />
        <div style={{ background: G.card, borderRadius: 28, height: 200, animation: "shimmer 1.5s ease-in-out infinite" }} />
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────── */
export default function DashboardExtra({
  isSuperAdmin,
  restaurants,
}: {
  isSuperAdmin: boolean;
  restaurants: Restaurant[];
}) {
  const [selectedId,  setSelectedId]  = useState<string>("");
  const [data,        setData]        = useState<DashData | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [chartPeriod, setChartPeriod] = useState<"7" | "30">("7");

  useEffect(() => {
    setLoading(true);
    const url = selectedId ? `/api/admin/dashboard?restaurantId=${selectedId}` : "/api/admin/dashboard";
    fetch(url)
      .then(r => r.json())
      .then((d: DashData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedId]);

  if (loading) return <GlassSkeleton />;
  if (!data)   return null;

  const { kpis, topItems, revenueChart, expiringSubscriptions, recentOrders, statusCounts, weekStats, cancelledToday, restaurantStats } = data;

  const showFilter = isSuperAdmin || restaurants.length > 1;
  const totalToday    = kpis.todayOrderCount + cancelledToday;
  const cancelRate    = totalToday > 0 ? ((cancelledToday / totalToday) * 100).toFixed(1) : "0.0";
  const completedToday   = (statusCounts["DELIVERED"] ?? 0) + (statusCounts["PAID"] ?? 0);
  const nonCancelledToday = totalToday - cancelledToday;
  const completionRate    = nonCancelledToday > 0 ? Math.round((completedToday / nonCancelledToday) * 100) : 0;

  return (
    <div style={{ direction: "rtl", fontFamily: "Heebo, sans-serif" }}>

      {/* ── Expiry warnings ── */}
      {expiringSubscriptions.length > 0 && (
        <div style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 8 }}>
          {expiringSubscriptions.map(s => {
            const days = Math.ceil((new Date(s.subscriptionTo!).getTime() - Date.now()) / 86400000);
            return (
              <div key={s.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 16px", borderRadius: 14,
                background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)",
              }}>
                <span>⚠️</span>
                <span style={{ fontSize: 13, color: G.amber }}>
                  המנוי של <strong>{s.name}</strong> יפוג בעוד {days} ימים ({new Date(s.subscriptionTo!).toLocaleDateString("he-IL")})
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Header + filter ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: G.text }}>דשבורד</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {showFilter && (
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              style={{
                background: G.card, backdropFilter: G.blur, WebkitBackdropFilter: G.blur,
                border: `1px solid ${G.border}`, color: G.sub,
                borderRadius: 12, padding: "6px 14px", fontSize: 13, outline: "none", cursor: "pointer",
              }}
            >
              <option value="">כל המסעדות</option>
              {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}
          <div style={{ fontSize: 12, color: G.muted }}>
            עדכון אחרון: עכשיו · <span style={{ color: G.green }}>●</span> חי
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20, marginBottom: 25 }}>
        <KpiCard color="red"   label="צפיות בתפריט היום" value={String(kpis.menuViewsToday)}  lucideIcon={<EyeIcon    color={G.red}   />} />
        <KpiCard color="blue"  label="הזמנות פתוחות"      value={String(kpis.openOrders)}      lucideIcon={<ClockIcon  color={G.blue}  />} />
        <KpiCard color="green" label="הכנסות היום"         value={fmtCurrency(kpis.todayRevenue)} lucideIcon={<DollarIcon color={G.green} />} />
        <KpiCard color="cyan"  label="הזמנות היום"         value={String(kpis.todayOrderCount)} lucideIcon={<CartIcon   color={G.cyan}  />} />
      </div>

      {/* ── Charts row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 25, marginBottom: 25 }}>

        {/* Donut — right column (RTL first = visual right) */}
        <GlassPanel title="סטטוס הזמנות" icon={<PieIcon color={G.amber} />}>
          <DonutChart statusCounts={statusCounts} />
        </GlassPanel>

        {/* Revenue chart — left column (RTL second = visual left) */}
        <GlassPanel
          title={`הכנסות לאורך זמן`}
          icon={<TrendIcon color={G.amber} />}
          extra={
            <div style={{ display: "flex", gap: 6 }}>
              {(["7", "30"] as const).map(p => (
                <button key={p} onClick={() => setChartPeriod(p)} style={{
                  background: chartPeriod === p ? G.blue : "rgba(255,255,255,0.08)",
                  color: chartPeriod === p ? "#fff" : G.muted,
                  border: `1px solid ${chartPeriod === p ? G.blue : G.border}`,
                  borderRadius: 8, padding: "3px 10px", fontSize: 12, fontWeight: 700,
                  cursor: "pointer", transition: "all .15s",
                }}>
                  {p === "7" ? "7י" : "30י"}
                </button>
              ))}
            </div>
          }
        >
          {revenueChart.every(d => d.revenue === 0) ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 220, color: G.muted, gap: 8 }}>
              <span style={{ fontSize: 36 }}>📊</span>
              <span style={{ fontSize: 13 }}>אין נתוני הזמנות עדיין</span>
            </div>
          ) : (
            <RevenueChart data={revenueChart} chartPeriod={chartPeriod} />
          )}
        </GlassPanel>
      </div>

      {/* ── Tables row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 25, marginBottom: 25 }}>

        {/* Top items */}
        <GlassPanel title="פריטים מובילים" icon={<StarIcon color={G.amber} />}
          extra={<span style={{ fontSize: 12, color: G.muted }}>(30 יום)</span>}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right" }}>
            <thead>
              <tr>
                {["פריט", "כמות", "הכנסה"].map(h => <th key={h} style={thStyle}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {topItems.length === 0 ? (
                <tr><td colSpan={3} style={{ ...tdStyle, textAlign: "center", color: G.muted }}>אין נתונים</td></tr>
              ) : topItems.map((item, i) => (
                <tr key={i} style={{ transition: "background 0.15s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                  <td style={tdStyle}>{item.name}</td>
                  <td style={tdStyle}>
                    <span style={{ background: "rgba(255,255,255,0.1)", color: "#fff", padding: "3px 10px", borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
                      {item.quantity}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, color: G.green, fontWeight: 700 }}>{fmtCurrency(item.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassPanel>

        {/* Recent orders */}
        <GlassPanel title="הזמנות אחרונות" icon={<HistoryIcon color={G.amber} />}
          extra={<a href="/admin/orders" style={{ fontSize: 12, color: G.amber, textDecoration: "none" }}>הכל ←</a>}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right" }}>
            <thead>
              <tr>
                {["#", "שולחן", "סכום", "סטטוס", "לפני"].map(h => <th key={h} style={thStyle}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr><td colSpan={5} style={{ ...tdStyle, textAlign: "center", color: G.muted }}>אין הזמנות</td></tr>
              ) : recentOrders.slice(0, 5).map(o => (
                <tr key={o.id} style={{ transition: "background 0.15s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                  <td style={{ ...tdStyle, fontFamily: "monospace", color: G.muted }}>#{o.id.slice(-4).toUpperCase()}</td>
                  <td style={tdStyle}>שולחן {o.tableNumber ?? "—"}</td>
                  <td style={{ ...tdStyle, color: G.green, fontWeight: 700 }}>{fmtCurrency(o.totalAmount)}</td>
                  <td style={tdStyle}><StatusBadge status={o.status} /></td>
                  <td style={{ ...tdStyle, color: G.muted, fontSize: 13 }}>{minutesAgo(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassPanel>
      </div>

      {/* ── Bottom row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 25 }}>

        {/* Restaurant stats */}
        <GlassPanel title="ביצועי מסעדות" icon="📊">
          {restaurantStats.length === 0 ? (
            <div style={{ textAlign: "center", color: G.muted, fontSize: 13, padding: "12px 0" }}>אין נתונים</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {restaurantStats.map(r => {
                const barColor = r.pct >= 70 ? G.green : r.pct >= 50 ? G.blue : r.pct >= 30 ? G.amber : G.red;
                return (
                  <div key={r.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: G.muted, marginBottom: 6 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>{r.name}</span>
                      <span style={{ color: barColor, fontWeight: 700 }}>{r.pct}%</span>
                    </div>
                    <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${r.pct}%`, background: barColor, borderRadius: 10, transition: "width .4s" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassPanel>

        {/* Quick stats */}
        <GlassPanel title="נתונים מהירים" icon="⚡">
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[
              { icon: "📦", val: String(weekStats.orders),    lbl: "הזמנות השבוע",    bg: "rgba(59,130,246,.15)" },
              { icon: "💳", val: fmtCurrency(weekStats.revenue), lbl: "הכנסות השבוע",  bg: "rgba(16,185,129,.15)" },
              { icon: "❌", val: `${cancelRate}%`,            lbl: "שיעור ביטולים",   bg: "rgba(255,77,77,.15)"  },
              { icon: "✅", val: `${completionRate}%`,        lbl: "קצב ביצוע היום",  bg: "rgba(245,158,11,.15)" },
            ].map((item, i, arr) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "12px 0",
                borderBottom: i < arr.length - 1 ? `1px solid ${G.border2}` : "none",
              }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: item.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{item.icon}</div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: G.text }}>{item.val}</div>
                  <div style={{ fontSize: 12, color: G.muted }}>{item.lbl}</div>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>

        {/* Activity feed */}
        <GlassPanel title="פעילות אחרונה" icon="🔔">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {recentOrders.length === 0 ? (
              <div style={{ textAlign: "center", color: G.muted, fontSize: 13 }}>אין פעילות</div>
            ) : recentOrders.slice(0, 5).map(o => {
              const dot = STATUS_CFG[o.status]?.dot ?? G.muted;
              return (
                <div key={o.id} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: dot, marginTop: 5, flexShrink: 0, boxShadow: `0 0 6px ${dot}` }} />
                  <div>
                    <div style={{ fontSize: 13, color: G.sub, lineHeight: 1.4 }}>
                      הזמנה #{o.id.slice(-4).toUpperCase()} — שולחן {o.tableNumber ?? "—"} — {fmtCurrency(o.totalAmount)}
                    </div>
                    <div style={{ fontSize: 11, color: G.muted, marginTop: 3 }}>{minutesAgo(o.createdAt)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
