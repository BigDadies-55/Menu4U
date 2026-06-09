"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";

// ── Types ──────────────────────────────────────────────────────────────
type Restaurant = { id: string; name: string };

type TableData = {
  tableNum: string;
  seats: number;
  availStatus: "free" | "occupied" | "reserved" | "inactive";
  sittingStart: string | null;
  guests: number;
  orderStatus: string | null;
  minutesSitting: number;
  activeOrderIds: string[];
};

type Insight = {
  tableNum: string;
  type: "alert" | "tip" | "info";
  text: string;
};

// ── Color maps (white theme) ───────────────────────────────────────────
const STATUS_BORDER: Record<string, string> = {
  occupied: "#ef4444",
  reserved: "#7c3aed",
  free:     "#22c55e",
  inactive: "#9ca3af",
};

const STATUS_LABEL: Record<string, string> = {
  occupied: "תפוס",
  reserved: "שמור",
  free:     "פנוי",
  inactive: "לא פעיל",
};

const STATUS_BADGE_BG: Record<string, string> = {
  occupied: "#ef4444",
  reserved: "#7c3aed",
  free:     "#22c55e",
  inactive: "#9ca3af",
};

const ORDER_STATUS_HE: Record<string, string> = {
  PENDING:   "ממתין להזמנה",
  CONFIRMED: "הזמנה נלקחה",
  PREPARING: "מכין",
  READY:     "מוכן",
  DELIVERED: "הוגש",
  PAID:      "שולם",
  CANCELLED: "בוטל",
};

const ORDER_STATUS_COLOR: Record<string, string> = {
  PENDING:   "#22c55e",
  CONFIRMED: "#ef4444",
  PREPARING: "#3b82f6",
  READY:     "#3b82f6",
  DELIVERED: "#f59e0b",
  PAID:      "#9ca3af",
  CANCELLED: "#9ca3af",
};

const INSIGHT_ICON: Record<string, string> = {
  alert: "⚠️",
  tip:   "💡",
  info:  "ℹ️",
};

