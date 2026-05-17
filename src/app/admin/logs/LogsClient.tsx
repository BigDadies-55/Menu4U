"use client";
import { useState, useEffect, useCallback } from "react";

interface AuditLog {
  id: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  entityName: string | null;
  meta: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

interface LogsResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  pages: number;
}

const ACTION_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: "התחברות",
  LOGIN_FAILED: "כישלון התחברות",
  LOGOUT: "יציאה",
  CREATE_RESTAURANT: "יצירת מסעדה",
  UPDATE_RESTAURANT: "עדכון מסעדה",
  DELETE_RESTAURANT: "מחיקת מסעדה",
  CREATE_MENU: "יצירת תפריט",
  UPDATE_MENU: "עדכון תפריט",
  DELETE_MENU: "מחיקת תפריט",
  CREATE_CATEGORY: "יצירת קטגוריה",
  UPDATE_CATEGORY: "עדכון קטגוריה",
  DELETE_CATEGORY: "מחיקת קטגוריה",
  CREATE_ITEM: "יצירת מנה",
  UPDATE_ITEM: "עדכון מנה",
  DELETE_ITEM: "מחיקת מנה",
  CREATE_USER: "יצירת משתמש",
  UPDATE_USER: "עדכון משתמש",
  DELETE_USER: "מחיקת משתמש",
  ASSIGN_USER_TO_RESTAURANT: "שיוך למסעדה",
  REMOVE_USER_FROM_RESTAURANT: "הסרה ממסעדה",
  CHANGE_PASSWORD: "שינוי סיסמה",
  RUN_MIGRATION: "הרצת מיגרציה",
};

const ACTION_COLORS: Record<string, string> = {
  LOGIN_SUCCESS: "bg-blue-900/40 text-blue-300 border-blue-700/40",
  LOGIN_FAILED: "bg-red-900/40 text-red-300 border-red-700/40",
  LOGOUT: "bg-slate-800/60 text-slate-400 border-slate-700/40",
  CREATE_RESTAURANT: "bg-emerald-900/40 text-emerald-300 border-emerald-700/40",
  UPDATE_RESTAURANT: "bg-amber-900/40 text-amber-300 border-amber-700/40",
  DELETE_RESTAURANT: "bg-red-900/40 text-red-300 border-red-700/40",
  CREATE_MENU: "bg-emerald-900/40 text-emerald-300 border-emerald-700/40",
  UPDATE_MENU: "bg-amber-900/40 text-amber-300 border-amber-700/40",
  DELETE_MENU: "bg-red-900/40 text-red-300 border-red-700/40",
  CREATE_CATEGORY: "bg-emerald-900/40 text-emerald-300 border-emerald-700/40",
  UPDATE_CATEGORY: "bg-amber-900/40 text-amber-300 border-amber-700/40",
  DELETE_CATEGORY: "bg-red-900/40 text-red-300 border-red-700/40",
  CREATE_ITEM: "bg-emerald-900/40 text-emerald-300 border-emerald-700/40",
  UPDATE_ITEM: "bg-amber-900/40 text-amber-300 border-amber-700/40",
  DELETE_ITEM: "bg-red-900/40 text-red-300 border-red-700/40",
  CREATE_USER: "bg-violet-900/40 text-violet-300 border-violet-700/40",
  UPDATE_USER: "bg-amber-900/40 text-amber-300 border-amber-700/40",
  DELETE_USER: "bg-red-900/40 text-red-300 border-red-700/40",
  ASSIGN_USER_TO_RESTAURANT: "bg-cyan-900/40 text-cyan-300 border-cyan-700/40",
  REMOVE_USER_FROM_RESTAURANT: "bg-orange-900/40 text-orange-300 border-orange-700/40",
  CHANGE_PASSWORD: "bg-violet-900/40 text-violet-300 border-violet-700/40",
  RUN_MIGRATION: "bg-violet-900/40 text-violet-300 border-violet-700/40",
};

const ALL_ACTIONS = Object.keys(ACTION_LABELS);

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function MetaDisplay({ meta }: { meta: Record<string, unknown> | null }) {
  if (!meta) return null;
  const entries = Object.entries(meta).filter(([, v]) => v !== null && v !== undefined);
  if (!entries.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {entries.map(([k, v]) => (
        <span key={k} className="text-xs text-slate-500 bg-white/5 px-1.5 py-0.5 rounded font-mono">
          {k}: {Array.isArray(v) ? (v as unknown[]).join(", ") : String(v)}
        </span>
      ))}
    </div>
  );
}

