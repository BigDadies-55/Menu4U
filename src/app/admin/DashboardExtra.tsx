"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

/* ─── Types ─────────────────────────────────────────────────── */
type Kpis = {
  todayRevenue: number;
  todayOrderCount: number;
  openOrders: number;
  menuViewsToday: number;
};

type RecentOrder = {
  id: string;
  tableNumber: string | null;
  customerName: string | null;
  status: string;
  totalAmount: number;
  createdAt: string;
  restaurant: { name: string };
};

type TopItem = { name: string; quantity: number; revenue: number };
type DayPoint = { date: string; revenue: number; orders: number };
type ExpiringSub = { id: string; name: string; subscriptionTo: string | null };

type DashData = {
  kpis: Kpis;
  recentOrders: RecentOrder[];
  topItems: TopItem[];
  revenueChart: DayPoint[];
  expiringSubscriptions: ExpiringSub[];
};

/* ─── Status labels/colors ───────────────────────────────────── */
const STATUS_LABEL: Record<string, string> = {
  PENDING: "ממתין", CONFIRMED: "אושר", PREPARING: "בהכנה",
  READY: "מוכן", DELIVERED: "הושלם", CANCELLED: "בוטל", PAID: "שולם",
};
const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  PENDING:   { bg: "#fef3c7", text: "#92400e" },
  CONFIRMED: { bg: "#dbeafe", text: "#1e40af" },
  PREPARING: { bg: "#e0e7ff", text: "#3730a3" },
  READY:     { bg: "#d1fae5", text: "#065f46" },
  DELIVERED: { bg: "#f0fdf4", text: "#166534" },
  CANCELLED: { bg: "#fee2e2", text: "#991b1b" },
  PAID:      { bg: "#f0fdf4", text: "#166534" },
};

