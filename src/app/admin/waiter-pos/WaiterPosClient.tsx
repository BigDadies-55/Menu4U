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
  INSIGHT_TYPE_COLOR, INSIGHT_TYPE_DIM,
  fmtTimer, fmtAgo,
} from "./useWaiterPos";

// ── Main ─────────────────────────────────────────────────────────────
export default function WaiterPosClient({ restaurants, waiterName, isWaiter = false, waiterId: _w }: {
  restaurants: Restaurant[]; waiterName: string; isWaiter?: boolean; waiterId?: string;
}) {
  const {
    restaurantId, setRestaurantId,
    tables, insights,
    loadingTables, insightLoading,
    insightIdx, insightFade,
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
    unreadCount, currentInsight, overlayTable, overlayInsights,
    filteredTables, rotatedFloor, floorScale, floorOffsetX, floorOffsetY,
    fetchAll, manualRefresh,
    showToast,
    quickFireCourse, patchStatus,
    toggleFilter, toggleFullscreen, triggerInstall,
  } = useWaiterPos({ restaurants, waiterName, isWaiter });

  return (
    <div dir="rtl" style={{
      ...(isWaiter ? { position: "fixed" as const, inset: 0, zIndex: 400 } : { minHeight: "calc(100vh - 64px)" }),
      background: (() => {
        const bg = restaurants.find(r => r.id === restaurantId)?.waiterBg;
        return bg
          ? `linear-gradient(rgba(12,12,18,0.72),rgba(12,12,18,0.72)), url('${bg}') no-repeat center center / cover fixed`
          : "#f0f2f5";
      })(),
      color: "#111", fontFamily: "inherit",
      overflowY: viewMode === "floor" ? "hidden" : "auto",
      paddingBottom: viewMode === "floor" ? 0 : 140,
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
              onChange={e => { setRestaurantId(e.target.value); }}
              style={{ padding: "4px 8px", borderRadius: 8, border: "1px solid #dde1e8", background: "#f5f5f7", color: "#333", fontSize: 12 }}>
              {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* 🔔 Notification bell */}
          <button onClick={() => { setNotifOpen(o => !o); setNotifications(prev => prev.map(n => ({ ...n, read: true }))); }} style={{
            position: "relative",
            background: unreadCount > 0 ? "#fff7ed" : "#f5f5f7",
            border: `1px solid ${unreadCount > 0 ? "#fed7aa" : "#e0e0e0"}`,
            borderRadius: 8, padding: "6px 9px", fontSize: 17, cursor: "pointer",
            display: "flex", alignItems: "center",
          }}>
            🔔
            {unreadCount > 0 && (
              <span style={{
                position: "absolute", top: -5, right: -5,
                background: "#ef4444", color: "#fff",
                borderRadius: 99, fontSize: 10, fontWeight: 800,
                minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center",
                padding: "0 4px",
              }}>{unreadCount}</span>
            )}
          </button>

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

      {/* Offline banner */}
      {isOffline && (
        <div style={{ background: "#7c3aed", color: "#fff", padding: "8px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexShrink: 0, fontSize: 13 }}>
          <span>
            📴 <strong>מצב offline</strong>
            {usingCachedData && offlineSince
              ? ` — מציג נתונים מ-${offlineSince.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}`
              : " — ממתין לחיבור"}
          </span>
          <span style={{ fontSize: 12, opacity: 0.8 }}>יצירת הזמנות אינה זמינה</span>
        </div>
      )}

      {/* PWA install banner */}
      {showInstallBanner && !isStandalone && (
        <div style={{ background: "#1a1612", color: "#fff", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexShrink: 0, direction: "rtl" }}>
          {isIos ? (
            <span style={{ fontSize: 13, lineHeight: 1.5 }}>
              📲 להתקנה: לחץ <strong>שתף</strong> <span style={{ fontSize: 16 }}>⎋</span> ← <strong>הוסף למסך הבית</strong>
            </span>
          ) : (
            <span style={{ fontSize: 13, fontWeight: 600 }}>📲 התקן כאפליקציה למסך הבית</span>
          )}
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {!isIos && (
              <button onClick={triggerInstall}
                style={{ background: "#d4a840", border: "none", borderRadius: 8, color: "#1a1208", fontSize: 13, fontWeight: 800, padding: "7px 16px", cursor: "pointer", fontFamily: "inherit" }}>
                התקן
              </button>
            )}
            <button onClick={() => setShowInstallBanner(false)}
              style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, color: "rgba(255,255,255,0.7)", fontSize: 13, padding: "7px 12px", cursor: "pointer", fontFamily: "inherit" }}>
              לא עכשיו
            </button>
          </div>
        </div>
      )}

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
          {myTableNums !== null && (
            <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }}>
              📍 התחנה שלי ({myTableNums.size})
            </span>
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
              const isReserved     = t.availStatus === "reserved";
              const tableInsights  = isReserved ? [] : insights.filter(i => i.tableNum === t.tableNum);
              const isWarn         = t.availStatus === "occupied" && t.minutesSitting > 20;
              const statusBadgeBg  = ORDER_STATUS_COLOR[t.orderStatus ?? ""] ?? STATUS_BADGE_BG[t.availStatus];
              const statusBadgeFg  = t.orderStatus ? (ORDER_STATUS_TEXT_COLOR[t.orderStatus] ?? "#374151") : (STATUS_BADGE_TEXT[t.availStatus] ?? "#374151");
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
                    animation: tableInsights.length > 0 ? "insightPulse 2.5s ease-in-out infinite" : undefined,
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

                  {/* Status row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 10px 6px" }}>
                    <span style={{
                      background: statusBadgeBg, color: statusBadgeFg,
                      borderRadius: 5, padding: "3px 8px", fontSize: 10, fontWeight: 700,
                    }}>{statusBadgeText}</span>
                    <div style={{ fontSize: 10, color: "#888" }}>
                      {t.availStatus === "occupied" && t.minutesSitting > 0 ? fmtAgo(t.minutesSitting) : "—"}
                    </div>
                  </div>

                  {/* 🔥 Fire course quick button */}
                  {(t.heldCourseNums ?? []).length > 0 && t.activeOrderIds.length > 0 && (
                    <div style={{ padding: "4px 10px 7px", borderTop: "1px solid #f0f2f5" }}>
                      {(t.heldCourseNums ?? []).length === 1 ? (
                        <button
                          onClick={e => { e.stopPropagation(); quickFireCourse(t.activeOrderIds[0], t.heldCourseNums![0], t.tableNum); }}
                          style={{
                            background: "#fdf7ed", border: "1px solid #d4a840",
                            cursor: "pointer", width: "100%",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                            color: "#92400e", fontSize: 11, fontWeight: 700, padding: "3px 4px", borderRadius: 6,
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = "#fef3c7")}
                          onMouseLeave={e => (e.currentTarget.style.background = "#fdf7ed")}
                        >
                          🔥 שחרר קורס {t.heldCourseNums![0]}
                        </button>
                      ) : (
                        <div style={{ background: "#fdf7ed", border: "1px solid #d4a840", borderRadius: 6, padding: "3px 8px", fontSize: 10, fontWeight: 700, color: "#92400e", display: "flex", alignItems: "center", gap: 4 }}>
                          🔥 {(t.heldCourseNums ?? []).length} קורסים ממתינים
                        </div>
                      )}
                    </div>
                  )}

                  {/* Ready badge */}
                  {(t.readyItemCount ?? 0) > 0 && (
                    <div style={{ padding: "4px 10px 7px", borderTop: "1px solid #f0f2f5" }}>
                      <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, padding: "3px 8px", fontSize: 10, fontWeight: 800, color: "#166534", display: "flex", alignItems: "center", gap: 4 }}>
                        ✅ {t.readyItemCount} מנות מוכנות להגשה
                      </div>
                    </div>
                  )}

                  {/* AI row */}
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
              if (statusFilter.size > 0 && !statusFilter.has(status)) return null;
              const isMyTable = myTableNums === null || myTableNums.has(tNum);
              const color     = isMyTable ? (STATUS_BORDER[status] ?? "#9ca3af") : "#c8cdd6";
              const isRound   = lt.shape === "round" || lt.shape === "oval";
              const tInsights = isMyTable ? insights.filter(i => i.tableNum === tNum) : [];
              const topIns    = tInsights[0];
              const isWarn    = isMyTable && status === "occupied" && (tData?.minutesSitting ?? 0) > 20;

              const W = lt.w * floorScale;
              const H = lt.h * floorScale;
              const numFs   = Math.max(10, Math.min(H * 0.3, 24));
              const infoFs  = Math.max(8, Math.min(H * 0.16, 12));
              const badgeFs = Math.max(7, Math.min(H * 0.14, 11));
              const showInfo  = W > 58 && H > 52;
              const showBadge = W > 68 && H > 64;

              const statusBadgeBg   = isMyTable ? (ORDER_STATUS_COLOR[tData?.orderStatus ?? ""] ?? STATUS_BADGE_BG[status]) : "#e5e7eb";
              const statusBadgeFg   = isMyTable ? (tData?.orderStatus ? (ORDER_STATUS_TEXT_COLOR[tData.orderStatus] ?? "#374151") : (STATUS_BADGE_TEXT[status] ?? "#374151")) : "#9ca3af";
              const statusBadgeText = isMyTable
                ? (status === "occupied" ? (ORDER_STATUS_HE[tData?.orderStatus ?? ""] ?? STATUS_LABEL[status]) : STATUS_LABEL[status])
                : STATUS_LABEL[status];

              return (
                <div key={`${lt.num}-${layoutRotation}`}
                  onClick={() => isMyTable && setTableOverlay(tNum)}
                  style={{
                    position: "absolute",
                    left: lt.x * floorScale + floorOffsetX,
                    top:  lt.y * floorScale + floorOffsetY,
                    width: W, height: H,
                    borderRadius: isRound ? "50%" : lt.shape === "banquet" ? 12 : 6,
                    background: isMyTable
                      ? (status === "occupied" ? color + "18" : color + "12")
                      : "#f0f1f3",
                    border: `2.5px solid ${color}`,
                    opacity: isMyTable ? 1 : 0.45,
                    animation: tInsights.length > 0 ? "insightPulse 2.5s ease-in-out infinite" : undefined,
                    cursor: isMyTable ? "pointer" : "not-allowed",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    padding: "3px 4px",
                    gap: 1,
                    overflow: "hidden",
                    boxSizing: "border-box",
                    transition: "box-shadow 0.12s",
                  }}
                  onMouseEnter={e => isMyTable && ((e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 18px ${color}55`)}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = ""}
                >
                  <span style={{ fontSize: numFs, fontWeight: 800, color: "#111", lineHeight: 1 }}>{tNum}</span>
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
                  {showBadge && (
                    <span style={{
                      background: statusBadgeBg, color: statusBadgeFg,
                      borderRadius: 4, padding: "1px 5px",
                      fontSize: badgeFs, fontWeight: 700, lineHeight: 1.3,
                      maxWidth: "90%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {statusBadgeText}
                    </span>
                  )}
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

      {/* ══ NOTIFICATION CENTER ══ */}
      {notifOpen && (
        <div onClick={() => setNotifOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 300 }}>
          <div onClick={e => e.stopPropagation()} style={{
            position: "absolute", top: 60, right: isMobile ? 8 : 16,
            background: "#fff", borderRadius: 16, width: isMobile ? "calc(100vw - 16px)" : 340,
            maxHeight: "70vh", overflowY: "auto", direction: "rtl",
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)", border: "1px solid #e5e7eb",
          }}>
            <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#fff", borderRadius: "16px 16px 0 0" }}>
              <button onClick={() => setNotifications([])} style={{ fontSize: 11, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>נקה הכל</button>
              <div style={{ fontSize: 14, fontWeight: 700 }}>🔔 התראות</div>
            </div>
            {notifications.length === 0 ? (
              <div style={{ padding: "24px 16px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>אין התראות</div>
            ) : notifications.map(n => (
              <div key={n.id} onClick={() => { setTableOverlay(n.tableNum); setNotifOpen(false); }}
                style={{
                  padding: "12px 16px", borderBottom: "1px solid #f3f4f6",
                  cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 10,
                  background: n.read ? "#fff" : (n.type === "ready" ? "#f0fdf4" : "#fff7ed"),
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
                onMouseLeave={e => (e.currentTarget.style.background = n.read ? "#fff" : (n.type === "ready" ? "#f0fdf4" : "#fff7ed"))}
              >
                <span style={{ fontSize: 18, flexShrink: 0 }}>{n.type === "ready" ? "✅" : "🔥"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{n.text}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
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

      {/* ══ RECEIPT PREVIEW ══ */}
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
          onSuccess={() => {
            setOrderScreenData(null);
            showToast("ההזמנה עודכנה בהצלחה ✓");
            fetchAll(true);
          }}
        />
      )}

      {/* ══ BOTTOM BAR ══ */}
      <div style={{ position: "fixed", bottom: 0, right: 0, left: 0, background: "#fff", borderTop: "1px solid #dde1e8", zIndex: 450, direction: "rtl" }}>

        {/* Segment bar */}
        <div style={{ display: "flex", height: 3, overflow: "hidden" }}>
          <div style={{ flex: occupiedCount,                   background: "#ef4444", transition: "flex 0.4s" }} />
          <div style={{ flex: reservedCount,                   background: "#3b82f6", transition: "flex 0.4s" }} />
          <div style={{ flex: freeCount,                       background: "#22c55e", transition: "flex 0.4s" }} />
          <div style={{ flex: Math.max(inactiveCount, 0.01),   background: "#e5e7eb", transition: "flex 0.4s" }} />
        </div>

        {/* Insight ticker */}
        <div style={{
          background: "#0d0d0d",
          padding: isMobile ? "6px 12px" : "8px 20px",
          display: "flex", alignItems: "center", gap: 8,
          minHeight: isMobile ? 36 : 44,
          opacity: insightFade ? 1 : 0, transition: "opacity 0.4s",
        }}>
          {currentInsight ? (
            <>
              <span style={{ fontSize: isMobile ? 16 : 20, flexShrink: 0 }}>
                {currentInsight.type === "alert" ? "⚠️" : currentInsight.type === "tip" ? "💡" : "ℹ️"}
              </span>
              <span style={{
                fontSize: isMobile ? 14 : 16, fontWeight: 800,
                color: INSIGHT_TYPE_COLOR[currentInsight.type],
                whiteSpace: "nowrap", flexShrink: 0, letterSpacing: "0.01em",
              }}>
                שולחן {currentInsight.tableNum}:
              </span>
              <span style={{
                fontSize: isMobile ? 13 : 15, fontWeight: 600,
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
            <span style={{ fontSize: isMobile ? 11 : 12, color: "rgba(255,255,255,0.3)", letterSpacing: "0.03em" }}>
              {insightLoading ? "✨  מנתח נתונים..." : "✨  אין תובנות כרגע"}
            </span>
          )}
        </div>

        {/* KPI row */}
        <div style={{
          display: "flex", alignItems: "center", gap: isMobile ? 4 : 8,
          padding: isMobile ? "6px 10px" : "8px 16px",
          overflowX: "auto",
        }}>
          <KpiCard label="תפוס"    value={occupiedCount} color="#ef4444" bg="#fef2f2" small={isMobile} />
          <KpiCard label="מוזמן"   value={reservedCount} color="#3b82f6" bg="#eff6ff" small={isMobile} />
          <KpiCard label="פנוי"    value={freeCount}     color="#22c55e" bg="#f0fdf4" small={isMobile} />
          <KpiCard label="לא פעיל" value={inactiveCount} color="#9ca3af" bg="#f9fafb" small={isMobile} />
          <div style={{ width: 1, background: "#e5e7eb", flexShrink: 0, alignSelf: "stretch", margin: "2px 4px" }} />
          <KpiCard label="סועדים"          value={totalDiners} color="#3b82f6" bg="#eff6ff" small={isMobile} />
          <KpiCard label="דורשים תשומת לב" value={alertsCount} color="#f59e0b" bg="#fffbeb" small={isMobile} />
          <KpiCard label="זמן ממוצע"   value={avgSittingMin > 0 ? fmtAgo(avgSittingMin) : "—"} color="#6366f1" bg="#eef2ff" small={isMobile} />
          <KpiCard label="עלות ממוצעת" value={avgCost > 0 ? `₪${avgCost}` : "—"}             color="#059669" bg="#ecfdf5" small={isMobile} />
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
      </div>

      {/* Spin keyframe */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes insightPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(251,191,36,0); }
          50%       { box-shadow: 0 0 0 7px rgba(251,191,36,0.4); }
        }
      `}</style>

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
