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
  CREATE_WAITER_ORDER: "הזמנת מלצר",
  UPDATE_ORDER_STATUS: "שינוי סטטוס הזמנה",
  CLOSE_TABLE: "סגירת שולחן / תשלום",
  CLEAR_ALL_ORDERS: "מחיקת כל ההזמנות",
};

const ACTION_DOT: Record<string, string> = {
  LOGIN_SUCCESS: "#339af0",
  LOGIN_FAILED: "#ff6b6b",
  LOGOUT: "#6c757d",
  CREATE_RESTAURANT: "#51cf66",
  UPDATE_RESTAURANT: "#fcc419",
  DELETE_RESTAURANT: "#ff6b6b",
  CREATE_MENU: "#51cf66",
  UPDATE_MENU: "#fcc419",
  DELETE_MENU: "#ff6b6b",
  CREATE_CATEGORY: "#51cf66",
  UPDATE_CATEGORY: "#fcc419",
  DELETE_CATEGORY: "#ff6b6b",
  CREATE_ITEM: "#51cf66",
  UPDATE_ITEM: "#fcc419",
  DELETE_ITEM: "#ff6b6b",
  CREATE_USER: "#be4bdb",
  UPDATE_USER: "#fcc419",
  DELETE_USER: "#ff6b6b",
  ASSIGN_USER_TO_RESTAURANT: "#22d3ee",
  REMOVE_USER_FROM_RESTAURANT: "#ff922b",
  CHANGE_PASSWORD: "#be4bdb",
  RUN_MIGRATION: "#be4bdb",
  CREATE_WAITER_ORDER: "#fcc419",
  UPDATE_ORDER_STATUS: "#22d3ee",
  CLOSE_TABLE: "#51cf66",
  CLEAR_ALL_ORDERS: "#ff6b6b",
};

