"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/permissions";
import type { Role } from "@/generated/prisma/client";

/* ─── Widths ─────────────────────────────────────────────── */
export const SIDEBAR_W_COLLAPSED = 60;
export const SIDEBAR_W_EXPANDED  = 256;

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
  Pin:        ({ on }: { on: boolean }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="17" x2="12" y2="22"/>
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z"/>
    </svg>
  ),
  Lock:   () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  Logout: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
};

/* ─── Nav data ───────────────────────────────────────────── */
const KDS = [
  { href: "/admin/kitchen-table",   label: "תצוגת שולחן", I: Ic.TableView },
  { href: "/admin/kitchen",         label: "Station Dark", I: Ic.Kitchen },
  { href: "/admin/kitchen-kanban",  label: "Kanban",       I: Ic.Kanban },
  { href: "/admin/kitchen-tickets", label: "Ticket Board", I: Ic.Ticket },
];

type Child = { href: string; label: string; I: React.FC; waiterHide?: boolean; displayHide?: boolean; ownerOnly?: boolean };
type Item  = { href: string; label: string; I: React.FC; exact?: boolean; superAdmin?: boolean; adminOnly?: boolean; ownerOnly?: boolean; waiterHide?: boolean; displayHide?: boolean; children?: Child[] };

const GROUPS: { label: string; items: Item[] }[] = [
  { label: "כללי", items: [
    { href: "/admin", label: "דשבורד", I: Ic.Dashboard, exact: true, waiterHide: true, displayHide: true },
  ]},
  { label: "ניהול", items: [
    { href: "/admin/restaurants",    label: "מסעדות",          I: Ic.Restaurant, superAdmin: true, waiterHide: true, displayHide: true },
    { href: "/admin/menus",          label: "תפריטים",         I: Ic.Menus,      waiterHide: true, displayHide: true },
    { href: "/admin/users",          label: "משתמשים",         I: Ic.Users,      adminOnly: true, waiterHide: true, displayHide: true },
    { href: "/admin/logs",           label: "לוגים",           I: Ic.Logs,       adminOnly: true, waiterHide: true, displayHide: true },
  ]},
  { label: "שירות", items: [
    { href: "/admin/orders", label: "הזמנות", I: Ic.Orders, displayHide: true,
      children: [{ href: "/admin/orders/stats", label: "סטטיסטיקות", I: Ic.Stats, waiterHide: true, displayHide: true, ownerOnly: true }] },
    { href: "/admin/layout-builder", label: "פריסת שולחנות", I: Ic.Layout, ownerOnly: true, waiterHide: true, displayHide: true },
  ]},
];

/* ─── Props ──────────────────────────────────────────────── */
interface SidebarProps {
  user: { name?: string | null; email?: string | null; role: Role };
  kdsView: string;
  pinned: boolean;
  onTogglePin: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  onChangePassword?: () => void;
}

/* ─── NavRow ─────────────────────────────────────────────── */
function NavRow({ href, label, I: NavIcon, isActive, isExpanded, indent = false, onClick }: {
  href: string; label: string; I: React.FC;
  isActive: boolean; isExpanded: boolean; indent?: boolean; onClick?: () => void;
}) {
  const TRANS = "all 230ms cubic-bezier(0.4,0,0.2,1)";
  return (
    <Link
      href={href}
      onClick={onClick}
      title={!isExpanded ? label : undefined}
      className={cn(
        "flex items-center rounded-xl transition-all duration-200 group",
        isActive
          ? "bg-amber-500 text-white shadow-sm"
          : "text-[#9ca3af] hover:bg-white/[0.07] hover:text-white",
      )}
      style={{
        justifyContent: isExpanded ? "flex-start" : "center",
        padding: isExpanded ? (indent ? "8px 14px" : "10px 14px") : (indent ? "8px 0" : "10px 0"),
        marginRight: indent && isExpanded ? 10 : 0,
        transition: TRANS,
      }}
    >
      <span className={cn(
        "shrink-0 flex items-center transition-colors",
        isActive ? "text-white" : "text-[#6b7280] group-hover:text-amber-400",
      )}>
        <NavIcon />
      </span>
      <span
        className="text-sm font-medium whitespace-nowrap"
        style={{
          overflow: "hidden",
          maxWidth: isExpanded ? 160 : 0,
          opacity: isExpanded ? 1 : 0,
          marginRight: isExpanded ? 10 : 0,
          transition: TRANS,
        }}
      >
        {label}
      </span>
    </Link>
  );
}

