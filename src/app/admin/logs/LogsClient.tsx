"use client";
import { useState, useEffect, useCallback } from "react";
import { T } from "@/lib/ui";
import PageShell from "@/components/admin/PageShell";

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
  CREATE_WAITER_ORDER: "הזמנת מלצר",
  UPDATE_ORDER_STATUS: "שינוי סטטוס הזמנה",
  CLOSE_TABLE: "סגירת שולחן / תשלום",
  CLEAR_ALL_ORDERS: "מחיקת כל ההזמנות",
  CANCEL_ORDER_ITEM: "ביטול פריט הזמנה",
  COMP_ORDER_ITEM: "פיצוי פריט (חינם)",
  UNCOMP_ORDER_ITEM: "ביטול פיצוי פריט",
  ITEM_86_MARK: "86 — הסרת פריט מתפריט",
  ITEM_86_RESTORE: "86 — החזרת פריט לתפריט",
  ACCEPT_TERMS: "אישור תנאי שימוש",
  UPDATE_SITE_CONFIG: "עדכון הגדרות אתר",
};

const ACTION_DOT: Record<string, string> = {
  LOGIN_SUCCESS: T.blue,
  LOGIN_FAILED: T.red,
  LOGOUT: T.muted,
  CREATE_RESTAURANT: T.green,
  UPDATE_RESTAURANT: T.gold,
  DELETE_RESTAURANT: T.red,
  CREATE_MENU: T.green,
  UPDATE_MENU: T.gold,
  DELETE_MENU: T.red,
  CREATE_CATEGORY: T.green,
  UPDATE_CATEGORY: T.gold,
  DELETE_CATEGORY: T.red,
  CREATE_ITEM: T.green,
  UPDATE_ITEM: T.gold,
  DELETE_ITEM: T.red,
  CREATE_USER: T.purple,
  UPDATE_USER: T.gold,
  DELETE_USER: T.red,
  ASSIGN_USER_TO_RESTAURANT: T.cyan,
  REMOVE_USER_FROM_RESTAURANT: T.orange,
  CHANGE_PASSWORD: T.purple,
  RUN_MIGRATION: T.purple,
  CREATE_WAITER_ORDER: T.gold,
  UPDATE_ORDER_STATUS: T.cyan,
  CLOSE_TABLE: T.green,
  CLEAR_ALL_ORDERS: T.red,
  CANCEL_ORDER_ITEM: T.red,
  COMP_ORDER_ITEM: T.purple,
  UNCOMP_ORDER_ITEM: T.orange,
  ITEM_86_MARK: T.orange,
  ITEM_86_RESTORE: T.green,
  ACCEPT_TERMS: T.cyan,
  UPDATE_SITE_CONFIG: T.gold,
};

// Action bg colors (RGBA) for the badge
function actionBadgeStyle(action: string): React.CSSProperties {
  const color = ACTION_DOT[action] ?? T.muted;
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "3px 9px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
    background: `${color}1a`, // 10% opacity
    color,
  };
}

const ALL_ACTIONS = Object.keys(ACTION_LABELS);

const DARK_INPUT: React.CSSProperties = {
  background: T.overlay, border: `1px solid ${T.border}`,
  color: T.text, borderRadius: 8, padding: "7px 11px",
  fontSize: 12, outline: "none", width: "100%",
};