// Action bg colors (RGBA) for the badge
function actionBadgeStyle(action: string): React.CSSProperties {
  const color = ACTION_DOT[action] ?? "#6c757d";
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

// ── Dark palette ──────────────────────────────────────────────────────────────
const C = {
  pageBg: "#1a1d23", cardBg: "#212529", border: "#2d3239",
  inputBg: "#2d3239", inputBorder: "#3a3f47",
  text: "#e9ecef", sub: "#adb5bd", muted: "#6c757d",
  amber: "#fcc419", green: "#51cf66", red: "#ff6b6b",
} as const;

const DARK_INPUT: React.CSSProperties = {
  background: C.inputBg, border: `1px solid ${C.inputBorder}`,
  color: C.text, borderRadius: 8, padding: "7px 11px",
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
        <span key={k} style={{ background: C.inputBg, color: C.muted, padding: "2px 6px", borderRadius: 5, fontFamily: "monospace", fontSize: 10 }}>
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
    <div className="p-4 md:p-6" dir="rtl" style={{ background: C.pageBg, minHeight: "100vh", color: C.text }}>

      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text }}>לוג פעולות</h1>
          <p style={{ color: C.muted, fontSize: 12, marginTop: 3 }}>היסטוריית פעולות מערכת הניהול</p>
        </div>
        <button
          onClick={exportCSV}
          disabled={exporting}
          style={{ background: "transparent", border: `1px solid ${C.amber}`, color: C.amber, padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: exporting ? 0.6 : 1 }}
        >
          {exporting ? "מייצא..." : "⬇ ייצוא לאקסל"}
        </button>
      </div>

      {/* Filters card */}
      <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 18 }}>
        <div className="flex flex-wrap gap-3 items-end">
          {/* Action filter */}
          <div style={{ flex: "1 1 160px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 6 }}>סוג פעולה</div>
            <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(1); }} style={DARK_SELECT}>
              <option value="" style={{ background: C.cardBg }}>הכל</option>
              {ALL_ACTIONS.map(a => <option key={a} value={a} style={{ background: C.cardBg }}>{ACTION_LABELS[a]}</option>)}
            </select>
          </div>
          {/* Entity filter */}
          <div style={{ flex: "1 1 130px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 6 }}>ישות</div>
            <select value={filterEntity} onChange={e => { setFilterEntity(e.target.value); setPage(1); }} style={DARK_SELECT}>
              <option value="" style={{ background: C.cardBg }}>הכל</option>
              {["restaurant","menu","category","item","user","restaurantUser","order","system"].map(e => (
                <option key={e} value={e} style={{ background: C.cardBg }}>{e}</option>
              ))}
            </select>
          </div>
          {/* Search */}
          <div style={{ flex: "1 1 200px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 6 }}>חיפוש</div>
            <div className="flex gap-1.5">
              <input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && applySearch()}
                placeholder="אימייל / שם ישות..."
                style={{ ...DARK_INPUT, flex: 1 }}
              />
              <button onClick={applySearch} style={{ background: C.amber, color: "#000", border: "none", padding: "0 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                חפש
              </button>
            </div>
          </div>
        </div>

        {/* Second row */}
        <div className="flex flex-wrap gap-3 items-center" style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
          <div style={{ flex: "1 1 130px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 6 }}>מתאריך</div>
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} style={DARK_INPUT} />
          </div>
          <div style={{ flex: "1 1 130px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 6 }}>עד תאריך</div>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} style={DARK_INPUT} />
          </div>
          <label className="flex items-center gap-2" style={{ cursor: "pointer", userSelect: "none", marginTop: 18 }}>
            <input
              type="checkbox"
              checked={hideMigration}
              onChange={e => { setHideMigration(e.target.checked); setPage(1); }}
              style={{ width: 14, height: 14, accentColor: C.amber }}
            />
            <span style={{ fontSize: 12, color: C.muted }}>הסתר הרצות מיגרציה</span>
          </label>
          {hasFilters && (
            <button onClick={clearFilters} style={{ marginTop: 18, fontSize: 12, color: C.red, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", marginRight: "auto" }}>
              נקה סינון
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "40px 24px", textAlign: "center", color: C.muted, fontSize: 14 }}>טוען...</div>
        ) : !data || data.logs.length === 0 ? (
          <div style={{ padding: "40px 24px", textAlign: "center", color: C.muted, fontSize: 14 }}>אין לוגים</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#1a1d23" }}>
                    {["זמן","פעולה","משתמש","ישות","פרטים"].map(h => (
                      <th key={h} style={{ padding: "11px 12px", textAlign: "right", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".5px", borderBottom: `1px solid ${C.border}` }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.logs.map((log) => (
                    <tr key={log.id}
                      style={{ borderBottom: `1px solid ${C.border}` }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Time */}
                      <td style={{ padding: "10px 12px", fontSize: 11, color: C.muted, whiteSpace: "nowrap", fontFamily: "monospace" }}>
                        {formatDate(log.createdAt)}
                      </td>
                      {/* Action */}
                      <td style={{ padding: "10px 12px" }}>
                        <span style={actionBadgeStyle(log.action)}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: ACTION_DOT[log.action] ?? C.muted, flexShrink: 0, display: "inline-block" }} />
                          {ACTION_LABELS[log.action] ?? log.action}
                        </span>
                      </td>
                      {/* User */}
                      <td style={{ padding: "10px 12px", fontSize: 12, color: C.sub, whiteSpace: "nowrap" }} dir="ltr">
                        {log.userEmail ?? <span style={{ color: C.muted }}>—</span>}
                      </td>
                      {/* Entity */}
                      <td style={{ padding: "10px 12px", fontSize: 12 }}>
                        {log.entityName
                          ? <span style={{ fontWeight: 600, color: C.text }}>{log.entityName}</span>
                          : log.entity
                            ? <span style={{ color: C.muted }}>{log.entity}</span>
                            : <span style={{ color: C.muted }}>—</span>}
                      </td>
                      {/* Meta */}
                      <td style={{ padding: "10px 12px", maxWidth: 280 }}>
                        <MetaDisplay meta={log.meta} />
                        {!log.meta && <span style={{ fontSize: 12, color: C.muted }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between" style={{ padding: "12px 16px", borderTop: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 12, color: C.muted }}>סה&quot;כ {data.total.toLocaleString()} רשומות</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  style={{ padding: "5px 12px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.inputBg, color: C.sub, fontSize: 12, cursor: "pointer", opacity: page <= 1 ? 0.4 : 1 }}
                >הקודם</button>
                <span style={{ fontSize: 12, color: C.muted, padding: "0 8px" }}>{page} / {data.pages}</span>
                <button
                  onClick={() => setPage(p => Math.min(data.pages, p + 1))}
                  disabled={page >= data.pages}
                  style={{ padding: "5px 12px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.inputBg, color: C.sub, fontSize: 12, cursor: "pointer", opacity: page >= data.pages ? 0.4 : 1 }}
                >הבא</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
