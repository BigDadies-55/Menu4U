"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { T, btn, badge, card } from "@/lib/ui";

interface Restaurant { id: string; name: string; }

interface TimelineEvent {
  type: string;
  at: string;
  actor: string;
  actorId: string | null;
  detail: string;
  orderId?: string;
  tableNumber?: string;
}

interface WaiterStat {
  id: string; name: string;
  ordersCreated: number; tablesClosed: number; itemsServed: number;
  totalRevenue: number;
}

interface Insights {
  totalSessions: number;
  totalOrders: number;
  avgSessionMinutes: number;
  avgAmountPerSession: number;
  cancellationRatePercent: number;
  busiestHour: number;
  topWaiters: WaiterStat[];
  hourCounts: number[];
}

interface Session {
  id: string; tableNumber: string; openedAt: string; closedAt: string;
  totalAmount: number; orderCount: number; durationMinutes: number;
}

interface ApiResponse {
  tableNumbers: string[];
  sessions: Session[];
  events: TimelineEvent[];
  insights: Insights;
}

const EVENT_CFG: Record<string, { label: string; color: string; icon: string }> = {
  ORDER_CREATED:   { label: "הזמנה נפתחה",  color: T.blue,    icon: "📋" },
  ITEM_SERVED:     { label: "מנה הוגשה",    color: T.green,   icon: "🍽️" },
  TABLE_PAID:      { label: "שולחן שולם",   color: T.gold,    icon: "💳" },
  ORDER_CANCELLED: { label: "הזמנה בוטלה",  color: T.red,     icon: "❌" },
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
function fmtDuration(mins: number) {
  if (mins < 60) return `${mins} דק'`;
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")} שע'`;
}

function toLocalDatetimeInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function defaultFrom(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0,0,0,0);
  return d;
}