/* ─── Helpers ────────────────────────────────────────────────── */
function fmtCurrency(n: number) {
  return `₪${n.toLocaleString("he-IL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function timeAgo(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return "הרגע";
  if (mins < 60) return `לפני ${mins} דק'`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `לפני ${hrs} ש'`;
  return `לפני ${Math.floor(hrs / 24)} ימים`;
}
function shortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
}

/* ─── Mini SVG Line Chart ────────────────────────────────────── */
function RevenueChart({ data, chartPeriod }: { data: DayPoint[]; chartPeriod: "7" | "30" }) {
  const visible = chartPeriod === "7" ? data.slice(-7) : data;
  const maxRev = Math.max(...visible.map(d => d.revenue), 1);
  const W = 600; const H = 120; const PAD = 8;

  const pts = visible.map((d, i) => {
    const x = PAD + (i / (visible.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((d.revenue / maxRev) * (H - PAD * 2));
    return { x, y, ...d };
  });

  const polyline = pts.map(p => `${p.x},${p.y}`).join(" ");
  const area = `M${pts[0].x},${H} ` + pts.map(p => `L${p.x},${p.y}`).join(" ") + ` L${pts[pts.length - 1].x},${H} Z`;

  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120, overflow: "visible" }}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c9a35d" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#c9a35d" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Area fill */}
        <path d={area} fill="url(#revGrad)" />
        {/* Line */}
        <polyline points={polyline} fill="none" stroke="#c9a35d" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {/* Dots */}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={hovered === i ? 6 : 3.5} fill={hovered === i ? "#c9a35d" : "#8B6914"} stroke="#fff" strokeWidth="1.5" style={{ cursor: "pointer", transition: "r 100ms" }} />
            {/* Hover area */}
            <rect x={p.x - 18} y={0} width={36} height={H} fill="transparent"
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} />
            {/* Tooltip */}
            {hovered === i && (
              <g>
                <rect
                  x={Math.min(p.x - 45, W - 110)} y={p.y - 44}
                  width={100} height={38} rx={6}
                  fill="#1e293b" stroke="#334155" strokeWidth="1"
                />
                <text x={Math.min(p.x - 45, W - 110) + 50} y={p.y - 28} textAnchor="middle" fill="#c9a35d" fontSize="13" fontWeight="bold">
                  {fmtCurrency(p.revenue)}
                </text>
                <text x={Math.min(p.x - 45, W - 110) + 50} y={p.y - 12} textAnchor="middle" fill="#94a3b8" fontSize="11">
                  {shortDate(p.date)} · {p.orders} הזמנות
                </text>
              </g>
            )}
          </g>
        ))}
      </svg>
      {/* X-axis labels */}
      <div className="flex justify-between mt-1" style={{ paddingLeft: PAD, paddingRight: PAD }}>
        {visible.filter((_, i) => i % (chartPeriod === "7" ? 1 : 5) === 0 || i === visible.length - 1).map((d, i) => (
          <span key={i} className="text-xs text-gray-400">{shortDate(d.date)}</span>
        ))}
      </div>
    </div>
  );
}

/* ─── KPI Card ───────────────────────────────────────────────── */
function KpiCard({
  icon, label, value, sub, accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-start gap-4">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-xl"
        style={{ background: accent + "18", color: accent }}
      >
        {icon}
      </div>
      <div>
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</div>
        <div className="text-2xl font-bold text-gray-900 leading-tight">{value}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────── */
export default function DashboardExtra({ restaurantId, isSuperAdmin }: { restaurantId?: string; isSuperAdmin: boolean }) {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState<"7" | "30">("30");

  useEffect(() => {
    const url = restaurantId
      ? `/api/admin/dashboard?restaurantId=${restaurantId}`
      : "/api/admin/dashboard";
    fetch(url)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [restaurantId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 animate-pulse">
              <div className="w-12 h-12 rounded-xl bg-gray-100 mb-3" />
              <div className="h-4 bg-gray-100 rounded w-1/2 mb-2" />
              <div className="h-7 bg-gray-100 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { kpis, recentOrders, topItems, revenueChart, expiringSubscriptions } = data;
  const totalChartRevenue = revenueChart.reduce((s, d) => s + d.revenue, 0);
  const maxTopItem = Math.max(...topItems.map(i => i.quantity), 1);

  return (
    <div className="space-y-6">

      {/* ─── Expiry warnings ─────────────────────────────────── */}
      {expiringSubscriptions.length > 0 && (
        <div className="space-y-2">
          {expiringSubscriptions.map(s => {
            const days = Math.ceil((new Date(s.subscriptionTo!).getTime() - Date.now()) / 86400000);
            return (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-200"
                style={{ background: "#fffbeb" }}>
                <span className="text-lg">⚠️</span>
                <span className="text-sm font-medium text-amber-800">
                  המנוי של <strong>{s.name}</strong> יפוג בעוד {days} ימים
                  {" "}({new Date(s.subscriptionTo!).toLocaleDateString("he-IL")})
                </span>
                <Link href={`/admin/restaurants`} className="mr-auto text-xs font-semibold text-amber-700 hover:underline">
                  לניהול מנויים
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── KPIs ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          icon="💰" label="הכנסות היום"
          value={fmtCurrency(kpis.todayRevenue)}
          sub={`${kpis.todayOrderCount} הזמנות היום`}
          accent="#c9a35d"
        />
        <KpiCard
          icon="🔔" label="הזמנות פתוחות"
          value={String(kpis.openOrders)}
          sub="ממתינות לטיפול"
          accent={kpis.openOrders > 0 ? "#f59e0b" : "#10b981"}
        />
        <KpiCard
          icon="👁️" label="צפיות היום"
          value={String(kpis.menuViewsToday)}
          sub="כניסות לתפריט"
          accent="#6366f1"
        />
        <KpiCard
          icon="📈" label="הכנסות 30 יום"
          value={fmtCurrency(totalChartRevenue)}
          sub="הזמנות שלא בוטלו"
          accent="#10b981"
        />
      </div>

      {/* ─── Revenue chart + Top items ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">הכנסות לאורך זמן</h3>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
              {(["7", "30"] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setChartPeriod(p)}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
                  style={chartPeriod === p
                    ? { background: "linear-gradient(135deg,#8B6914,#C9A84C)", color: "#fff" }
                    : { color: "#6b7280" }}
                >
                  {p === "7" ? "7 ימים" : "30 ימים"}
                </button>
              ))}
            </div>
          </div>
          {revenueChart.every(d => d.revenue === 0) ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400 gap-2">
              <span className="text-3xl">📊</span>
              <span className="text-sm">אין נתוני הזמנות עדיין</span>
            </div>
          ) : (
            <RevenueChart data={revenueChart} chartPeriod={chartPeriod} />
          )}
        </div>

        {/* Top items */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">פריטים מובילים <span className="text-xs font-normal text-gray-400">(30 יום)</span></h3>
          {topItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 text-gray-400 gap-2">
              <span className="text-2xl">🍽️</span>
              <span className="text-sm">אין נתונים</span>
            </div>
          ) : (
            <div className="space-y-3">
              {topItems.map((item, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-800 truncate max-w-[160px]">
                      <span className="text-xs font-bold text-gray-400 ml-1">#{i + 1}</span>
                      {item.name}
                    </span>
                    <span className="text-xs text-gray-500 shrink-0 mr-2">{item.quantity} יח'</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(item.quantity / maxTopItem) * 100}%`,
                        background: i === 0
                          ? "linear-gradient(90deg,#c9a35d,#8B6914)"
                          : i === 1
                          ? "linear-gradient(90deg,#94a3b8,#64748b)"
                          : "linear-gradient(90deg,#cd7c3a,#92400e)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Recent orders ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">הזמנות אחרונות</h3>
          <Link href="/admin/orders" className="text-xs font-semibold text-amber-700 hover:underline">
            כל ההזמנות ←
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
            <span className="text-3xl">📋</span>
            <span className="text-sm">אין הזמנות עדיין</span>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentOrders.map(order => {
              const sc = STATUS_COLOR[order.status] ?? { bg: "#f3f4f6", text: "#374151" };
              return (
                <div key={order.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                  {/* Table / customer */}
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0"
                    style={{ background: "#fef3c7", color: "#92400e" }}
                  >
                    {order.tableNumber ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-800 truncate">
                      {order.customerName ?? (order.tableNumber ? `שולחן ${order.tableNumber}` : "לא ידוע")}
                    </div>
                    <div className="text-xs text-gray-400">{order.restaurant.name} · {timeAgo(order.createdAt)}</div>
                  </div>
                  <div className="text-sm font-bold text-gray-900 shrink-0">{fmtCurrency(order.totalAmount)}</div>
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                    style={{ background: sc.bg, color: sc.text }}
                  >
                    {STATUS_LABEL[order.status] ?? order.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
