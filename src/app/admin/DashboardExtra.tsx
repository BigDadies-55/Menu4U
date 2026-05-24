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
type DashData = {
  kpis: Kpis;
  recentOrders: unknown[];   // fetched but not displayed
  topItems: TopItem[];
  revenueChart: DayPoint[];
  expiringSubscriptions: ExpiringSub[];
};
type Restaurant = { id: string; name: string };

/* ─── Helpers ────────────────────────────────────────────────── */
function fmtCurrency(n: number) {
  return `₪${n.toLocaleString("he-IL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function shortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
}

/* ─── Compact KPI Card ───────────────────────────────────────── */
function KpiCard({
  icon, label, value, sub, accent,
}: {
  icon: string; label: string; value: string; sub?: string; accent: string;
}) {
  return (
    <div className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100 flex items-center gap-3 min-w-0">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-base"
        style={{ background: accent + "18", color: accent }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide leading-none mb-0.5 truncate">
          {label}
        </div>
        <div className="text-lg font-bold text-gray-900 leading-tight truncate">{value}</div>
        {sub && <div className="text-[11px] text-gray-400 mt-0.5 leading-none truncate">{sub}</div>}
      </div>
    </div>
  );
}

/* ─── Mini SVG Line Chart ────────────────────────────────────── */
function RevenueChart({ data, chartPeriod }: { data: DayPoint[]; chartPeriod: "7" | "30" }) {
  const visible = chartPeriod === "7" ? data.slice(-7) : data;
  const maxRev = Math.max(...visible.map(d => d.revenue), 1);
  const W = 600; const H = 110; const PAD = 8;

  const pts = visible.map((d, i) => ({
    x: visible.length < 2 ? W / 2 : PAD + (i / (visible.length - 1)) * (W - PAD * 2),
    y: H - PAD - ((d.revenue / maxRev) * (H - PAD * 2)),
    ...d,
  }));

  const polyline = pts.map(p => `${p.x},${p.y}`).join(" ");
  const area = pts.length > 0
    ? `M${pts[0].x},${H} ` + pts.map(p => `L${p.x},${p.y}`).join(" ") + ` L${pts[pts.length - 1].x},${H} Z`
    : "";

  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 110, overflow: "visible" }}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c9a35d" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#c9a35d" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#revGrad)" />
        <polyline points={polyline} fill="none" stroke="#c9a35d" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={hovered === i ? 5.5 : 3} fill={hovered === i ? "#c9a35d" : "#8B6914"} stroke="#fff" strokeWidth="1.5" />
            <rect x={p.x - 18} y={0} width={36} height={H} fill="transparent"
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} style={{ cursor: "crosshair" }} />
            {hovered === i && (
              <g>
                <rect x={Math.min(p.x - 45, W - 115)} y={p.y - 46} width={108} height={40} rx={6}
                  fill="#1e293b" stroke="#334155" strokeWidth="1" />
                <text x={Math.min(p.x - 45, W - 115) + 54} y={p.y - 30} textAnchor="middle" fill="#c9a35d" fontSize="13" fontWeight="bold">
                  {fmtCurrency(p.revenue)}
                </text>
                <text x={Math.min(p.x - 45, W - 115) + 54} y={p.y - 13} textAnchor="middle" fill="#94a3b8" fontSize="11">
                  {shortDate(p.date)} · {p.orders} הזמנות
                </text>
              </g>
            )}
          </g>
        ))}
      </svg>
      {/* X axis */}
      <div className="flex justify-between mt-1 px-1">
        {visible
          .filter((_, i) => i % (chartPeriod === "7" ? 1 : 5) === 0 || i === visible.length - 1)
          .map((d, i) => (
            <span key={i} className="text-[11px] text-gray-400">{shortDate(d.date)}</span>
          ))}
      </div>
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
  const [selectedId, setSelectedId] = useState<string>("");   // "" = כולם
  const [data, setData]             = useState<DashData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [chartPeriod, setChartPeriod] = useState<"7" | "30">("30");

  useEffect(() => {
    setLoading(true);
    const url = selectedId
      ? `/api/admin/dashboard?restaurantId=${selectedId}`
      : "/api/admin/dashboard";
    fetch(url)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedId]);

  /* ── skeleton ── */
  if (loading) {
    return (
      <div className="space-y-4">
        {/* filter placeholder */}
        <div className="h-9 w-48 bg-gray-200 animate-pulse rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 animate-pulse flex gap-3 items-center">
              <div className="w-9 h-9 rounded-lg bg-gray-100 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 bg-gray-100 rounded w-3/4" />
                <div className="h-5 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { kpis, topItems, revenueChart, expiringSubscriptions } = data;
  const total30dRevenue = revenueChart.reduce((s, d) => s + d.revenue, 0);
  const total30dOrders  = revenueChart.reduce((s, d) => s + d.orders, 0);
  const maxTopItem = Math.max(...topItems.map(i => i.quantity), 1);

  const showFilter = isSuperAdmin || restaurants.length > 1;

  return (
    <div className="space-y-5">

      {/* ─── Expiry warnings ─────────────────────────────── */}
      {expiringSubscriptions.length > 0 && (
        <div className="space-y-2">
          {expiringSubscriptions.map(s => {
            const days = Math.ceil((new Date(s.subscriptionTo!).getTime() - Date.now()) / 86400000);
            return (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-200"
                style={{ background: "#fffbeb" }}>
                <span>⚠️</span>
                <span className="text-sm font-medium text-amber-800">
                  המנוי של <strong>{s.name}</strong> יפוג בעוד {days} ימים ({new Date(s.subscriptionTo!).toLocaleDateString("he-IL")})
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Restaurant filter ───────────────────────────── */}
      {showFilter && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 shrink-0">מסעדה:</span>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedId("")}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
              style={selectedId === ""
                ? { background: "linear-gradient(135deg,#8B6914,#C9A84C)", color: "#fff", borderColor: "transparent" }
                : { background: "#fff", color: "#6b7280", borderColor: "#e5e7eb" }}
            >
              כולם
            </button>
            {restaurants.map(r => (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all truncate max-w-[160px]"
                style={selectedId === r.id
                  ? { background: "linear-gradient(135deg,#8B6914,#C9A84C)", color: "#fff", borderColor: "transparent" }
                  : { background: "#fff", color: "#6b7280", borderColor: "#e5e7eb" }}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── KPIs (5 cards) ──────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard
          icon="💰" label="הכנסות היום"
          value={fmtCurrency(kpis.todayRevenue)}
          sub={`${kpis.todayOrderCount} הזמנות`}
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
          value={fmtCurrency(total30dRevenue)}
          sub="ללא ביטולים"
          accent="#10b981"
        />
        <KpiCard
          icon="🧾" label="הזמנות 30 יום"
          value={String(total30dOrders)}
          sub="סה״כ הזמנות"
          accent="#8b5cf6"
        />
      </div>

      {/* ─── Chart + Top items ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Revenue chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 text-sm">הכנסות לאורך זמן</h3>
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
            <div className="flex flex-col items-center justify-center h-28 text-gray-300 gap-2">
              <span className="text-3xl">📊</span>
              <span className="text-sm">אין נתוני הזמנות עדיין</span>
            </div>
          ) : (
            <RevenueChart data={revenueChart} chartPeriod={chartPeriod} />
          )}
        </div>

        {/* Top items */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 text-sm mb-4">
            פריטים מובילים <span className="text-xs font-normal text-gray-400">(30 יום)</span>
          </h3>
          {topItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 text-gray-300 gap-2">
              <span className="text-2xl">🍽️</span>
              <span className="text-sm">אין נתונים</span>
            </div>
          ) : (
            <div className="space-y-3">
              {topItems.map((item, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700 truncate max-w-[150px]">
                      <span className="text-gray-400 ml-1">#{i + 1}</span>{item.name}
                    </span>
                    <span className="text-gray-400 shrink-0 mr-2">{item.quantity} יח׳</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
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

    </div>
  );
}
