"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useOffline } from "@/hooks/useOffline";
import { idbSet, idbGet } from "@/lib/waiter-db";
import type { OrderDetail } from "./TableOverlay";

// ── Exported types ────────────────────────────────────────────────────
export type Restaurant = { id: string; name: string; waiterBg?: string | null; waiterBgOpacity?: number | null };

export type TableData = {
  tableNum: string;
  seats: number;
  availStatus: "free" | "occupied" | "reserved" | "inactive" | "bill_requested" | "paid";
  sittingStart: string | null;
  guests: number;
  orderStatus: string | null;
  minutesSitting: number;
  activeOrderIds: string[];
  totalAmount: number;
  orderCount: number;
  minutesSinceLastOrder: number;
  readyItemCount?: number;
  heldCourseNums?: number[];
};

export type Notification = {
  id: string;
  tableNum: string;
  type: "ready" | "held";
  text: string;
  at: number;
  read: boolean;
};

export type Insight = {
  tableNum: string;
  type: "alert" | "tip" | "info";
  text: string;
};

export type LayoutTable = {
  num: number | string; name?: string; shape?: string;
  x: number; y: number; w: number; h: number; seats?: number; rot?: number;
};
export type LayoutRoom = { id: string; name: string; tables: LayoutTable[]; bgImg?: string; bgOpacity?: number };
export type LayoutV2 = { version: 2; rooms: LayoutRoom[] };

export type ReceiptData = {
  order: OrderDetail;
  tableNum: string;
  restaurantName: string;
  waiterName: string;
};

export type OrderScreenData = {
  orderId: string | null;
  tableNum: string;
  allergens: string[];
  guestCount: number;
  existingOrder: OrderDetail | null;
};

// ── Shared color maps (exported for use in both UIs) ─────────────────
export const STATUS_BORDER: Record<string, string> = {
  occupied: "#f87171", reserved: "#93c5fd", free: "#6ee7b7", inactive: "#d1d5db",
  bill_requested: "#fb923c", paid: "#34d399",
};
export const STATUS_LABEL: Record<string, string> = {
  occupied: "תפוס", reserved: "מוזמן", free: "פנוי", inactive: "לא פעיל",
  bill_requested: "מבקש חשבון", paid: "שולם",
};
export const STATUS_BADGE_BG: Record<string, string> = {
  occupied: "#fca5a5", reserved: "#bfdbfe", free: "#a7f3d0", inactive: "#e5e7eb",
  bill_requested: "#fed7aa", paid: "#a7f3d0",
};
export const STATUS_BADGE_TEXT: Record<string, string> = {
  occupied: "#b91c1c", reserved: "#1d4ed8", free: "#065f46", inactive: "#6b7280",
  bill_requested: "#c2410c", paid: "#065f46",
};
export const ORDER_STATUS_HE: Record<string, string> = {
  PENDING: "ממתין", CONFIRMED: "הזמנה נלקחה", PREPARING: "מכין",
  READY: "מוכן!", DELIVERED: "הוגש", PAID: "שולם", CANCELLED: "בוטל",
};
export const ORDER_STATUS_COLOR: Record<string, string> = {
  PENDING: "#a7f3d0", CONFIRMED: "#fca5a5", PREPARING: "#bfdbfe",
  READY: "#bfdbfe", DELIVERED: "#fde68a", PAID: "#e5e7eb", CANCELLED: "#e5e7eb",
};
export const ORDER_STATUS_TEXT_COLOR: Record<string, string> = {
  PENDING: "#065f46", CONFIRMED: "#b91c1c", PREPARING: "#1d4ed8",
  READY: "#1d4ed8", DELIVERED: "#92400e", PAID: "#6b7280", CANCELLED: "#6b7280",
};
export const INSIGHT_TYPE_COLOR: Record<string, string> = {
  alert: "#ff4444", tip: "#fbbf24", info: "#22d3ee",
};
export const INSIGHT_TYPE_DIM: Record<string, string> = {
  alert: "#ff9999", tip: "#fde68a", info: "#a5f3fc",
};

