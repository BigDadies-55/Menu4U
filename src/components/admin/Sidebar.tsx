"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/generated/prisma/client";

/* ─── Width ──────────────────────────────────────────────── */
export const SIDEBAR_W_COLLAPSED = 256;
export const SIDEBAR_W_EXPANDED  = 256;
export const SIDEBAR_MIN_W = 180;
export const SIDEBAR_MAX_W = 420;
export const SIDEBAR_DEFAULT_W = 256;
const LS_KEY  = "menu4u_sidebar_w";
const FAV_KEY = "menu4u_favorites";

/* ─── Admin palettes ─────────────────────────────────────── */
export const ADMIN_PALETTE_MAP: Record<string, { bg: string; accent: string; accentMuted: string; accentText: string }> = {
  dark:   { bg: "#0d0f18", accent: "#c9a84c", accentMuted: "rgba(201,168,76,0.15)",  accentText: "#e0c47a" },
  purple: { bg: "#120b1e", accent: "#9333ea", accentMuted: "rgba(147,51,234,0.15)", accentText: "#c084fc" },
  blue:   { bg: "#080f1e", accent: "#3b82f6", accentMuted: "rgba(59,130,246,0.15)", accentText: "#93c5fd" },
  green:  { bg: "#071510", accent: "#22c55e", accentMuted: "rgba(34,197,94,0.15)",  accentText: "#86efac" },
  rose:   { bg: "#150a0e", accent: "#f43f5e", accentMuted: "rgba(244,63,94,0.15)",  accentText: "#fda4af" },
  custom: { bg: "#0d0f18", accent: "#c9a84c", accentMuted: "rgba(201,168,76,0.15)", accentText: "#e0c47a" },
};

/* ─── Icons ──────────────────────────────────────────────── */
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

/* ─── Favorites ──────────────────────────────────────────── */
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

/* ─── Nav structure ──────────────────────────────────────── */
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
      { href: "/admin/cashier",      label: "קאשייר",           I: Ic.Cashier,   displayHide: true },
      { href: "/admin/orders/stats", label: "סטטיסטיקות",      I: Ic.Stats,     waiterHide: true, displayHide: true, ownerOnly: true },
      { href: "/admin/layout-builder", label: "פריסת שולחנות", I: Ic.Layout,    ownerOnly: true, waiterHide: true, displayHide: true },
      { href: "/admin/customers",      label: "לקוחות",         I: Ic.Customers, displayHide: true },
      { href: "/admin/loyalty",        label: "מועדון לקוחות ⭐", I: Ic.Loyalty,   displayHide: true },
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

/* ─── Props ──────────────────────────────────────────────── */
interface SidebarProps {
  user: { name?: string | null; email?: string | null; role: Role };
  kdsView: string;
  pinned: boolean;
  onTogglePin: () => void;
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

/* ─── Helpers ────────────────────────────────────────────── */
function isLeafActive(leaf: NavLeaf, pathname: string): boolean {
  if (leaf.exact) return pathname === leaf.href;
  if (leaf.excludeStartsWith?.some(p => pathname === p || pathname.startsWith(p + "/"))) return false;
  return pathname === leaf.href || pathname.startsWith(leaf.href + "/");
}

/* ─── NavItem ────────────────────────────────────────────── */
function NavItem({
  href, label, I: Icon, isActive, onClick, accentColor, textColor, isFavorite, onToggleFavorite,
}: {
  href: string; label: string; I: React.FC;
  isActive: boolean; onClick?: () => void;
  accentColor: string; textColor: string;
  isFavorite: boolean;
  onToggleFavorite: (href: string, label: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="group relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link
        href={href}
        onClick={onClick}
        className="flex items-center gap-2.5 rounded-lg transition-colors duration-150"
        style={{
          padding: "6px 8px",
          paddingLeft: 30, /* space for star button on left */
          color: isActive ? "#fff" : textColor,
          background: isActive ? accentColor : "transparent",
          fontWeight: isActive ? 500 : 400,
          boxShadow: isActive ? `0 2px 8px ${accentColor}44` : "none",
        }}
      >
        {!isActive && (
          <span className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            style={{ background: "rgba(255,255,255,0.05)" }} />
        )}
        <span className="shrink-0 relative z-10"
          style={{ color: isActive ? "#fff" : textColor, opacity: isActive ? 1 : 0.6 }}>
          <Icon />
        </span>
        <span className="relative z-10 text-[12.5px] whitespace-nowrap tracking-[-0.01em] flex-1">
          {label}
        </span>
      </Link>

      {/* ⭐ Star button — appears on hover, always accessible via z-index */}
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(href, label); }}
        className="absolute left-1 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-5 h-5 rounded transition-all duration-150"
        style={{
          opacity: hovered || isFavorite ? 1 : 0,
          color: isFavorite ? "#fcc419" : "rgba(255,255,255,0.35)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
        }}
        title={isFavorite ? "הסר ממועדפים" : "הוסף למועדפים"}
      >
        <svg width="11" height="11" viewBox="0 0 24 24"
          fill={isFavorite ? "currentColor" : "none"}
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      </button>
    </div>
  );
}