const DARK_SELECT: React.CSSProperties = { ...DARK_INPUT, cursor: "pointer" };

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
        <span key={k} style={{ background: T.overlay, color: T.muted, padding: "2px 6px", borderRadius: 5, fontFamily: "monospace", fontSize: 10 }}>
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
    <PageShell>

      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text }}>לוג פעולות</h1>
          <p style={{ color: T.muted, fontSize: 12, marginTop: 3 }}>היסטוריית פעולות מערכת הניהול</p>
        </div>
        <button
          onClick={exportCSV}
          disabled={exporting}
          style={{ background: "transparent", border: `1px solid ${T.gold}`, color: T.gold, padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: exporting ? 0.6 : 1 }}
        >
          {exporting ? "מייצא..." : "⬇ ייצוא לאקסל"}
        </button>
      </div>

      {/* Filters card */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, marginBottom: 18 }}>
        <div className="flex flex-wrap gap-3 items-end">
          {/* Action filter */}
          <div style={{ flex: "1 1 160px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 6 }}>סוג פעולה</div>
            <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(1); }} style={DARK_SELECT}>
              <option value="" style={{ background: T.surface }}>הכל</option>
              {ALL_ACTIONS.map(a => <option key={a} value={a} style={{ background: T.surface }}>{ACTION_LABELS[a]}</option>)}
            </select>
          </div>
          {/* Entity filter */}
          <div style={{ flex: "1 1 130px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 6 }}>ישות</div>
            <select value={filterEntity} onChange={e => { setFilterEntity(e.target.value); setPage(1); }} style={DARK_SELECT}>
              <option value="" style={{ background: T.surface }}>הכל</option>
              {["restaurant","menu","category","item","user","restaurantUser","order","system"].map(e => (
                <option key={e} value={e} style={{ background: T.surface }}>{e}</option>
              ))}
            </select>
          </div>
          {/* Search */}
          <div style={{ flex: "1 1 200px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 6 }}>חיפוש</div>
            <div className="flex gap-1.5">
              <input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && applySearch()}
                placeholder="אימייל / שם ישות..."
                style={{ ...DARK_INPUT, flex: 1 }}
              />
              <button onClick={applySearch} style={{ background: T.gold, color: "#fff", border: "none", padding: "0 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                חפש
              </button>
            </div>
          </div>
        </div>

        {/* Second row */}
        <div className="flex flex-wrap gap-3 items-center" style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
          <div style={{ flex: "1 1 130px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 6 }}>מתאריך</div>
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} style={DARK_INPUT} />
          </div>
          <div style={{ flex: "1 1 130px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 6 }}>עד תאריך</div>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} style={DARK_INPUT} />
          </div>
          <label className="flex items-center gap-2" style={{ cursor: "pointer", userSelect: "none", marginTop: 18 }}>
            <input
              type="checkbox"
              checked={hideMigration}
              onChange={e => { setHideMigration(e.target.checked); setPage(1); }}
              style={{ width: 14, height: 14, accentColor: T.gold }}
            />
            <span style={{ fontSize: 12, color: T.muted }}>הסתר הרצות מיגרציה</span>
          </label>
          {hasFilters && (
            <button onClick={clearFilters} style={{ marginTop: 18, fontSize: 12, color: T.red, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", marginRight: "auto" }}>
              נקה סינון
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "40px 24px", textAlign: "center", color: T.muted, fontSize: 14 }}>טוען...</div>
        ) : !data || data.logs.length === 0 ? (
          <div style={{ padding: "40px 24px", textAlign: "center", color: T.muted, fontSize: 14 }}>אין לוגים</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: T.surface }}>
                    {["זמן","פעולה","משתמש","ישות","פרטים"].map(h => (
                      <th key={h} style={{ padding: "11px 12px", textAlign: "right", fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".5px", borderBottom: `1px solid ${T.border}` }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.logs.map((log) => (
                    <tr key={log.id}
                      style={{ borderBottom: `1px solid ${T.border}` }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Time */}
                      <td style={{ padding: "10px 12px", fontSize: 11, color: T.muted, whiteSpace: "nowrap", fontFamily: "monospace" }}>
                        {formatDate(log.createdAt)}
                      </td>
                      {/* Action */}
                      <td style={{ padding: "10px 12px" }}>
                        <span style={actionBadgeStyle(log.action)}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: ACTION_DOT[log.action] ?? T.muted, flexShrink: 0, display: "inline-block" }} />
                          {ACTION_LABELS[log.action] ?? log.action}
                        </span>
                      </td>
                      {/* User */}
                      <td style={{ padding: "10px 12px", fontSize: 12, color: T.sub, whiteSpace: "nowrap" }} dir="ltr">
                        {log.userEmail ?? <span style={{ color: T.muted }}>—</span>}
                      </td>
                      {/* Entity */}
                      <td style={{ padding: "10px 12px", fontSize: 12 }}>
                        {log.entityName
                          ? <span style={{ fontWeight: 600, color: T.text }}>{log.entityName}</span>
                          : log.entity
                            ? <span style={{ color: T.muted }}>{log.entity}</span>
                            : <span style={{ color: T.muted }}>—</span>}
                      </td>
                      {/* Meta */}
                      <td style={{ padding: "10px 12px", maxWidth: 280 }}>
                        <MetaDisplay meta={log.meta} />
                        {!log.meta && <span style={{ fontSize: 12, color: T.muted }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between" style={{ padding: "12px 16px", borderTop: `1px solid ${T.border}` }}>
              <span style={{ fontSize: 12, color: T.muted }}>סה&quot;כ {data.total.toLocaleString()} רשומות</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  style={{ padding: "5px 12px", borderRadius: 7, border: `1px solid ${T.border}`, background: T.overlay, color: T.sub, fontSize: 12, cursor: "pointer", opacity: page <= 1 ? 0.4 : 1 }}
                >הקודם</button>
                <span style={{ fontSize: 12, color: T.muted, padding: "0 8px" }}>{page} / {data.pages}</span>
                <button
                  onClick={() => setPage(p => Math.min(data.pages, p + 1))}
                  disabled={page >= data.pages}
                  style={{ padding: "5px 12px", borderRadius: 7, border: `1px solid ${T.border}`, background: T.overlay, color: T.sub, fontSize: 12, cursor: "pointer", opacity: page >= data.pages ? 0.4 : 1 }}
                >הבא</button>
              </div>
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}