export function fmtTimer(sittingStart: string | null): string {
  if (!sittingStart) return "00:00";
  const s = Math.max(0, Math.floor((Date.now() - new Date(sittingStart).getTime()) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
export function fmtAgo(minutes: number): string {
  if (minutes < 1) return "—";
  if (minutes < 60) return `${minutes} דק'`;
  return `${Math.floor(minutes / 60)}ש' ${minutes % 60}′`;
}

const LS_REST_KEY = "menu4u_active_restaurant";
const LS_ROTATION_KEY = "menu4u_layout_rotation";
const LS_VIEWMODE_KEY = "menu4u_waiter_viewmode";

// ── Hook ──────────────────────────────────────────────────────────────
export function useWaiterPos({
  restaurants,
  waiterName: _waiterName,
  isWaiter = false,
}: {
  restaurants: Restaurant[];
  waiterName: string;
  isWaiter?: boolean;
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
  const [snoozed, setSnoozed]         = useState<Map<string, { until: number; status: string }>>(new Map());
  const [loadingTables, setLoading]   = useState(true);
  const [insightLoading, setILoading] = useState(false);
  const [tick, setTick]               = useState(0);
  const [insightIdx, setInsightIdx]   = useState(0);
  const [insightFade, setInsightFade] = useState(true);
  const [allInsightsOpen, setAllInsightsOpen] = useState(false);
  const [tableOverlay, setTableOverlay]       = useState<string | null>(null);
  const [toastMsg, setToastMsg]               = useState("");
  const [receiptData, setReceiptData]         = useState<ReceiptData | null>(null);
  const [clock, setClock]                     = useState("");
  const [isMobile, setIsMobile]               = useState(false);
  const [isFullscreen, setIsFullscreen]       = useState(false);
  const [showFsBanner, setShowFsBanner]       = useState(false);
  const [viewMode, setViewMode]               = useState<"grid" | "floor">(() => {
    if (typeof window !== "undefined") {
      const v = localStorage.getItem(LS_VIEWMODE_KEY);
      if (v === "grid" || v === "floor") return v;
    }
    return "floor";
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(LS_VIEWMODE_KEY, viewMode);
  }, [viewMode]);
  const [layout, setLayout]                   = useState<LayoutV2 | null>(null);
  const [roomIdx, setRoomIdx]                 = useState(0);
  const [refreshing, setRefreshing]           = useState(false);
  const [statusFilter, setStatusFilter]       = useState<Set<string>>(new Set());
  const [myTableNums, setMyTableNums]         = useState<Set<string> | null>(null);
  const [layoutRotation, setLayoutRotation]   = useState<0 | 90>(() => {
    if (typeof window !== "undefined" && localStorage.getItem(LS_ROTATION_KEY) === "90") return 90;
    return 0;
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(LS_ROTATION_KEY, String(layoutRotation));
  }, [layoutRotation]);
  const [notifications, setNotifications]     = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen]             = useState(false);
  const prevReadyRef = useRef<Record<string, number>>({});
  const prevHeldRef  = useRef<Record<string, string>>({});

  const isOffline = useOffline();
  const [offlineSince, setOfflineSince] = useState<Date | null>(null);
  const [usingCachedData, setUsingCachedData] = useState(false);
  useEffect(() => {
    if (isOffline) { setOfflineSince(prev => prev ?? new Date()); }
    else { setOfflineSince(null); setUsingCachedData(false); }
  }, [isOffline]);

  const [orderScreenData, setOrderScreenData] = useState<OrderScreenData | null>(null);

  const floorRef = useRef<HTMLDivElement>(null);
  const [floorSize, setFloorSize] = useState({ w: 600, h: 400 });

  const [installPrompt, setInstallPrompt] = useState<Event & { prompt?: () => Promise<void> } | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true);
    setIsStandalone(standalone);
    if (standalone) return;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIos(ios);
    if (ios) {
      const t = setTimeout(() => setShowInstallBanner(true), 3000);
      return () => clearTimeout(t);
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as Event & { prompt?: () => Promise<void> });
      setShowInstallBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function triggerInstall() {
    if (!installPrompt?.prompt) return;
    await installPrompt.prompt();
    setShowInstallBanner(false);
    setInstallPrompt(null);
  }

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

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function upd() {
      const n = new Date();
      setClock(`${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`);
    }
    upd(); const id = setInterval(upd, 1000); return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!floorRef.current) return;
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setFloorSize({ w: width, h: height });
    });
    obs.observe(floorRef.current);
    return () => obs.disconnect();
  }, [viewMode]);

  useEffect(() => {
    if (!restaurantId) return;
    const es = new EventSource(`/api/admin/orders/stream?restaurantId=${restaurantId}`);
    es.onmessage = () => fetchAll(true);
    return () => es.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  useEffect(() => {
    const newNotifs: Notification[] = [];
    const now = Date.now();
    for (const t of tables) {
      const ready = t.readyItemCount ?? 0;
      const prev  = prevReadyRef.current[t.tableNum] ?? 0;
      if (ready > 0 && ready > prev) {
        newNotifs.push({ id: `ready-${t.tableNum}-${now}`, tableNum: t.tableNum, type: "ready", text: `שולחן ${t.tableNum}: ${ready} מנות מוכנות להגשה`, at: now, read: false });
      }
      prevReadyRef.current[t.tableNum] = ready;
      const held = (t.heldCourseNums ?? []).join(",");
      const prevHeld = prevHeldRef.current[t.tableNum] ?? "";
      if (held && held !== prevHeld) {
        const newCourses = (t.heldCourseNums ?? []).filter(c => !prevHeld.split(",").includes(String(c)));
        for (const c of newCourses) {
          newNotifs.push({ id: `held-${t.tableNum}-${c}-${now}`, tableNum: t.tableNum, type: "held", text: `שולחן ${t.tableNum}: קורס ${c} ממתין לשחרור`, at: now, read: false });
        }
      }
      prevHeldRef.current[t.tableNum] = held;
    }
    if (newNotifs.length > 0) setNotifications(prev => [...newNotifs, ...prev].slice(0, 50));
  }, [tables]);

  const fetchLayout = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const r = await fetch(`/api/admin/restaurants/${restaurantId}/layout`);
      if (r.ok) {
        const d = await r.json();
        const raw = d?.tableLayoutJson;
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        const lay = parsed?.version === 2 ? parsed : null;
        setLayout(lay);
        setRoomIdx(0);
        if (lay) idbSet("layout", restaurantId, lay).catch(() => {});
        return;
      }
    } catch { /* fall through */ }
    const cached = await idbGet<LayoutV2>("layout", restaurantId).catch(() => undefined);
    if (cached) { setLayout(cached); setRoomIdx(0); }
    else setLayout(null);
  }, [restaurantId]);

  useEffect(() => { fetchLayout(); }, [fetchLayout]);

  useEffect(() => {
    if (!restaurantId) return;
    fetch(`/api/admin/waiter-stations?restaurantId=${restaurantId}&userId=me`)
      .then(r => r.ok ? r.json() : null)
      .then((stations: Array<{ tableNumbers: string[] }> | null) => {
        if (!stations || stations.length === 0 || stations[0]?.tableNumbers?.length === 0) {
          setMyTableNums(null);
        } else {
          setMyTableNums(new Set(stations[0].tableNumbers));
        }
      })
      .catch(() => setMyTableNums(null));
  }, [restaurantId]);

  const fetchAll = useCallback(async (quiet = false) => {
    if (!restaurantId) return;
    if (!quiet) setLoading(true);
    try {
      const r = await fetch(`/api/admin/waiter-pos/tables?restaurantId=${restaurantId}`);
      if (r.ok) {
        const data: TableData[] = await r.json();
        setTables(prev => {
          void prev;
          setSnoozed(s => {
            const next = new Map(s);
            for (const [key, v] of next) {
              const tNum = key.split("|")[0];
              const newT = data.find(t => t.tableNum === tNum);
              if (newT && newT.availStatus !== v.status) next.delete(key);
            }
            return next;
          });
          return data;
        });
        setUsingCachedData(false);
        idbSet("tables", restaurantId, { data, savedAt: new Date().toISOString() }).catch(() => {});
        const orderIds = data.flatMap(t => t.activeOrderIds);
        for (const oid of orderIds) {
          fetch(`/api/admin/orders/${oid}`)
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d) idbSet("orders", oid, d).catch(() => {}); })
            .catch(() => {});
        }
        setILoading(true);
        fetch("/api/admin/waiter-pos/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ restaurantId, tables: data }),
        }).then(ir => ir.ok ? ir.json() : { insights: [] })
          .then(d => { setInsights(Array.isArray(d.insights) ? d.insights : []); setInsightIdx(0); })
          .finally(() => setILoading(false));
        return;
      }
    } catch { /* fall through */ }
    finally { setLoading(false); }
    const cached = await idbGet<{ data: TableData[]; savedAt: string }>("tables", restaurantId).catch(() => undefined);
    if (cached?.data) { setTables(cached.data); setUsingCachedData(true); }
  }, [restaurantId]);

  useEffect(() => {
    fetchAll();
    const id = setInterval(() => fetchAll(true), 15_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  async function manualRefresh() {
    setRefreshing(true);
    await fetchAll(true);
    setRefreshing(false);
  }

  useEffect(() => {
    if (insights.length <= 1) return;
    const id = setInterval(() => {
      setInsightFade(false);
      setTimeout(() => { setInsightIdx(i => (i + 1) % insights.length); setInsightFade(true); }, 400);
    }, 10_000);
    return () => clearInterval(id);
  }, [insights]);

  function showToast(msg: string) { setToastMsg(msg); setTimeout(() => setToastMsg(""), 3000); }

  async function quickFireCourse(orderId: string, course: number, tableNum: string) {
    await fetch(`/api/admin/orders/${orderId}/fire-course`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course }),
    });
    showToast(`🔥 קורס ${course} שולחן ${tableNum} — יצא למטבח`);
    fetchAll(true);
  }

  async function patchStatus(tableNum: string, status: "reserved" | "inactive" | "free" | "bill_requested") {
    await fetch("/api/admin/waiter-pos/tables", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId, tableNum, status }),
    });
    setTableOverlay(null);
    showToast(`שולחן ${tableNum} עודכן`);
    fetchAll(true);
  }

  // KPIs
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

  const unreadCount    = notifications.filter(n => !n.read).length;
  const currentInsight = insights[insightIdx] ?? null;
  const overlayTable   = tables.find(t => t.tableNum === tableOverlay) ?? null;
  const overlayInsights = insights.filter(i => i.tableNum === tableOverlay);

  const filteredTables = useMemo(() => {
    let result = tables;
    if (myTableNums !== null) result = result.filter(t => myTableNums.has(t.tableNum));
    if (statusFilter.size > 0) result = result.filter(t => statusFilter.has(t.availStatus));
    return result;
  }, [tables, statusFilter, myTableNums]);

  function toggleFilter(s: string) {
    setStatusFilter(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });
  }

  const activeRoom = layout?.rooms[roomIdx];

  const rotatedFloor = useMemo(() => {
    if (!activeRoom?.tables.length) return { tables: [], maxX: 0, maxY: 0 };
    const origMaxY = Math.max(...activeRoom.tables.map(t => t.y + t.h));
    const origMaxX = Math.max(...activeRoom.tables.map(t => t.x + t.w));
    if (layoutRotation === 0) return { tables: activeRoom.tables, maxX: origMaxX, maxY: origMaxY };
    const rotated = activeRoom.tables.map(lt => ({ ...lt, x: origMaxY - (lt.y + lt.h), y: lt.x, w: lt.h, h: lt.w }));
    return { tables: rotated, maxX: Math.max(...rotated.map(t => t.x + t.w)), maxY: Math.max(...rotated.map(t => t.y + t.h)) };
  }, [activeRoom, layoutRotation]);

  const { floorScale, floorOffsetX, floorOffsetY } = useMemo(() => {
    if (!rotatedFloor.maxX || !rotatedFloor.maxY || !floorSize.w || !floorSize.h)
      return { floorScale: 1, floorOffsetX: 0, floorOffsetY: 0 };
    const scale = Math.min(floorSize.w / rotatedFloor.maxX, floorSize.h / rotatedFloor.maxY);
    return { floorScale: scale, floorOffsetX: Math.max(0, (floorSize.w - rotatedFloor.maxX * scale) / 2), floorOffsetY: Math.max(0, (floorSize.h - rotatedFloor.maxY * scale) / 2) };
  }, [rotatedFloor, floorSize]);

  // Snooze helpers (used by V2; V1 ignores)
  function insightKey(ins: Insight) { return `${ins.tableNum}|${ins.type}|${ins.text.slice(0, 30)}`; }
  function snoozeInsight(ins: Insight, minutes: number) {
    const tStatus = tables.find(t => t.tableNum === ins.tableNum)?.availStatus ?? "";
    setSnoozed(s => new Map(s).set(insightKey(ins), { until: Date.now() + minutes * 60_000, status: tStatus }));
  }
  const visibleInsights = insights.filter(ins => {
    const entry = snoozed.get(insightKey(ins));
    return !entry || Date.now() > entry.until;
  });

  void tick;

  return {
    // State
    restaurantId, setRestaurantId,
    tables, insights, visibleInsights, snoozed,
    loadingTables, insightLoading,
    insightIdx, insightFade,
    allInsightsOpen, setAllInsightsOpen,
    tableOverlay, setTableOverlay,
    toastMsg,
    receiptData, setReceiptData,
    clock,
    isMobile,
    isFullscreen,
    showFsBanner, setShowFsBanner,
    viewMode, setViewMode,
    layout,
    roomIdx, setRoomIdx,
    refreshing,
    statusFilter, setStatusFilter,
    myTableNums,
    layoutRotation, setLayoutRotation,
    notifications, setNotifications,
    notifOpen, setNotifOpen,
    isOffline, offlineSince, usingCachedData,
    orderScreenData, setOrderScreenData,
    floorRef, floorSize,
    showInstallBanner, setShowInstallBanner,
    isIos, isStandalone,
    // KPIs
    occupiedCount, reservedCount, freeCount, inactiveCount,
    totalDiners, alertsCount, avgSittingMin, avgCost,
    unreadCount, currentInsight, overlayTable, overlayInsights,
    filteredTables, activeRoom, rotatedFloor, floorScale, floorOffsetX, floorOffsetY,
    // Handlers
    fetchAll, manualRefresh,
    showToast,
    quickFireCourse, patchStatus,
    toggleFilter, toggleFullscreen, triggerInstall,
    snoozeInsight, insightKey,
  };
}
