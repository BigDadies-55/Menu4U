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

const ACTION_DOT: Record<string, string> = {
  LOGIN_SUCCESS: "#3b82f6",
  LOGIN_FAILED: "#ef4444",
  LOGOUT: "#94a3b8",
  CREATE_RESTAURANT: "#10b981",
  UPDATE_RESTAURANT: "#f59e0b",
  DELETE_RESTAURANT: "#ef4444",
  CREATE_MENU: "#10b981",
  UPDATE_MENU: "#f59e0b",
  DELETE_MENU: "#ef4444",
  CREATE_CATEGORY: "#10b981",
  UPDATE_CATEGORY: "#f59e0b",
  DELETE_CATEGORY: "#ef4444",
  CREATE_ITEM: "#10b981",
  UPDATE_ITEM: "#f59e0b",
  DELETE_ITEM: "#ef4444",
  CREATE_USER: "#8b5cf6",
  UPDATE_USER: "#f59e0b",
  DELETE_USER: "#ef4444",
  ASSIGN_USER_TO_RESTAURANT: "#06b6d4",
  REMOVE_USER_FROM_RESTAURANT: "#f97316",
  CHANGE_PASSWORD: "#8b5cf6",
  RUN_MIGRATION: "#8b5cf6",
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
    <div className="flex flex-wrap gap-1">
      {entries.map(([k, v]) => (
        <span key={k} className="text-gray-500 bg-gray-100 px-1 py-0.5 rounded font-mono" style={{ fontSize: "10px" }}>
          {k}: {Array.isArray(v) ? (v as unknown[]).join(", ") : String(v)}
        </span>
      ))}
    </div>
  );
}

export default function LogsClient() {
  const [data, setData] = useState<LogsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [filterAction, setFilterAction] = useState("");
  const [filterEntity, setFilterEntity] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [hideMigration, setHideMigration] = useState(true);

  function buildParams(extra: Record<string, string> = {}) {
    const params = new URLSearchParams();
    if (filterAction) params.set("action", filterAction);
    if (filterEntity) params.set("entity", filterEntity);
    if (search) params.set("search", search);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    if (hideMigration) params.set("hideMigration", "1");
    Object.entries(extra).forEach(([k, v]) => params.set(k, v));
    return params;
  }

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = buildParams({ page: String(page) });
    const res = await fetch(`/api/admin/logs?${params}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterAction, filterEntity, search, dateFrom, dateTo, hideMigration]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  function applySearch() { setSearch(searchInput); setPage(1); }

  async function exportCSV() {
    setExporting(true);
    const params = buildParams({ format: "csv" });
    const res = await fetch(`/api/admin/logs?${params}`);
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setExporting(false);
  }

  function clearFilters() {
    setFilterAction(""); setFilterEntity(""); setSearch(""); setSearchInput("");
    setDateFrom(""); setDateTo(""); setPage(1);
  }

  const hasFilters = !!(filterAction || filterEntity || search || dateFrom || dateTo);

  return (
    <div className="p-4 md:p-6 min-h-screen" dir="rtl" style={{ background: "#f5f2ea" }}>
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">לוג פעולות</h1>
        <p className="text-gray-400 text-xs mt-0.5">היסטוריית פעולות מערכת הניהול</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 mb-4">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-36">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">סוג פעולה</label>
            <select
              value={filterAction}
              onChange={e => { setFilterAction(e.target.value); setPage(1); }}
              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
            >
              <option value="">הכל</option>
              {ALL_ACTIONS.map(a => <option key={a} value={a}>{ACTION_LABELS[a]}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-32">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">ישות</label>
            <select
              value={filterEntity}
              onChange={e => { setFilterEntity(e.target.value); setPage(1); }}
              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
            >
              <option value="">הכל</option>
              {["restaurant","menu","category","item","user","restaurantUser","system"].map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-44">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">חיפוש</label>
            <div className="flex gap-1.5">
              <input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && applySearch()}
                placeholder="אימייל / שם ישות..."
                className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button onClick={applySearch} className="text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "linear-gradient(135deg,#8B6914,#C9A84C)" }}>
                חפש
              </button>
            </div>
          </div>
        </div>

        {/* Second row: dates + checkbox + actions */}
        <div className="flex flex-wrap gap-2 items-center mt-2.5 pt-2.5 border-t border-gray-100">
          <div className="flex-1 min-w-32">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">מתאריך</label>
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div className="flex-1 min-w-32">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">עד תאריך</label>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer select-none mt-4">
            <input
              type="checkbox"
              checked={hideMigration}
              onChange={e => { setHideMigration(e.target.checked); setPage(1); }}
              className="w-3.5 h-3.5 accent-amber-500 rounded"
            />
            <span className="text-xs text-gray-500">הסתר הרצות מיגרציה</span>
          </label>
          <div className="flex items-center gap-2 mt-4 mr-auto">
            {hasFilters && (
              <button onClick={clearFilters} className="text-xs text-gray-400 hover:text-red-500 underline">
                נקה סינון
              </button>
            )}
            <button onClick={exportCSV} disabled={exporting}
              className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 transition-colors">
              {exporting ? "מייצא..." : "⬇ ייצוא לאקסל"}
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400 text-sm">טוען...</div>
        ) : !data || data.logs.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">אין לוגים</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100" style={{ background: "#faf9f6" }}>
                    <th className="text-right font-semibold text-gray-400 text-xs uppercase tracking-wide px-3 py-2">זמן</th>
                    <th className="text-right font-semibold text-gray-400 text-xs uppercase tracking-wide px-3 py-2">פעולה</th>
                    <th className="text-right font-semibold text-gray-400 text-xs uppercase tracking-wide px-3 py-2">משתמש</th>
                    <th className="text-right font-semibold text-gray-400 text-xs uppercase tracking-wide px-3 py-2">ישות</th>
                    <th className="text-right font-semibold text-gray-400 text-xs uppercase tracking-wide px-3 py-2">פרטים</th>
                  </tr>
                </thead>
                <tbody>
                  {data.logs.map((log, i) => (
                    <tr key={log.id} className={`border-b border-gray-50 hover:bg-amber-50/20 transition-colors ${i % 2 !== 0 ? "bg-gray-50/40" : ""}`}>
                      <td className="px-3 py-1.5 text-xs text-gray-400 whitespace-nowrap font-mono">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: ACTION_DOT[log.action] ?? "#94a3b8" }} />
                          <span className="text-xs font-bold text-gray-900">
                            {ACTION_LABELS[log.action] ?? log.action}
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-xs text-gray-600 whitespace-nowrap">
                        {log.userEmail ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-1.5 text-xs">
                        {log.entityName
                          ? <span className="font-medium text-gray-700">{log.entityName}</span>
                          : log.entity
                            ? <span className="text-gray-400">{log.entity}</span>
                            : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-1.5 max-w-xs">
                        <MetaDisplay meta={log.meta} />
                        {!log.meta && <span className="text-xs text-gray-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100">
              <span className="text-xs text-gray-400">סה"כ {data.total.toLocaleString()} רשומות</span>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                  className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  הקודם
                </button>
                <span className="text-xs text-gray-500 px-1">{page} / {data.pages}</span>
                <button onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page >= data.pages}
                  className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
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
