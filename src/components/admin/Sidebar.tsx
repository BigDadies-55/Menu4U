"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/permissions";
import type { Role } from "@/generated/prisma/client";

/* ─── Widths ─────────────────────────────────────────────── */
export const SIDEBAR_W_COLLAPSED = 8;
export const SIDEBAR_W_EXPANDED  = 256;

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
  Dashboard:  () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  Restaurant: () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2l1.5 9h15L21 2"/><path d="M3 11v9h18v-9"/><line x1="12" y1="2" x2="12" y2="11"/></svg>,
  Menus:      () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>,
  Orders:     () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
  Stats:      () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Layout:     () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>,
  Users:      () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Logs:       () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  Kitchen:    () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
  Kanban:     () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="5" height="18"/><rect x="10" y="3" width="5" height="11"/><rect x="17" y="3" width="5" height="15"/></svg>,
  Ticket:     () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z"/></svg>,
  TableView:  () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>,
  // Group header icons
  Manage:     () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M4.93 19.07l1.41-1.41M19.07 19.07l-1.41-1.41M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>,
  Service:    () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v5a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
  KDSIcon:    () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  Chevron:    ({ open }: { open: boolean }) => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms" }}>
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  Settings:   () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>,
  Customers: () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Pin:   ({ on }: { on: boolean }) => <svg width="14" height="14" viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z"/></svg>,
  Lock:  () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  Logout:() => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
};

/* ─── Nav structure ──────────────────────────────────────── */
type NavLeaf = {
  href: string; label: string; I: React.FC;
  exact?: boolean; superAdmin?: boolean; adminOnly?: boolean;
  ownerOnly?: boolean; waiterHide?: boolean; displayHide?: boolean;
  children?: NavLeaf[];
};

type NavGroup = {
  id: string; label: string; I: React.FC;
  waiterHide?: boolean; displayHide?: boolean;
  items: NavLeaf[];
};

// Standalone item (Dashboard)
const STANDALONE: NavLeaf = {
  href: "/admin", label: "דשבורד", I: Ic.Dashboard,
  exact: true, waiterHide: true, displayHide: true,
};

