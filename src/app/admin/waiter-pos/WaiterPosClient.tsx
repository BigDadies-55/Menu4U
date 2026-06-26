"use client";

import React, { useState, useEffect, useRef } from "react";
import AttendanceWidget from "@/components/attendance/AttendanceWidget";
import { signOut } from "next-auth/react";
import { TableOverlay } from "./TableOverlay";
import { OrderScreen } from "./OrderScreen";
import Receipt from "./Receipt";
import SelfSignoffModal from "./SelfSignoffModal";
import ChangePasswordModal from "./ChangePasswordModal";
import FloorLayout from "./FloorLayout";
import { useOutbox } from "@/hooks/useOutbox";
import {
  useWaiterPos,
  type Restaurant, type Insight,
  STATUS_LABEL, STATUS_BADGE_BG, STATUS_BADGE_TEXT,
  ORDER_STATUS_HE, ORDER_STATUS_COLOR, ORDER_STATUS_TEXT_COLOR,
  fmtTimer,
} from "./useWaiterPos";

// ── Glass design tokens ───────────────────────────────────────────────
const G_CARD       = "rgba(255,255,255,0.08)";
const G_CARD_HOVER = "rgba(255,255,255,0.14)";
const G_BORDER_C   = "rgba(255,255,255,0.15)";
const G_MUTED_C    = "rgba(255,255,255,0.6)";

const STATUS_NUM_COLOR: Record<string, string> = {
  occupied: "#EF4444", reserved: "#3B82F6", free: "#10B981",
  inactive: "rgba(255,255,255,0.55)", bill_requested: "#F97316", paid: "#34d399",
};
const STATUS_NUM_GLOW: Record<string, string> = {
  occupied: "rgba(239,68,68,0.45)", reserved: "rgba(59,130,246,0.45)", free: "rgba(16,185,129,0.45)",
  inactive: "transparent", bill_requested: "rgba(249,115,22,0.45)", paid: "rgba(52,211,153,0.45)",
};

function todayKey() {
  const n = new Date();
  return `m4u_clock_prompt_${n.getFullYear()}-${n.getMonth() + 1}-${n.getDate()}`;
}

function shiftLabel() {
  const h = new Date().getHours();
  if (h < 6) return "משמרת לילה";
  if (h < 12) return "משמרת בוקר";
  if (h < 17) return "משמרת צהריים";
  if (h < 22) return "משמרת ערב";
  return "משמרת לילה";
}

