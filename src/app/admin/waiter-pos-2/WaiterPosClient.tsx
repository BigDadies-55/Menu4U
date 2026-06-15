"use client";

import React from "react";
import { signOut } from "next-auth/react";
import { TableOverlay } from "./TableOverlay";
import { OrderScreen } from "./OrderScreen";
import Receipt from "./Receipt";
import {
  useWaiterPos,
  type Restaurant,
  type Insight,
  STATUS_BORDER, STATUS_LABEL, STATUS_BADGE_BG, STATUS_BADGE_TEXT,
  ORDER_STATUS_HE, ORDER_STATUS_COLOR, ORDER_STATUS_TEXT_COLOR,
  fmtTimer, fmtAgo,
} from "../waiter-pos/useWaiterPos";

// ── Main ─────────────────────────────────────────────────────────────
export default function WaiterPosClient({ restaurants, waiterName, isWaiter = false, waiterId: _w }: {
  restaurants: Restaurant[]; waiterName: string; isWaiter?: boolean; waiterId?: string;
}) {
  const {
    restaurantId, setRestaurantId,
    tables, insights, visibleInsights,
    loadingTables, insightLoading,
    allInsightsOpen, setAllInsightsOpen,
    tableOverlay, setTableOverlay,
    toastMsg,
    receiptData, setReceiptData,
    clock, isMobile,
    isFullscreen, showFsBanner, setShowFsBanner,
    viewMode, setViewMode,
    layout, roomIdx, setRoomIdx,
    refreshing,
    statusFilter, setStatusFilter,
    myTableNums,
    layoutRotation, setLayoutRotation,
    notifications, setNotifications,
    notifOpen, setNotifOpen,
    isOffline, offlineSince, usingCachedData,
    orderScreenData, setOrderScreenData,
    floorRef,
    showInstallBanner, setShowInstallBanner,
    isIos, isStandalone,
    occupiedCount, reservedCount, freeCount, inactiveCount,
    totalDiners, alertsCount, avgSittingMin, avgCost,
    unreadCount, overlayTable, overlayInsights,
    filteredTables, rotatedFloor, floorScale, floorOffsetX, floorOffsetY,
    fetchAll, manualRefresh,
    showToast,
    quickFireCourse, patchStatus,
    toggleFilter, toggleFullscreen, triggerInstall,
    snoozeInsight,
  } = useWaiterPos({ restaurants, waiterName, isWaiter });

  // ── Glass design tokens ───────────────────────────────────────────
  const G_CARD       = "rgba(255,255,255,0.08)";
  const G_CARD_HOVER = "rgba(255,255,255,0.14)";
  const G_BORDER_C   = "rgba(255,255,255,0.15)";
  const G_NAV        = "rgba(255,255,255,0.05)";
  const G_MUTED_C    = "rgba(255,255,255,0.6)";
  void G_NAV;

  const STATUS_NUM_COLOR: Record<string, string> = {
    occupied: "#EF4444", reserved: "#3B82F6", free: "#10B981",
    inactive: "rgba(255,255,255,0.25)", bill_requested: "#F97316", paid: "#34d399",
  };
  const STATUS_NUM_GLOW: Record<string, string> = {
    occupied: "rgba(239,68,68,0.45)", reserved: "rgba(59,130,246,0.45)", free: "rgba(16,185,129,0.45)",
    inactive: "transparent", bill_requested: "rgba(249,115,22,0.45)", paid: "rgba(52,211,153,0.45)",
  };

  return (
    <div dir="rtl" style={{
      ...(isWaiter ? { position: "fixed" as const, inset: 0, zIndex: 400 } : { minHeight: "calc(100vh - 64px)" }),
      fontFamily: "'Heebo', sans-serif",
      overflowX: "hidden",
      display: "flex", flexDirection: "column",
      padding: "16px 20px 115px", gap: 10,
      background: (() => {
        const bg = restaurants.find(r => r.id === restaurantId)?.waiterBg
          ?? "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=2070";
        return `linear-gradient(rgba(12,12,18,0.78),rgba(12,12,18,0.78)), url('${bg}') no-repeat center center / cover fixed`;
      })(),
      color: "#fff",
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes insightPulse { 0%,100% { box-shadow:0 0 0 0 rgba(251,191,36,0); } 50% { box-shadow:0 0 0 7px rgba(251,191,36,0.4); } }
        @keyframes scrollStrip { 0% { transform:translateX(0); } 100% { transform:translateX(-100%); } }
      `}</style>

      {/* ══ TOP NAV ══ */}
      <div style={{
        background: "rgba(15,14,22,0.75)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
        border: `1px solid ${G_BORDER_C}`, borderRadius: 18,
        padding: "0 20px", height: 60, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#7c3aed,#4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🍽️</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: 0.3 }}>מלצר חכם</div>
            <div style={{ fontSize: 11, color: G_MUTED_C }}>{waiterName}</div>
          </div>
          {restaurants.length > 1 && (
            <select value={restaurantId}
              onChange={e => { setRestaurantId(e.target.value); }}
              style={{ padding: "5px 10px", borderRadius: 10, border: `1px solid ${G_BORDER_C}`, background: "rgba(255,255,255,0.08)", color: "#fff", fontSize: 12, fontFamily: "inherit" }}>
              {restaurants.map(r => <option key={r.id} value={r.id} style={{ background: "#1a1a2e" }}>{r.name}</option>)}
            </select>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", background: "rgba(255,255,255,0.08)", border: `1px solid ${G_BORDER_C}`, borderRadius: 10, padding: "5px 12px", fontVariantNumeric: "tabular-nums" }}>{clock}</div>

          <button onClick={() => { setNotifOpen(o => !o); setNotifications(prev => prev.map(n => ({ ...n, read: true }))); }} style={{
            position: "relative", background: unreadCount > 0 ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.06)",
            border: `1px solid ${unreadCount > 0 ? "rgba(249,115,22,0.5)" : G_BORDER_C}`,
            borderRadius: 10, padding: "7px 10px", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center",
          }}>
            🔔
            {unreadCount > 0 && (
              <span style={{ position: "absolute", top: -5, right: -5, background: "#ef4444", color: "#fff", borderRadius: 99, fontSize: 10, fontWeight: 800, minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{unreadCount}</span>
            )}
          </button>

          <button onClick={() => setAllInsightsOpen(true)} style={{
            background: "linear-gradient(135deg,rgba(124,58,237,0.4),rgba(79,70,229,0.4))",
            color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.4)", borderRadius: 10,
            padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit",
          }}>
            ✨{!isMobile && " תובנות"}
            {insightLoading && <span style={{ fontSize: 10 }}>…</span>}
          </button>

          <button onClick={toggleFullscreen} title={isFullscreen ? "צא ממסך מלא" : "מסך מלא"} style={{
            background: "rgba(255,255,255,0.06)", border: `1px solid ${G_BORDER_C}`, borderRadius: 10,
            padding: "7px 10px", fontSize: 14, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center",
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {isFullscreen
                ? <><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></>
                : <><path d="M3 7V3h4"/><path d="M21 7V3h-4"/><path d="M3 17v4h4"/><path d="M21 17v4h-4"/></>
              }
            </svg>
          </button>

          <button onClick={() => signOut({ callbackUrl: "/login" })} style={{
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 10, padding: "7px 12px", fontSize: 12, fontWeight: 600,
            color: "#fca5a5", cursor: "pointer", fontFamily: "inherit",
          }}>
            ⬅{!isMobile && " יציאה"}
          </button>
        </div>
      </div>

      {/* Offline banner */}
      {isOffline && (
        <div style={{ background: "rgba(124,58,237,0.25)", border: "1px solid rgba(124,58,237,0.5)", borderRadius: 12, color: "#c4b5fd", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexShrink: 0, fontSize: 13 }}>
          <span>📴 <strong>מצב offline</strong>{usingCachedData && offlineSince ? ` — מציג נתונים מ-${offlineSince.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}` : " — ממתין לחיבור"}</span>
          <span style={{ fontSize: 12, opacity: 0.8 }}>יצירת הזמנות אינה זמינה</span>
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

      {/* Fullscreen banner */}
      {showFsBanner && (
        <div style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.4)", borderRadius: 12, color: "#93c5fd", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>💡 למיטב החוויה — כנס למסך מלא</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { toggleFullscreen(); setShowFsBanner(false); }} style={{ background: "rgba(59,130,246,0.3)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>מסך מלא</button>
            <button onClick={() => setShowFsBanner(false)} style={{ background: "transparent", color: G_MUTED_C, border: `1px solid ${G_BORDER_C}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>לא עכשיו</button>
          </div>
        </div>
      )}

      {/* ══ FILTER + VIEW BAR ══ */}
      <div style={{
        background: "rgba(255,255,255,0.04)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        border: `1px solid ${G_BORDER_C}`, borderRadius: 14,
        padding: "8px 16px", display: "flex", alignItems: "center",
        gap: 10, flexShrink: 0, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: 10, border: `1px solid ${G_BORDER_C}`, overflow: "hidden", flexShrink: 0 }}>
          {(["grid", "floor"] as const).map(m => (
            <button key={m} onClick={() => setViewMode(m)} style={{
              padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
              border: "none", background: viewMode === m ? "rgba(255,255,255,0.14)" : "transparent",
              color: viewMode === m ? "#fff" : G_MUTED_C,
              transition: "all 0.15s", fontFamily: "inherit",
            }}>
              {m === "grid" ? "⊞ כרטיסים" : "🗺️ לייאוט"}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 22, background: G_BORDER_C, flexShrink: 0 }} />

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(["occupied","reserved","free","inactive"] as const).map(s => {
            const active = statusFilter.has(s);
            const c = STATUS_NUM_COLOR[s] ?? "#fff";
            return (
              <button key={s} onClick={() => toggleFilter(s)} style={{
                padding: "5px 13px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                cursor: "pointer", border: `1px solid ${active ? c : "rgba(255,255,255,0.18)"}`,
                background: active ? `${c}22` : "transparent",
                color: active ? "#fff" : G_MUTED_C,
                transition: "all 0.15s", fontFamily: "inherit",
              }}>
                {STATUS_LABEL[s]}
              </button>
            );
          })}
          {statusFilter.size > 0 && (
            <button onClick={() => setStatusFilter(new Set())} style={{
              padding: "5px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
              cursor: "pointer", border: `1px solid ${G_BORDER_C}`,
              background: "transparent", color: G_MUTED_C, fontFamily: "inherit",
            }}>✕ הכל</button>
          )}
          {myTableNums !== null && (
            <span style={{ padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "rgba(59,130,246,0.12)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.3)" }}>
              📍 התחנה שלי ({myTableNums.size})
            </span>
          )}
        </div>

        {viewMode === "floor" && (
          <>
            <div style={{ width: 1, height: 22, background: G_BORDER_C, flexShrink: 0 }} />
            <button onClick={() => setLayoutRotation(r => r === 0 ? 90 : 0)} style={{
              padding: "6px 12px", borderRadius: 10, fontSize: 12, fontWeight: 600,
              cursor: "pointer", border: `1px solid ${G_BORDER_C}`,
              background: layoutRotation !== 0 ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.05)",
              color: "#fff", fontFamily: "inherit", transition: "0.15s",
            }}>🔄 {layoutRotation === 0 ? "סובב" : "אנכי"}</button>
          </>
        )}
        {viewMode === "floor" && layout && layout.rooms.length > 1 && (
          <>
            <div style={{ width: 1, height: 22, background: G_BORDER_C, flexShrink: 0 }} />
            {layout.rooms.map((room, i) => (
              <button key={room.id} onClick={() => setRoomIdx(i)} style={{
                padding: "6px 12px", borderRadius: 10, fontSize: 12, fontWeight: 600,
                cursor: "pointer", border: `1px solid ${G_BORDER_C}`,
                background: roomIdx === i ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.05)",
                color: "#fff", fontFamily: "inherit",
              }}>{room.name}</button>
            ))}
          </>
        )}
      </div>

      {/* ══ GRID VIEW ══ */}
      {viewMode === "grid" && (
        <div style={{ flex: 1 }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 150 : 185}px, 1fr))`,
            gap: 18,
          }}>
            {loadingTables ? (
              <div style={{ gridColumn: "1/-1", textAlign: "center", color: G_MUTED_C, padding: 40 }}>טוען שולחנות...</div>
            ) : filteredTables.length === 0 ? (
              <div style={{ gridColumn: "1/-1", textAlign: "center", color: G_MUTED_C, padding: 40 }}>
                {tables.length === 0 ? "אין פריסת שולחנות — הגדר פריסה בבונה הפריסה תחילה." : "אין שולחנות בסינון זה"}
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
                    cursor: "pointer", opacity: isInactive ? 0.42 : 1,
                    position: "relative", overflow: "hidden",
                    transition: "all 0.28s cubic-bezier(0.4,0,0.2,1)",
                    animation: tableInsights.length > 0 ? "insightPulse 2.5s ease-in-out infinite" : undefined,
                  }}
                  onMouseEnter={e => {
                    const d = e.currentTarget as HTMLDivElement;
                    d.style.transform = "translateY(-4px)"; d.style.background = G_CARD_HOVER;
                    d.style.borderColor = "rgba(255,255,255,0.25)"; d.style.boxShadow = "0 14px 30px rgba(0,0,0,0.35)";
                  }}
                  onMouseLeave={e => {
                    const d = e.currentTarget as HTMLDivElement;
                    d.style.transform = ""; d.style.background = G_CARD;
                    d.style.borderColor = G_BORDER_C; d.style.boxShadow = "";
                  }}
                >
                  {(t.readyItemCount ?? 0) > 0 && <div style={{ position: "absolute", top: 12, left: 12, width: 8, height: 8, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 6px rgba(52,211,153,0.8)", animation: "insightPulse 2s infinite" }} />}
                  {(t.heldCourseNums ?? []).length > 0 && !(t.readyItemCount && t.readyItemCount > 0) && <div style={{ position: "absolute", top: 12, left: 12, width: 8, height: 8, borderRadius: "50%", background: "#93c5fd", boxShadow: "0 0 6px rgba(59,130,246,0.8)", animation: "insightPulse 2s infinite" }} />}
                  {t.availStatus === "bill_requested" && <div style={{ position: "absolute", top: 12, left: 12, width: 8, height: 8, borderRadius: "50%", background: "#fdba74", boxShadow: "0 0 6px rgba(249,115,22,0.8)", animation: "insightPulse 2s infinite" }} />}

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
                    <div style={{ fontSize: 12, color: G_MUTED_C }}>
                      👤 {isOccupied && t.guests > 0 ? `${t.guests} סועדים` : `${t.seats} מקומות`}
                    </div>
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

      {/* ══ FLOOR VIEW ══ */}
      {viewMode === "floor" && (
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div ref={floorRef} style={{ flex: 1, position: "relative", overflow: "hidden", background: "rgba(0,0,0,0.3)", borderRadius: 16 }}>
            {!layout ? (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: G_MUTED_C, fontSize: 14 }}>
                אין פריסת שולחנות — הגדר פריסה בבונה הפריסה
              </div>
            ) : rotatedFloor.tables.map(lt => {
              const tNum      = String(lt.num);
              const tData     = tables.find(t => t.tableNum === tNum);
              const status    = tData?.availStatus ?? "free";
              if (statusFilter.size > 0 && !statusFilter.has(status)) return null;
              const isMyTable = myTableNums === null || myTableNums.has(tNum);
              const color     = isMyTable ? (STATUS_BORDER[status] ?? "#9ca3af") : "#555";
              const numColor  = isMyTable ? (STATUS_NUM_COLOR[status] ?? "#fff") : "#555";
              const isRound   = lt.shape === "round" || lt.shape === "oval";
              const tInsights = isMyTable ? insights.filter(i => i.tableNum === tNum) : [];
              const topIns    = tInsights[0];
              const isWarn    = isMyTable && status === "occupied" && (tData?.minutesSitting ?? 0) > 20;
              const W = lt.w * floorScale, H = lt.h * floorScale;
              const numFs   = Math.max(10, Math.min(H * 0.3, 24));
              const infoFs  = Math.max(8, Math.min(H * 0.16, 12));
              const badgeFs = Math.max(7, Math.min(H * 0.14, 11));
              const showInfo  = W > 58 && H > 52;
              const showBadge = W > 68 && H > 64;
              const statusBadgeBg   = isMyTable ? (ORDER_STATUS_COLOR[tData?.orderStatus ?? ""] ?? STATUS_BADGE_BG[status]) : "#333";
              const statusBadgeFg   = isMyTable ? (tData?.orderStatus ? (ORDER_STATUS_TEXT_COLOR[tData.orderStatus] ?? "#fff") : (STATUS_BADGE_TEXT[status] ?? "#fff")) : "#888";
              const statusBadgeText = isMyTable
                ? (status === "occupied" ? (ORDER_STATUS_HE[tData?.orderStatus ?? ""] ?? STATUS_LABEL[status]) : STATUS_LABEL[status])
                : STATUS_LABEL[status];
              return (
                <div key={`${lt.num}-${layoutRotation}`}
                  onClick={() => isMyTable && setTableOverlay(tNum)}
                  style={{
                    position: "absolute",
                    left: lt.x * floorScale + floorOffsetX, top: lt.y * floorScale + floorOffsetY,
                    width: W, height: H,
                    borderRadius: isRound ? "50%" : lt.shape === "banquet" ? 12 : 6,
                    background: isMyTable ? `${color}18` : "rgba(255,255,255,0.05)",
                    border: `2.5px solid ${color}`,
                    opacity: isMyTable ? 1 : 0.35,
                    animation: tInsights.length > 0 ? "insightPulse 2.5s ease-in-out infinite" : undefined,
                    cursor: isMyTable ? "pointer" : "not-allowed",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    padding: "3px 4px", gap: 1, overflow: "hidden", boxSizing: "border-box", transition: "box-shadow 0.12s",
                  }}
                  onMouseEnter={e => isMyTable && ((e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 18px ${color}55`)}
                  onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.boxShadow = "")}
                >
                  <span style={{ fontSize: numFs, fontWeight: 800, color: numColor, lineHeight: 1 }}>{tNum}</span>
                  {showInfo && status === "occupied" && tData && (
                    <span style={{ fontSize: infoFs, fontWeight: 500, color: isWarn ? "#fca5a5" : G_MUTED_C, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{fmtTimer(tData.sittingStart)}</span>
                  )}
                  {showInfo && status === "occupied" && tData && tData.guests > 0 && (
                    <span style={{ fontSize: infoFs, color: G_MUTED_C, lineHeight: 1 }}>👤{tData.guests}</span>
                  )}
                  {showInfo && status !== "occupied" && (
                    <span style={{ fontSize: infoFs, color: G_MUTED_C, lineHeight: 1 }}>{lt.seats ?? tData?.seats ?? ""}מק&apos;</span>
                  )}
                  {showBadge && (
                    <span style={{ background: statusBadgeBg, color: statusBadgeFg, borderRadius: 4, padding: "1px 5px", fontSize: badgeFs, fontWeight: 700, lineHeight: 1.3, maxWidth: "90%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {statusBadgeText}
                    </span>
                  )}
                  {topIns && <span style={{ fontSize: Math.max(9, infoFs), lineHeight: 1 }}>{topIns.type === "alert" ? "⚠️" : topIns.type === "tip" ? "💡" : "ℹ️"}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ NOTIFICATION CENTER ══ */}
      {notifOpen && (
        <div onClick={() => setNotifOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 300 }}>
          <div onClick={e => e.stopPropagation()} style={{
            position: "absolute", top: 68, right: isMobile ? 8 : 16,
            background: "rgba(15,14,22,0.97)", backdropFilter: "blur(30px)", WebkitBackdropFilter: "blur(30px)",
            borderRadius: 16, width: isMobile ? "calc(100vw - 16px)" : 340,
            maxHeight: "70vh", overflowY: "auto", direction: "rtl",
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
                style={{ padding: "12px 16px", borderBottom: `1px solid rgba(255,255,255,0.06)`, cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 10, background: n.read ? "transparent" : (n.type === "ready" ? "rgba(52,211,153,0.08)" : "rgba(249,115,22,0.08)") }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                onMouseLeave={e => (e.currentTarget.style.background = n.read ? "transparent" : (n.type === "ready" ? "rgba(52,211,153,0.08)" : "rgba(249,115,22,0.08)"))}
              >
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
        <div onClick={() => setAllInsightsOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "rgba(15,14,22,0.97)", backdropFilter: "blur(30px)", WebkitBackdropFilter: "blur(30px)",
            border: `1px solid ${G_BORDER_C}`, borderRadius: 20, width: "90%", maxWidth: 520,
            maxHeight: "88vh", overflowY: "auto", direction: "rtl",
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
                  <InsightCard insight={ins} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 12, flexShrink: 0 }}>
                    <button onClick={() => snoozeInsight(ins, 30)} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${G_BORDER_C}`, borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: G_MUTED_C, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>⏸ 30 דק'</button>
                    <button onClick={() => snoozeInsight(ins, 120)} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${G_BORDER_C}`, borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: G_MUTED_C, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>⏸ 2 שע'</button>
                  </div>
                </div>
              ))}
            </div>
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
            if (isOffline) { showToast("📴 לא ניתן לערוך הזמנה במצב offline"); return; }
            setOrderScreenData({ orderId: order.id, tableNum: overlayTable.tableNum, allergens: order.tableAllergens, guestCount: overlayTable.guests, existingOrder: order });
            setTableOverlay(null);
          }}
          onNewOrder={(guestCount, allergens) => {
            if (isOffline) { showToast("📴 לא ניתן ליצור הזמנה במצב offline"); return; }
            setOrderScreenData({ orderId: null, tableNum: overlayTable.tableNum, allergens, guestCount, existingOrder: null });
            setTableOverlay(null);
          }}
          onStatusChange={(status) => patchStatus(overlayTable.tableNum, status)}
          onRequestBill={(order) => setReceiptData({
            order,
            tableNum: overlayTable.tableNum,
            restaurantName: restaurants.find(r => r.id === restaurantId)?.name ?? "המסעדה",
            waiterName,
          })}
        />
      )}

      {/* ══ RECEIPT ══ */}
      {receiptData && (
        <Receipt
          order={receiptData.order}
          tableNum={receiptData.tableNum}
          restaurantName={receiptData.restaurantName}
          waiterName={receiptData.waiterName}
          autoPrint={false}
          onClose={() => setReceiptData(null)}
        />
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
          onClose={() => setOrderScreenData(null)}
          onSuccess={() => { setOrderScreenData(null); showToast("ההזמנה עודכנה בהצלחה ✓"); fetchAll(true); }}
        />
      )}

      {/* ══ BOTTOM SECTION ══ */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50, display: "flex", flexDirection: "column", gap: 1, padding: "0 20px 0" }}>

        {/* Scrolling insights strip */}
        <div style={{
          background: "rgba(8,8,14,0.75)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(139,92,246,0.25)", borderRadius: 16,
          padding: "8px 14px", display: "flex", alignItems: "center", gap: 12, overflow: "hidden",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#a78bfa", whiteSpace: "nowrap", flexShrink: 0 }}>
            ✨ תובנות
          </div>
          <div style={{ width: 1, height: 22, background: "rgba(139,92,246,0.3)", flexShrink: 0 }} />
          <div style={{ flex: 1, overflow: "hidden", position: "relative", height: 28 }}>
            {visibleInsights.length === 0 ? (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", height: "100%" }}>
                {insightLoading ? "מנתח נתונים..." : "אין תובנות כרגע"}
              </div>
            ) : (
              <div style={{
                display: "flex", gap: 10, position: "absolute", whiteSpace: "nowrap", alignItems: "center", height: "100%",
                direction: "ltr", left: 0,
                animation: visibleInsights.length >= 1 ? "scrollStrip 18s ease-in-out infinite alternate" : undefined,
              }}>
                {visibleInsights.map((ins, i) => {
                  const cs: Record<string, { bg: string; border: string; color: string }> = {
                    alert: { bg: "rgba(239,68,68,0.14)",   border: "rgba(239,68,68,0.35)",   color: "#fca5a5" },
                    tip:   { bg: "rgba(139,92,246,0.14)",  border: "rgba(139,92,246,0.35)",  color: "#c4b5fd" },
                    info:  { bg: "rgba(59,130,246,0.14)",  border: "rgba(59,130,246,0.3)",   color: "#93c5fd" },
                  };
                  const s = cs[ins.type] ?? cs.info;
                  return (
                    <span key={i} style={{
                      display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px 4px 12px", borderRadius: 20,
                      background: s.bg, border: `1px solid ${s.border}`, color: s.color,
                      fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", direction: "rtl",
                    }}>
                      <span onClick={() => setTableOverlay(ins.tableNum)} style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                        <span style={{ fontWeight: 900, fontSize: 11, background: "rgba(255,255,255,0.12)", padding: "1px 6px", borderRadius: 6 }}>{ins.tableNum}</span>
                        {ins.type === "alert" ? "⚠️" : ins.type === "tip" ? "💡" : "ℹ️"}
                        {ins.text.replace(new RegExp(`^שולחן ${ins.tableNum}[^—]*—\\s*`), "").slice(0, 60)}
                      </span>
                      <button onClick={e => { e.stopPropagation(); snoozeInsight(ins, 30); }} title="הסתר 30 דקות" style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 99, width: 16, height: 16, fontSize: 9, cursor: "pointer", color: s.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: "inherit" }}>✕</button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* KPI bar */}
        <div style={{
          background: "rgba(8,8,12,0.92)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
          border: `1px solid ${G_BORDER_C}`, borderRadius: 22,
          padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center",
          boxShadow: "0 -8px 35px rgba(0,0,0,0.5)",
        }}>
          <div style={{ display: "flex", gap: isMobile ? 6 : 10, flexWrap: "wrap", alignItems: "center" }}>
            <GlassKpi label="מוזמן"           value={reservedCount}                              color="#3B82F6" />
            <GlassKpi label="פנוי"            value={freeCount}                                  color="#10B981" />
            <GlassKpi label="תפוס"            value={occupiedCount}                              color="#EF4444" />
            <GlassKpi label="לא פעיל"         value={inactiveCount}                              color="rgba(255,255,255,0.3)" />
            <div style={{ width: 1, height: 28, background: G_BORDER_C, flexShrink: 0, margin: "0 4px" }} />
            <GlassKpi label="סועדים"          value={totalDiners}                                color="#fff" />
            <GlassKpi label="דורשים תשומת לב" value={alertsCount}                               color="#F59E0B" />
            <GlassKpi label="זמן ממוצע"       value={avgSittingMin > 0 ? fmtAgo(avgSittingMin) : "—"} color="#a78bfa" />
            <GlassKpi label="עלות ממוצעת"     value={avgCost > 0 ? `₪${avgCost}` : "—"}         color="#34d399" />
          </div>
          <button onClick={manualRefresh} style={{
            background: "rgba(255,255,255,0.06)", border: `1px solid ${G_BORDER_C}`,
            color: "#fff", padding: 9, borderRadius: 12, cursor: "pointer",
            display: "flex", alignItems: "center", transition: "0.2s", flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={refreshing ? "#818cf8" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: refreshing ? "spin 0.7s linear infinite" : "none" }}>
              <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Toast */}
      {toastMsg && (
        <div style={{ position: "fixed", bottom: 110, right: "50%", transform: "translateX(50%)", background: "#1a2a1a", borderRadius: 8, padding: "10px 20px", color: "#4ade80", fontSize: 13, fontWeight: 600, zIndex: 600, boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}>
          ✓ {toastMsg}
        </div>
      )}
    </div>
  );
}

function GlassKpi({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", padding: "6px 14px", borderRadius: 12 }}>
      <span style={{ fontSize: typeof value === "string" ? 14 : 18, fontWeight: 900, color, lineHeight: 1, whiteSpace: "nowrap" }}>{value}</span>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap" }}>{label}</span>
    </div>
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
