"use client";

import { useState, useEffect } from "react";

type Restaurant = { id: string; name: string; _count: { menus: number } };

type RestaurantStats = {
  periodViews: number;
  totalViews: number;
  topCategories: { refName: string; count: number }[];
  topItems: { refName: string; count: number }[];
};

const PERIODS = [
  { key: "7d",  label: "7 ימים" },
  { key: "30d", label: "חודש" },
  { key: "1y",  label: "שנה" },
] as const;

type Period = typeof PERIODS[number]["key"];

export default function AnalyticsSection({ restaurants }: { restaurants: Restaurant[] }) {
  const [period, setPeriod] = useState<Period>("7d");
  const [stats, setStats] = useState<Record<string, RestaurantStats>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/analytics?period=${period}`)
      .then(r => r.json())
      .then(data => { setStats(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [period]);

  if (restaurants.length === 0) return null;

  return (
    <div className="mb-8">
      {/* Header + period selector */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-lg font-bold text-gray-900">המסעדות שלי</h2>
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={period === p.key
                ? { background: "linear-gradient(135deg,#8B6914,#C9A84C)", color: "#fff" }
                : { color: "#6b7280" }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {restaurants.map(r => {
          const mv = stats[r.id];
          return (
            <div key={r.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              {/* Restaurant header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm shrink-0"
                  style={{ background: "linear-gradient(135deg,#8B6914,#C9A84C)" }}>
                  {r.name[0]}
                </div>
                <div className="font-semibold text-gray-900">{r.name}</div>
              </div>

              {/* Menus count */}
              <div className="text-center mb-4">
                <div className="text-lg font-bold text-gray-900">{r._count.menus}</div>
                <div className="text-xs text-gray-400">תפריטים</div>
              </div>

              {/* Analytics */}
              <div className="border-t border-gray-100 pt-3">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  צפיות בתפריט
                </div>

                {loading ? (
                  <div className="animate-pulse space-y-2">
                    <div className="h-10 bg-gray-100 rounded-lg" />
                    <div className="h-3 bg-gray-100 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                ) : mv ? (
                  <>
                    <div className="grid grid-cols-2 gap-2 text-center mb-3">
                      <div className="bg-amber-50 rounded-lg py-2">
                        <div className="text-base font-bold text-amber-700">{mv.periodViews}</div>
                        <div className="text-xs text-gray-400">
                          {period === "7d" ? "7 ימים" : period === "30d" ? "חודש" : "שנה"}
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-lg py-2">
                        <div className="text-base font-bold text-gray-700">{mv.totalViews}</div>
                        <div className="text-xs text-gray-400">סה״כ</div>
                      </div>
                    </div>

                    {mv.topCategories.length > 0 && (
                      <div className="mb-2">
                        <div className="text-xs text-gray-400 mb-1">קטגוריות מובילות</div>
                        {mv.topCategories.map(c => (
                          <div key={c.refName} className="flex justify-between text-xs py-0.5">
                            <span className="text-gray-600 truncate max-w-[130px]">{c.refName}</span>
                            <span className="font-medium text-amber-700">{c.count}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {mv.topItems.length > 0 && (
                      <div>
                        <div className="text-xs text-gray-400 mb-1">פריטים מובילים</div>
                        {mv.topItems.map(i => (
                          <div key={i.refName} className="flex justify-between text-xs py-0.5">
                            <span className="text-gray-600 truncate max-w-[130px]">{i.refName}</span>
                            <span className="font-medium text-amber-700">{i.count}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {mv.totalViews === 0 && (
                      <p className="text-xs text-gray-400 text-center py-2">אין צפיות עדיין</p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-gray-400 text-center py-2">אין נתונים</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