// ── Main ─────────────────────────────────────────────────────────────
export default function WaiterPosClient({ restaurants, waiterName, isWaiter = false, waiterId }: {
  restaurants: Restaurant[]; waiterName: string; isWaiter?: boolean; waiterId?: string;
}) {
  const {
    restaurantId, setRestaurantId,
    tables, insights, visibleInsights,
    loadingTables, insightLoading,
    allInsightsOpen, setAllInsightsOpen,
    tableOverlay, setTableOverlay,
    toastMsg, showToast,
    receiptData, setReceiptData,
    clock, isMobile,
    isFullscreen,
    viewMode, setViewMode,
    layout, roomIdx, setRoomIdx,
    myTableNums,
    layoutRotation, setLayoutRotation,
    notifications, setNotifications,
    notifOpen, setNotifOpen,
    isOffline, offlineSince, usingCachedData,
    orderScreenData, setOrderScreenData,
    showInstallBanner, setShowInstallBanner,
    isIos, isStandalone,
    unreadCount, overlayTable, overlayInsights,
    filteredTables,
    fetchAll, refreshing,
    quickFireCourse, patchStatus,
    toggleFullscreen, triggerInstall,
    snoozeInsight,
  } = useWaiterPos({ restaurants, waiterName, isWaiter });

  // ── Offline outbox — durable, ordered, idempotent replay of all queued actions ──
  const { pendingCount, isSyncing, enqueue } = useOutbox(results => {
    const ok = results.filter(r => r.ok).length;
    if (ok > 0) { showToast(`${ok} פעולות סונכרנו ✓`); fetchAll(true); }
  });

  // ── Local UI state for the redesigned shell ──
  const [menuOpen, setMenuOpen]         = useState(false);
  const [signoffOpen, setSignoffOpen]   = useState(false);
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [attSignal, setAttSignal]       = useState(0);
  const [clockPrompt, setClockPrompt]   = useState(false);
  const [logoutPrompt, setLogoutPrompt] = useState(false);
  const [alertToast, setAlertToast]     = useState<string | null>(null);
  const prevAlertKeys = useRef<Set<string>>(new Set());
  const [shift, setShift] = useState<{ revenue: number; diners: number; avgPerDiner: number } | null>(null);
  const [statusMenu, setStatusMenu] = useState<{ tableNum: string; x: number; y: number } | null>(null);

  const activeRestaurant = restaurants.find(r => r.id === restaurantId);
  const [bgUrl, setBgUrl] = useState(
    activeRestaurant?.waiterBg ?? "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=2070"
  );
  const [bgOpacity, setBgOpacity] = useState(
    Math.max(0, Math.min(1, Number(activeRestaurant?.waiterBgOpacity ?? 0)))
  );

  useEffect(() => {
    if (!restaurantId) return;
    fetch(`/api/admin/waiter-pos/bg-settings?restaurantId=${restaurantId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        if (d.waiterBg != null) setBgUrl(d.waiterBg);
        if (d.waiterBgOpacity != null) setBgOpacity(Math.max(0, Math.min(1, Number(d.waiterBgOpacity))));
      })
      .catch(() => {});
  }, [restaurantId]);

  // First-entry clock reminder — once per day per device.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(todayKey())) setClockPrompt(true);
  }, []);

  // Shift totals (today) — revenue, diners, avg per diner.
  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    const load = () => fetch(`/api/admin/waiter-pos/shift-stats?restaurantId=${restaurantId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && !cancelled) setShift(d); })
      .catch(() => {});
    load();
    const id = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [restaurantId, tables]);

  function answerClockPrompt(reported: boolean) {
    try { localStorage.setItem(todayKey(), "1"); } catch { /* ignore */ }
    setClockPrompt(false);
    if (!reported) setAttSignal(s => s + 1); // open attendance report
  }

  // Surface a floating toast whenever a NEW critical (alert) insight appears.
  useEffect(() => {
    const alerts = visibleInsights.filter(i => i.type === "alert");
    const seen = prevAlertKeys.current;
    const fresh = alerts.find(a => !seen.has(`${a.tableNum}|${a.text}`));
    if (fresh) {
      setAlertToast(`שולחן ${fresh.tableNum} — ${fresh.text.replace(new RegExp(`^שולחן ${fresh.tableNum}[^—]*—\\s*`), "")}`);
      const t = setTimeout(() => setAlertToast(null), 7000);
      prevAlertKeys.current = new Set(alerts.map(a => `${a.tableNum}|${a.text}`));
      return () => clearTimeout(t);
    }
    prevAlertKeys.current = new Set(alerts.map(a => `${a.tableNum}|${a.text}`));
  }, [visibleInsights]);

  const insightCount = visibleInsights.length;

  // ── Menu action helpers ──
  function runMenu(fn: () => void) { setMenuOpen(false); fn(); }

  const menuItems: { icon: string; label: string; badge?: number; onClick: () => void; danger?: boolean }[] = [
    { icon: "⏱", label: "דיווח נוכחות", onClick: () => runMenu(() => setAttSignal(s => s + 1)) },
    { icon: "📝", label: "אישור נוכחות", onClick: () => runMenu(() => setSignoffOpen(true)) },
    { icon: "✨", label: "תובנות", badge: insightCount, onClick: () => runMenu(() => setAllInsightsOpen(true)) },
    { icon: "🔔", label: "התראות", badge: unreadCount, onClick: () => runMenu(() => { setNotifOpen(true); setNotifications(prev => prev.map(n => ({ ...n, read: true }))); }) },
    { icon: viewMode === "floor" ? "⊞" : "🗺️", label: viewMode === "floor" ? "תצוגת כרטיסים" : "תצוגת מפה", onClick: () => runMenu(() => setViewMode(viewMode === "floor" ? "grid" : "floor")) },
    { icon: isFullscreen ? "🗗" : "⛶", label: isFullscreen ? "צא ממסך מלא" : "מסך מלא", onClick: () => runMenu(toggleFullscreen) },
    { icon: "🔐", label: "החלפת סיסמה", onClick: () => runMenu(() => setChangePwOpen(true)) },
    { icon: "📲", label: "הורד אפליקציה (Android)", onClick: () => { setMenuOpen(false); window.open("/downloads/waiter.apk", "_blank"); } },
    { icon: "⬅", label: "יציאה", danger: true, onClick: () => runMenu(() => setLogoutPrompt(true)) },
  ];

  const totalPending = pendingCount;

  return (
    <>
      {/* Full-screen background layers */}
      <div style={{ position: "fixed", inset: 0, zIndex: 1, backgroundImage: `url('${bgUrl}')`, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 2, background: `rgba(12,12,18,${bgOpacity})`, transition: "background 0.3s" }} />

    <div dir="rtl" style={{
      ...(isWaiter ? { position: "fixed" as const, inset: 0, zIndex: 400 } : { position: "relative" as const, zIndex: 3, minHeight: "calc(100vh - 64px)" }),
      fontFamily: "'Heebo', sans-serif",
      overflow: "hidden",
      display: "flex", flexDirection: "column",
      padding: "12px 16px 68px", gap: 10,
      background: "transparent",
      color: "#fff",
      height: isWaiter ? "100%" : undefined,
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes insightPulse { 0%,100% { box-shadow:0 0 0 0 rgba(251,191,36,0); } 50% { box-shadow:0 0 0 7px rgba(251,191,36,0.4); } }
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes toastIn { from { transform: translateY(-16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

      {/* ══ TOP NAV — full-width black bar, edge to edge ══ */}
      <div style={{
        background: "#000",
        borderBottom: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 2px 14px rgba(0,0,0,0.5)",
        margin: "-12px -16px 0", padding: "0 14px", height: 60, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
      }}>
        {/* RIGHT (RTL start): hamburger | waiter name | restaurant */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <button onClick={() => setMenuOpen(true)} aria-label="תפריט" style={{
            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
            background: "rgba(255,255,255,0.08)", border: `1px solid ${G_BORDER_C}`,
            cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, position: "relative",
          }}>
            <span style={{ width: 18, height: 2, background: "#fff", borderRadius: 2 }} />
            <span style={{ width: 18, height: 2, background: "#fff", borderRadius: 2 }} />
            <span style={{ width: 18, height: 2, background: "#fff", borderRadius: 2 }} />
            {(insightCount + unreadCount) > 0 && (
              <span style={{ position: "absolute", top: -5, right: -5, background: "#ef4444", color: "#fff", borderRadius: 99, fontSize: 10, fontWeight: 800, minWidth: 17, height: 17, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{insightCount + unreadCount}</span>
            )}
          </button>

          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 0.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{waiterName}</div>
            <div style={{ fontSize: 10, color: G_MUTED_C }}>מלצר חכם</div>
          </div>

          {restaurants.length > 1 && (
            <select value={restaurantId}
              onChange={e => setRestaurantId(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 10, border: `1px solid ${G_BORDER_C}`, background: "rgba(255,255,255,0.08)", color: "#fff", fontSize: 12, fontFamily: "inherit", maxWidth: 150 }}>
              {restaurants.map(r => <option key={r.id} value={r.id} style={{ background: "#1a1a2e" }}>{r.name}</option>)}
            </select>
          )}
        </div>

        {/* LEFT (RTL end): clock | fullscreen */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", fontVariantNumeric: "tabular-nums", letterSpacing: 0.5 }}>{clock}</div>
          <button onClick={() => fetchAll()} disabled={refreshing} title="רענון" style={{
            background: "rgba(255,255,255,0.06)", border: `1px solid ${G_BORDER_C}`, borderRadius: 10,
            padding: "8px 11px", cursor: refreshing ? "default" : "pointer", color: "#fff", display: "flex", alignItems: "center",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: refreshing ? "spin 0.8s linear infinite" : undefined }}>
              <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
          <button onClick={toggleFullscreen} title={isFullscreen ? "צא ממסך מלא" : "מסך מלא"} style={{
            background: "rgba(255,255,255,0.06)", border: `1px solid ${G_BORDER_C}`, borderRadius: 10,
            padding: "8px 11px", cursor: "pointer", color: "#fff", display: "flex", alignItems: "center",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {isFullscreen
                ? <><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></>
                : <><path d="M3 7V3h4"/><path d="M21 7V3h-4"/><path d="M3 17v4h4"/><path d="M21 17v4h-4"/></>
              }
            </svg>
          </button>
        </div>
      </div>

      {/* Offline / sync banner */}
      {(isOffline || totalPending > 0) && (
        <div style={{ background: isOffline ? "rgba(124,58,237,0.25)" : "rgba(59,130,246,0.2)", border: `1px solid ${isOffline ? "rgba(124,58,237,0.5)" : "rgba(59,130,246,0.45)"}`, borderRadius: 12, color: isOffline ? "#c4b5fd" : "#93c5fd", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexShrink: 0, fontSize: 13 }}>
          <span>
            {isOffline
              ? <>📴 <strong>מצב offline</strong>{usingCachedData && offlineSince ? ` — נתונים מ-${offlineSince.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}` : ""}</>
              : <>{isSyncing ? "🔄 מסנכרן..." : "⏳ ממתין לסנכרון"}</>
            }
          </span>
          {totalPending > 0 && <span style={{ fontWeight: 700, background: "rgba(255,255,255,0.12)", borderRadius: 8, padding: "2px 10px" }}>{totalPending} פעולות בתור</span>}
        </div>
      )}

      {/* PWA install banner */}
      {showInstallBanner && !isStandalone && (
        <div style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${G_BORDER_C}`, borderRadius: 12, color: "#fff", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexShrink: 0, direction: "rtl" }}>
          {isIos ? (
            <span style={{ fontSize: 13, lineHeight: 1.5 }}>📲 להתקנה: לחץ <strong>שתף</strong> <span style={{ fontSize: 16 }}>⎋</span> ← <strong>הוסף למסך הבית</strong></span>
          ) : (
            <span style={{ fontSize: 13, fontWeight: 600 }}>📲 התקן כאפליקציה למסך הבית</span>
          )}
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {!isIos && <button onClick={triggerInstall} style={{ background: "#d4a840", border: "none", borderRadius: 8, color: "#1a1208", fontSize: 13, fontWeight: 800, padding: "7px 16px", cursor: "pointer", fontFamily: "inherit" }}>התקן</button>}
            <button onClick={() => setShowInstallBanner(false)} style={{ background: "transparent", border: `1px solid ${G_BORDER_C}`, borderRadius: 8, color: G_MUTED_C, fontSize: 13, padding: "7px 12px", cursor: "pointer", fontFamily: "inherit" }}>לא עכשיו</button>
          </div>
        </div>
      )}

      {/* ══ FLOOR VIEW (full-screen layout) ══ */}
      {viewMode === "floor" && (
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>
          {/* Floating room / rotate controls */}
          {layout && (
            <div style={{ position: "absolute", top: 10, right: 10, zIndex: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {layout.rooms.length > 1 && layout.rooms.map((room, i) => (
                <button key={room.id} onClick={() => setRoomIdx(i)} style={{
                  padding: "5px 11px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  border: `1px solid ${G_BORDER_C}`, background: roomIdx === i ? "rgba(255,255,255,0.18)" : "rgba(15,14,22,0.7)",
                  color: "#fff", fontFamily: "inherit", backdropFilter: "blur(12px)",
                }}>{room.name}</button>
              ))}
              <button onClick={() => setLayoutRotation(r => r === 0 ? 90 : 0)} title="סיבוב" style={{
                padding: "5px 11px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: `1px solid ${G_BORDER_C}`, background: layoutRotation !== 0 ? "rgba(255,255,255,0.18)" : "rgba(15,14,22,0.7)",
                color: "#fff", fontFamily: "inherit", backdropFilter: "blur(12px)",
              }}>🔄</button>
            </div>
          )}

          <FloorLayout
            room={layout?.rooms[roomIdx] as unknown as Parameters<typeof FloorLayout>[0]["room"]}
            liveTables={tables}
            insights={insights}
            myTableNums={myTableNums}
            rotation={layoutRotation}
            onTableClick={setTableOverlay}
            onTableContext={(tableNum, x, y) => setStatusMenu({ tableNum, x, y })}
          />
        </div>
      )}

      {/* ══ GRID VIEW (cards) — available via the menu ══ */}
      {viewMode === "grid" && (
        <div style={{ flex: 1, overflowY: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 150 : 185}px, 1fr))`, gap: 18 }}>
            {loadingTables ? (
              <div style={{ gridColumn: "1/-1", textAlign: "center", color: G_MUTED_C, padding: 40 }}>טוען שולחנות...</div>
            ) : filteredTables.length === 0 ? (
              <div style={{ gridColumn: "1/-1", textAlign: "center", color: G_MUTED_C, padding: 40 }}>
                {tables.length === 0 ? "אין פריסת שולחנות — הגדר פריסה בבונה הפריסה תחילה." : "אין שולחנות"}
              </div>
            ) : filteredTables.map(t => {
              const numColor      = STATUS_NUM_COLOR[t.availStatus] ?? "#fff";
              const numGlow       = STATUS_NUM_GLOW[t.availStatus] ?? "transparent";
              const tableInsights = t.availStatus === "reserved" ? [] : insights.filter(i => i.tableNum === t.tableNum);
              const isOccupied    = t.availStatus === "occupied" || t.availStatus === "bill_requested";
              const isWarn        = isOccupied && t.minutesSitting > 20;
              const isInactive    = t.availStatus === "inactive";
              const statusBadgeBg   = ORDER_STATUS_COLOR[t.orderStatus ?? ""] ?? STATUS_BADGE_BG[t.availStatus];
              const statusBadgeFg   = t.orderStatus ? (ORDER_STATUS_TEXT_COLOR[t.orderStatus] ?? "#374151") : (STATUS_BADGE_TEXT[t.availStatus] ?? "#374151");
              const statusBadgeText = t.availStatus === "occupied"
                ? (ORDER_STATUS_HE[t.orderStatus ?? ""] ?? STATUS_LABEL[t.availStatus])
                : STATUS_LABEL[t.availStatus];
              return (
                <div key={t.tableNum} onClick={() => setTableOverlay(t.tableNum)}
                  style={{
                    background: G_CARD, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
                    border: `1px solid ${G_BORDER_C}`, borderRadius: 22, padding: "16px 18px",
                    height: 130, display: "flex", flexDirection: "column", justifyContent: "space-between",
                    cursor: "pointer", opacity: isInactive ? 0.42 : 1, position: "relative", overflow: "hidden",
                    transition: "all 0.28s cubic-bezier(0.4,0,0.2,1)",
                    animation: tableInsights.length > 0 ? "insightPulse 2.5s ease-in-out infinite" : undefined,
                  }}
                  onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = "translateY(-4px)"; d.style.background = G_CARD_HOVER; }}
                  onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = ""; d.style.background = G_CARD; }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 10, color: G_MUTED_C }}>שולחן</div>
                      <div style={{ fontSize: 38, fontWeight: 900, lineHeight: 1, color: numColor, textShadow: `0 0 18px ${numGlow}` }}>{t.tableNum}</div>
                    </div>
                    <div style={{ textAlign: "left", direction: "ltr" }}>
                      <div style={{ fontSize: 11, color: G_MUTED_C }}>זמן ישיבה</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: isWarn ? "#fca5a5" : "#fff", fontVariantNumeric: "tabular-nums", marginTop: 2 }}>
                        {isOccupied ? fmtTimer(t.sittingStart) : "--:--"}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 12, color: G_MUTED_C }}>👤 {isOccupied && t.guests > 0 ? `${t.guests} סועדים` : `${t.seats} מקומות`}</div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: statusBadgeBg, color: statusBadgeFg }}>{statusBadgeText}</span>
                  </div>
                  {(t.heldCourseNums ?? []).length > 0 && t.activeOrderIds.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      {(t.heldCourseNums ?? []).length === 1 ? (
                        <button onClick={e => { e.stopPropagation(); quickFireCourse(t.activeOrderIds[0], t.heldCourseNums![0], t.tableNum); }}
                          style={{ background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.3)", cursor: "pointer", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, color: "#fdba74", fontSize: 11, fontWeight: 700, padding: "3px 4px", borderRadius: 8, fontFamily: "inherit" }}>
                          🔥 שחרר קורס {t.heldCourseNums![0]}
                        </button>
                      ) : (
                        <div style={{ background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.3)", borderRadius: 8, padding: "3px 8px", fontSize: 10, fontWeight: 700, color: "#fdba74", display: "flex", alignItems: "center", gap: 4 }}>
                          🔥 {(t.heldCourseNums ?? []).length} קורסים ממתינים
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hidden attendance widget — opened from the menu / first-entry prompt */}
      {waiterId && restaurantId && (
        <AttendanceWidget restaurantId={restaurantId} userId={waiterId} hideTrigger openSignal={attSignal} />
      )}

      {/* ══ HAMBURGER MENU DRAWER ══ */}
      {menuOpen && (
        <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.5)" }}>
          <div onClick={e => e.stopPropagation()} dir="rtl" style={{
            position: "absolute", top: 0, right: 0, bottom: 0, width: isMobile ? "82vw" : 320,
            background: "rgba(15,14,22,0.98)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
            borderLeft: `1px solid ${G_BORDER_C}`, boxShadow: "-12px 0 40px rgba(0,0,0,0.5)",
            display: "flex", flexDirection: "column", animation: "slideInRight 0.22s ease-out",
          }}>
            <div style={{ padding: "20px 20px 16px", borderBottom: `1px solid ${G_BORDER_C}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{waiterName}</div>
                <div style={{ fontSize: 11, color: G_MUTED_C }}>{activeRestaurant?.name ?? "מלצר חכם"}</div>
              </div>
              <button onClick={() => setMenuOpen(false)} style={{ background: "rgba(255,255,255,0.08)", border: `1px solid ${G_BORDER_C}`, borderRadius: 8, width: 34, height: 34, fontSize: 18, cursor: "pointer", color: "#fff" }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
              {menuItems.map(item => (
                <button key={item.label} onClick={item.onClick} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderRadius: 12,
                  background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit",
                  fontSize: 15, fontWeight: 600, color: item.danger ? "#fca5a5" : "#fff", textAlign: "right", width: "100%",
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = item.danger ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.07)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ fontSize: 19, width: 26, textAlign: "center", flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span style={{ background: item.icon === "✨" ? "rgba(139,92,246,0.3)" : "#ef4444", color: "#fff", borderRadius: 99, fontSize: 11, fontWeight: 800, minWidth: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px" }}>{item.badge}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ FIRST-ENTRY CLOCK PROMPT ══ */}
      {clockPrompt && (
        <div style={{ position: "fixed", inset: 0, zIndex: 700, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div dir="rtl" style={{ background: "rgba(15,14,22,0.98)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: `1px solid ${G_BORDER_C}`, borderRadius: 20, width: "100%", maxWidth: 360, padding: 28, textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>⏱</div>
            <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 8 }}>דיווחת שעון?</div>
            <div style={{ fontSize: 13, color: G_MUTED_C, marginBottom: 22 }}>לפני תחילת המשמרת, ודא שדיווחת כניסה.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => answerClockPrompt(true)} style={{ flex: 1, padding: "13px", borderRadius: 12, border: "none", background: "rgba(248,113,113,0.18)", color: "#F87171", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>המשך ללא דיווח</button>
              <button onClick={() => answerClockPrompt(false)} style={{ flex: 1, padding: "13px", borderRadius: 12, border: "none", background: "rgba(52,211,153,0.2)", color: "#34D399", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>דווח עכשיו</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ LOGOUT / CLOCK-OUT PROMPT ══ */}
      {logoutPrompt && (
        <div style={{ position: "fixed", inset: 0, zIndex: 700, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div dir="rtl" style={{ background: "rgba(15,14,22,0.98)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: `1px solid ${G_BORDER_C}`, borderRadius: 20, width: "100%", maxWidth: 360, padding: 28, textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🚪</div>
            <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 8 }}>דיווחת יציאה?</div>
            <div style={{ fontSize: 13, color: G_MUTED_C, marginBottom: 22 }}>לפני היציאה מהמערכת, ודא שדיווחת יציאה בשעון.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={() => signOut({ callbackUrl: "/login" })} style={{ padding: "10px", borderRadius: 12, border: `1px solid ${G_BORDER_C}`, background: "transparent", color: G_MUTED_C, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>כבר דיווחתי</button>
              <button onClick={() => { setLogoutPrompt(false); setAttSignal(s => s + 1); }} style={{ padding: "13px", borderRadius: 12, border: "none", background: "rgba(52,211,153,0.2)", color: "#34D399", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>דווח עכשיו</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ NOTIFICATION CENTER ══ */}
      {notifOpen && (
        <div onClick={() => setNotifOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 600 }}>
          <div onClick={e => e.stopPropagation()} style={{
            position: "absolute", top: 70, right: isMobile ? 8 : 16,
            background: "rgba(15,14,22,0.97)", backdropFilter: "blur(30px)", WebkitBackdropFilter: "blur(30px)",
            borderRadius: 16, width: isMobile ? "calc(100vw - 16px)" : 340, maxHeight: "70vh", overflowY: "auto", direction: "rtl",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)", border: `1px solid ${G_BORDER_C}`,
          }}>
            <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${G_BORDER_C}`, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "rgba(15,14,22,0.97)", borderRadius: "16px 16px 0 0" }}>
              <button onClick={() => setNotifications([])} style={{ fontSize: 11, color: G_MUTED_C, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>נקה הכל</button>
              <div style={{ fontSize: 14, fontWeight: 700 }}>🔔 התראות</div>
            </div>
            {notifications.length === 0 ? (
              <div style={{ padding: "24px 16px", textAlign: "center", color: G_MUTED_C, fontSize: 13 }}>אין התראות</div>
            ) : notifications.map(n => (
              <div key={n.id} onClick={() => { setTableOverlay(n.tableNum); setNotifOpen(false); }}
                style={{ padding: "12px 16px", borderBottom: `1px solid rgba(255,255,255,0.06)`, cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{n.type === "ready" ? "✅" : "🔥"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{n.text}</div>
                  <div style={{ fontSize: 11, color: G_MUTED_C, marginTop: 2 }}>
                    {Math.floor((Date.now() - n.at) / 60000) < 1 ? "עכשיו" : `לפני ${Math.floor((Date.now() - n.at) / 60000)} דק'`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ ALL INSIGHTS OVERLAY ══ */}
      {allInsightsOpen && (
        <div onClick={() => setAllInsightsOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "rgba(15,14,22,0.97)", backdropFilter: "blur(30px)", WebkitBackdropFilter: "blur(30px)",
            border: `1px solid ${G_BORDER_C}`, borderRadius: 20, width: "90%", maxWidth: 520, maxHeight: "88vh", overflowY: "auto", direction: "rtl",
            boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          }}>
            <div style={{ padding: "20px 22px 16px", borderBottom: `1px solid ${G_BORDER_C}`, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "rgba(15,14,22,0.97)", borderRadius: "20px 20px 0 0", zIndex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>✨ כל התובנות</div>
              <button onClick={() => setAllInsightsOpen(false)} style={{ background: "rgba(255,255,255,0.08)", border: `1px solid ${G_BORDER_C}`, borderRadius: 8, width: 34, height: 34, fontSize: 18, cursor: "pointer", color: "#fff" }}>✕</button>
            </div>
            <div style={{ padding: "16px 22px 22px" }}>
              {visibleInsights.length === 0 ? (
                <div style={{ textAlign: "center", color: G_MUTED_C, fontSize: 14, padding: 30 }}>
                  {insightLoading ? "מנתח שולחנות..." : "אין תובנות זמינות כרגע"}
                </div>
              ) : visibleInsights.map((ins, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div onClick={() => { setAllInsightsOpen(false); setTableOverlay(ins.tableNum); }} style={{ flex: 1, cursor: "pointer" }}>
                    <InsightCard insight={ins} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 12, flexShrink: 0 }}>
                    <button onClick={() => snoozeInsight(ins, 30)} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${G_BORDER_C}`, borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: G_MUTED_C, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>⏸ 30 דק&apos;</button>
                    <button onClick={() => snoozeInsight(ins, 120)} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${G_BORDER_C}`, borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: G_MUTED_C, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>⏸ 2 שע&apos;</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ RIGHT-CLICK STATUS MENU ══ */}
      {statusMenu && (
        <div onClick={() => setStatusMenu(null)} onContextMenu={e => { e.preventDefault(); setStatusMenu(null); }} style={{ position: "fixed", inset: 0, zIndex: 650 }}>
          <div onClick={e => e.stopPropagation()} dir="rtl" style={{
            position: "fixed",
            top: Math.min(statusMenu.y, (typeof window !== "undefined" ? window.innerHeight : 800) - 210),
            left: Math.min(statusMenu.x, (typeof window !== "undefined" ? window.innerWidth : 600) - 200),
            background: "rgba(15,14,22,0.98)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
            border: `1px solid ${G_BORDER_C}`, borderRadius: 14, padding: 8, width: 190,
            boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: G_MUTED_C, padding: "4px 10px 8px" }}>שולחן {statusMenu.tableNum} — שינוי סטטוס</div>
            {([
              { s: "reserved" as const, label: "🔵 מוזמן" },
              { s: "inactive" as const, label: "🔴 לא פעיל" },
              { s: "free" as const, label: "🟢 פנוי" },
              { s: "bill_requested" as const, label: "🧾 מבקש חשבון" },
            ]).map(o => (
              <button key={o.s} onClick={() => { patchStatus(statusMenu.tableNum, o.s); setStatusMenu(null); }} style={{
                display: "block", width: "100%", textAlign: "right", padding: "10px 12px", borderRadius: 10,
                background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit",
                fontSize: 14, fontWeight: 600, color: "#fff",
              }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >{o.label}</button>
            ))}
          </div>
        </div>
      )}

      {/* ══ TABLE OVERLAY ══ */}
      {tableOverlay && overlayTable && !orderScreenData && (
        <TableOverlay
          tableNum={overlayTable.tableNum}
          seats={overlayTable.seats}
          availStatus={overlayTable.availStatus}
          guests={overlayTable.guests}
          minutesSitting={overlayTable.minutesSitting}
          sittingStart={overlayTable.sittingStart}
          activeOrderIds={overlayTable.activeOrderIds}
          totalAmount={overlayTable.totalAmount}
          orderStatus={overlayTable.orderStatus}
          insights={overlayInsights}
          isMobile={isMobile}
          freeTables={tables.filter(t => t.availStatus === "free").map(t => t.tableNum)}
          restaurantId={restaurantId}
          restaurantName={restaurants.find(r => r.id === restaurantId)?.name ?? "המסעדה"}
          waiterName={waiterName}
          onClose={() => setTableOverlay(null)}
          onAddItems={(order) => {
            // Adding items offline is now supported via the outbox (order already has a server id).
            setOrderScreenData({ orderId: order.id, tableNum: overlayTable.tableNum, allergens: order.tableAllergens, guestCount: overlayTable.guests, existingOrder: order });
            setTableOverlay(null);
          }}
          onNewOrder={(guestCount, allergens) => {
            setOrderScreenData({ orderId: null, tableNum: overlayTable.tableNum, allergens, guestCount, existingOrder: null });
            setTableOverlay(null);
          }}
          onStatusChange={(status) => patchStatus(overlayTable.tableNum, status)}
          onRequestBill={(order) => setReceiptData({
            order, tableNum: overlayTable.tableNum,
            restaurantName: restaurants.find(r => r.id === restaurantId)?.name ?? "המסעדה",
            waiterName,
          })}
        />
      )}

      {/* ══ RECEIPT ══ */}
      {receiptData && (
        <Receipt order={receiptData.order} tableNum={receiptData.tableNum} restaurantName={receiptData.restaurantName} waiterName={receiptData.waiterName} autoPrint={false} onClose={() => setReceiptData(null)} />
      )}

      {/* ══ ORDER SCREEN ══ */}
      {orderScreenData && (
        <OrderScreen
          tableNum={orderScreenData.tableNum}
          orderId={orderScreenData.orderId}
          guestCount={orderScreenData.guestCount}
          tableAllergens={orderScreenData.allergens}
          restaurantId={restaurantId}
          existingOrder={orderScreenData.existingOrder}
          isOffline={isOffline}
          enqueueOffline={enqueue}
          areaName={layout?.rooms.find(r => r.tables?.some(t => String(t.num) === orderScreenData.tableNum))?.name}
          shiftName={shiftLabel()}
          waiterName={waiterName}
          restaurantName={activeRestaurant?.name}
          onClose={() => setOrderScreenData(null)}
          onSuccess={() => { setOrderScreenData(null); showToast("ההזמנה עודכנה בהצלחה ✓"); fetchAll(true); }}
          onQueued={() => { setOrderScreenData(null); showToast("📴 ההזמנה נשמרה ותסונכרן כשיחזור החיבור"); }}
        />
      )}

      {/* ══ SELF SIGN-OFF ══ */}
      {signoffOpen && waiterId && restaurantId && (
        <SelfSignoffModal restaurantId={restaurantId} userId={waiterId} userName={waiterName} showToast={showToast} onClose={() => setSignoffOpen(false)} />
      )}

      {/* ══ CHANGE PASSWORD ══ */}
      {changePwOpen && (
        <ChangePasswordModal showToast={showToast} onClose={() => setChangePwOpen(false)} />
      )}

      {/* Critical alert toast (top, auto-dismiss) */}
      {alertToast && (
        <div onClick={() => setAlertToast(null)} style={{ position: "fixed", top: 78, right: "50%", transform: "translateX(50%)", zIndex: 800, background: "rgba(127,29,29,0.96)", border: "1px solid rgba(239,68,68,0.6)", borderRadius: 12, padding: "12px 20px", color: "#fecaca", fontSize: 13, fontWeight: 700, boxShadow: "0 8px 28px rgba(0,0,0,0.5)", maxWidth: "90vw", cursor: "pointer", animation: "toastIn 0.25s ease-out", direction: "rtl" }}>
          ⚠️ {alertToast}
        </div>
      )}

      {/* Success toast */}
      {toastMsg && (
        <div style={{ position: "fixed", bottom: 80, right: "50%", transform: "translateX(50%)", background: "#1a2a1a", borderRadius: 10, padding: "11px 22px", color: "#4ade80", fontSize: 13, fontWeight: 600, zIndex: 800, boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}>
          ✓ {toastMsg}
        </div>
      )}

      {/* ══ BOTTOM BAR — shift totals (full-width black) ══ */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
        background: "#000", borderTop: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 -2px 14px rgba(0,0,0,0.5)", height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-around",
        padding: "0 12px", direction: "rtl",
      }}>
        {[
          { label: "הכנסות משמרת", val: `₪${Math.round(shift?.revenue ?? 0).toLocaleString("he-IL")}`, color: "#34d399" },
          { label: "סועדים במשמרת", val: `${shift?.diners ?? 0}`, color: "#93c5fd" },
          { label: "ממוצע לאדם", val: `₪${Math.round(shift?.avgPerDiner ?? 0).toLocaleString("he-IL")}`, color: "#fbbf24" },
        ].map((s, i) => (
          <React.Fragment key={s.label}>
            {i > 0 && <div style={{ width: 1, height: 30, background: "rgba(255,255,255,0.12)" }} />}
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontSize: 10, color: G_MUTED_C, marginBottom: 2 }}>{s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: s.color, fontVariantNumeric: "tabular-nums" }}>{s.val}</div>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
    </>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const styles: Record<string, { bg: string; border: string; labelColor: string; label: string }> = {
    alert: { bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.3)",  labelColor: "#fca5a5", label: "⚠️ התראה" },
    tip:   { bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.3)", labelColor: "#c4b5fd", label: "💡 עצה" },
    info:  { bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.3)", labelColor: "#93c5fd", label: "ℹ️ מידע" },
  };
  const s = styles[insight.type] ?? styles.info;
  return (
    <div style={{ borderRadius: 12, padding: "12px 14px", marginBottom: 10, background: s.bg, border: `1.5px solid ${s.border}`, direction: "rtl" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: s.labelColor, marginBottom: 5 }}>{s.label}</div>
      <div style={{ fontSize: 14, color: "#fff", lineHeight: 1.55, fontWeight: 500 }}>{insight.text}</div>
    </div>
  );
}