export default function TableTimelineClient({ restaurants }: { restaurants: Restaurant[] }) {
  const [restaurantId, setRestaurantId] = useState(restaurants[0]?.id ?? "");
  const [tableNumber,  setTableNumber]  = useState<string>("");
  const [days,         setDays]         = useState(7);
  const [fromDt,       setFromDt]       = useState(() => toLocalDatetimeInput(defaultFrom(7)));
  const [toDt,         setToDt]         = useState(() => toLocalDatetimeInput(new Date()));
  const [data,         setData]         = useState<ApiResponse | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [viewTab,      setViewTab]      = useState<"gantt" | "events" | "fraud">("gantt");

  // Fraud detection state
  type WaiterFraudStat = {
    id: string; name: string;
    totalOrders: number; totalRevenue: number;
    voidCount: number; voidAmount: number;
    compCount: number; compAmount: number;
    riskScore: number;
  };
  type FraudEvent = {
    type: "VOID" | "COMP";
    at: string; waiterId: string; waiterName: string;
    itemName: string; quantity: number; amount: number;
    reason: string | null; tableNumber: string | null; orderId: string;
  };
  type FraudData = { waiterStats: WaiterFraudStat[]; events: FraudEvent[] };
  const [fraudData,    setFraudData]    = useState<FraudData | null>(null);
  const [fraudLoading, setFraudLoading] = useState(false);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        restaurantId,
        days: String(days),
        from: new Date(fromDt).toISOString(),
        to:   new Date(toDt).toISOString(),
      });
      if (tableNumber) params.set("tableNumber", tableNumber);
      const res = await fetch(`/api/admin/orders/table-timeline?${params}`);
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, tableNumber, days, fromDt, toDt]);

  const loadFraud = useCallback(async () => {
    if (!restaurantId) return;
    setFraudLoading(true);
    try {
      const params = new URLSearchParams({
        restaurantId, days: String(days),
        from: new Date(fromDt).toISOString(),
        to:   new Date(toDt).toISOString(),
      });
      const res = await fetch(`/api/admin/fraud-detection?${params}`);
      if (res.ok) setFraudData(await res.json());
    } catch { /* ignore */ } finally {
      setFraudLoading(false);
    }
  }, [restaurantId, days, fromDt, toDt]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (viewTab === "fraud") loadFraud(); }, [viewTab, loadFraud]);

  const insights = data?.insights;
  const events   = data?.events ?? [];

  return (
    <div style={{ direction: "rtl", padding: "24px 28px", minHeight: "100vh", background: T.bg, fontFamily: T.fontSans, color: T.text }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: T.f2xl, fontWeight: 800, color: T.gold, margin: 0 }}>
          🗂️ ציר זמן שולחנות
        </h1>
        <p style={{ fontSize: T.fmd, color: T.muted, marginTop: 4 }}>
          מעקב פעולות מלצרים · תובנות ביצוע
        </p>
      </div>

      {/* ── Filters ── */}
      <div style={{
        display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end",
        marginBottom: 24, padding: "14px 16px",
        background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.rLg,
      }}>
        {/* Restaurant selector */}
        {restaurants.length > 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10, color: T.muted, fontWeight: 700 }}>מסעדה</label>
            <select value={restaurantId} onChange={e => { setRestaurantId(e.target.value); setTableNumber(""); }} style={{ ...selectStyle }}>
              {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        )}

        {/* Table selector */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 10, color: T.muted, fontWeight: 700 }}>שולחן</label>
          <select value={tableNumber} onChange={e => setTableNumber(e.target.value)} style={{ ...selectStyle }}>
            <option value="">כל השולחנות</option>
            {(data?.tableNumbers ?? []).map(t => <option key={t} value={t}>שולחן {t}</option>)}
          </select>
        </div>

        {/* Quick-range shortcuts */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 10, color: T.muted, fontWeight: 700 }}>טווח מהיר</label>
          <div style={{ display: "flex", gap: 4 }}>
            {([
              [1, "היום"], [3, "3י׳"], [7, "שבוע"], [14, "2 שב׳"], [30, "30י׳"],
            ] as [number, string][]).map(([d, lbl]) => (
              <button key={d} onClick={() => {
                setDays(d);
                const from = defaultFrom(d);
                const to   = new Date();
                setFromDt(toLocalDatetimeInput(from));
                setToDt(toLocalDatetimeInput(to));
              }} style={{
                padding: "5px 10px", borderRadius: T.rMd, fontSize: 11, fontWeight: 700, cursor: "pointer",
                background: days === d ? T.gold : T.panel,
                color: days === d ? T.text : T.sub,
                border: `1px solid ${days === d ? T.gold + "88" : T.border}`,
              }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Date-time range */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 10, color: T.muted, fontWeight: 700 }}>מ-</label>
          <input
            type="datetime-local"
            value={fromDt}
            onChange={e => { setFromDt(e.target.value); setDays(0); }}
            style={{ ...selectStyle, fontSize: 12 }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 10, color: T.muted, fontWeight: 700 }}>עד-</label>
          <input
            type="datetime-local"
            value={toDt}
            onChange={e => { setToDt(e.target.value); setDays(0); }}
            style={{ ...selectStyle, fontSize: 12 }}
          />
        </div>

        <button onClick={() => { load(); if (viewTab === "fraud") loadFraud(); }} style={{ ...btn("ghost", "sm"), alignSelf: "flex-end" }}>
          🔍 חפש
        </button>

        {loading && <span style={{ fontSize: T.fsm, color: T.muted, alignSelf: "flex-end" }}>טוען...</span>}
        {error   && <span style={{ fontSize: T.fsm, color: T.red, alignSelf: "flex-end" }}>{error}</span>}
      </div>

      {/* ── Insight cards ── */}
      {insights && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12, marginBottom: 20 }}>
          <InsightCard label="סשנים" value={String(insights.totalSessions)} icon="📊" color={T.blue} />
          <InsightCard label="הזמנות" value={String(insights.totalOrders)} icon="📋" color={T.purple} />
          <InsightCard label="זמן ממוצע" value={fmtDuration(insights.avgSessionMinutes)} icon="⏱️" color={T.cyan} />
          <InsightCard label="ממוצע לשולחן" value={`₪${insights.avgAmountPerSession}`} icon="💰" color={T.gold} />
          <InsightCard label="ביטולים" value={`${insights.cancellationRatePercent}%`} icon="❌" color={insights.cancellationRatePercent > 10 ? T.red : T.green} />
          <InsightCard label="שעת שיא" value={`${insights.busiestHour}:00`} icon="🕐" color={T.orange} />
        </div>
      )}

      {/* ── Hourly load bar chart ── */}
      {insights?.hourCounts && <HourlyChart hourCounts={insights.hourCounts} busiestHour={insights.busiestHour} />}

      {/* ── View tabs ── */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: `1px solid ${T.border}`, paddingBottom: 0 }}>
        {([
          ["gantt",  "📊 גאנט שולחנות"],
          ["events", "📋 יומן אירועים"],
          ["fraud",  "🚨 זיהוי הונאות"],
        ] as const).map(([t, label]) => (
          <button key={t} onClick={() => setViewTab(t)} style={{
            padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer",
            background: viewTab === t ? (t === "fraud" ? T.red : T.gold) : "transparent",
            color: viewTab === t ? (t === "fraud" ? "#fff" : T.text) : T.sub,
            border: "none", borderRadius: "8px 8px 0 0",
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Gantt view ── */}
      {viewTab === "gantt" && data && (
        <GanttChart
          sessions={data.sessions}
          tableNumbers={data.tableNumbers}
          days={days}
          onTableClick={t => setTableNumber(t === tableNumber ? "" : t)}
          selectedTable={tableNumber}
        />
      )}

      {/* ── Fraud detection view ── */}
      {viewTab === "fraud" && (
        <FraudDashboard
          data={fraudData}
          loading={fraudLoading}
          onRefresh={loadFraud}
          days={days}
        />
      )}

      {/* ── Events view ── */}
      {viewTab === "events" && (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, alignItems: "start" }}>

        {/* ── Timeline ── */}
        <div style={{ ...card(), padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}` }}>
            <span style={{ fontSize: T.flg, fontWeight: 700 }}>
              {tableNumber ? `שולחן ${tableNumber} · ` : ""}אירועים
            </span>
            <span style={{ fontSize: T.fsm, color: T.muted, marginRight: 8 }}>
              {events.length} אירועים
            </span>
          </div>

          <div style={{ maxHeight: 640, overflowY: "auto", padding: "12px 0" }}>
            {events.length === 0 && !loading && (
              <div style={{ textAlign: "center", padding: "40px 20px", color: T.muted, fontSize: T.fmd }}>
                אין אירועים בטווח הזמן הנבחר
              </div>
            )}
            {events.map((ev, i) => {
              const cfg = EVENT_CFG[ev.type] ?? { label: ev.type, color: T.muted, icon: "•" };
              const showDateHeader = i === 0 || fmtDate(events[i - 1].at) !== fmtDate(ev.at);
              return (
                <div key={i}>
                  {showDateHeader && (
                    <div style={{
                      padding: "6px 18px",
                      fontSize: T.fxs, fontWeight: 700, color: T.muted,
                      letterSpacing: "0.05em", textTransform: "uppercase" as const,
                      borderBottom: `1px solid ${T.borderSub}`,
                      marginBottom: 4, marginTop: i > 0 ? 8 : 0,
                    }}>
                      {fmtDate(ev.at)}
                    </div>
                  )}
                  <div style={{
                    display: "flex", alignItems: "flex-start", gap: 12,
                    padding: "10px 18px",
                    borderBottom: `1px solid ${T.borderSub}`,
                    transition: "background 0.12s",
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = T.panel)}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* Timeline dot */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, paddingTop: 2 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%",
                        background: cfg.color + "22",
                        border: `1.5px solid ${cfg.color}55`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14,
                      }}>
                        {cfg.icon}
                      </div>
                      {i < events.length - 1 && (
                        <div style={{ width: 1, height: 18, background: T.borderSub, marginTop: 3 }} />
                      )}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: T.fmd, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
                        {!tableNumber && ev.tableNumber && ev.tableNumber !== "—" && (
                          <span style={{ ...badge(T.blue) }}>שולחן {ev.tableNumber}</span>
                        )}
                        <span style={{ fontSize: T.fsm, color: T.muted, marginRight: "auto" }}>
                          {fmtTime(ev.at)}
                        </span>
                      </div>
                      <div style={{ fontSize: T.fsm, color: T.sub, marginTop: 2 }}>
                        {ev.actor !== "מערכת" && <span style={{ color: T.gold, fontWeight: 600 }}>{ev.actor} · </span>}
                        {ev.detail}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Waiters panel ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* AI insights box */}
          {insights && (
            <div style={{ ...card(), padding: 16, borderColor: T.purple + "44" }}>
              <div style={{ fontSize: T.fsm, fontWeight: 800, color: T.purple, marginBottom: 12, letterSpacing: "0.06em" }}>
                ✨ תובנות AI
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: T.fsm }}>
                <AiInsight
                  icon="⏱️"
                  text={insights.avgSessionMinutes === 0
                    ? "אין נתוני משך שולחן עדיין"
                    : `ממוצע שהייה: ${fmtDuration(insights.avgSessionMinutes)} לשולחן`}
                />
                <AiInsight
                  icon="🕐"
                  text={`שעת השיא: ${insights.busiestHour}:00–${insights.busiestHour + 1}:00`}
                />
                <AiInsight
                  icon={insights.cancellationRatePercent > 10 ? "⚠️" : "✅"}
                  text={insights.cancellationRatePercent > 10
                    ? `אחוז ביטול גבוה: ${insights.cancellationRatePercent}% — מומלץ לבדוק`
                    : `אחוז ביטול תקין: ${insights.cancellationRatePercent}%`}
                  color={insights.cancellationRatePercent > 10 ? T.orange : T.green}
                />
                {insights.avgAmountPerSession > 0 && (
                  <AiInsight
                    icon="💰"
                    text={`ממוצע הכנסה לשולחן: ₪${insights.avgAmountPerSession}`}
                  />
                )}
              </div>
            </div>
          )}

          {/* Waiters leaderboard */}
          {insights && insights.topWaiters.length > 0 && (
            <div style={{ ...card(), padding: 16 }}>
              <div style={{ fontSize: T.fsm, fontWeight: 800, color: T.gold, marginBottom: 12, letterSpacing: "0.06em" }}>
                🏆 דירוג מלצרים
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {insights.topWaiters.map((w, idx) => (
                  <div key={w.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 10px", borderRadius: T.rMd,
                    background: idx === 0 ? T.goldSub : T.panel,
                    border: `1px solid ${idx === 0 ? T.gold + "33" : T.borderSub}`,
                  }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: "50%",
                      background: idx === 0 ? T.gold : T.raised,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: T.fsm, fontWeight: 800, color: idx === 0 ? "#000" : T.muted,
                      flexShrink: 0,
                    }}>
                      {idx + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: T.fmd, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                        {w.name}
                      </div>
                      <div style={{ fontSize: T.fxs, color: T.muted }}>
                        {w.ordersCreated} הזמנות · {w.itemsServed} הגשות
                        {w.totalRevenue > 0 && ` · ₪${Math.round(w.totalRevenue)}`}
                      </div>
                    </div>
                    {idx === 0 && <span style={{ fontSize: 16 }}>🥇</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sessions summary */}
          {(data?.sessions?.length ?? 0) > 0 && (
            <div style={{ ...card(), padding: 16 }}>
              <div style={{ fontSize: T.fsm, fontWeight: 800, color: T.sub, marginBottom: 12, letterSpacing: "0.06em" }}>
                📅 סשנים אחרונים
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflowY: "auto" }}>
                {data!.sessions.slice(0, 20).map(sess => (
                  <button
                    key={sess.id}
                    onClick={() => setTableNumber(sess.tableNumber)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "8px 10px", borderRadius: T.rMd,
                      background: tableNumber === sess.tableNumber ? T.goldSub : T.panel,
                      border: `1px solid ${tableNumber === sess.tableNumber ? T.gold + "44" : T.borderSub}`,
                      cursor: "pointer", textAlign: "right" as const, direction: "rtl",
                      transition: "background 0.12s",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: T.fsm, fontWeight: 600, color: T.text }}>
                        שולחן {sess.tableNumber}
                      </div>
                      <div style={{ fontSize: T.fxs, color: T.muted }}>
                        {fmtDate(sess.closedAt)} · {fmtDuration(sess.durationMinutes)}
                      </div>
                    </div>
                    <div style={{ fontSize: T.fsm, fontWeight: 700, color: T.gold }}>
                      ₪{Math.round(sess.totalAmount)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

/* ── Hourly load chart ── */
function HourlyChart({ hourCounts, busiestHour }: { hourCounts: number[]; busiestHour: number }) {
  const max = Math.max(...hourCounts, 1);
  const activeHours = hourCounts.map((c, h) => ({ h, c })).filter(x => x.c > 0);
  if (activeHours.length === 0) return null;
  return (
    <div style={{ ...card(), padding: "14px 18px", marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.sub, marginBottom: 12 }}>⏰ עומס לפי שעה</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 56 }}>
        {hourCounts.map((c, h) => (
          <div key={h} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <div style={{
              width: "100%", borderRadius: "3px 3px 0 0",
              height: Math.max(c > 0 ? 4 : 0, Math.round((c / max) * 48)),
              background: h === busiestHour ? T.gold : c > 0 ? T.blue + "99" : "transparent",
              transition: "height 0.3s",
            }} title={`${h}:00 — ${c} הזמנות`} />
            {h % 3 === 0 && <span style={{ fontSize: 9, color: T.muted, lineHeight: 1 }}>{h}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Gantt chart ── */
function GanttChart({ sessions, tableNumbers, days, onTableClick, selectedTable }: {
  sessions: Session[];
  tableNumbers: string[];
  days: number;
  onTableClick: (t: string) => void;
  selectedTable: string;
}) {
  const ROW_H = 36;
  const LABEL_W = 52;

  // For single-day view: X = hours 0-24. For multi-day: X = days.
  const isMultiDay = days > 1;

  // Compute time window
  const now = Date.now();
  const windowStart = now - days * 86_400_000;

  // For multi-day: bucket by day. For single day: by hours of today.
  const xSlots = isMultiDay ? days : 24;

  function xPos(iso: string): number {
    const t = new Date(iso).getTime();
    if (isMultiDay) {
      return Math.max(0, Math.min(1, (t - windowStart) / (days * 86_400_000)));
    } else {
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      return Math.max(0, Math.min(1, (t - todayStart.getTime()) / 86_400_000));
    }
  }

  // Group sessions by table
  const byTable = useMemo(() => {
    const map: Record<string, Session[]> = {};
    for (const s of sessions) {
      (map[s.tableNumber] ??= []).push(s);
    }
    return map;
  }, [sessions]);

  const tables = tableNumbers.length > 0 ? tableNumbers : Object.keys(byTable).sort((a,b) => Number(a)-Number(b));

  if (tables.length === 0) return (
    <div style={{ ...card(), padding: 40, textAlign: "center", color: T.muted }}>אין נתוני סשנים לתקופה זו</div>
  );

  const xLabels = isMultiDay
    ? Array.from({ length: days }, (_, i) => {
        const d = new Date(windowStart + i * 86_400_000);
        return d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" });
      })
    : [0,3,6,9,12,15,18,21,24].map(h => `${h}:00`);

  return (
    <div style={{ ...card(), padding: 0, overflow: "hidden", marginBottom: 20 }}>
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, fontSize: 13, fontWeight: 700, color: T.sub }}>
        📊 גאנט שולחנות {isMultiDay ? `(${days} ימים)` : "(היום)"}
        {selectedTable && (
          <button onClick={() => onTableClick(selectedTable)} style={{ marginRight: 12, fontSize: 11, color: T.muted, background: "none", border: "none", cursor: "pointer" }}>✕ בטל סינון</button>
        )}
      </div>

      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 600 }}>
          {/* X axis header */}
          <div style={{ display: "flex", paddingRight: LABEL_W, borderBottom: `1px solid ${T.border}` }}>
            {xLabels.map((lbl, i) => (
              <div key={i} style={{
                flex: 1, textAlign: "center", fontSize: 10, color: T.muted,
                padding: "4px 0", borderRight: `1px solid ${T.borderSub}`,
              }}>{lbl}</div>
            ))}
          </div>

          {/* Rows */}
          <div style={{ maxHeight: Math.min(tables.length * ROW_H + 8, 480), overflowY: "auto" }}>
            {tables.map(tNum => {
              const tableSessions = byTable[tNum] ?? [];
              const isSelected = selectedTable === tNum;
              const revenue = tableSessions.reduce((s, sess) => s + sess.totalAmount, 0);
              return (
                <div key={tNum}
                  onClick={() => onTableClick(tNum)}
                  style={{
                    display: "flex", alignItems: "center", height: ROW_H,
                    borderBottom: `1px solid ${T.borderSub}`,
                    background: isSelected ? T.goldSub : "transparent",
                    cursor: "pointer", transition: "background 0.12s",
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = T.panel; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                >
                  {/* Label */}
                  <div style={{ width: LABEL_W, flexShrink: 0, paddingRight: 12, textAlign: "right", borderLeft: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: isSelected ? T.gold : T.text }}>{tNum}</div>
                    {revenue > 0 && <div style={{ fontSize: 9, color: T.muted }}>₪{Math.round(revenue)}</div>}
                  </div>

                  {/* Timeline bar area */}
                  <div style={{ flex: 1, position: "relative", height: ROW_H, overflow: "hidden" }}>
                    {tableSessions.map(sess => {
                      const left  = xPos(sess.openedAt) * 100;
                      const right = xPos(sess.closedAt) * 100;
                      const width = Math.max(0.5, right - left);
                      const mins  = sess.durationMinutes;
                      const hue   = sess.totalAmount > 0 ? T.green : T.blue;
                      return (
                        <div key={sess.id}
                          title={`שולחן ${sess.tableNumber} · ${fmtDuration(mins)} · ₪${Math.round(sess.totalAmount)}`}
                          style={{
                            position: "absolute",
                            left: `${left}%`, width: `${width}%`,
                            top: 6, height: ROW_H - 12,
                            background: hue + "cc",
                            border: `1px solid ${hue}`,
                            borderRadius: 4,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            overflow: "hidden",
                            fontSize: 9, color: "#fff", fontWeight: 700,
                          }}
                        >
                          {width > 4 ? fmtDuration(mins) : ""}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ padding: "8px 16px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 16, fontSize: 10, color: T.muted }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 12, height: 8, background: T.green + "cc", borderRadius: 2, display: "inline-block" }} />עם הכנסה
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 12, height: 8, background: T.blue + "cc", borderRadius: 2, display: "inline-block" }} />ללא הכנסה
        </span>
        <span style={{ marginRight: "auto" }}>לחץ על שורה לסינון אירועים</span>
      </div>
    </div>
  );
}

/* ── Small helper components ── */

function InsightCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${color}33`, borderRadius: T.rLg,
      padding: "14px 16px",
    }}>
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: T.f2xl, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: T.fsm, color: T.muted, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function AiInsight({ icon, text, color = T.sub }: { icon: string; text: string; color?: string }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
      <span style={{ color, lineHeight: 1.4 }}>{text}</span>
    </div>
  );
}

/* ── Fraud Dashboard ── */
type WaiterFraudStat = {
  id: string; name: string;
  totalOrders: number; totalRevenue: number;
  voidCount: number; voidAmount: number;
  compCount: number; compAmount: number;
  riskScore: number;
};
type FraudEvent = {
  type: "VOID" | "COMP";
  at: string; waiterId: string; waiterName: string;
  itemName: string; quantity: number; amount: number;
  reason: string | null; tableNumber: string | null; orderId: string;
};
type FraudData = { waiterStats: WaiterFraudStat[]; events: FraudEvent[] };

function riskColor(score: number): string {
  if (score >= 20) return T.red;
  if (score >= 8)  return T.orange;
  if (score >= 3)  return "#e8c840";
  return T.green;
}
function riskLabel(score: number): string {
  if (score >= 20) return "סיכון גבוה";
  if (score >= 8)  return "סיכון בינוני";
  if (score >= 3)  return "נמוך";
  return "תקין";
}

function FraudDashboard({ data, loading, onRefresh, days }: {
  data: FraudData | null; loading: boolean; onRefresh: () => void; days: number;
}) {
  const [selectedWaiter, setSelectedWaiter] = useState<string | null>(null);
  const [eventFilter,    setEventFilter]    = useState<"ALL" | "VOID" | "COMP">("ALL");

  const filteredEvents = useMemo(() => {
    if (!data) return [];
    return data.events
      .filter(e => eventFilter === "ALL" || e.type === eventFilter)
      .filter(e => !selectedWaiter || e.waiterId === selectedWaiter);
  }, [data, eventFilter, selectedWaiter]);

  if (loading) return (
    <div style={{ ...card(), padding: 40, textAlign: "center", color: T.muted }}>טוען נתוני הונאות...</div>
  );
  if (!data) return null;
  if (data.waiterStats.length === 0 && data.events.length === 0) return (
    <div style={{ ...card(), padding: 40, textAlign: "center", color: T.muted }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
      <div style={{ fontWeight: 700, color: T.green }}>לא נמצאו ביטולים או מתנות ב-{days} הימים האחרונים</div>
    </div>
  );

  const totalVoidAmount = data.waiterStats.reduce((s, w) => s + w.voidAmount, 0);
  const totalCompAmount = data.waiterStats.reduce((s, w) => s + w.compAmount, 0);
  const totalVoidCount  = data.waiterStats.reduce((s, w) => s + w.voidCount, 0);
  const totalCompCount  = data.waiterStats.reduce((s, w) => s + w.compCount, 0);

  return (
    <div>
      {/* Summary strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12, marginBottom: 20 }}>
        <InsightCard label="סה״כ ביטולים (VOID)" value={`₪${Math.round(totalVoidAmount)}`} icon="⚠️" color={T.red} />
        <InsightCard label="אירועי VOID"          value={String(totalVoidCount)}             icon="🗑️" color={T.red} />
        <InsightCard label="סה״כ מתנות (COMP)"   value={`₪${Math.round(totalCompAmount)}`}  icon="🎁" color={T.orange} />
        <InsightCard label="אירועי COMP"           value={String(totalCompCount)}             icon="🎁" color={T.orange} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: 20, alignItems: "start" }}>

        {/* ── Waiter risk table ── */}
        <div style={{ ...card(), padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>🚨 דירוג סיכון מלצרים</span>
            <button onClick={onRefresh} style={{ ...btn("ghost", "sm") }}>🔄</button>
          </div>
          <div>
            {/* Header */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 70px 70px 70px 70px 90px",
              padding: "8px 18px", fontSize: 10, fontWeight: 700, color: T.muted,
              borderBottom: `1px solid ${T.border}`, letterSpacing: "0.05em",
            }}>
              <span>מלצר</span>
              <span style={{ textAlign: "center" }}>הזמנות</span>
              <span style={{ textAlign: "center" }}>VOID</span>
              <span style={{ textAlign: "center" }}>COMP</span>
              <span style={{ textAlign: "center" }}>₪ שבוטל</span>
              <span style={{ textAlign: "center" }}>רמת סיכון</span>
            </div>
            {data.waiterStats.map(w => {
              const rc = riskColor(w.riskScore);
              const isSelected = selectedWaiter === w.id;
              return (
                <div
                  key={w.id}
                  onClick={() => setSelectedWaiter(isSelected ? null : w.id)}
                  style={{
                    display: "grid", gridTemplateColumns: "1fr 70px 70px 70px 70px 90px",
                    padding: "11px 18px", fontSize: 13,
                    borderBottom: `1px solid ${T.borderSub}`,
                    background: isSelected ? rc + "18" : "transparent",
                    cursor: "pointer", transition: "background 0.12s",
                    borderRight: isSelected ? `3px solid ${rc}` : "3px solid transparent",
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = T.panel; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: T.text }}>{w.name}</div>
                    <div style={{ fontSize: 10, color: T.muted }}>הכנסות: ₪{Math.round(w.totalRevenue)}</div>
                  </div>
                  <div style={{ textAlign: "center", color: T.sub }}>{w.totalOrders}</div>
                  <div style={{ textAlign: "center", color: w.voidCount > 0 ? T.red : T.muted, fontWeight: w.voidCount > 0 ? 700 : 400 }}>{w.voidCount}</div>
                  <div style={{ textAlign: "center", color: w.compCount > 0 ? T.orange : T.muted, fontWeight: w.compCount > 0 ? 700 : 400 }}>{w.compCount}</div>
                  <div style={{ textAlign: "center", color: (w.voidAmount + w.compAmount) > 0 ? T.red : T.muted, fontWeight: 600 }}>
                    ₪{Math.round(w.voidAmount + w.compAmount)}
                  </div>
                  <div style={{ textAlign: "center" }}>
                    {/* Risk bar */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                      <div style={{ flex: 1, height: 6, background: T.raised, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 3,
                          width: `${Math.min(100, w.riskScore * 3)}%`,
                          background: rc, transition: "width 0.4s",
                        }} />
                      </div>
                    </div>
                    <div style={{ fontSize: 9, color: rc, fontWeight: 700, marginTop: 2 }}>{riskLabel(w.riskScore)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Events journal ── */}
        <div style={{ ...card(), padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
              יומן אירועים {selectedWaiter && `— ${data.waiterStats.find(w => w.id === selectedWaiter)?.name ?? ""}`}
              {selectedWaiter && (
                <button onClick={() => setSelectedWaiter(null)} style={{ marginRight: 8, fontSize: 11, color: T.muted, background: "none", border: "none", cursor: "pointer" }}>✕</button>
              )}
            </div>
            {/* Filter toggles */}
            <div style={{ display: "flex", gap: 6 }}>
              {(["ALL", "VOID", "COMP"] as const).map(f => (
                <button key={f} onClick={() => setEventFilter(f)} style={{
                  padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: "pointer",
                  border: `1.5px solid ${f === "VOID" ? T.red + "66" : f === "COMP" ? T.orange + "66" : T.border}`,
                  background: eventFilter === f ? (f === "VOID" ? T.red + "22" : f === "COMP" ? T.orange + "22" : T.panel) : "transparent",
                  color: f === "VOID" ? T.red : f === "COMP" ? T.orange : T.sub,
                }}>
                  {f === "ALL" ? "הכל" : f}
                </button>
              ))}
              <span style={{ marginRight: "auto", fontSize: 11, color: T.muted, lineHeight: "26px" }}>
                {filteredEvents.length} אירועים
              </span>
            </div>
          </div>

          <div style={{ maxHeight: 520, overflowY: "auto" }}>
            {filteredEvents.length === 0 && (
              <div style={{ padding: 32, textAlign: "center", color: T.muted, fontSize: 13 }}>אין אירועים</div>
            )}
            {filteredEvents.map((ev, i) => (
              <div key={i} style={{
                padding: "10px 14px", borderBottom: `1px solid ${T.borderSub}`,
                display: "flex", gap: 10, alignItems: "flex-start",
              }}>
                {/* Icon */}
                <div style={{
                  width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                  background: ev.type === "VOID" ? T.red + "22" : T.orange + "22",
                  border: `1.5px solid ${ev.type === "VOID" ? T.red + "55" : T.orange + "55"}`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                }}>
                  {ev.type === "VOID" ? "⚠️" : "🎁"}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: ev.type === "VOID" ? T.red : T.orange }}>
                      {ev.type === "VOID" ? "VOID" : "COMP"}
                    </span>
                    <span style={{ fontSize: 11, color: T.muted }}>
                      {fmtDate(ev.at)} {fmtTime(ev.at)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>
                    {ev.itemName} ×{ev.quantity}
                    <span style={{ color: T.red, fontWeight: 800, marginRight: 6 }}>−₪{Math.round(ev.amount)}</span>
                  </div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                    <span style={{ color: T.gold }}>{ev.waiterName}</span>
                    {ev.tableNumber && ` · שולחן ${ev.tableNumber}`}
                    {ev.reason && <span style={{ fontStyle: "italic" }}> · "{ev.reason}"</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  background: T.panel, border: `1px solid ${T.border}`, borderRadius: T.rMd,
  color: T.text, fontSize: T.fmd, padding: "6px 10px", outline: "none",
  direction: "rtl",
};