/* ─── SectionDivider ─────────────────────────────────────── */
function SectionDiv({ label, isExpanded }: { label: string; isExpanded: boolean }) {
  return (
    <div style={{ paddingTop: 16, paddingBottom: 6, overflow: "hidden" }}>
      {isExpanded ? (
        <p className="px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-600">{label}</p>
      ) : (
        <div className="mx-3 border-t border-white/[0.08]" />
      )}
    </div>
  );
}

/* ─── Component ──────────────────────────────────────────── */
export default function Sidebar({
  user, kdsView, pinned, onTogglePin, isOpen = false, onClose, onChangePassword,
}: SidebarProps) {
  const pathname = usePathname();
  const [hovered, setHovered] = useState(false);
  const isExpanded = pinned || hovered;

  const isWaiter  = user.role === "WAITER";
  const isDisplay = user.role === "DISPLAY";
  const isEditor  = user.role === "EDITOR";
  const isViewer  = user.role === "VIEWER";

  function ok(it: Item | Child): boolean {
    if (it.waiterHide  && isWaiter)  return false;
    if (it.displayHide && isDisplay) return false;
    if ("superAdmin" in it && it.superAdmin && user.role !== "SUPER_ADMIN") return false;
    if ("adminOnly"  in it && it.adminOnly  && !["SUPER_ADMIN","ADMIN"].includes(user.role)) return false;
    if (it.ownerOnly && (isEditor || isViewer || isWaiter || isDisplay)) return false;
    return true;
  }

  const initials = (user.name ?? user.email ?? "?")
    .split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  const TRANS = "width 230ms cubic-bezier(0.4,0,0.2,1)";

  /* ── inner content (same for desktop/mobile) ── */
  function SidebarInner({ expanded, close }: { expanded: boolean; close?: () => void }) {
    return (
      <div className="flex flex-col h-full" style={{ direction: "rtl" }}>

        {/* Logo */}
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
            <div
              className="w-8 h-8 shrink-0 rounded-xl flex items-center justify-center font-black text-sm text-white group-hover:opacity-80 transition-opacity"
              style={{ background: "linear-gradient(135deg,#c9a35d,#8B6914)" }}
            >M</div>
            <span
              className="font-extrabold text-white text-[16px] tracking-tight whitespace-nowrap group-hover:opacity-80"
              style={{ overflow: "hidden", maxWidth: expanded ? 120 : 0, opacity: expanded ? 1 : 0, transition: TRANS }}
            >
              Menu4U<span style={{ color: "#c9a35d" }}>.</span>
            </span>
          </Link>

          {/* Pin */}
          {expanded && (
            <button
              onClick={onTogglePin}
              title={pinned ? "שחרר קיבוע" : "קבע סיידבר"}
              className={cn(
                "w-7 h-7 shrink-0 rounded-lg flex items-center justify-center transition-all",
                pinned ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30" : "text-gray-600 hover:text-gray-400 hover:bg-white/10",
              )}
            >
              <Ic.Pin on={pinned} />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2">
          {GROUPS.map(group => {
            const vis = group.items.filter(ok);
            if (!vis.length) return null;
            return (
              <div key={group.label}>
                <SectionDiv label={group.label} isExpanded={expanded} />
                <div className="space-y-0.5">
                  {vis.map(item => {
                    const active = item.exact
                      ? pathname === item.href
                      : pathname === item.href || pathname.startsWith(item.href + "/");
                    const kids = item.children?.filter(ok) ?? [];
                    return (
                      <div key={item.href}>
                        <NavRow href={item.href} label={item.label} I={item.I}
                          isActive={active} isExpanded={expanded} onClick={close} />
                        {active && kids.map(c => (
                          <NavRow key={c.href} href={c.href} label={c.label} I={c.I}
                            isActive={pathname === c.href || pathname.startsWith(c.href + "/")}
                            isExpanded={expanded} indent onClick={close} />
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* KDS */}
          <SectionDiv label="מטבח (KDS)" isExpanded={expanded} />
          <div className="space-y-0.5">
            {KDS.map(v => (
              <NavRow key={v.href} href={v.href} label={v.label} I={v.I}
                isActive={pathname === v.href || pathname.startsWith(v.href + "/")}
                isExpanded={expanded} onClick={close} />
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="shrink-0 px-2 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {/* User card */}
          <div
            className="flex items-center rounded-xl mb-1"
            style={{
              background: "rgba(255,255,255,0.04)",
              justifyContent: expanded ? "flex-start" : "center",
              padding: expanded ? "10px 10px" : "10px 0",
              gap: expanded ? 10 : 0,
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}
            >{initials}</div>
            <div
              className="min-w-0"
              style={{ overflow: "hidden", maxWidth: expanded ? 140 : 0, opacity: expanded ? 1 : 0, transition: TRANS }}
            >
              <div className="text-sm font-semibold text-white truncate">{user.name ?? user.email}</div>
              <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", ROLE_COLORS[user.role])}>
                {ROLE_LABELS[user.role]}
              </span>
            </div>
          </div>

          {/* Buttons */}
          {[
            { label: "שנה סיסמה", Icon: Ic.Lock, onClick: onChangePassword, cls: "hover:text-white hover:bg-white/[0.06]" },
            { label: "יציאה",     Icon: Ic.Logout, onClick: () => signOut({ callbackUrl: "/login" }), cls: "hover:text-red-400 hover:bg-red-500/10" },
          ].map(btn => (
            <button
              key={btn.label}
              onClick={btn.onClick}
              title={!expanded ? btn.label : undefined}
              className={cn("w-full flex items-center rounded-lg py-2 text-xs text-gray-500 transition-colors", btn.cls)}
              style={{ justifyContent: expanded ? "flex-start" : "center", padding: expanded ? "8px 10px" : "8px 0", gap: expanded ? 8 : 0 }}
            >
              <span className="shrink-0 flex"><btn.Icon /></span>
              <span style={{ overflow: "hidden", maxWidth: expanded ? 140 : 0, opacity: expanded ? 1 : 0, whiteSpace: "nowrap", transition: TRANS }}>
                {btn.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── Desktop: fixed full-height floating sidebar ── */}
      <aside
        className="hidden md:block fixed z-30"
        style={{
          right: 0,
          top: 0,
          bottom: 0,
          width: isExpanded ? SIDEBAR_W_EXPANDED : SIDEBAR_W_COLLAPSED,
          background: "#0f111a",
          borderLeft: "1px solid rgba(255,255,255,0.06)",
          transition: TRANS,
          overflow: "hidden",
        }}
        onMouseEnter={() => !pinned && setHovered(true)}
        onMouseLeave={() => !pinned && setHovered(false)}
      >
        <SidebarInner expanded={isExpanded} />
      </aside>

      {/* ── Mobile: overlay drawer ── */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <div className="relative z-50 h-full overflow-hidden flex flex-col"
            style={{ width: SIDEBAR_W_EXPANDED, background: "#0f111a" }}>
            <button onClick={onClose}
              className="absolute top-4 left-4 text-gray-500 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors z-10">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <SidebarInner expanded close={onClose} />
          </div>
        </div>
      )}
    </>
  );
}
