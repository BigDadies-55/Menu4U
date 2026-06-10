"use client";

import { T } from "@/lib/ui";
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

/* ─── Color palette ─────────────────────────────────────────── */
const COLORS = {
  pageBg:       T.surface,
  cardBg:       T.panel,
  cardBorder:   T.raised,
  textPrimary:  T.text,
  textSecondary:T.sub,
  textMuted:    T.muted,
  blue:         T.blue,
  blueDark:     T.blue,
  green:        T.green,
  greenDark:    T.green,
  yellow:       T.gold,
  yellowDark:   T.gold,
  red:          T.red,
  redDark:      T.red,
  orange:       T.orange,
  purple:       T.purple,
};

const GRADIENTS = {
  blue:   `linear-gradient(135deg,${COLORS.blueDark},${COLORS.blue})`,
  green:  `linear-gradient(135deg,${COLORS.greenDark},${COLORS.green})`,
  yellow: `linear-gradient(135deg,${COLORS.yellowDark},${COLORS.yellow})`,
  red:    `linear-gradient(135deg,${COLORS.redDark},${COLORS.red})`,
};

/* ─── Status config ─────────────────────────────────────────── */
const STATUS_CFG: Record<string, { label: string; color: string; badgeBg: string; badgeColor: string }> = {
  PENDING:   { label: "ממתין",  color: COLORS.yellow, badgeBg: "rgba(255,193,7,.15)",   badgeColor: T.orange },
  CONFIRMED: { label: "אושר",   color: COLORS.blue,   badgeBg: "rgba(13,110,253,.15)",  badgeColor: T.blue },
  PREPARING: { label: "בהכנה",  color: COLORS.orange, badgeBg: "rgba(255,153,0,.15)",   badgeColor: T.orange },
  READY:     { label: "מוכן",   color: T.green,     badgeBg: "rgba(16,185,129,.15)",  badgeColor: T.green },
  DELIVERED: { label: "הוגש",   color: COLORS.purple, badgeBg: "rgba(99,102,241,.15)",  badgeColor: T.purple },
  PAID:      { label: "שולם",   color: T.green,     badgeBg: "rgba(34,197,94,.15)",   badgeColor: T.green },
  CANCELLED: { label: "בוטל",   color: COLORS.textMuted, badgeBg: "rgba(108,117,125,.15)", badgeColor: T.muted },
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

/* ─── Card wrapper ───────────────────────────────────────────── */
function DarkCard({ title, children, extra }: { title: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div style={{ background: COLORS.cardBg, borderRadius: 12, border: `1px solid ${COLORS.cardBorder}`, overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${COLORS.cardBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.textPrimary }}>{title}</div>
        {extra}
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

/* ─── KPI Card ───────────────────────────────────────────────── */
function KpiCardDark({
  color, icon, num, label, trend,
}: {
  color: "blue" | "green" | "yellow" | "red";
  icon: string;
  num: string;
  label: string;
  trend: string;
}) {
  return (
    <div style={{
      background: GRADIENTS[color],
      borderRadius: 12,
      padding: "20px 22px 0",
      position: "relative",
      overflow: "hidden",
      cursor: "pointer",
      transition: "transform .15s, box-shadow .15s",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(0,0,0,.3)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.boxShadow = ""; }}
    >
      <div style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-60%)", fontSize: 52, opacity: 0.2 }}>{icon}</div>
      <div style={{ fontSize: 32, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{num}</div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,.85)", marginTop: 4, fontWeight: 500 }}>{label}</div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,.25)", marginTop: 12, padding: "10px 0", fontSize: 12, color: "rgba(255,255,255,.8)", display: "flex", alignItems: "center", gap: 6 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        פרטים נוספים
        <span style={{ marginRight: "auto", background: "rgba(255,255,255,.2)", padding: "2px 7px", borderRadius: 20, fontSize: 11 }}>{trend}</span>
      </div>
    </div>
  );
}

/* ─── Donut Chart ─────────────────────────────────────────────── */
function DonutChart({ statusCounts }: { statusCounts: Record<string, number> }) {
  const statuses = ["PENDING", "CONFIRMED", "PREPARING", "READY", "DELIVERED", "PAID", "CANCELLED"];
  const total = statuses.reduce((s, k) => s + (statusCounts[k] ?? 0), 0);
  const CIRC = 2 * Math.PI * 70; // ≈ 439.8

  let offset = 0;
  const segments = statuses.map(k => {
    const count = statusCounts[k] ?? 0;
    const frac = total > 0 ? count / total : 0;
    const dash = frac * CIRC;
    const gap = CIRC - dash;
    const seg = { key: k, count, dash, gap, offset, color: STATUS_CFG[k]?.color ?? "#888" };
    offset += dash;
    return seg;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <svg viewBox="0 0 200 200" width={160} height={160}>
        <circle cx="100" cy="100" r="70" fill="none" stroke={COLORS.cardBorder} strokeWidth="24" />
        {total === 0 ? (
          <circle cx="100" cy="100" r="70" fill="none" stroke={COLORS.textMuted} strokeWidth="24" strokeDasharray={`${CIRC} 0`} transform="rotate(-90 100 100)" />
        ) : (
          segments.map(seg => seg.count > 0 && (
            <circle
              key={seg.key}
              cx="100" cy="100" r="70"
              fill="none"
              stroke={seg.color}
              strokeWidth="24"
              strokeDasharray={`${seg.dash} ${seg.gap}`}
              strokeDashoffset={-seg.offset}
              transform="rotate(-90 100 100)"
            />
          ))
        )}
        <text x="100" y="94" textAnchor="middle" fontSize="28" fontWeight="900" fill="#fff">{total}</text>
        <text x="100" y="112" textAnchor="middle" fontSize="11" fill={COLORS.textMuted}>הזמנות היום</text>
      </svg>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 7 }}>
        {statuses.map(k => {
          const count = statusCounts[k] ?? 0;
          if (count === 0) return null;
          return (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.textSecondary }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: STATUS_CFG[k]?.color ?? "#888", display: "inline-block", flexShrink: 0 }} />
                {STATUS_CFG[k]?.label ?? k}
              </span>
              <span style={{ color: T.text, fontWeight: 700 }}>{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Revenue Chart ───────────────────────────────────────────── */
function RevenueChartDark({ data, chartPeriod }: { data: DayPoint[]; chartPeriod: "7" | "30" }) {
  const visible = chartPeriod === "7" ? data.slice(-7) : data;
  const maxRev = Math.max(...visible.map(d => d.revenue), 1);
  const maxOrd = Math.max(...visible.map(d => d.orders), 1);
  const W = 600; const H = 180; const PAD_L = 40; const PAD_R = 8; const PAD_T = 20; const PAD_B = 20;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const [hovered, setHovered] = useState<number | null>(null);

  const pts = visible.map((d, i) => ({
    x: visible.length < 2 ? PAD_L + chartW / 2 : PAD_L + (i / (visible.length - 1)) * chartW,
    yRev: PAD_T + (1 - d.revenue / maxRev) * chartH,
    yOrd: PAD_T + (1 - d.orders / maxOrd) * chartH,
    ...d,
  }));

  const revLine = pts.map(p => `${p.x},${p.yRev}`).join(" ");
  const ordLine = pts.map(p => `${p.x},${p.yOrd}`).join(" ");
  const revArea = pts.length > 0
    ? `M${pts[0].x},${PAD_T + chartH} ` + pts.map(p => `L${p.x},${p.yRev}`).join(" ") + ` L${pts[pts.length - 1].x},${PAD_T + chartH} Z`
    : "";

  // Grid
  const gridLines = [0.25, 0.5, 0.75, 1].map(frac => ({
    y: PAD_T + (1 - frac) * chartH,
    label: fmtCurrency(Math.round(maxRev * frac)),
  }));

  // Day labels — show every nth
  const step = chartPeriod === "7" ? 1 : 5;
  const labelPts = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.blue} stopOpacity="0.4" />
            <stop offset="100%" stopColor={COLORS.blue} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {gridLines.map((g, i) => (
          <g key={i}>
            <line x1={PAD_L} y1={g.y} x2={W - PAD_R} y2={g.y} stroke={COLORS.cardBorder} strokeWidth="1" />
            <text x={PAD_L - 4} y={g.y + 4} fontSize="9" fill={COLORS.textMuted} textAnchor="end">{g.label}</text>
          </g>
        ))}

        {/* Revenue area */}
        <path d={revArea} fill="url(#blueGrad)" />
        {/* Revenue line */}
        <polyline points={revLine} fill="none" stroke={COLORS.blue} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {/* Orders dashed line */}
        <polyline points={ordLine} fill="none" stroke={COLORS.green} strokeWidth="2" strokeDasharray="5,3" strokeLinejoin="round" strokeLinecap="round" />

        {/* Day labels */}
        {labelPts.map((p, i) => (
          <text key={i} x={p.x} y={H - 2} fontSize="10" fill={COLORS.textMuted} textAnchor="middle">
            {shortDate(p.date)}
          </text>
        ))}

        {/* Dots + hover zones */}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.yRev} r={hovered === i ? 5.5 : 3.5} fill={COLORS.blue} stroke={COLORS.pageBg} strokeWidth="2" />
            <rect
              x={p.x - 18} y={0} width={36} height={H}
              fill="transparent"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "crosshair" }}
            />
            {hovered === i && (
              <g>
                <rect x={Math.min(p.x - 55, W - 125)} y={p.yRev - 52} width={120} height={46} rx={6} fill={T.surface} stroke={T.overlay} strokeWidth="1" />
                <text x={Math.min(p.x - 55, W - 125) + 60} y={p.yRev - 34} textAnchor="middle" fill={COLORS.blue} fontSize="13" fontWeight="bold">
                  {fmtCurrency(p.revenue)}
                </text>
                <text x={Math.min(p.x - 55, W - 125) + 60} y={p.yRev - 18} textAnchor="middle" fill={COLORS.textSecondary} fontSize="11">
                  {shortDate(p.date)} · {p.orders} הזמנות
                </text>
              </g>
            )}
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div style={{ display: "flex", gap: 20, marginTop: 6, paddingRight: PAD_L }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.textSecondary }}>
          <div style={{ width: 14, height: 3, background: COLORS.blue, borderRadius: 2 }} />
          הכנסות
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.textSecondary }}>
          <div style={{ width: 14, height: 2, background: COLORS.green, borderRadius: 2, borderTop: `2px dashed ${COLORS.green}` }} />
          הזמנות
        </div>
      </div>
    </div>
  );
}