function fmtTimer(sittingStart: string | null): string {
  if (!sittingStart) return "00:00";
  const s = Math.max(0, Math.floor((Date.now() - new Date(sittingStart).getTime()) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function fmtAgo(minutes: number): string {
  if (minutes < 1) return "—";
  if (minutes < 60) return `${minutes} דק'`;
  return `${Math.floor(minutes / 60)}ש' ${minutes % 60}′`;
}

const LS_REST_KEY = "menu4u_active_restaurant";

// ── Main component ─────────────────────────────────────────────────────
export default function WaiterPosClient({
  restaurants,
  waiterName,
}: {
  restaurants: Restaurant[];
  waiterName: string;
  waiterId?: string;
}) {
  const [restaurantId, setRestaurantId] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(LS_REST_KEY);
      if (saved && restaurants.some(r => r.id === saved)) return saved;
    }
    return restaurants[0]?.id ?? "";
  });

  const [tables, setTables]           = useState<TableData[]>([]);
  const [insights, setInsights]       = useState<Insight[]>([]);
  const [loadingTables, setLoading]   = useState(true);
  const [insightLoading, setILoading] = useState(false);
  const [tick, setTick]               = useState(0);   // 1-second ticker for timers
  const [insightIdx, setInsightIdx]   = useState(0);
  const [insightFade, setInsightFade] = useState(true);
  const [allInsightsOpen, setAllInsightsOpen] = useState(false);
  const [tableOverlay, setTableOverlay]       = useState<string | null>(null); // tableNum
  const [toastMsg, setToastMsg]               = useState("");
  const [clock, setClock]                     = useState("");

  const lastInsightFetch = useRef(0);

  // Persist restaurant
  useEffect(() => {
    if (restaurantId) localStorage.setItem(LS_REST_KEY, restaurantId);
  }, [restaurantId]);

  // 1s ticker for live timers
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Clock
  useEffect(() => {
    function update() {
      const now = new Date();
      setClock(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch tables
  const fetchTables = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const res = await fetch(`/api/admin/waiter-pos/tables?restaurantId=${restaurantId}`);
      if (res.ok) setTables(await res.json());
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    setLoading(true);
    fetchTables();
    const id = setInterval(fetchTables, 15_000);
    return () => clearInterval(id);
  }, [fetchTables]);

  // Fetch AI insights
  const fetchInsights = useCallback(async (currentTables: TableData[]) => {
    if (!restaurantId) return;
    const now = Date.now();
    if (now - lastInsightFetch.current < 60_000) return;
    lastInsightFetch.current = now;
    setILoading(true);
    try {
      const res = await fetch("/api/admin/waiter-pos/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, tables: currentTables }),
      });
      if (res.ok) {
        const data = await res.json();
        setInsights(Array.isArray(data.insights) ? data.insights : []);
        setInsightIdx(0);
      }
    } finally {
      setILoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!loadingTables && tables.length > 0) fetchInsights(tables);
  }, [loadingTables, tables, fetchInsights]);

  // Insight rotator every 10s with fade
  useEffect(() => {
    if (insights.length <= 1) return;
    const id = setInterval(() => {
      setInsightFade(false);
      setTimeout(() => {
        setInsightIdx(i => (i + 1) % insights.length);
        setInsightFade(true);
      }, 400);
    }, 10_000);
    return () => clearInterval(id);
  }, [insights]);

  // Toast
  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  }

  // Patch override
  async function patchStatus(tableNum: string, status: "reserved" | "inactive" | "free") {
    await fetch("/api/admin/waiter-pos/tables", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId, tableNum, status }),
    });
    setTableOverlay(null);
    showToast(`שולחן ${tableNum} עודכן`);
    fetchTables();
  }

  // ── KPIs ──────────────────────────────────────────────────────────────
  const occupiedCount  = tables.filter(t => t.availStatus === "occupied").length;
  const reservedCount  = tables.filter(t => t.availStatus === "reserved").length;
  const freeCount      = tables.filter(t => t.availStatus === "free").length;
  const inactiveCount  = tables.filter(t => t.availStatus === "inactive").length;
  const totalDiners    = tables.filter(t => t.availStatus === "occupied").reduce((s, t) => s + t.guests, 0);
  const alertsCount    = insights.filter(i => i.type === "alert").length;
  const total          = tables.length || 1;

  const currentInsight = insights[insightIdx] ?? null;
  const overlayTable   = tables.find(t => t.tableNum === tableOverlay) ?? null;
  const overlayInsights = insights.filter(i => i.tableNum === tableOverlay);

  // suppress tick lint
  void tick;

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "#f0f2f5", color: "#111", fontFamily: "inherit", paddingBottom: 100 }}>

      {/* ══ TOP BAR ══ */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #dde1e8",
        padding: "0 20px", height: 56, display: "flex", alignItems: "center",
        justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: "#111" }}>🍽️ מלצר חכם</span>
          <span style={{
            background: "#f0f2f5", border: "1px solid #dde1e8",
            borderRadius: 20, fontSize: 12, fontWeight: 600, color: "#555", padding: "2px 10px",
          }}>{waiterName}</span>
          {restaurants.length > 1 && (
            <select
              value={restaurantId}
              onChange={e => { setRestaurantId(e.target.value); setTables([]); setInsights([]); lastInsightFetch.current = 0; }}
              style={{
                padding: "4px 8px", borderRadius: 8, border: "1px solid #dde1e8",
                background: "#f5f5f7", color: "#333", fontSize: 12, cursor: "pointer",
              }}
            >
              {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setAllInsightsOpen(true)}
            style={{
              background: "linear-gradient(135deg,#6c3fc5,#9b59e8)",
              color: "#fff", border: "none", borderRadius: 10,
              padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 5,
            }}
          >
            ✨ תובנות AI
            {insightLoading && <span style={{ fontSize: 10, opacity: 0.8 }}>...</span>}
          </button>
          <div style={{
            fontSize: 14, fontWeight: 600, color: "#333",
            background: "#f5f5f7", border: "1px solid #e0e0e0",
            borderRadius: 8, padding: "5px 11px",
          }}>{clock}</div>
        </div>
      </div>

      {/* ══ TABLE GRID ══ */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        gap: 16, padding: 20, direction: "rtl",
      }}>
        {loadingTables ? (
          <div style={{ gridColumn: "1/-1", textAlign: "center", color: "#888", padding: 40, fontSize: 15 }}>
            טוען שולחנות...
          </div>
        ) : tables.length === 0 ? (
          <div style={{ gridColumn: "1/-1", textAlign: "center", color: "#888", padding: 40, fontSize: 15 }}>
            אין פריסת שולחנות — הגדר פריסה בבונה הפריסה תחילה.
          </div>
        ) : tables.map(t => {
          const borderColor  = STATUS_BORDER[t.availStatus] ?? "#9ca3af";
          const tableInsights = insights.filter(i => i.tableNum === t.tableNum);
          const isWarn = t.availStatus === "occupied" && t.minutesSitting > 20;
          const statusBadgeBg   = ORDER_STATUS_COLOR[t.orderStatus ?? ""] ?? STATUS_BADGE_BG[t.availStatus];
          const statusBadgeText = t.availStatus === "occupied"
            ? (ORDER_STATUS_HE[t.orderStatus ?? ""] ?? STATUS_LABEL[t.availStatus])
            : STATUS_LABEL[t.availStatus];

          return (
            <div
              key={t.tableNum}
              onClick={() => setTableOverlay(t.tableNum)}
              style={{
                background: "#fff",
                border: "1.5px solid #e5e7eb",
                borderRight: `7px solid ${borderColor}`,
                borderRadius: 18,
                overflow: "hidden",
                cursor: "pointer",
                transition: "box-shadow 0.15s, transform 0.1s",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 24px rgba(0,0,0,0.12)";
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = "";
                (e.currentTarget as HTMLDivElement).style.transform = "";
              }}
            >
              {/* ── Card top ── */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 14px 6px", direction: "rtl" }}>
                {/* Right: table info */}
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: "#888" }}>שולחן</div>
                  <div style={{ fontSize: 38, fontWeight: 800, color: "#111", lineHeight: 1 }}>{t.tableNum}</div>
                  <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>
                    👤 {t.availStatus === "occupied" && t.guests > 0 ? `${t.guests} סועדים` : `${t.seats} מקומות`}
                  </div>
                </div>
                {/* Left: timer */}
                <div style={{ textAlign: "left", direction: "ltr" }}>
                  <div style={{
                    fontSize: 16, fontWeight: 400, color: isWarn ? "#ef4444" : "#111",
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {t.availStatus === "occupied" ? fmtTimer(t.sittingStart) : "--:--"}
                  </div>
                  <div style={{ fontSize: 10, color: "#aaa", marginTop: 1 }}>זמן ישיבה</div>
                </div>
              </div>

              {/* ── Divider ── */}
              <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "0 10px" }} />

              {/* ── Status row ── */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", direction: "rtl" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: statusBadgeBg, flexShrink: 0, display: "inline-block" }} />
                  <span style={{
                    background: statusBadgeBg, color: "#fff", border: "none",
                    borderRadius: 6, padding: "4px 9px", fontSize: 11, fontWeight: 700,
                  }}>{statusBadgeText}</span>
                </div>
                <div style={{ fontSize: 12, color: "#888" }}>
                  {t.availStatus === "occupied" && t.minutesSitting > 0 ? fmtAgo(t.minutesSitting) : "—"}
                </div>
              </div>

              {/* ── Divider ── */}
              <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "0 10px" }} />

              {/* ── AI row ── */}
              <div style={{ padding: "6px 14px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", direction: "rtl" }}>
                <button
                  onClick={e => { e.stopPropagation(); setTableOverlay(t.tableNum); }}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 5,
                    color: "#9b59e8", fontSize: 13, fontWeight: 600,
                    padding: "3px 5px", borderRadius: 7,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f3eeff")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                  <span style={{ fontSize: 18 }}>✨</span>
                  {tableInsights.length > 0 ? `${tableInsights.length} תובנות` : "תובנות AI"}
                </button>
                <span style={{ fontSize: 11, color: "#bbb" }}>לחץ לפרטים</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ══ ALL INSIGHTS OVERLAY ══ */}
      {allInsightsOpen && (
        <div
          onClick={() => setAllInsightsOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div onClick={e => e.stopPropagation()} style={{
            background: "#fff", borderRadius: 20, width: "90%", maxWidth: 520,
            maxHeight: "88vh", overflowY: "auto", direction: "rtl",
            boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          }}>
            <div style={{
              padding: "20px 22px 16px", borderBottom: "1px solid #e5e7eb",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              position: "sticky", top: 0, background: "#fff", borderRadius: "20px 20px 0 0", zIndex: 1,
            }}>
              <div style={{ fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                ✨ כל התובנות — כל השולחנות
              </div>
              <button onClick={() => setAllInsightsOpen(false)} style={{
                background: "#f0f2f5", border: "none", borderRadius: 8, width: 34, height: 34,
                fontSize: 18, cursor: "pointer", color: "#555",
              }}>✕</button>
            </div>
            <div style={{ padding: "16px 22px 22px" }}>
              {insights.length === 0 ? (
                <div style={{ textAlign: "center", color: "#aaa", fontSize: 14, padding: 30 }}>
                  {insightLoading ? "מנתח שולחנות..." : "אין תובנות זמינות כרגע"}
                </div>
              ) : (
                (() => {
                  const byTable = new Map<string, Insight[]>();
                  for (const ins of insights) {
                    if (!byTable.has(ins.tableNum)) byTable.set(ins.tableNum, []);
                    byTable.get(ins.tableNum)!.push(ins);
                  }
                  return Array.from(byTable.entries()).map(([num, ins], gi) => (
                    <div key={num}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#555", marginBottom: 8, marginTop: gi > 0 ? 18 : 0 }}>
                        שולחן {num}
                      </div>
                      {ins.map((i, j) => (
                        <InsightCard key={j} insight={i} />
                      ))}
                    </div>
                  ));
                })()
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ TABLE OVERLAY ══ */}
      {tableOverlay && overlayTable && (
        <div
          onClick={() => setTableOverlay(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div onClick={e => e.stopPropagation()} style={{
            background: "#fff", borderRadius: 20, width: "90%", maxWidth: 480,
            maxHeight: "88vh", overflowY: "auto", direction: "rtl",
            boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          }}>
            {/* Header */}
            <div style={{
              padding: "18px 22px 14px", borderBottom: "1px solid #e5e7eb",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              position: "sticky", top: 0, background: "#fff", borderRadius: "20px 20px 0 0", zIndex: 1,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22, fontWeight: 800 }}>שולחן {overlayTable.tableNum}</span>
                <span style={{
                  background: STATUS_BADGE_BG[overlayTable.availStatus], color: "#fff",
                  borderRadius: 8, padding: "3px 10px", fontSize: 12, fontWeight: 700,
                }}>{STATUS_LABEL[overlayTable.availStatus]}</span>
              </div>
              <button onClick={() => setTableOverlay(null)} style={{
                background: "#f0f2f5", border: "none", borderRadius: 8, width: 34, height: 34,
                fontSize: 18, cursor: "pointer", color: "#555",
              }}>✕</button>
            </div>

            <div style={{ padding: "16px 22px 22px" }}>
              {/* Details */}
              <div style={{ fontSize: 13, color: "#666", display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
                <span>👤 {overlayTable.guests > 0 ? `${overlayTable.guests} סועדים` : `${overlayTable.seats} מקומות`}</span>
                {overlayTable.minutesSitting > 0 && <span>⏱ {fmtAgo(overlayTable.minutesSitting)} ישיבה</span>}
                {overlayTable.orderStatus && <span>📋 {ORDER_STATUS_HE[overlayTable.orderStatus] ?? overlayTable.orderStatus}</span>}
              </div>

              {/* AI Insights */}
              {overlayInsights.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", marginBottom: 8 }}>✨ תובנות AI</div>
                  {overlayInsights.map((ins, i) => <InsightCard key={i} insight={ins} />)}
                </div>
              )}
              {overlayInsights.length === 0 && (
                <div style={{ fontSize: 13, color: "#aaa", marginBottom: 16 }}>אין תובנות לשולחן זה כרגע.</div>
              )}

              {/* Status override */}
              <div style={{ fontSize: 12, color: "#666", fontWeight: 700, marginBottom: 8 }}>שנה סטטוס:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(["free", "reserved", "inactive"] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => patchStatus(overlayTable.tableNum, s)}
                    style={{
                      padding: "7px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600,
                      border: `2px solid ${STATUS_BORDER[s]}`,
                      background: overlayTable.availStatus === s ? STATUS_BORDER[s] : "#fff",
                      color: overlayTable.availStatus === s ? "#fff" : STATUS_BORDER[s],
                      transition: "all 0.12s",
                    }}
                  >{STATUS_LABEL[s]}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ BOTTOM KPI BAR ══ */}
      <div style={{ position: "fixed", bottom: 0, right: 0, left: 0, background: "#fff", borderTop: "1px solid #dde1e8", zIndex: 100, direction: "rtl" }}>
        {/* Segment bar */}
        <div style={{ display: "flex", height: 3, overflow: "hidden" }}>
          <div style={{ flex: occupiedCount,  background: "#ef4444", transition: "flex 0.4s" }} />
          <div style={{ flex: reservedCount,  background: "#7c3aed", transition: "flex 0.4s" }} />
          <div style={{ flex: freeCount,      background: "#22c55e", transition: "flex 0.4s" }} />
          <div style={{ flex: Math.max(inactiveCount, 0.01), background: "#e5e7eb", transition: "flex 0.4s" }} />
        </div>

        {/* KPI row */}
        <div style={{ display: "flex", gap: 8, alignItems: "stretch", padding: "10px 16px", overflowX: "auto" }}>
          <KpiCard label="תפוס"  value={occupiedCount} color="#ef4444" bg="#fef2f2" />
          <KpiCard label="שמור"  value={reservedCount} color="#7c3aed" bg="#f5f0ff" />
          <KpiCard label="פנוי"  value={freeCount}     color="#22c55e" bg="#f0fdf4" />
          <KpiCard label="לא פעיל" value={inactiveCount} color="#9ca3af" bg="#f9fafb" />
          <div style={{ width: 1, background: "#e5e7eb", flexShrink: 0, alignSelf: "stretch", margin: "2px 4px" }} />
          <KpiCard label="סועדים" value={totalDiners} color="#3b82f6" bg="#eff6ff" />
          <KpiCard label="דורשים תשומת לב" value={alertsCount} color="#f59e0b" bg="#fffbeb" />
          <div style={{ width: 1, background: "#e5e7eb", flexShrink: 0, alignSelf: "stretch", margin: "2px 4px" }} />

          {/* Critical insight rotator */}
          {currentInsight && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 6px 0 12px", flex: 1, minWidth: 0 }}>
              <div style={{
                background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6,
                padding: "3px 10px", fontSize: 17, fontWeight: 700, color: "#dc2626",
                whiteSpace: "nowrap", flexShrink: 0,
                opacity: insightFade ? 1 : 0, transition: "opacity 0.4s",
              }}>
                {INSIGHT_ICON[currentInsight.type] ?? "⚠️"} שולחן {currentInsight.tableNum}
              </div>
              <div style={{
                fontSize: 17, color: "#374151", fontWeight: 500, lineHeight: 1.35,
                overflow: "hidden", display: "-webkit-box",
                WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
                opacity: insightFade ? 1 : 0, transition: "opacity 0.4s",
              }}>
                {currentInsight.text}
              </div>
            </div>
          )}
          {!currentInsight && insightLoading && (
            <div style={{ display: "flex", alignItems: "center", padding: "0 12px", color: "#aaa", fontSize: 13 }}>
              מנתח תובנות AI...
            </div>
          )}
          {!currentInsight && !insightLoading && tables.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", padding: "0 12px", color: "#ccc", fontSize: 13 }}>
              אין תובנות כרגע
            </div>
          )}
        </div>
      </div>

      {/* ══ TOAST ══ */}
      {toastMsg && (
        <div style={{
          position: "fixed", bottom: 100, right: "50%", transform: "translateX(50%)",
          background: "#1a2a1a", borderRadius: 8, padding: "10px 20px",
          color: "#4ade80", fontSize: 13, fontWeight: 600, zIndex: 600,
          boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
        }}>
          ✓ {toastMsg}
        </div>
      )}

      {/* suppress unused tick lint */}
      <span style={{ display: "none" }}>{tick}</span>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────
function KpiCard({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      borderRadius: 10, padding: "8px 14px", minWidth: 64,
      background: bg, borderTop: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, color, marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#888", whiteSpace: "nowrap" }}>{label}</div>
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const styles: Record<string, { bg: string; border: string; labelColor: string; label: string }> = {
    alert: { bg: "#fef2f2", border: "#fecaca", labelColor: "#dc2626", label: "⚠️ התראה" },
    tip:   { bg: "#fffbeb", border: "#fde68a", labelColor: "#b45309", label: "💡 עצה" },
    info:  { bg: "#eff6ff", border: "#bfdbfe", labelColor: "#1d4ed8", label: "ℹ️ מידע" },
  };
  const s = styles[insight.type] ?? styles.info;
  return (
    <div style={{
      borderRadius: 12, padding: "12px 14px", marginBottom: 10,
      background: s.bg, border: `1.5px solid ${s.border}`, direction: "rtl",
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: s.labelColor, marginBottom: 5 }}>{s.label}</div>
      <div style={{ fontSize: 14, color: "#1f2937", lineHeight: 1.55, fontWeight: 500 }}>{insight.text}</div>
    </div>
  );
}
