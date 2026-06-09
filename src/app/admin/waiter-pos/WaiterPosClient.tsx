"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { signOut } from "next-auth/react";

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
  totalAmount: number;
  orderCount: number;
  minutesSinceLastOrder: number;
};

type Insight = {
  tableNum: string;
  type: "alert" | "tip" | "info";
  text: string;
};

type LayoutTable = {
  num: number | string; name?: string; shape?: string;
  x: number; y: number; w: number; h: number; seats?: number; rot?: number;
};
type LayoutRoom = { id: string; name: string; tables: LayoutTable[]; bgImg?: string; bgOpacity?: number };
type LayoutV2 = { version: 2; rooms: LayoutRoom[] };

// ── Color maps ───────────────────────────────────────────────────────
const STATUS_BORDER: Record<string, string> = {
  occupied: "#ef4444", reserved: "#7c3aed", free: "#22c55e", inactive: "#9ca3af",
};
const STATUS_LABEL: Record<string, string> = {
  occupied: "תפוס", reserved: "שמור", free: "פנוי", inactive: "לא פעיל",
};
const STATUS_BADGE_BG: Record<string, string> = {
  occupied: "#ef4444", reserved: "#7c3aed", free: "#22c55e", inactive: "#9ca3af",
};
const ORDER_STATUS_HE: Record<string, string> = {
  PENDING: "ממתין", CONFIRMED: "הזמנה נלקחה", PREPARING: "מכין",
  READY: "מוכן!", DELIVERED: "הוגש", PAID: "שולם", CANCELLED: "בוטל",
};
const ORDER_STATUS_COLOR: Record<string, string> = {
  PENDING: "#22c55e", CONFIRMED: "#ef4444", PREPARING: "#3b82f6",
  READY: "#3b82f6", DELIVERED: "#f59e0b", PAID: "#9ca3af", CANCELLED: "#9ca3af",
};
const INSIGHT_TYPE_COLOR: Record<string, string> = {
  alert: "#ff4444", tip: "#fbbf24", info: "#22d3ee",
};
const INSIGHT_TYPE_DIM: Record<string, string> = {
  alert: "#ff9999", tip: "#fde68a", info: "#a5f3fc",
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

// ── Main ─────────────────────────────────────────────────────────────
export default function WaiterPosClient({ restaurants, waiterName, isWaiter = false, waiterId: _w }: {
  restaurants: Restaurant[]; waiterName: string; isWaiter?: boolean; waiterId?: string;
}) {
  const [restaurantId, setRestaurantId] = useState(() => {
    if (typeof window !== "undefined") {
      const s = localStorage.getItem(LS_REST_KEY);
      if (s && restaurants.some(r => r.id === s)) return s;
    }
    return restaurants[0]?.id ?? "";
  });

  const [tables, setTables]           = useState<TableData[]>([]);
  const [insights, setInsights]       = useState<Insight[]>([]);
  const [loadingTables, setLoading]   = useState(true);
  const [insightLoading, setILoading] = useState(false);
  const [tick, setTick]               = useState(0);
  const [insightIdx, setInsightIdx]   = useState(0);
  const [insightFade, setInsightFade] = useState(true);
  const [allInsightsOpen, setAllInsightsOpen] = useState(false);
  const [tableOverlay, setTableOverlay]       = useState<string | null>(null);
  const [toastMsg, setToastMsg]               = useState("");
  const [clock, setClock]                     = useState("");
  const [isMobile, setIsMobile]               = useState(false);
  const [isFullscreen, setIsFullscreen]       = useState(false);
  const [showFsBanner, setShowFsBanner]       = useState(false);
  const [viewMode, setViewMode]               = useState<"grid" | "floor">("grid");
  const [layout, setLayout]                   = useState<LayoutV2 | null>(null);
  const [roomIdx, setRoomIdx]                 = useState(0);
  const [refreshing, setRefreshing]           = useState(false);
  const [statusFilter, setStatusFilter]       = useState<Set<string>>(new Set());
  const [layoutRotation, setLayoutRotation]   = useState<0 | 90>(0);

  const floorRef = useRef<HTMLDivElement>(null);
  const [floorSize, setFloorSize] = useState({ w: 600, h: 400 });

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 640); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(!!document.fullscreenElement);
      if (document.fullscreenElement) setShowFsBanner(false);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    if (!isWaiter) return;
    const t = setTimeout(() => {
      if (!document.fullscreenElement)
        document.documentElement.requestFullscreen().catch(() => setShowFsBanner(true));
    }, 300);
    return () => clearTimeout(t);
  }, [isWaiter]);

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  }

  useEffect(() => {
    if (restaurantId) localStorage.setItem(LS_REST_KEY, restaurantId);
  }, [restaurantId]);

  // 1s ticker
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Clock
  useEffect(() => {
    function upd() {
      const n = new Date();
      setClock(`${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`);
    }
    upd(); const id = setInterval(upd, 1000); return () => clearInterval(id);
  }, []);

  // Floor container size
  useEffect(() => {
    if (!floorRef.current) return;
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setFloorSize({ w: width, h: height });
    });
    obs.observe(floorRef.current);
    return () => obs.disconnect();
  }, [viewMode]);

  // Fetch layout
  const fetchLayout = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const r = await fetch(`/api/admin/restaurants/${restaurantId}/layout`);
      if (r.ok) {
        const d = await r.json();
        // API returns { tableLayoutJson: string }
        const raw = d?.tableLayoutJson;
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        setLayout(parsed?.version === 2 ? parsed : null);
        setRoomIdx(0);
      }
    } catch { setLayout(null); }
  }, [restaurantId]);

  useEffect(() => { fetchLayout(); }, [fetchLayout]);

  // Fetch tables + insights together
  const fetchAll = useCallback(async (quiet = false) => {
    if (!restaurantId) return;
    if (!quiet) setLoading(true);
    try {
      const r = await fetch(`/api/admin/waiter-pos/tables?restaurantId=${restaurantId}`);
      if (r.ok) {
        const data: TableData[] = await r.json();
        setTables(data);
        // Fetch insights right after with fresh table data
        setILoading(true);
        fetch("/api/admin/waiter-pos/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ restaurantId, tables: data }),
        }).then(ir => ir.ok ? ir.json() : { insights: [] })
          .then(d => {
            setInsights(Array.isArray(d.insights) ? d.insights : []);
            setInsightIdx(0);
          })
          .finally(() => setILoading(false));
      }
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchAll();
    const id = setInterval(() => fetchAll(true), 15_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  // Manual refresh
  async function manualRefresh() {
    setRefreshing(true);
    await fetchAll(true);
    setRefreshing(false);
  }

  // Insight rotator every 10s
  useEffect(() => {
    if (insights.length <= 1) return;
    const id = setInterval(() => {
      setInsightFade(false);
      setTimeout(() => { setInsightIdx(i => (i + 1) % insights.length); setInsightFade(true); }, 400);
    }, 10_000);
    return () => clearInterval(id);
  }, [insights]);

  function showToast(msg: string) { setToastMsg(msg); setTimeout(() => setToastMsg(""), 3000); }

  async function patchStatus(tableNum: string, status: "reserved" | "inactive" | "free") {
    await fetch("/api/admin/waiter-pos/tables", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId, tableNum, status }),
    });
    setTableOverlay(null);
    showToast(`שולחן ${tableNum} עודכן`);
    fetchAll(true);
  }

  // ── KPIs
  const occupiedCount = tables.filter(t => t.availStatus === "occupied").length;
  const reservedCount = tables.filter(t => t.availStatus === "reserved").length;
  const freeCount     = tables.filter(t => t.availStatus === "free").length;
  const inactiveCount = tables.filter(t => t.availStatus === "inactive").length;
  const totalDiners   = tables.filter(t => t.availStatus === "occupied").reduce((s, t) => s + t.guests, 0);
  const alertsCount   = insights.filter(i => i.type === "alert").length;

  const occupiedTables = tables.filter(t => t.availStatus === "occupied");
  const avgSittingMin  = occupiedTables.length > 0 && occupiedTables.some(t => t.minutesSitting > 0)
    ? Math.round(occupiedTables.filter(t => t.minutesSitting > 0).reduce((s, t) => s + t.minutesSitting, 0) /
        occupiedTables.filter(t => t.minutesSitting > 0).length)
    : 0;
  const tablesWithCost = occupiedTables.filter(t => t.totalAmount > 0);
  const avgCost        = tablesWithCost.length > 0
    ? Math.round(tablesWithCost.reduce((s, t) => s + t.totalAmount, 0) / tablesWithCost.length)
    : 0;

  const currentInsight = insights[insightIdx] ?? null;
  const overlayTable   = tables.find(t => t.tableNum === tableOverlay) ?? null;
  const overlayInsights = insights.filter(i => i.tableNum === tableOverlay);

  // ── Status filter
  const filteredTables = useMemo(() =>
    statusFilter.size === 0 ? tables : tables.filter(t => statusFilter.has(t.availStatus)),
  [tables, statusFilter]);

  function toggleFilter(s: string) {
    setStatusFilter(prev => {
      const n = new Set(prev);
      n.has(s) ? n.delete(s) : n.add(s);
      return n;
    });
  }

  // ── Floor map scale + rotation
  const activeRoom = layout?.rooms[roomIdx];

  const rotatedFloor = useMemo(() => {
    if (!activeRoom?.tables.length) return { tables: [], maxX: 0, maxY: 0 };
    const origMaxY = Math.max(...activeRoom.tables.map(t => t.y + t.h));
    const origMaxX = Math.max(...activeRoom.tables.map(t => t.x + t.w));
    if (layoutRotation === 0) {
      return { tables: activeRoom.tables, maxX: origMaxX, maxY: origMaxY };
    }
    // 90° clockwise: x' = origMaxY - (y+h), y' = x, w' = h, h' = w
    const rotated = activeRoom.tables.map(lt => ({
      ...lt,
      x: origMaxY - (lt.y + lt.h),
      y: lt.x,
      w: lt.h,
      h: lt.w,
    }));
    const newMaxX = Math.max(...rotated.map(t => t.x + t.w));
    const newMaxY = Math.max(...rotated.map(t => t.y + t.h));
    return { tables: rotated, maxX: newMaxX, maxY: newMaxY };
  }, [activeRoom, layoutRotation]);

  const { floorScale, floorOffsetX, floorOffsetY } = useMemo(() => {
    if (!rotatedFloor.maxX || !rotatedFloor.maxY || !floorSize.w || !floorSize.h)
      return { floorScale: 1, floorOffsetX: 0, floorOffsetY: 0 };
    const scale = Math.min(floorSize.w / rotatedFloor.maxX, floorSize.h / rotatedFloor.maxY);
    // center the layout in the canvas
    const offsetX = Math.max(0, (floorSize.w - rotatedFloor.maxX * scale) / 2);
    const offsetY = Math.max(0, (floorSize.h - rotatedFloor.maxY * scale) / 2);
    return { floorScale: scale, floorOffsetX: offsetX, floorOffsetY: offsetY };
  }, [rotatedFloor, floorSize]);

  void tick;

  return (
    <div dir="rtl" style={{
      ...(isWaiter ? { position: "fixed" as const, inset: 0, zIndex: 400 } : { minHeight: "calc(100vh - 64px)" }),
      background: "#f0f2f5", color: "#111", fontFamily: "inherit",
      overflowY: viewMode === "floor" ? "hidden" : "auto",
      paddingBottom: viewMode === "floor" ? 0 : 110,
      display: "flex", flexDirection: "column",
    }}>

      {/* ══ TOP BAR ══ */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #dde1e8",
        padding: "0 16px", height: 56, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: "#111" }}>🍽️ מלצר חכם</span>
          <span style={{
            background: "#f0f2f5", border: "1px solid #dde1e8",
            borderRadius: 20, fontSize: 12, fontWeight: 600, color: "#555", padding: "2px 10px",
          }}>{waiterName}</span>
          {restaurants.length > 1 && (
            <select value={restaurantId}
              onChange={e => { setRestaurantId(e.target.value); setTables([]); setInsights([]); }}
              style={{ padding: "4px 8px", borderRadius: 8, border: "1px solid #dde1e8", background: "#f5f5f7", color: "#333", fontSize: 12 }}>
              {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setAllInsightsOpen(true)} style={{
            background: "linear-gradient(135deg,#6c3fc5,#9b59e8)",
            color: "#fff", border: "none", borderRadius: 10,
            padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 4,
          }}>
            ✨{!isMobile && " תובנות"}
            {insightLoading && <span style={{ fontSize: 10 }}>…</span>}
          </button>

          <div style={{
            fontSize: 14, fontWeight: 600, color: "#333",
            background: "#f5f5f7", border: "1px solid #e0e0e0",
            borderRadius: 8, padding: "5px 10px",
          }}>{clock}</div>

          <button onClick={toggleFullscreen} title={isFullscreen ? "צא ממסך מלא" : "מסך מלא"} style={{
            background: "#f5f5f7", border: "1px solid #e0e0e0", borderRadius: 8,
            padding: "6px 9px", fontSize: 15, cursor: "pointer", color: "#555", display: "flex", alignItems: "center",
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {isFullscreen
                ? <><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></>
                : <><path d="M3 7V3h4"/><path d="M21 7V3h-4"/><path d="M3 17v4h4"/><path d="M21 17v4h-4"/></>
              }
            </svg>
          </button>

          <button onClick={() => signOut({ callbackUrl: "/login" })} style={{
            background: "#fef2f2", border: "1px solid #fecaca",
            borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 600,
            color: "#dc2626", cursor: "pointer",
          }}>
            ⬅{!isMobile && " יציאה"}
          </button>
        </div>
      </div>

      {/* Fullscreen banner */}
      {showFsBanner && (
        <div style={{ background: "#1d4ed8", color: "#fff", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>💡 למיטב החוויה — כנס למסך מלא</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { toggleFullscreen(); setShowFsBanner(false); }}
              style={{ background: "#fff", color: "#1d4ed8", border: "none", borderRadius: 8, padding: "6px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              מסך מלא
            </button>
            <button onClick={() => setShowFsBanner(false)}
              style={{ background: "transparent", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>
              לא עכשיו
            </button>
          </div>
        </div>
      )}

      {/* ══ FILTER + VIEW BAR ══ */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #dde1e8",
        padding: "6px 14px", display: "flex", alignItems: "center",
        gap: 8, flexShrink: 0, flexWrap: "wrap",
        position: "sticky", top: 56, zIndex: 99,
      }}>
        {/* View toggle */}
        <div style={{ display: "flex", background: "#f0f2f5", borderRadius: 8, border: "1px solid #dde1e8", overflow: "hidden", flexShrink: 0 }}>
          {(["grid", "floor"] as const).map(m => (
            <button key={m} onClick={() => setViewMode(m)} style={{
              padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
              border: "none", background: viewMode === m ? "#111" : "transparent",
              color: viewMode === m ? "#fff" : "#888",
              transition: "all 0.15s",
            }}>
              {m === "grid" ? "📋 כרטיסים" : "🗺️ לייאוט"}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 22, background: "#dde1e8", flexShrink: 0 }} />

        {/* Status filter pills */}
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {(["occupied","reserved","free","inactive"] as const).map(s => {
            const active = statusFilter.has(s);
            return (
              <button key={s} onClick={() => toggleFilter(s)} style={{
                padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                cursor: "pointer", border: `2px solid ${STATUS_BORDER[s]}`,
                background: active ? STATUS_BORDER[s] : "transparent",
                color: active ? "#fff" : STATUS_BORDER[s],
                transition: "all 0.15s",
              }}>
                {STATUS_LABEL[s]}
              </button>
            );
          })}
          {statusFilter.size > 0 && (
            <button onClick={() => setStatusFilter(new Set())} style={{
              padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
              cursor: "pointer", border: "1px solid #dde1e8",
              background: "transparent", color: "#888",
            }}>✕ הכל</button>
          )}
        </div>

        {/* Rotate button — floor only */}
        {viewMode === "floor" && (
          <>
            <div style={{ width: 1, height: 22, background: "#dde1e8", flexShrink: 0 }} />
            <button onClick={() => setLayoutRotation(r => r === 0 ? 90 : 0)} title="סובב לייאוט 90°" style={{
              padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              cursor: "pointer", border: "1px solid #dde1e8",
              background: layoutRotation !== 0 ? "#111" : "#f5f5f7",
              color: layoutRotation !== 0 ? "#fff" : "#555",
              display: "flex", alignItems: "center", gap: 4,
              transition: "all 0.15s",
            }}>
              🔄 {layoutRotation === 0 ? "סובב" : "אנכי"}
            </button>
          </>
        )}

        {/* Room tabs — floor only */}
        {viewMode === "floor" && layout && layout.rooms.length > 1 && (
          <>
            <div style={{ width: 1, height: 22, background: "#dde1e8", flexShrink: 0 }} />
            {layout.rooms.map((room, i) => (
              <button key={room.id} onClick={() => setRoomIdx(i)} style={{
                padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: "pointer", border: "1px solid #dde1e8",
                background: roomIdx === i ? "#333" : "#f5f5f7",
                color: roomIdx === i ? "#fff" : "#555",
              }}>
                {room.name}
              </button>
            ))}
          </>
        )}
      </div>

      {/* ══ GRID VIEW ══ */}
      {viewMode === "grid" && (
        <div style={{ flex: 1, overflowY: "auto" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 140 : 160}px, 1fr))`,
            gap: 10, padding: 12,
          }}>
            {loadingTables ? (
              <div style={{ gridColumn: "1/-1", textAlign: "center", color: "#888", padding: 40 }}>טוען שולחנות...</div>
            ) : filteredTables.length === 0 ? (
              <div style={{ gridColumn: "1/-1", textAlign: "center", color: "#888", padding: 40 }}>
                {tables.length === 0 ? "אין פריסת שולחנות — הגדר פריסה בבונה הפריסה תחילה." : "אין שולחנות בסינון זה"}
              </div>
            ) : filteredTables.map(t => {
              const borderColor    = STATUS_BORDER[t.availStatus] ?? "#9ca3af";
              const tableInsights  = insights.filter(i => i.tableNum === t.tableNum);
              const isWarn         = t.availStatus === "occupied" && t.minutesSitting > 20;
              const statusBadgeBg  = ORDER_STATUS_COLOR[t.orderStatus ?? ""] ?? STATUS_BADGE_BG[t.availStatus];
              const statusBadgeText = t.availStatus === "occupied"
                ? (ORDER_STATUS_HE[t.orderStatus ?? ""] ?? STATUS_LABEL[t.availStatus])
                : STATUS_LABEL[t.availStatus];

              return (
                <div key={t.tableNum} onClick={() => setTableOverlay(t.tableNum)}
                  style={{
                    background: "#fff", border: "1.5px solid #e5e7eb",
                    borderRight: `7px solid ${borderColor}`,
                    borderRadius: 18, overflow: "hidden", cursor: "pointer",
                    transition: "box-shadow 0.15s, transform 0.1s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 24px rgba(0,0,0,0.12)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = ""; (e.currentTarget as HTMLDivElement).style.transform = ""; }}
                >
                  {/* Card top */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "8px 10px 6px" }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10, fontWeight: 500, color: "#888" }}>שולחן</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: "#111", lineHeight: 1 }}>{t.tableNum}</div>
                      <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
                        👤 {t.availStatus === "occupied" && t.guests > 0 ? `${t.guests} סועדים` : `${t.seats} מקומות`}
                      </div>
                    </div>
                    <div style={{ textAlign: "left", direction: "ltr" }}>
                      <div style={{ fontSize: 13, fontWeight: 400, color: isWarn ? "#ef4444" : "#111", fontVariantNumeric: "tabular-nums" }}>
                        {t.availStatus === "occupied" ? fmtTimer(t.sittingStart) : "--:--"}
                      </div>
                      <div style={{ fontSize: 9, color: "#aaa", marginTop: 1 }}>זמן ישיבה</div>
                    </div>
                  </div>

                  {/* Status row — no dot, no HR */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 10px 6px" }}>
                    <span style={{
                      background: statusBadgeBg, color: "#fff",
                      borderRadius: 5, padding: "3px 8px", fontSize: 10, fontWeight: 700,
                    }}>{statusBadgeText}</span>
                    <div style={{ fontSize: 10, color: "#888" }}>
                      {t.availStatus === "occupied" && t.minutesSitting > 0 ? fmtAgo(t.minutesSitting) : "—"}
                    </div>
                  </div>

                  {/* AI row — only if there are insights for this table */}
                  {tableInsights.length > 0 && (
                    <div style={{ padding: "4px 10px 7px", borderTop: "1px solid #f0f2f5" }}>
                      <button
                        onClick={e => { e.stopPropagation(); setTableOverlay(t.tableNum); }}
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          display: "flex", alignItems: "center", gap: 4,
                          color: "#9b59e8", fontSize: 11, fontWeight: 600, padding: "2px 4px", borderRadius: 6,
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#f3eeff")}
                        onMouseLeave={e => (e.currentTarget.style.background = "none")}
                      >
                        <span style={{ fontSize: 13 }}>✨</span>
                        {tableInsights.length} תובנות
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ FLOOR VIEW ══ */}
      {viewMode === "floor" && (
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", paddingBottom: isMobile ? 96 : 120 }}>
          <div ref={floorRef} style={{ flex: 1, position: "relative", overflow: "hidden", background: "#e8eaf0" }}>
            {!layout ? (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#888", fontSize: 14 }}>
                אין פריסת שולחנות — הגדר פריסה בבונה הפריסה
              </div>
            ) : rotatedFloor.tables.map(lt => {
              const tNum      = String(lt.num);
              const tData     = tables.find(t => t.tableNum === tNum);
              const status    = tData?.availStatus ?? "free";
              // apply status filter
              if (statusFilter.size > 0 && !statusFilter.has(status)) return null;
              const color     = STATUS_BORDER[status];
              const isRound   = lt.shape === "round" || lt.shape === "oval";
              const tInsights = insights.filter(i => i.tableNum === tNum);
              const topIns    = tInsights[0];
              const isWarn    = status === "occupied" && (tData?.minutesSitting ?? 0) > 20;

              const W = lt.w * floorScale;
              const H = lt.h * floorScale;
              const numFs   = Math.max(10, Math.min(H * 0.3, 24));
              const infoFs  = Math.max(8, Math.min(H * 0.16, 12));
              const badgeFs = Math.max(7, Math.min(H * 0.14, 11));
              const showInfo  = W > 58 && H > 52;
              const showBadge = W > 68 && H > 64;

              const statusBadgeBg   = ORDER_STATUS_COLOR[tData?.orderStatus ?? ""] ?? STATUS_BADGE_BG[status];
              const statusBadgeText = status === "occupied"
                ? (ORDER_STATUS_HE[tData?.orderStatus ?? ""] ?? STATUS_LABEL[status])
                : STATUS_LABEL[status];

              return (
                <div key={`${lt.num}-${layoutRotation}`} onClick={() => setTableOverlay(tNum)}
                  style={{
                    position: "absolute",
                    left: lt.x * floorScale + floorOffsetX,
                    top:  lt.y * floorScale + floorOffsetY,
                    width: W, height: H,
                    borderRadius: isRound ? "50%" : lt.shape === "banquet" ? 12 : 6,
                    background: status === "occupied" ? color + "18" : color + "12",
                    border: `2.5px solid ${color}`,
                    cursor: "pointer",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    padding: "3px 4px",
                    gap: 1,
                    overflow: "hidden",
                    boxSizing: "border-box",
                    transition: "box-shadow 0.12s",
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 18px ${color}55`}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = ""}
                >
                  {/* Table number */}
                  <span style={{ fontSize: numFs, fontWeight: 800, color: "#111", lineHeight: 1 }}>{tNum}</span>

                  {/* Timer + guests */}
                  {showInfo && status === "occupied" && tData && (
                    <span style={{ fontSize: infoFs, fontWeight: 500, color: isWarn ? "#ef4444" : "#555", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                      {fmtTimer(tData.sittingStart)}
                    </span>
                  )}
                  {showInfo && status === "occupied" && tData && tData.guests > 0 && (
                    <span style={{ fontSize: infoFs, color: "#666", lineHeight: 1 }}>👤{tData.guests}</span>
                  )}
                  {showInfo && status !== "occupied" && (
                    <span style={{ fontSize: infoFs, color: "#888", lineHeight: 1 }}>
                      {lt.seats ?? tData?.seats ?? ""}מק'
                    </span>
                  )}

                  {/* Status / order badge */}
                  {showBadge && (
                    <span style={{
                      background: statusBadgeBg, color: "#fff",
                      borderRadius: 4, padding: "1px 5px",
                      fontSize: badgeFs, fontWeight: 700, lineHeight: 1.3,
                      maxWidth: "90%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {statusBadgeText}
                    </span>
                  )}

                  {/* Insight icon */}
                  {topIns && (
                    <span style={{ fontSize: Math.max(9, infoFs), lineHeight: 1 }}>
                      {topIns.type === "alert" ? "⚠️" : topIns.type === "tip" ? "💡" : "ℹ️"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ ALL INSIGHTS OVERLAY ══ */}
      {allInsightsOpen && (
        <div onClick={() => setAllInsightsOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#fff", borderRadius: 20, width: "90%", maxWidth: 520,
            maxHeight: "88vh", overflowY: "auto", direction: "rtl",
            boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          }}>
            <div style={{ padding: "20px 22px 16px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#fff", borderRadius: "20px 20px 0 0", zIndex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>✨ כל התובנות</div>
              <button onClick={() => setAllInsightsOpen(false)} style={{ background: "#f0f2f5", border: "none", borderRadius: 8, width: 34, height: 34, fontSize: 18, cursor: "pointer", color: "#555" }}>✕</button>
            </div>
            <div style={{ padding: "16px 22px 22px" }}>
              {insights.length === 0 ? (
                <div style={{ textAlign: "center", color: "#aaa", fontSize: 14, padding: 30 }}>
                  {insightLoading ? "מנתח שולחנות..." : "אין תובנות זמינות כרגע"}
                </div>
              ) : insights.map((ins, i) => <InsightCard key={i} insight={ins} />)}
            </div>
          </div>
        </div>
      )}

      {/* ══ TABLE OVERLAY ══ */}
      {tableOverlay && overlayTable && (
        <div onClick={() => setTableOverlay(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#fff", borderRadius: 20, width: "90%", maxWidth: 480,
            maxHeight: "88vh", overflowY: "auto", direction: "rtl",
            boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          }}>
            <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#fff", borderRadius: "20px 20px 0 0", zIndex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22, fontWeight: 800 }}>שולחן {overlayTable.tableNum}</span>
                <span style={{ background: STATUS_BADGE_BG[overlayTable.availStatus], color: "#fff", borderRadius: 8, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>
                  {STATUS_LABEL[overlayTable.availStatus]}
                </span>
              </div>
              <button onClick={() => setTableOverlay(null)} style={{ background: "#f0f2f5", border: "none", borderRadius: 8, width: 34, height: 34, fontSize: 18, cursor: "pointer", color: "#555" }}>✕</button>
            </div>
            <div style={{ padding: "16px 22px 22px" }}>
              <div style={{ fontSize: 13, color: "#666", display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
                <span>👤 {overlayTable.guests > 0 ? `${overlayTable.guests} סועדים` : `${overlayTable.seats} מקומות`}</span>
                {overlayTable.minutesSitting > 0 && <span>⏱ {fmtAgo(overlayTable.minutesSitting)} ישיבה</span>}
                {overlayTable.orderStatus && <span>📋 {ORDER_STATUS_HE[overlayTable.orderStatus] ?? overlayTable.orderStatus}</span>}
              </div>
              {overlayInsights.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", marginBottom: 8 }}>✨ תובנות AI</div>
                  {overlayInsights.map((ins, i) => <InsightCard key={i} insight={ins} />)}
                </div>
              )}
              {overlayInsights.length === 0 && (
                <div style={{ fontSize: 13, color: "#aaa", marginBottom: 16 }}>אין תובנות לשולחן זה כרגע.</div>
              )}
              <div style={{ fontSize: 12, color: "#666", fontWeight: 700, marginBottom: 8 }}>שנה סטטוס:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(["free", "reserved", "inactive"] as const).map(s => (
                  <button key={s} onClick={() => patchStatus(overlayTable.tableNum, s)} style={{
                    padding: "7px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600,
                    border: `2px solid ${STATUS_BORDER[s]}`,
                    background: overlayTable.availStatus === s ? STATUS_BORDER[s] : "#fff",
                    color: overlayTable.availStatus === s ? "#fff" : STATUS_BORDER[s],
                    transition: "all 0.12s",
                  }}>{STATUS_LABEL[s]}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ BOTTOM KPI BAR ══ */}
      <div style={{ position: "fixed", bottom: 0, right: 0, left: 0, background: "#fff", borderTop: "1px solid #dde1e8", zIndex: 450, direction: "rtl" }}>

        {/* Segment bar */}
        <div style={{ display: "flex", height: 3, overflow: "hidden" }}>
          <div style={{ flex: occupiedCount,                   background: "#ef4444", transition: "flex 0.4s" }} />
          <div style={{ flex: reservedCount,                   background: "#7c3aed", transition: "flex 0.4s" }} />
          <div style={{ flex: freeCount,                       background: "#22c55e", transition: "flex 0.4s" }} />
          <div style={{ flex: Math.max(inactiveCount, 0.01),   background: "#e5e7eb", transition: "flex 0.4s" }} />
        </div>

        {/* KPI row + refresh button */}
        <div style={{
          display: "flex", gap: isMobile ? 5 : 8, alignItems: "stretch",
          padding: isMobile ? "5px 8px" : "8px 14px",
          overflowX: "auto",
        }}>
          <KpiCard label="תפוס"    value={occupiedCount} color="#ef4444" bg="#fef2f2" small={isMobile} />
          <KpiCard label="שמור"    value={reservedCount} color="#7c3aed" bg="#f5f0ff" small={isMobile} />
          <KpiCard label="פנוי"    value={freeCount}     color="#22c55e" bg="#f0fdf4" small={isMobile} />
          <KpiCard label="לא פעיל" value={inactiveCount} color="#9ca3af" bg="#f9fafb" small={isMobile} />
          <div style={{ width: 1, background: "#e5e7eb", flexShrink: 0, alignSelf: "stretch", margin: "2px 4px" }} />
          <KpiCard label="סועדים"          value={totalDiners} color="#3b82f6" bg="#eff6ff" small={isMobile} />
          <KpiCard label="דורשים תשומת לב" value={alertsCount} color="#f59e0b" bg="#fffbeb" small={isMobile} />
          <KpiCard label="זמן ממוצע"   value={avgSittingMin > 0 ? fmtAgo(avgSittingMin) : "—"} color="#6366f1" bg="#eef2ff" small={isMobile} />
          <KpiCard label="עלות ממוצעת" value={avgCost > 0 ? `₪${avgCost}` : "—"}             color="#059669" bg="#ecfdf5" small={isMobile} />
          {/* Refresh — far left (last in RTL row) */}
          <button onClick={manualRefresh} title="רענן נתונים" style={{
            marginRight: "auto",
            background: "#f5f5f7", border: "1px solid #dde1e8",
            borderRadius: 8, width: isMobile ? 32 : 38, height: isMobile ? 32 : 38,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0, alignSelf: "center",
            transition: "all 0.15s",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={refreshing ? "#3b82f6" : "#666"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transition: "stroke 0.2s", animation: refreshing ? "spin 0.7s linear infinite" : "none" }}>
              <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
          </button>
        </div>

        {/* Insight ticker — black, very bottom */}
        <div style={{
          background: "#0d0d0d",
          padding: isMobile ? "8px 12px" : "10px 20px",
          display: "flex", alignItems: "center", gap: 8,
          minHeight: isMobile ? 44 : 52,
          opacity: insightFade ? 1 : 0, transition: "opacity 0.4s",
        }}>
          {currentInsight ? (
            <>
              <span style={{ fontSize: isMobile ? 18 : 22, flexShrink: 0 }}>
                {currentInsight.type === "alert" ? "⚠️" : currentInsight.type === "tip" ? "💡" : "ℹ️"}
              </span>
              <span style={{
                fontSize: isMobile ? 16 : 18, fontWeight: 800,
                color: INSIGHT_TYPE_COLOR[currentInsight.type],
                whiteSpace: "nowrap", flexShrink: 0, letterSpacing: "0.01em",
              }}>
                שולחן {currentInsight.tableNum}:
              </span>
              <span style={{
                fontSize: isMobile ? 15 : 17, fontWeight: 600,
                color: INSIGHT_TYPE_DIM[currentInsight.type],
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
              }}>
                {currentInsight.text.replace(new RegExp(`^שולחן ${currentInsight.tableNum}[^—]*—\\s*`), "")}
              </span>
              {insights.length > 1 && (
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", flexShrink: 0 }}>
                  {insightIdx + 1}/{insights.length}
                </span>
              )}
            </>
          ) : (
            <span style={{ fontSize: isMobile ? 12 : 13, color: "rgba(255,255,255,0.3)", letterSpacing: "0.03em" }}>
              {insightLoading ? "✨  מנתח נתונים..." : "✨  אין תובנות כרגע"}
            </span>
          )}
        </div>
      </div>

      {/* Spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Toast */}
      {toastMsg && (
        <div style={{ position: "fixed", bottom: 110, right: "50%", transform: "translateX(50%)", background: "#1a2a1a", borderRadius: 8, padding: "10px 20px", color: "#4ade80", fontSize: 13, fontWeight: 600, zIndex: 600, boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}>
          ✓ {toastMsg}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────
function KpiCard({ label, value, color, bg, small }: { label: string; value: number | string; color: string; bg: string; small?: boolean }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      borderRadius: small ? 8 : 10, padding: small ? "4px 8px" : "6px 12px",
      minWidth: small ? 44 : 62, background: bg, borderTop: `${small ? 2 : 3}px solid ${color}`,
    }}>
      <div style={{ fontSize: typeof value === "string" ? (small ? 12 : 14) : (small ? 16 : 20), fontWeight: 800, lineHeight: 1, color, marginBottom: 2, whiteSpace: "nowrap" }}>{value}</div>
      <div style={{ fontSize: small ? 9 : 10, fontWeight: 600, color: "#888", whiteSpace: "nowrap" }}>{label}</div>
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
    <div style={{ borderRadius: 12, padding: "12px 14px", marginBottom: 10, background: s.bg, border: `1.5px solid ${s.border}`, direction: "rtl" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: s.labelColor, marginBottom: 5 }}>{s.label}</div>
      <div style={{ fontSize: 14, color: "#1f2937", lineHeight: 1.55, fontWeight: 500 }}>{insight.text}</div>
    </div>
  );
}
