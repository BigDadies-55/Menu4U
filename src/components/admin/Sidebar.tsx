"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { T } from "@/lib/ui";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Role } from "@/generated/prisma/client";
import { ROLE_LABELS } from "@/lib/permissions";
import { Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["700", "900"], display: "swap" });

/* ─── Width constants (52 for API compat — strip width) ─────── */
export const SIDEBAR_W_COLLAPSED = 52;
export const SIDEBAR_W_EXPANDED  = 52;
export const SIDEBAR_MIN_W = 220;
export const SIDEBAR_MAX_W = 520;
export const SIDEBAR_DEFAULT_W = 52;
const LS_KEY_DRAWER = "menu4u_drawer_w";
const FAV_KEY = "menu4u_favorites";

/* ─── Admin palettes ─────────────────────────────────────────── */
export const ADMIN_PALETTE_MAP: Record<string, { bg: string; accent: string; accentMuted: string; accentText: string }> = {
  dark:   { bg: "var(--c-panel)", accent: T.gold,    accentMuted: T.goldSub,              accentText: T.gold   },
  purple: { bg: "#120b1e",        accent: T.purple,  accentMuted: "rgba(147,51,234,0.15)", accentText: "#c084fc" },
  blue:   { bg: "#080f1e",        accent: T.blue,    accentMuted: "rgba(59,130,246,0.15)", accentText: "#93c5fd" },
  green:  { bg: "#071510",        accent: T.green,   accentMuted: "rgba(34,197,94,0.15)",  accentText: "#86efac" },
  rose:   { bg: "#150a0e",        accent: "#f43f5e", accentMuted: "rgba(244,63,94,0.15)",  accentText: "#fda4af" },
  custom: { bg: "var(--c-panel)", accent: T.gold,    accentMuted: T.goldSub,              accentText: T.gold   },
};

/* ─── Icons ──────────────────────────────────────────────────── */
const Ic = {
  Dashboard:  () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  Restaurant: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2l1.5 9h15L21 2"/><path d="M3 11v9h18v-9"/><line x1="12" y1="2" x2="12" y2="11"/></svg>,
  Menus:      () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>,
  Orders:     () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
  Stats:      () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Layout:     () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>,
  Users:      () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Logs:       () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  Kitchen:    () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
  Kanban:     () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="5" height="18"/><rect x="10" y="3" width="5" height="11"/><rect x="17" y="3" width="5" height="15"/></svg>,
  Ticket:     () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z"/></svg>,
  TableView:  () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>,
  Settings:   () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>,
  Customers:  () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Loyalty:    () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  KDSIcon:    () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  Manage:     () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>,
  Service:    () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v5a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
  Cashier:    () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
};

/* ─── Favorites ──────────────────────────────────────────────── */
export type Favorite = { href: string; label: string };