/* ─── Section label ──────────────────────────────────────── */
function SectionLabel({ label, accentText }: { label: string; accentText: string }) {
  return (
    <div style={{
      padding: "14px 8px 5px",
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.1em",
      textTransform: "uppercase" as const,
      color: accentText,
      opacity: 0.55,
    }}>
      {label}
    </div>
  );
}

/* ─── Main Sidebar ───────────────────────────────────────── */
export default function Sidebar({
  user, kdsView,
  isOpen = false, onOpen: _onOpen, onClose,
  adminPalette = "dark", siteLogo, siteName = "Menu4U",
  adminSidebarBg, adminSidebarAccent, adminSidebarTextColor = "#9ca3af",
  pinned: _pinned, onTogglePin: _onTogglePin,
  favorites, onToggleFavorite,
}: SidebarProps) {
  const pathname = usePathname();

  /* ── Resizable width ── */
  const [sidebarW, setSidebarW] = useState(SIDEBAR_DEFAULT_W);
  const dragging = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY);
    const w = saved ? Math.min(SIDEBAR_MAX_W, Math.max(SIDEBAR_MIN_W, parseInt(saved))) : SIDEBAR_DEFAULT_W;
    setSidebarW(w);
    document.documentElement.style.setProperty("--sidebar-w", `${w}px`);
  }, []);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    setIsDragging(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function onMove(ev: MouseEvent) {
      if (!dragging.current) return;
      const newW = Math.min(SIDEBAR_MAX_W, Math.max(SIDEBAR_MIN_W, window.innerWidth - ev.clientX));
      setSidebarW(newW);
      document.documentElement.style.setProperty("--sidebar-w", `${newW}px`);
    }
    function onUp() {
      dragging.current = false;
      setIsDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      const cur = parseInt(document.documentElement.style.getPropertyValue("--sidebar-w")) || SIDEBAR_DEFAULT_W;
      localStorage.setItem(LS_KEY, String(cur));
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  const pal = (() => {
    if (adminPalette === "custom" && adminSidebarAccent) {
      const accent = adminSidebarAccent;
      const bg     = adminSidebarBg ?? "#0f111a";
      return { bg, accent, accentMuted: `${accent}26`, accentText: accent };
    }
    return ADMIN_PALETTE_MAP[adminPalette ?? "dark"] ?? ADMIN_PALETTE_MAP.dark;
  })();

  const textColor = adminSidebarTextColor;
  const isWaiter  = user.role === "WAITER";
  const isDisplay = user.role === "DISPLAY";
  const isEditor  = user.role === "EDITOR";
  const isViewer  = user.role === "VIEWER";

  function filterLeaf(l: NavLeaf): boolean {
    if (l.waiterHide  && isWaiter)  return false;
    if (l.displayHide && isDisplay) return false;
    if (l.superAdmin  && user.role !== "SUPER_ADMIN") return false;
    if (l.adminOnly   && !["SUPER_ADMIN","ADMIN"].includes(user.role)) return false;
    if (l.ownerOnly   && (isEditor || isViewer || isWaiter || isDisplay)) return false;
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

  const favSet = new Set(favorites.map(f => f.href));
  const userInitials = (user.name ?? user.email ?? "?")
    .split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  /* ── Sidebar body ── */
  function Body({ close }: { close?: () => void }) {
    return (
      <div className="flex flex-col h-full" style={{ direction: "rtl" }}>

        {/* Logo */}
        <div className="flex items-center shrink-0"
          style={{ height: 58, padding: "0 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Link href="/" className="flex items-center gap-3 group" title="עמוד הבית" onClick={close}>
            {siteLogo ? (
              <img src={siteLogo} alt={siteName} className="w-8 h-8 rounded-xl object-contain" />
            ) : (
              <div
                className="w-8 h-8 shrink-0 rounded-xl flex items-center justify-center font-black text-[14px] text-white group-hover:opacity-80 transition-opacity"
                style={{ background: `linear-gradient(135deg,${pal.accentText},${pal.accent})` }}
              >
                {siteName[0] ?? "M"}
              </div>
            )}
            <span className="font-extrabold text-white text-[15px] tracking-tight group-hover:opacity-80 transition-opacity">
              {siteName}<span style={{ color: pal.accentText }}>.</span>
            </span>
          </Link>
        </div>

        {/* Nav — scrollable but scrollbar hidden */}
        <nav
          className="flex-1 overflow-y-auto overflow-x-hidden"
          style={{ padding: "4px 8px 8px" }}
        >
          <style>{`
            nav::-webkit-scrollbar { display: none; }
            nav { scrollbar-width: none; }
          `}</style>

          {/* Dashboard */}
          {filterLeaf(STANDALONE) && (
            <div style={{ marginBottom: 2, marginTop: 6 }}>
              <NavItem
                href={STANDALONE.href} label={STANDALONE.label} I={STANDALONE.I}
                isActive={isLeafActive(STANDALONE, pathname)} onClick={close}
                accentColor={pal.accent} textColor={textColor}
                isFavorite={favSet.has(STANDALONE.href)}
                onToggleFavorite={(href, label) => { onToggleFavorite(href, label); }}
              />
            </div>
          )}

          {/* Groups — always expanded, no accordion */}
          {GROUPS.map(group => {
            if (group.waiterHide  && isWaiter)  return null;
            if (group.displayHide && isDisplay) return null;
            const filterFn = group.id === "kds" ? filterKds : filterLeaf;
            const visItems  = group.items.filter(filterFn);
            if (visItems.length === 0) return null;

            return (
              <div key={group.id}>
                <SectionLabel label={group.label} accentText={pal.accentText} />
                <div style={{
                  borderRight: `2px solid ${pal.accent}22`,
                  marginRight: 4,
                  paddingRight: 2,
                }}>
                  {visItems.map(item => (
                    <NavItem
                      key={item.href}
                      href={item.href} label={item.label} I={item.I}
                      isActive={isLeafActive(item, pathname)} onClick={close}
                      accentColor={pal.accent} textColor={textColor}
                      isFavorite={favSet.has(item.href)}
                      onToggleFavorite={(href, label) => { onToggleFavorite(href, label); }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer: user badge */}
        <div className="shrink-0 flex items-center gap-2.5"
          style={{ padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div
            className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold text-black"
            style={{ background: pal.accent }}
          >
            {userInitials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-medium truncate leading-tight" style={{ color: "#e5e7eb" }}>
              {user.name ?? user.email ?? ""}
            </div>
            <div className="text-[10px] truncate mt-0.5" style={{ color: "rgba(255,255,255,0.32)" }}>
              {user.role}
            </div>
          </div>
        </div>

      </div>
    );
  }

  return (
    <>
      {/* Desktop — always visible, resizable */}
      <aside
        className="hidden md:block fixed z-30"
        style={{
          right: 0, top: 0, bottom: 0,
          width: sidebarW,
          background: pal.bg,
          borderLeft: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <Body />

        {/* ── Drag handle ── */}
        <div
          onMouseDown={startResize}
          className="resize-handle group"
          style={{
            position: "absolute", top: 0, left: 0, width: 5, bottom: 0,
            cursor: "col-resize", zIndex: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          title="גרור לשינוי רוחב"
        >
          <div
            style={{
              width: 3, height: "100%", borderRadius: 99,
              background: isDragging ? pal.accent : "transparent",
              transition: "background 150ms",
            }}
            className="group-hover:bg-white/20"
          />
        </div>
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <div className="relative z-50 h-full overflow-hidden"
            style={{ width: SIDEBAR_W_EXPANDED, background: pal.bg }}>
            <button onClick={onClose}
              className="absolute top-4 left-4 text-gray-500 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors z-10">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <Body close={onClose} />
          </div>
        </div>
      )}
    </>
  );
}