export default function LogsClient() {
  const [data, setData] = useState<LogsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterAction, setFilterAction] = useState("");
  const [filterEntity, setFilterEntity] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (filterAction) params.set("action", filterAction);
    if (filterEntity) params.set("entity", filterEntity);
    if (search) params.set("search", search);
    const res = await fetch(`/api/admin/logs?${params}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [page, filterAction, filterEntity, search]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  function applySearch() {
    setSearch(searchInput);
    setPage(1);
  }

  function clearFilters() {
    setFilterAction("");
    setFilterEntity("");
    setSearch("");
    setSearchInput("");
    setPage(1);
  }

  return (
    <div className="p-4 md:p-8 min-h-screen" dir="rtl" style={{ background: "#f5f2ea" }}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">לוג פעולות</h1>
        <p className="text-gray-500 text-sm mt-1">היסטוריית פעולות מערכת הניהול</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-5 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-40">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">סוג פעולה</label>
          <select
            value={filterAction}
            onChange={e => { setFilterAction(e.target.value); setPage(1); }}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
          >
            <option value="">הכל</option>
            {ALL_ACTIONS.map(a => (
              <option key={a} value={a}>{ACTION_LABELS[a]}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-36">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">ישות</label>
          <select
            value={filterEntity}
            onChange={e => { setFilterEntity(e.target.value); setPage(1); }}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
          >
            <option value="">הכל</option>
            {["restaurant", "menu", "category", "item", "user", "restaurantUser", "system"].map(e => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">חיפוש</label>
          <div className="flex gap-2">
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && applySearch()}
              placeholder="אימייל / שם ישות..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button onClick={applySearch} className="text-white px-3 py-2 rounded-xl text-sm font-semibold" style={{ background: "linear-gradient(135deg,#8B6914,#C9A84C)" }}>
              חפש
            </button>
          </div>
        </div>
        {(filterAction || filterEntity || search) && (
          <button onClick={clearFilters} className="text-xs text-gray-500 hover:text-red-500 underline self-end pb-2.5">
            נקה סינון
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">טוען...</div>
        ) : !data || data.logs.length === 0 ? (
          <div className="p-12 text-center text-gray-400">אין לוגים</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100" style={{ background: "#faf9f6" }}>
                    <th className="text-right font-semibold text-gray-500 text-xs uppercase tracking-wide px-4 py-3">זמן</th>
                    <th className="text-right font-semibold text-gray-500 text-xs uppercase tracking-wide px-4 py-3">פעולה</th>
                    <th className="text-right font-semibold text-gray-500 text-xs uppercase tracking-wide px-4 py-3">משתמש</th>
                    <th className="text-right font-semibold text-gray-500 text-xs uppercase tracking-wide px-4 py-3">ישות</th>
                    <th className="text-right font-semibold text-gray-500 text-xs uppercase tracking-wide px-4 py-3">פרטים</th>
                  </tr>
                </thead>
                <tbody>
                  {data.logs.map((log, i) => (
                    <tr key={log.id} className={`border-b border-gray-50 hover:bg-amber-50/30 transition-colors ${i % 2 === 0 ? "" : "bg-gray-50/30"}`}>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap font-mono">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block text-xs font-semibold px-2 py-1 rounded-lg border ${ACTION_COLORS[log.action] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                          {ACTION_LABELS[log.action] ?? log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {log.userEmail ?? <span className="text-gray-300">—</span>}
                        {log.ip && <div className="text-gray-400 font-mono">{log.ip}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {log.entity && <span className="text-gray-400 text-xs">{log.entity}</span>}
                        {log.entityName && <div className="font-medium text-gray-700">{log.entityName}</div>}
                        {!log.entityName && !log.entity && <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-xs">
                        <MetaDisplay meta={log.meta} />
                        {!log.meta && <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <span className="text-xs text-gray-400">סה"כ {data.total.toLocaleString()} רשומות</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  הקודם
                </button>
                <span className="text-xs text-gray-500">{page} / {data.pages}</span>
                <button
                  onClick={() => setPage(p => Math.min(data.pages, p + 1))}
                  disabled={page >= data.pages}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  הבא
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