export function useFavorites(): [Favorite[], (href: string, label: string) => void] {
  const [favs, setFavs] = useState<Favorite[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(FAV_KEY);
      if (stored) setFavs(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  function toggle(href: string, label: string) {
    setFavs(prev => {
      const exists = prev.some(f => f.href === href);
      const next = exists ? prev.filter(f => f.href !== href) : [...prev, { href, label }];
      try { localStorage.setItem(FAV_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  return [favs, toggle];
}

/* ─── Nav structure ──────────────────────────────────────────── */
type NavLeaf = {
  href: string; label: string; I: React.FC;
  exact?: boolean; superAdmin?: boolean; adminOnly?: boolean;
  ownerOnly?: boolean; waiterHide?: boolean; displayHide?: boolean;
  excludeStartsWith?: string[];
  children?: NavLeaf[];
};

type NavGroup = {
  id: string; label: string; I: React.FC;
  waiterHide?: boolean; displayHide?: boolean;
  items: NavLeaf[];
};

const STANDALONE: NavLeaf = {
  href: "/admin", label: "דשבורד", I: Ic.Dashboard,
  exact: true, waiterHide: true, displayHide: true,
};

const GROUPS: NavGroup[] = [
  {
    id: "manage", label: "ניהול", I: Ic.Manage,
    waiterHide: true, displayHide: true,
    items: [
      { href: "/admin/restaurants", label: "מסעדות",       I: Ic.Restaurant, superAdmin: true, waiterHide: true, displayHide: true },
      { href: "/admin/groups",      label: "רשתות 🏢",      I: Ic.Restaurant, superAdmin: true, waiterHide: true, displayHide: true },
      { href: "/admin/menus",       label: "תפריטים",      I: Ic.Menus,      waiterHide: true, displayHide: true },
      { href: "/admin/users",       label: "משתמשים",      I: Ic.Users,      adminOnly: true,  waiterHide: true, displayHide: true },
      { href: "/admin/logs",        label: "לוגים",         I: Ic.Logs,       adminOnly: true,  waiterHide: true, displayHide: true },
      { href: "/admin/settings",    label: "הגדרות",        I: Ic.Settings,   waiterHide: true, displayHide: true },
    ],
  },
  {
    id: "service", label: "שירות", I: Ic.Service,
    displayHide: true,
    items: [
      { href: "/admin/orders", label: "הזמנות", I: Ic.Orders, displayHide: true, excludeStartsWith: ["/admin/orders/stats"] },
      { href: "/admin/cashier",        label: "קאשייר",             I: Ic.Cashier,   displayHide: true },
      { href: "/admin/waiter-floor",   label: "רצפת שירות 🗺️",     I: Ic.Layout,    displayHide: true },
      { href: "/admin/shift-manager",  label: "מנהל משמרת 🎛️",     I: Ic.Stats,     displayHide: true, waiterHide: true },
      { href: "/admin/waiter",         label: "הזמנת מלצר 🍽️",     I: Ic.Orders,    displayHide: true },
      { href: "/admin/orders/stats", label: "סטטיסטיקות",      I: Ic.Stats,     waiterHide: true, displayHide: true, ownerOnly: true },
      { href: "/admin/layout-builder", label: "פריסת שולחנות", I: Ic.Layout,    ownerOnly: true, waiterHide: true, displayHide: true },
      { href: "/admin/loyalty",        label: "מועדון לקוחות ⭐", I: Ic.Loyalty,   displayHide: true },
      { href: "/admin/crm",            label: "קשרי לקוחות 📱",   I: Ic.Customers, displayHide: true },
    ],
  },
  {
    id: "kds", label: "KDS", I: Ic.KDSIcon,
    items: [
      { href: "/admin/kitchen-table",   label: "תצוגת שולחן", I: Ic.TableView },
      { href: "/admin/kitchen",         label: "Station Dark", I: Ic.Kitchen   },
      { href: "/admin/kitchen-kanban",  label: "Kanban",       I: Ic.Kanban    },
      { href: "/admin/kitchen-tickets", label: "Ticket Board", I: Ic.Ticket    },
    ],
  },
];

/* ─── Props ──────────────────────────────────────────────────── */
interface SidebarProps {
  user: { name?: string | null; email?: string | null; role: Role };
  kdsView: string;
  pinned?: boolean;
  onTogglePin?: () => void;
  isOpen?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  onChangePassword?: () => void;
  adminPalette?: string;
  siteLogo?: string | null;
  siteName?: string;
  adminSidebarBg?: string | null;
  adminSidebarAccent?: string | null;
  adminSidebarTextColor?: string;
  favorites: Favorite[];
  onToggleFavorite: (href: string, label: string) => void;
}

/* ─── Search result type ─────────────────────────────────────── */
type SearchResult = { type: string; id: string; label: string; sub: string; href: string };

const TYPE_ICON: Record<string, string> = {
  page:       "📄",
  restaurant: "🍽️",
  menu:       "📋",
  item:       "🍕",
  order:      "🧾",
  user:       "👤",
};

/* ─── Helpers ────────────────────────────────────────────────── */
function isLeafActive(leaf: NavLeaf, pathname: string): boolean {
  if (leaf.exact) return pathname === leaf.href;
  if (leaf.excludeStartsWith?.some(p => pathname === p || pathname.startsWith(p + "/"))) return false;
  return pathname === leaf.href || pathname.startsWith(leaf.href + "/");
}

/* ─── Colors ─────────────────────────────────────────────────── */
const GOLD_GRADIENT = `linear-gradient(110deg,#7a3c04 0%,${T.gold} 50%,#e8843a 100%)`;

/* ─── Main Sidebar ───────────────────────────────────────────── */
export default function Sidebar({
  user, kdsView,
  isOpen: _isOpen = false,
  onChangePassword,
  adminPalette = "dark", siteLogo, siteName = "Menu4U",
  adminSidebarBg, adminSidebarAccent, adminSidebarTextColor: _adminSidebarTextColor = T.muted,
  pinned: _pinned, onTogglePin: _onTogglePin,
  favorites, onToggleFavorite,
}: SidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();

  /* ── Drawer state ── */
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [drawerW,      setDrawerW]      = useState(320);
  const drawerDragging = useRef(false);

  /* ── Floating panels ── */
  const [favPanelOpen,    setFavPanelOpen]    = useState(false);
  const [searchPanelOpen, setSearchPanelOpen] = useState(false);
  const [favBtnFromBottom,    setFavBtnFromBottom]    = useState(0);
  const [searchBtnFromBottom, setSearchBtnFromBottom] = useState(0);

  const favBtnRef      = useRef<HTMLButtonElement>(null);
  const searchBtnRef   = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  /* ── Accordion groups (all start collapsed) ── */
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  /* ── Search state ── */
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  /* ── Palette ── */
  const pal = (() => {
    if (adminPalette === "custom" && adminSidebarAccent) {
      const a  = adminSidebarAccent;
      const bg = adminSidebarBg ?? T.surface;
      return { bg, accent: a, accentMuted: `${a}26`, accentText: a };
    }
    return ADMIN_PALETTE_MAP[adminPalette ?? "dark"] ?? ADMIN_PALETTE_MAP.dark;
  })();

  const sidebarBg = adminSidebarBg ?? pal.bg;
  const accent    = adminSidebarAccent ?? pal.accent;

  /* ── Role checks ── */
  const isWaiter   = user.role === "WAITER";
  const isDisplay  = user.role === "DISPLAY";
  const isEditor   = user.role === "EDITOR";
  const isViewer   = user.role === "VIEWER";
  const isShiftMgr = user.role === "SHIFT_MANAGER";

  function filterLeaf(l: NavLeaf): boolean {
    if (l.waiterHide  && isWaiter)  return false;
    if (l.displayHide && isDisplay) return false;
    if (l.superAdmin  && user.role !== "SUPER_ADMIN") return false;
    if (l.adminOnly   && !["SUPER_ADMIN","ADMIN"].includes(user.role)) return false;
    if (l.ownerOnly   && (isEditor || isViewer || isWaiter || isDisplay || isShiftMgr)) return false;
    return true;
  }

  function filterKds(l: NavLeaf): boolean {
    if (!filterLeaf(l)) return false;
    if (l.href.startsWith("/admin/kitchen")) {
      if (kdsView === "STATION_DARK"  && l.href !== "/admin/kitchen")          return false;
      if (kdsView === "TABLE"         && l.href !== "/admin/kitchen-table")    return false;
      if (kdsView === "KANBAN"        && l.href !== "/admin/kitchen-kanban")   return false;
      if (kdsView === "TICKETS"       && l.href !== "/admin/kitchen-tickets")  return false;
    }
    return true;
  }

  /* ── Set CSS variable to 52px on mount ── */
  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-w", "52px");
  }, []);

  /* ── Restore drawer width from localStorage ── */
  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY_DRAWER);
    if (saved) {
      const w = Math.min(SIDEBAR_MAX_W, Math.max(SIDEBAR_MIN_W, parseInt(saved)));
      setDrawerW(w);
    }
  }, []);

  /* ── Drawer resize ── */
  const startDrawerResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    drawerDragging.current = true;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";

    function onMove(ev: MouseEvent) {
      if (!drawerDragging.current) return;
      const newW = Math.min(SIDEBAR_MAX_W, Math.max(SIDEBAR_MIN_W, (window.innerWidth - 52) - ev.clientX));
      setDrawerW(newW);
    }
    function onUp() {
      if (!drawerDragging.current) return;
      drawerDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  /* Save drawer width to localStorage on change */
  useEffect(() => {
    localStorage.setItem(LS_KEY_DRAWER, String(drawerW));
  }, [drawerW]);

  /* ── Debounced search ── */
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSearchResults(data);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doSearch(searchQuery), 280);
    return () => clearTimeout(t);
  }, [searchQuery, doSearch]);

  /* Focus search input when panel opens */
  useEffect(() => {
    if (searchPanelOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 320);
    } else {
      setSearchQuery("");
      setSearchResults([]);
    }
  }, [searchPanelOpen]);

  /* ── Close all on Escape ── */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setDrawerOpen(false);
        setFavPanelOpen(false);
        setSearchPanelOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /* ── Handlers ── */
  function openDrawer() {
    setFavPanelOpen(false);
    setSearchPanelOpen(false);
    setDrawerOpen(true);
  }
  function closeDrawer() { setDrawerOpen(false); }
  function toggleDrawer() { drawerOpen ? closeDrawer() : openDrawer(); }

  function openFavPanel() {
    setDrawerOpen(false);
    setSearchPanelOpen(false);
    if (favBtnRef.current) {
      const rect = favBtnRef.current.getBoundingClientRect();
      setFavBtnFromBottom(window.innerHeight - rect.bottom);
    }
    setFavPanelOpen(true);
  }
  function closeFavPanel() { setFavPanelOpen(false); }
  function toggleFavPanel() { favPanelOpen ? closeFavPanel() : openFavPanel(); }

  function openSearchPanel() {
    setDrawerOpen(false);
    setFavPanelOpen(false);
    if (searchBtnRef.current) {
      const rect = searchBtnRef.current.getBoundingClientRect();
      setSearchBtnFromBottom(window.innerHeight - rect.bottom);
    }
    setSearchPanelOpen(true);
  }
  function closeSearchPanel() { setSearchPanelOpen(false); }
  function toggleSearchPanel() { searchPanelOpen ? closeSearchPanel() : openSearchPanel(); }

  function closeAll() {
    setDrawerOpen(false);
    setFavPanelOpen(false);
    setSearchPanelOpen(false);
  }

  function navigateSearch(href: string) {
    router.push(href);
    setSearchPanelOpen(false);
    setSearchQuery("");
    setSearchResults([]);
  }

  function toggleGroup(id: string) {
    setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }));
  }

  const overlayOpen     = drawerOpen || favPanelOpen || searchPanelOpen;
  const drawerTranslate = drawerOpen ? "translateX(0)" : `translateX(${drawerW + 60}px)`;

  const favSet       = new Set(favorites.map(f => f.href));
  const userInitials = (user.name ?? user.email ?? "?")
    .split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  // Gradient D: dark vertical gradient (gold edge added as a child element below)
  const useDefaultDrawer = sidebarBg === "var(--c-panel)" || !adminSidebarBg;
  const drawerBg = useDefaultDrawer
    ? "linear-gradient(180deg,#1c1c1c 0%,#161412 55%,#100f0d 100%)"
    : sidebarBg;

  return (
    <>
      <style>{`
        .nav-item-row:hover .fav-star-btn { opacity: 1 !important; }
        .fav-star-btn.is-fav { opacity: 1 !important; }
        .fav-item-row:hover .fav-remove-btn { opacity: 1 !important; }
        .drawer-scroll::-webkit-scrollbar { display: none; }
        .drawer-scroll { scrollbar-width: none; }
        .group-items-inner { overflow: hidden; transition: max-height 0.3s ease; max-height: 0; }
        .group-items-inner.open { max-height: 600px; }
        .group-chevron { transition: transform 0.22s; display: inline-block; }
        .group-chevron.open { transform: rotate(180deg); }
        .strip-icon-link:hover { background: ${T.goldSub} !important; color: ${T.gold} !important; }
        .nav-item-link:hover { background: ${T.goldSub} !important; color: ${T.gold} !important; }
        .fav-item-link:hover { background: ${T.goldSub} !important; color: ${T.gold} !important; }
        .search-result-btn:hover { background: ${T.goldSub} !important; color: ${T.gold} !important; }
      `}</style>

      {/* ── Overlay ── */}
      {overlayOpen && (
        <div
          onClick={closeAll}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 290,
          }}
        />
      )}

      {/* ══════════ STRIP ══════════ */}
      <aside style={{
        position: "fixed", top: 0, right: 0,
        width: 52, height: "100vh",
        background: T.surface,
        borderLeft: `1px solid ${T.border}`,
        display: "flex", flexDirection: "column", alignItems: "center",
        zIndex: 200,
      }}>
        {/* Hamburger */}
        <button
          onClick={toggleDrawer}
          style={{
            width: 52, height: 52, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", border: "none",
            background: drawerOpen ? T.goldSub : "transparent",
            borderBottom: `1px solid ${T.border}`,
            transition: "background 0.15s",
          }}
          title="תפריט"
        >
          {drawerOpen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.sub} strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="4" x2="20" y2="20"/>
              <line x1="20" y1="4" x2="4" y2="20"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.sub} strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          )}
        </button>

        <div style={{ flex: 1 }} />

        {/* Bottom icon buttons */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, paddingBottom: 16 }}>
          {/* Favorites */}
          <button
            ref={favBtnRef}
            onClick={toggleFavPanel}
            title="מועדפים"
            style={{
              width: 40, height: 40, borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", border: "none",
              color: favPanelOpen ? T.gold : T.sub,
              background: favPanelOpen ? T.goldSub : "transparent",
              transition: "background 0.15s, color 0.15s",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24"
              fill={favorites.length > 0 ? T.gold : "none"}
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </button>

          {/* Search */}
          <button
            ref={searchBtnRef}
            onClick={toggleSearchPanel}
            title="חיפוש"
            style={{
              width: 40, height: 40, borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", border: "none",
              color: searchPanelOpen ? T.gold : T.sub,
              background: searchPanelOpen ? T.goldSub : "transparent",
              transition: "background 0.15s, color 0.15s",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>

          {/* Settings */}
          <Link
            href="/admin/settings"
            title="הגדרות"
            className="strip-icon-link"
            style={{
              width: 40, height: 40, borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: T.sub, textDecoration: "none",
              transition: "background 0.15s, color 0.15s",
            }}
          >
            <Ic.Settings />
          </Link>

          {/* User */}
          <button
            onClick={() => onChangePassword?.()}
            title={`${user.name ?? user.email ?? ""} · ${ROLE_LABELS[user.role]}`}
            style={{
              width: 40, height: 40, borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", border: "none",
              color: T.sub,
              background: "transparent",
              transition: "background 0.15s, color 0.15s",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </button>
        </div>
      </aside>

      {/* ══════════ DRAWER ══════════ */}
      <div
        style={{
          position: "fixed", top: 0, right: 52,
          width: drawerW, height: "100vh",
          background: drawerBg,
          borderLeft: `1px solid ${T.border}`,
          zIndex: 300,
          display: "flex", flexDirection: "column",
          transform: drawerTranslate,
          transition: "transform 0.36s cubic-bezier(0.4,0,0.2,1)",
          overflow: "hidden",
          direction: "rtl",
        }}
      >
        {/* Gradient D — gold accent edge on the right (toward the strip) */}
        {useDefaultDrawer && (
          <div style={{
            position: "absolute", top: 0, right: 0,
            width: 3, height: "100%",
            background: "linear-gradient(180deg,#7a4e04 0%,#c9890a 50%,#e8b84b 100%)",
            opacity: 0.7, zIndex: 6, pointerEvents: "none",
          }} />
        )}

        {/* Resize handle */}
        <div
          onMouseDown={startDrawerResize}
          style={{
            position: "absolute", top: 0, left: 0,
            width: 5, height: "100%",
            cursor: "ew-resize", zIndex: 10,
            background: "transparent",
            transition: "background 0.15s",
          }}
          title="גרור לשינוי רוחב"
        />

        {/* Close button */}
        <button
          onClick={closeDrawer}
          style={{
            position: "absolute", top: 10, left: 10,
            width: 30, height: 30, borderRadius: "50%",
            border: `1px solid ${T.border}`, background: "transparent",
            color: T.sub, fontSize: 15, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.15s", zIndex: 5,
          }}
        >
          ✕
        </button>

        {/* Scrollable content */}
        <div
          className="drawer-scroll"
          style={{ flex: 1, overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column" }}
        >
          {/* Logo */}
          <div style={{ padding: "16px 24px 14px", borderBottom: `1px solid ${T.border}`, marginBottom: 14 }}>
            {siteLogo ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={siteLogo} alt={siteName} style={{ width: 40, height: 40, borderRadius: 10, objectFit: "contain" }} />
                <div className={playfair.className} style={{
                  fontSize: 26, fontWeight: 900, letterSpacing: 1,
                  background: GOLD_GRADIENT,
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}>
                  {siteName}
                </div>
              </div>
            ) : (
              <>
                <div className={playfair.className} style={{
                  fontSize: 32, fontWeight: 900, letterSpacing: 1,
                  background: GOLD_GRADIENT,
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  backgroundClip: "text", lineHeight: 1.1,
                }}>
                  {siteName}
                </div>
                <div style={{ fontSize: 10, color: T.muted, marginTop: 4, letterSpacing: "2px", textTransform: "uppercase" as const }}>
                  Restaurant OS
                </div>
              </>
            )}
          </div>

          {/* Nav */}
          <div style={{ padding: "0 24px 20px" }}>
            {/* Dashboard standalone link */}
            {filterLeaf(STANDALONE) && (
              <Link
                href={STANDALONE.href}
                onClick={closeDrawer}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "7px 0", fontSize: 13, fontWeight: 600,
                  color: isLeafActive(STANDALONE, pathname) ? T.gold : T.sub,
                  textDecoration: "none",
                  borderBottom: `1px solid ${T.border}`,
                  marginBottom: 10,
                }}
              >
                <span style={{ opacity: 0.7 }}><Ic.Dashboard /></span>
                {STANDALONE.label}
              </Link>
            )}

            {/* Groups with accordion */}
            {GROUPS.map(group => {
              if (group.waiterHide  && isWaiter)  return null;
              if (group.displayHide && isDisplay) return null;
              const filterFn = group.id === "kds" ? filterKds : filterLeaf;
              const visItems  = group.items.filter(filterFn);
              if (visItems.length === 0) return null;

              const isGroupOpen = !!openGroups[group.id];

              return (
                <div key={group.id}>
                  {/* Group header */}
                  <button
                    onClick={() => toggleGroup(group.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "10px 0 9px",
                      fontSize: 14, fontWeight: 800,
                      cursor: "pointer", background: "none", border: "none",
                      width: "100%", textAlign: "right" as const,
                      userSelect: "none" as const, position: "relative" as const,
                    }}
                  >
                    {/* bullet dot */}
                    <span style={{
                      fontSize: 16, lineHeight: 1, flexShrink: 0,
                      background: GOLD_GRADIENT,
                      WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}>•</span>

                    {/* label with gradient */}
                    <span style={{
                      flexShrink: 0,
                      background: GOLD_GRADIENT,
                      WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}>
                      {group.label}
                    </span>

                    {/* decorative line */}
                    <span style={{
                      flex: 1, height: 1, margin: "0 2px",
                      background: `linear-gradient(to left, transparent 0%, ${T.gold}55 100%)`,
                      display: "block",
                    }} />

                    {/* chevron */}
                    <span
                      className={`group-chevron${isGroupOpen ? " open" : ""}`}
                      style={{ fontSize: 9, color: T.gold, opacity: isGroupOpen ? 1 : 0.55, flexShrink: 0 }}
                    >
                      ▾
                    </span>

                    {/* bottom separator */}
                    <span style={{
                      position: "absolute", bottom: 0, right: 0, left: 0,
                      height: 1, background: T.border,
                      display: "block",
                    }} />
                  </button>

                  {/* Group items */}
                  <div className={`group-items-inner${isGroupOpen ? " open" : ""}`}>
                    <div style={{ padding: "4px 0 3px" }}>
                      {visItems.map(item => {
                        const active = isLeafActive(item, pathname);
                        const isFav  = favSet.has(item.href);
                        return (
                          <div
                            key={item.href}
                            className="nav-item-row"
                            style={{ display: "flex", alignItems: "center", position: "relative", margin: "1px 0" }}
                          >
                            <Link
                              href={item.href}
                              onClick={closeDrawer}
                              className="nav-item-link"
                              style={{
                                display: "flex", alignItems: "center", gap: 9,
                                padding: "7px 8px", fontSize: 13,
                                color: active ? T.gold : T.sub,
                                textDecoration: "none", borderRadius: 7,
                                background: active ? T.goldSub : "transparent",
                                fontWeight: active ? 600 : 400,
                                flex: 1,
                                transition: "all 0.12s",
                              }}
                            >
                              <span style={{
                                width: 24, height: 24, borderRadius: 6,
                                background: active ? T.goldSub : T.panel,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                flexShrink: 0,
                                color: active ? T.gold : T.muted,
                              }}>
                                <item.I />
                              </span>
                              {item.label}
                            </Link>

                            {/* Fav star button */}
                            <button
                              onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(item.href, item.label); }}
                              className={`fav-star-btn${isFav ? " is-fav" : ""}`}
                              style={{
                                position: "absolute", left: 6,
                                opacity: isFav ? 1 : 0,
                                fontSize: 12,
                                color: isFav ? accent : T.muted,
                                cursor: "pointer",
                                padding: "0 3px",
                                background: "none", border: "none",
                                flexShrink: 0,
                                lineHeight: 1,
                                transition: "opacity 0.15s, color 0.15s",
                              }}
                              title={isFav ? "הסר ממועדפים" : "הוסף למועדפים"}
                            >
                              ★
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* User footer */}
        <div style={{
          flexShrink: 0,
          padding: "14px 18px",
          borderTop: `1px solid ${T.border}`,
          display: "flex", alignItems: "center", gap: 10,
          direction: "rtl",
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: `linear-gradient(135deg,${T.gold},#7a3c04)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 800, color: "#fff", flexShrink: 0,
          }}>
            {userInitials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
              {user.name ?? user.email ?? ""}
            </div>
            <div style={{ fontSize: 10, color: T.muted }}>
              {ROLE_LABELS[user.role]}
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            {onChangePassword && (
              <button
                onClick={() => { closeDrawer(); onChangePassword(); }}
                style={{
                  padding: "3px 8px", borderRadius: 20,
                  border: `1px solid ${T.border}`, background: "transparent",
                  color: T.sub, fontSize: 11, cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                🔑 סיסמה
              </button>
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              style={{
                padding: "3px 8px", borderRadius: 20,
                border: `1px solid ${T.border}`, background: "transparent",
                color: T.sub, fontSize: 11, cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              יציאה
            </button>
          </div>
        </div>
      </div>

      {/* ══════════ FAVORITES PANEL ══════════ */}
      <div
        style={{
          position: "fixed",
          right: 52,
          bottom: favBtnFromBottom,
          width: 240,
          maxHeight: `calc(100vh - ${favBtnFromBottom + 16}px)`,
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: "12px 0 0 12px",
          zIndex: 360,
          display: "flex", flexDirection: "column",
          transform: favPanelOpen ? "translateX(0)" : "translateX(260px)",
          transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: "-6px 4px 24px rgba(0,0,0,0.4)",
          overflow: "hidden",
          pointerEvents: favPanelOpen ? "auto" : "none",
          visibility: favPanelOpen ? "visible" : "hidden",
          direction: "rtl",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "11px 14px 10px",
          borderBottom: `1px solid ${T.border}`,
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: 12, fontWeight: 800, letterSpacing: "0.4px",
            background: GOLD_GRADIENT,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            backgroundClip: "text", flex: 1,
          }}>
            ★ מועדפים
          </span>
          <button
            onClick={closeFavPanel}
            style={{
              width: 22, height: 22, borderRadius: "50%",
              border: `1px solid ${T.border}`, background: "transparent",
              color: T.muted, fontSize: 12, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
            }}
          >
            ✕
          </button>
        </div>

        {/* List — flex:1 + minHeight:0 enables scroll when panel hits maxHeight */}
        <div style={{ overflowY: "auto", padding: 8, flex: 1, minHeight: 0 }}>
          {favorites.length === 0 ? (
            <div style={{ fontSize: 11, color: T.muted, padding: "10px 8px", fontStyle: "italic", textAlign: "center" as const }}>
              לחץ ★ ליד פריט בתפריט
            </div>
          ) : (
            favorites.map(fav => (
              <div
                key={fav.href}
                className="fav-item-row"
                style={{ display: "flex", alignItems: "center", margin: "1px 0" }}
              >
                <Link
                  href={fav.href}
                  onClick={closeFavPanel}
                  className="fav-item-link"
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "7px 8px", borderRadius: 7,
                    fontSize: 13, color: T.sub, textDecoration: "none",
                    flex: 1, transition: "all 0.12s",
                  }}
                >
                  <span style={{
                    width: 24, height: 24, borderRadius: 5,
                    background: T.goldSub,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, flexShrink: 0, color: T.gold,
                  }}>
                    ★
                  </span>
                  {fav.label}
                </Link>
                <button
                  onClick={e => { e.preventDefault(); onToggleFavorite(fav.href, fav.label); }}
                  className="fav-remove-btn"
                  style={{
                    opacity: 0, fontSize: 11, color: T.muted, cursor: "pointer",
                    background: "none", border: "none", padding: "0 6px 0 2px",
                    transition: "opacity 0.15s, color 0.15s",
                  }}
                  title="הסר ממועדפים"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ══════════ SEARCH PANEL ══════════ */}
      <div
        style={{
          position: "fixed",
          right: 52,
          bottom: searchBtnFromBottom,
          width: 260,
          maxHeight: `calc(100vh - ${searchBtnFromBottom + 16}px)`,
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: "12px 0 0 12px",
          zIndex: 360,
          display: "flex", flexDirection: "column",
          transform: searchPanelOpen ? "translateX(0)" : "translateX(280px)",
          transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: "-6px 4px 24px rgba(0,0,0,0.4)",
          overflow: "hidden",
          pointerEvents: searchPanelOpen ? "auto" : "none",
          visibility: searchPanelOpen ? "visible" : "hidden",
          direction: "rtl",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "11px 14px 10px",
          borderBottom: `1px solid ${T.border}`,
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: 12, fontWeight: 800, letterSpacing: "0.4px",
            background: GOLD_GRADIENT,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            backgroundClip: "text", flex: 1,
          }}>
            🔍 חיפוש
          </span>
          <button
            onClick={closeSearchPanel}
            style={{
              width: 22, height: 22, borderRadius: "50%",
              border: `1px solid ${T.border}`, background: "transparent",
              color: T.muted, fontSize: 12, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
            }}
          >
            ✕
          </button>
        </div>

        {/* Input */}
        <div style={{ padding: "10px 12px 8px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === "Escape" && closeSearchPanel()}
            placeholder="חפש פריט בתפריט..."
            style={{
              width: "100%", padding: "7px 10px",
              border: `1px solid ${T.border}`, borderRadius: 8,
              fontSize: 13, color: T.text, background: T.panel,
              outline: "none", textAlign: "right" as const,
              direction: "rtl",
            }}
          />
        </div>

        {/* Results — flex:1 + minHeight:0 enables scroll when panel hits maxHeight */}
        <div style={{ overflowY: "auto", padding: 6, flex: 1, minHeight: 0 }}>
          {searchQuery.length < 2 ? (
            <div style={{ fontSize: 11, color: T.muted, padding: "10px 8px", fontStyle: "italic", textAlign: "center" as const }}>
              התחל להקליד לחיפוש
            </div>
          ) : searchLoading ? (
            <div style={{ fontSize: 11, color: T.muted, padding: "10px 8px", textAlign: "center" as const }}>
              טוען...
            </div>
          ) : searchResults.length === 0 ? (
            <div style={{ fontSize: 11, color: T.muted, padding: "10px 8px", fontStyle: "italic", textAlign: "center" as const }}>
              לא נמצאו תוצאות
            </div>
          ) : (
            searchResults.map((r, i) => (
              <button
                key={i}
                onClick={() => navigateSearch(r.href)}
                className="search-result-btn"
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 8,
                  padding: "7px 8px", borderRadius: 7,
                  fontSize: 13, color: T.sub,
                  background: "transparent", border: "none",
                  cursor: "pointer", textAlign: "right" as const,
                  transition: "all 0.12s", direction: "rtl",
                }}
              >
                <span style={{
                  width: 24, height: 24, borderRadius: 5,
                  background: T.goldSub,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, flexShrink: 0,
                }}>
                  {TYPE_ICON[r.type] ?? "🔍"}
                </span>
                <div style={{ flex: 1, textAlign: "right" as const, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                    {r.label}
                  </div>
                  <div style={{ fontSize: 11, color: T.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                    {r.sub}
                  </div>
                </div>
                <span style={{ fontSize: 10, color: T.muted, marginRight: "auto", flexShrink: 0 }}>
                  {r.type}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}