const GROUPS: NavGroup[] = [
  {
    id: "manage", label: "ניהול", I: Ic.Manage,
    waiterHide: true, displayHide: true,
    items: [
      { href: "/admin/restaurants", label: "מסעדות",  I: Ic.Restaurant, superAdmin: true, waiterHide: true, displayHide: true },
      { href: "/admin/menus",       label: "תפריטים", I: Ic.Menus,      waiterHide: true, displayHide: true },
      { href: "/admin/users",       label: "משתמשים", I: Ic.Users,      adminOnly: true,  waiterHide: true, displayHide: true },
      { href: "/admin/logs",        label: "לוגים",    I: Ic.Logs,       adminOnly: true,  waiterHide: true, displayHide: true },
      { href: "/admin/settings",    label: "הגדרות",   I: Ic.Settings,   waiterHide: true, displayHide: true },
    ],
  },
  {
    id: "service", label: "שירות", I: Ic.Service,
    displayHide: true,
    items: [
      {
        href: "/admin/orders", label: "הזמנות", I: Ic.Orders, displayHide: true,
        children: [
          { href: "/admin/orders/stats", label: "סטטיסטיקות", I: Ic.Stats, waiterHide: true, displayHide: true, ownerOnly: true },
        ],
      },
      { href: "/admin/layout-builder", label: "פריסת שולחנות", I: Ic.Layout, ownerOnly: true, waiterHide: true, displayHide: true },
      { href: "/admin/customers", label: "לקוחות", I: Ic.Customers, displayHide: true },
    ],
  },
  {
    id: "kds", label: "KDS", I: Ic.KDSIcon,
    items: [
      { href: "/admin/kitchen-table",   label: "תצוגת שולחן", I: Ic.TableView },
      { href: "/admin/kitchen",         label: "Station Dark", I: Ic.Kitchen },
      { href: "/admin/kitchen-kanban",  label: "Kanban",       I: Ic.Kanban },
      { href: "/admin/kitchen-tickets", label: "Ticket Board", I: Ic.Ticket },
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
}

/* ─── Helpers ────────────────────────────────────────────── */
function isLeafActive(leaf: NavLeaf, pathname: string): boolean {
  if (leaf.exact) return pathname === leaf.href;
  return pathname === leaf.href || pathname.startsWith(leaf.href + "/");
}

function isGroupActive(group: NavGroup, pathname: string): boolean {
  return group.items.some(item =>
    isLeafActive(item, pathname) || (item.children ?? []).some(c => isLeafActive(c, pathname))
  );
}

/* ─── Sub-components ─────────────────────────────────────── */

/** Single nav link row */
function NavLink({ href, label, I: Icon, isActive, depth = 0, isExpanded, onClick, accentColor, accentMuted, textColor = "#9ca3af" }: {
  href: string; label: string; I: React.FC;
  isActive: boolean; depth?: number; isExpanded: boolean; onClick?: () => void;
  accentColor: string; accentMuted: string; textColor?: string;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={!isExpanded ? label : undefined}
      className="flex items-center rounded-lg transition-all duration-150 group hover:bg-white/[0.07]"
      style={{
        padding: isExpanded ? (depth > 0 ? "7px 12px" : "9px 12px") : "9px 0",
        justifyContent: isExpanded ? "flex-start" : "center",
        paddingRight: isExpanded ? (depth > 0 ? 12 : 12) : 0,
        marginRight: isExpanded && depth > 0 ? 8 : 0,
        color: isActive ? "#fff" : textColor,
        ...(isActive ? { background: accentColor } : {}),
      }}
    >
      <span className="shrink-0 flex transition-colors"
        style={{ color: isActive ? "#fff" : textColor }}
      >
        <Icon />
      </span>
      <span
        className="text-sm font-medium whitespace-nowrap"
        style={{
          overflow: "hidden",
          maxWidth: isExpanded ? 160 : 0,
          opacity: isExpanded ? 1 : 0,
          marginRight: isExpanded ? 9 : 0,
          transition: "all 220ms cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {label}
      </span>
    </Link>
  );
}

/** Accordion group header + collapsible children */
function NavGroupSection({ group, pathname, isExpanded, open, onToggle, filterLeaf, onClick, accentColor, accentMuted, accentText, textColor = "#9ca3af" }: {
  group: NavGroup;
  pathname: string;
  isExpanded: boolean;
  open: boolean;
  onToggle: () => void;
  filterLeaf: (l: NavLeaf) => boolean;
  onClick?: () => void;
  accentColor: string;
  accentMuted: string;
  accentText: string;
  textColor?: string;
}) {
  const groupActive = isGroupActive(group, pathname);
  const visItems = group.items.filter(filterLeaf);
  if (visItems.length === 0) return null;

  return (
    <div>
      {/* Group header button */}
      <button
        onClick={isExpanded ? onToggle : undefined}
        title={!isExpanded ? group.label : undefined}
        className="w-full flex items-center rounded-lg transition-all duration-150 group hover:bg-white/[0.07]"
        style={{
          padding: isExpanded ? "9px 12px" : "9px 0",
          justifyContent: isExpanded ? "flex-start" : "center",
          cursor: isExpanded ? "pointer" : "default",
          color: (groupActive && !isExpanded) ? accentText : textColor,
          ...(groupActive && !isExpanded ? { background: accentMuted } : {}),
        }}
      >
        <span className="shrink-0 flex transition-colors"
          style={{ color: groupActive ? accentText : textColor }}
        >
          <group.I />
        </span>

        {/* Label + chevron (only when expanded) */}
        <span
          className="flex items-center flex-1 min-w-0"
          style={{
            overflow: "hidden",
            maxWidth: isExpanded ? 200 : 0,
            opacity: isExpanded ? 1 : 0,
            transition: "all 220ms cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          <span className="text-sm font-semibold whitespace-nowrap mr-2 flex-1 text-right">
            {group.label}
          </span>
          <span style={groupActive ? { color: accentText } : { color: "#4b5563" }}>
            <Ic.Chevron open={open} />
          </span>
        </span>
      </button>

      {/* Children (only in expanded sidebar) */}
      {isExpanded && open && (
        <div
          className="overflow-hidden"
          style={{
            paddingRight: 8,
            borderRight: "2px solid rgba(255,255,255,0.07)",
            marginRight: 14,
            marginTop: 2,
            marginBottom: 4,
          }}
        >
          {visItems.map(item => {
            const active = isLeafActive(item, pathname);
            const visKids = (item.children ?? []).filter(filterLeaf);
            return (
              <div key={item.href}>
                <NavLink
                  href={item.href} label={item.label} I={item.I}
                  isActive={active} isExpanded depth={1} onClick={onClick}
                  accentColor={accentColor} accentMuted={accentMuted}
                  textColor={textColor}
                />
                {active && visKids.map(c => (
                  <NavLink
                    key={c.href} href={c.href} label={c.label} I={c.I}
                    isActive={isLeafActive(c, pathname)}
                    isExpanded depth={2} onClick={onClick}
                    accentColor={accentColor} accentMuted={accentMuted}
                    textColor={textColor}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────── */
export default function Sidebar({
  user, kdsView, pinned, onTogglePin, isOpen = false, onOpen, onClose, onChangePassword,
  adminPalette = "dark", siteLogo, siteName = "Menu4U",
  adminSidebarBg, adminSidebarAccent, adminSidebarTextColor = "#9ca3af",
}: SidebarProps) {
  const pathname  = usePathname();
  const pal = (() => {
    if (adminPalette === "custom" && adminSidebarAccent) {
      const accent = adminSidebarAccent;
      const bg     = adminSidebarBg ?? "#0f111a";
      return { bg, accent, accentMuted: `${accent}26`, accentText: accent };
    }
    return ADMIN_PALETTE_MAP[adminPalette ?? "dark"] ?? ADMIN_PALETTE_MAP.dark;
  })();
  const textColor = adminSidebarTextColor;

  // openGroups: which accordion sections are open
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    // Auto-open group that contains the active item
    const initial = new Set<string>();
    for (const g of GROUPS) {
      if (isGroupActive(g, pathname)) initial.add(g.id);
    }
    return initial;
  });

  // When pathname changes, ensure the active group is open
  useEffect(() => {
    for (const g of GROUPS) {
      if (isGroupActive(g, pathname)) {
        setOpenGroups(prev => {
          if (prev.has(g.id)) return prev;
          const next = new Set(prev);
          next.add(g.id);
          return next;
        });
      }
    }
  }, [pathname]);

  // isOpen controls desktop expansion (via hamburger click); pinned keeps it always open
  const isExpanded = pinned || isOpen;

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

  function toggleGroup(id: string) {
    setOpenGroups(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const initials = (user.name ?? user.email ?? "?")
    .split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  const TRANS = "width 230ms cubic-bezier(0.4,0,0.2,1)";

  /* ── Inner content ── */
  function SidebarBody({ expanded, close }: { expanded: boolean; close?: () => void }) {
    const standActive = isLeafActive(STANDALONE, pathname);

    return (
      <div className="flex flex-col h-full" style={{ direction: "rtl" }}>

        {/* Logo row */}
        <div
          className="flex items-center shrink-0"
          style={{
            height: 64,
            justifyContent: expanded ? "space-between" : "center",
            padding: expanded ? "0 14px" : "0",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <Link href="/" className="flex items-center gap-3 group" title="עמוד הבית" onClick={close}>
            {siteLogo ? (
              <img src={siteLogo} alt={siteName} className="w-8 h-8 rounded-xl object-contain" />
            ) : (
              <div
                className="w-8 h-8 shrink-0 rounded-xl flex items-center justify-center font-black text-sm text-white group-hover:opacity-80 transition-opacity"
                style={{ background: "linear-gradient(135deg,#c9a35d,#8B6914)" }}
              >M</div>
            )}
            <span
              className="font-extrabold text-white text-[16px] tracking-tight whitespace-nowrap group-hover:opacity-80"
              style={{ overflow: "hidden", maxWidth: expanded ? 120 : 0, opacity: expanded ? 1 : 0, transition: TRANS }}
            >
              {siteName}<span style={{ color: "#c9a35d" }}>.</span>
            </span>
          </Link>
          {expanded && (
            <button
              onClick={onTogglePin}
              title={pinned ? "שחרר קיבוע" : "קבע סיידבר"}
              className="w-7 h-7 shrink-0 rounded-lg flex items-center justify-center transition-all"
              style={pinned
                ? { background: pal.accentMuted, color: pal.accentText }
                : { color: "#4b5563" }
              }
            >
              <Ic.Pin on={pinned} />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 space-y-0.5">

          {/* Dashboard — standalone */}
          {filterLeaf(STANDALONE) && (
            <NavLink
              href={STANDALONE.href} label={STANDALONE.label} I={STANDALONE.I}
              isActive={standActive} isExpanded={expanded} onClick={close}
              accentColor={pal.accent} accentMuted={pal.accentMuted}
              textColor={textColor}
            />
          )}

          {/* Accordion groups */}
          {GROUPS.map(group => {
            // Hide whole group if all items are hidden for this role
            if (group.waiterHide && isWaiter)   return null;
            if (group.displayHide && isDisplay) return null;
            return (
              <NavGroupSection
                key={group.id}
                group={group}
                pathname={pathname}
                isExpanded={expanded}
                open={openGroups.has(group.id)}
                onToggle={() => toggleGroup(group.id)}
                filterLeaf={filterLeaf}
                onClick={close}
                accentColor={pal.accent}
                accentMuted={pal.accentMuted}
                accentText={pal.accentText}
                textColor={textColor}
              />
            );
          })}

        </nav>

      </div>
    );
  }

  return (
    <>
      {/* Desktop click-outside backdrop (only when open & not pinned) */}
      {isOpen && !pinned && (
        <div
          className="hidden md:block fixed inset-0 z-20"
          onClick={onClose}
        />
      )}

      {/* Desktop fixed sidebar */}
      <aside
        className="hidden md:block fixed z-30"
        style={{
          right: 0, top: 0, bottom: 0,
          width: isExpanded ? SIDEBAR_W_EXPANDED : SIDEBAR_W_COLLAPSED,
          background: pal.bg,
          borderLeft: "1px solid rgba(255,255,255,0.12)",
          transition: TRANS,
          overflow: "hidden",
          cursor: isExpanded ? "default" : "pointer",
        }}
        onClick={!isExpanded ? onOpen : undefined}
      >
        {/* Collapsed: thin strip with subtle pill indicator */}
        {!isExpanded && (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <div className="w-0.5 h-10 rounded-full bg-white opacity-25" />
          </div>
        )}
        {isExpanded && <SidebarBody expanded={isExpanded} />}
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <div className="relative z-50 h-full flex flex-col overflow-hidden"
            style={{ width: SIDEBAR_W_EXPANDED, background: pal.bg }}>
            <button onClick={onClose}
              className="absolute top-4 left-4 text-gray-500 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors z-10">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <SidebarBody expanded close={onClose} />
          </div>
        </div>
      )}
    </>
  );
}