/* ─── Status Badge ────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { label: status, badgeBg: "rgba(108,117,125,.15)", badgeColor: T.muted };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: cfg.badgeBg, color: cfg.badgeColor }}>
      {cfg.label}
    </span>
  );
}

/* ─── Dark Skeleton ───────────────────────────────────────────── */
function DarkSkeleton() {
  return (
    <div style={{ padding: 0 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 22 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ background: T.panel, borderRadius: 12, height: 110, animation: "pulse 1.5s ease-in-out infinite" }} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 16, marginBottom: 22 }}>
        <div style={{ background: T.panel, borderRadius: 12, height: 260, animation: "pulse 1.5s ease-in-out infinite" }} />
        <div style={{ background: T.panel, borderRadius: 12, height: 260, animation: "pulse 1.5s ease-in-out infinite" }} />
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  );
}

/* ─── Main ───────────────────────────────────────────────────── */
export default function DashboardExtra({
  isSuperAdmin,
  restaurants,
}: {
  isSuperAdmin: boolean;
  restaurants: Restaurant[];
}) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [data, setData]             = useState<DashData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [chartPeriod, setChartPeriod] = useState<"7" | "30">("7");

  useEffect(() => {
    setLoading(true);
    const url = selectedId ? `/api/admin/dashboard?restaurantId=${selectedId}` : "/api/admin/dashboard";
    fetch(url)
      .then(r => r.json())
      .then((d: DashData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedId]);

  if (loading) return <DarkSkeleton />;
  if (!data) return null;

  const { kpis, topItems, revenueChart, expiringSubscriptions, recentOrders, statusCounts, weekStats, cancelledToday, restaurantStats } = data;

  const showFilter = isSuperAdmin || restaurants.length > 1;

  // Cancellation rate
  const totalToday = kpis.todayOrderCount + cancelledToday;
  const cancelRate = totalToday > 0 ? ((cancelledToday / totalToday) * 100).toFixed(1) : "0.0";

  // Completion rate today
  const completedToday = (statusCounts["DELIVERED"] ?? 0) + (statusCounts["PAID"] ?? 0);
  const nonCancelledToday = totalToday - cancelledToday;
  const completionRate = nonCancelledToday > 0 ? Math.round((completedToday / nonCancelledToday) * 100) : 0;

  // Top item badge colors by rank
  const rankColors = [COLORS.blueDark, COLORS.greenDark, COLORS.yellowDark, COLORS.redDark, T.purple];

  return (
    <div style={{ direction: "rtl" }}>

      {/* ── Expiry warnings ── */}
      {expiringSubscriptions.length > 0 && (
        <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {expiringSubscriptions.map(s => {
            const days = Math.ceil((new Date(s.subscriptionTo!).getTime() - Date.now()) / 86400000);
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 10, background: "rgba(230,119,0,.12)", border: "1px solid rgba(230,119,0,.3)" }}>
                <span>⚠️</span>
                <span style={{ fontSize: 13, color: COLORS.yellow }}>
                  המנוי של <strong>{s.name}</strong> יפוג בעוד {days} ימים ({new Date(s.subscriptionTo!).toLocaleDateString("he-IL")})
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Page header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.textPrimary }}>דשבורד</div>
        <div style={{ fontSize: 12, color: COLORS.textMuted }}>
          עדכון אחרון: עכשיו · <span style={{ color: COLORS.green }}>●</span> חי
        </div>
      </div>

      {/* ── Restaurant filter (dropdown) ── */}
      {showFilter && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <span style={{ fontSize: 13, color: COLORS.textMuted, flexShrink: 0 }}>מסעדה:</span>
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            style={{
              background: COLORS.cardBg,
              border: `1px solid ${COLORS.cardBorder}`,
              color: COLORS.textSecondary,
              borderRadius: 8,
              padding: "6px 12px",
              fontSize: 13,
              outline: "none",
              cursor: "pointer",
              minWidth: 180,
            }}
          >
            <option value="">כולם</option>
            {restaurants.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── KPI Cards (4) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 22 }}>
        <KpiCardDark color="blue" icon="🛒" num={String(kpis.todayOrderCount)} label="הזמנות היום" trend="בזמן אמת" />
        <KpiCardDark color="green" icon="💰" num={fmtCurrency(kpis.todayRevenue)} label="הכנסות היום" trend="היום" />
        <KpiCardDark color="yellow" icon="⏳" num={String(kpis.openOrders)} label="הזמנות פתוחות" trend="בזמן אמת" />
        <KpiCardDark color="red" icon="👁️" num={String(kpis.menuViewsToday)} label="צפיות בתפריט היום" trend="היום" />
      </div>

      {/* ── Charts row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 16, marginBottom: 22 }}>

        {/* Revenue chart */}
        <DarkCard
          title="📈 הכנסות לאורך זמן"
          extra={
            <div style={{ display: "flex", gap: 6 }}>
              {(["7", "30"] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setChartPeriod(p)}
                  style={{
                    background: chartPeriod === p ? COLORS.blueDark : T.panel,
                    color: chartPeriod === p ? "#fff" : COLORS.textSecondary,
                    border: "none",
                    borderRadius: 6,
                    padding: "0 10px",
                    height: 26,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all .15s",
                  }}
                >
                  {p === "7" ? "7י" : "30י"}
                </button>
              ))}
            </div>
          }
        >
          {revenueChart.every(d => d.revenue === 0) ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 180, color: COLORS.textMuted, gap: 8 }}>
              <span style={{ fontSize: 32 }}>📊</span>
              <span style={{ fontSize: 13 }}>אין נתוני הזמנות עדיין</span>
            </div>
          ) : (
            <RevenueChartDark data={revenueChart} chartPeriod={chartPeriod} />
          )}
        </DarkCard>

        {/* Status donut */}
        <DarkCard title="🍩 סטטוס הזמנות">
          <DonutChart statusCounts={statusCounts} />
        </DarkCard>
      </div>

      {/* ── Tables row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 22 }}>

        {/* Recent orders */}
        <DarkCard title="🛒 הזמנות אחרונות" extra={<a href="/admin/orders" style={{ fontSize: 12, color: T.gold, textDecoration: "none" }}>הכל ←</a>}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["#", "שולחן", "סכום", "סטטוס", "לפני"].map(h => (
                    <th key={h} style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".8px", color: COLORS.textMuted, padding: "8px 12px", textAlign: "right", borderBottom: `1px solid ${COLORS.cardBorder}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentOrders.slice(0, 5).map(o => (
                  <tr key={o.id}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,.03)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = ""; }}
                  >
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${COLORS.cardBorder}`, fontFamily: "monospace", color: COLORS.textMuted }}>#{o.id.slice(-4).toUpperCase()}</td>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${COLORS.cardBorder}`, color: T.sub }}>🪑 שולחן {o.tableNumber ?? "—"}</td>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${COLORS.cardBorder}`, color: COLORS.green, fontWeight: 600 }}>{fmtCurrency(o.totalAmount)}</td>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${COLORS.cardBorder}` }}><StatusBadge status={o.status} /></td>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${COLORS.cardBorder}`, color: COLORS.textMuted }}>{minutesAgo(o.createdAt)}</td>
                  </tr>
                ))}
                {recentOrders.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: "24px 12px", textAlign: "center", color: COLORS.textMuted }}>אין הזמנות</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </DarkCard>

        {/* Top items */}
        <DarkCard title="🏆 פריטים מובילים" extra={<span style={{ fontSize: 12, color: COLORS.textMuted }}>(30 יום)</span>}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["פריט", "כמות", "הכנסה"].map(h => (
                    <th key={h} style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".8px", color: COLORS.textMuted, padding: "8px 12px", textAlign: "right", borderBottom: `1px solid ${COLORS.cardBorder}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topItems.map((item, i) => (
                  <tr key={i}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,.03)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = ""; }}
                  >
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${COLORS.cardBorder}`, color: T.sub }}>{item.name}</td>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${COLORS.cardBorder}` }}>
                      <span style={{ background: rankColors[i] ?? "#555", color: "#fff", padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{item.quantity}</span>
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${COLORS.cardBorder}`, color: COLORS.green, fontWeight: 600 }}>{fmtCurrency(item.revenue)}</td>
                  </tr>
                ))}
                {topItems.length === 0 && (
                  <tr><td colSpan={3} style={{ padding: "24px 12px", textAlign: "center", color: COLORS.textMuted }}>אין נתונים</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </DarkCard>
      </div>

      {/* ── Bottom row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>

        {/* Restaurant progress bars */}
        <DarkCard title="📊 ביצועי מסעדות">
          {restaurantStats.length === 0 ? (
            <div style={{ textAlign: "center", color: COLORS.textMuted, fontSize: 13, padding: "12px 0" }}>אין נתונים</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {restaurantStats.map((r, i) => {
                const barColor = r.pct >= 70 ? COLORS.green : r.pct >= 50 ? COLORS.blue : r.pct >= 30 ? COLORS.yellow : COLORS.red;
                return (
                  <div key={r.id} style={{ marginBottom: i === restaurantStats.length - 1 ? 0 : undefined }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: COLORS.textSecondary, marginBottom: 5 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>{r.name}</span>
                      <span style={{ color: barColor, fontWeight: 700 }}>{r.pct}%</span>
                    </div>
                    <div style={{ height: 8, background: T.panel, borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${r.pct}%`, background: barColor, borderRadius: 10, transition: "width .4s" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DarkCard>

        {/* Quick stats */}
        <DarkCard title="⚡ נתונים מהירים">
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[
              { icon: "📦", val: String(weekStats.orders), lbl: "הזמנות השבוע", iconBg: "rgba(51,154,240,.15)", trend: null },
              { icon: "💳", val: fmtCurrency(weekStats.revenue), lbl: "הכנסות השבוע", iconBg: "rgba(81,207,102,.15)", trend: null },
              { icon: "❌", val: `${cancelRate}%`, lbl: "שיעור ביטולים", iconBg: "rgba(255,107,107,.15)", trend: null },
              { icon: "✅", val: `${completionRate}%`, lbl: "קצב ביצוע היום", iconBg: "rgba(201,168,76,.15)", trend: null },
            ].map((item, i, arr) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < arr.length - 1 ? `1px solid ${COLORS.cardBorder}` : "none" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: item.iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{item.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.textPrimary }}>{item.val}</div>
                  <div style={{ fontSize: 11, color: COLORS.textMuted }}>{item.lbl}</div>
                </div>
              </div>
            ))}
          </div>
        </DarkCard>

        {/* Activity feed */}
        <DarkCard title="🔔 פעילות אחרונה">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {recentOrders.slice(0, 5).map(o => {
              const dot = STATUS_CFG[o.status]?.color ?? COLORS.textMuted;
              return (
                <div key={o.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: dot, marginTop: 5, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, color: T.sub }}>
                      הזמנה #{o.id.slice(-4).toUpperCase()} — שולחן {o.tableNumber ?? "—"} — {fmtCurrency(o.totalAmount)}
                    </div>
                    <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2 }}>{minutesAgo(o.createdAt)}</div>
                  </div>
                </div>
              );
            })}
            {recentOrders.length === 0 && (
              <div style={{ textAlign: "center", color: COLORS.textMuted, fontSize: 13 }}>אין פעילות</div>
            )}
          </div>
        </DarkCard>

      </div>
    </div>
  );
}
