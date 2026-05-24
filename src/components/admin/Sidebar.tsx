"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/permissions";
import type { Role } from "@/generated/prisma/client";

/* ─── Constants ──────────────────────────────────────────── */
const W_COLLAPSED = 60;
const W_EXPANDED  = 256;

/* ─── SVG Icons ──────────────────────────────────────────── */
const Ic = {
  Dashboard: () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  Restaurant: () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2l1.5 9h15L21 2"/><path d="M3 11v9h18v-9"/><line x1="12" y1="2" x2="12" y2="11"/></svg>,
  Menus: () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>,
  Orders: () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
  Stats: () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Layout: () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>,
  Users: () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Logs: () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  Kitchen: () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
  Kanban: () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="5" height="18"/><rect x="10" y="3" width="5" height="11"/><rect x="17" y="3" width="5" height="15"/></svg>,
  Ticket: () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z"/></svg>,
  TableView: () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>,
  Pin: ({ active }: { active: boolean }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z"/>
    </svg>
  ),
  Lock: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  Logout: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
};

/* ─── Nav data ───────────────────────────────────────────── */
const KDS_VIEWS = [
  { href: "/admin/kitchen-table",   label: "תצוגת שולחן", NavIc: Ic.TableView },
  { href: "/admin/kitchen",         label: "Station Dark", NavIc: Ic.Kitchen },
  { href: "/admin/kitchen-kanban",  label: "Kanban",       NavIc: Ic.Kanban },
  { href: "/admin/kitchen-tickets", label: "Ticket Board", NavIc: Ic.Ticket },
];

type Child = { href: string; label: string; NavIc: React.FC; waiterHide?: boolean; displayHide?: boolean; ownerOnly?: boolean };
type NavItem = {
  href: string; label: string; NavIc: React.FC; exact?: boolean;
  superAdmin?: boolean; adminOnly?: boolean; ownerOnly?: boolean;
  waiterHide?: boolean; displayHide?: boolean; children?: Child[];
};
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  { label: "כללי", items: [
    { href: "/admin", label: "דשבורד", NavIc: Ic.Dashboard, exact: true, waiterHide: true, displayHide: true },
  ]},
  { label: "ניהול", items: [
    { href: "/admin/restaurants",    label: "מסעדות",          NavIc: Ic.Restaurant, superAdmin: true, waiterHide: true, displayHide: true },
    { href: "/admin/menus",          label: "תפריטים",         NavIc: Ic.Menus,      waiterHide: true, displayHide: true },
    { href: "/admin/users",          label: "משתמשים",         NavIc: Ic.Users,      adminOnly: true, waiterHide: true, displayHide: true },
    { href: "/admin/logs",           label: "לוגים",           NavIc: Ic.Logs,       adminOnly: true, waiterHide: true, displayHide: true },
  ]},
  { label: "שירות", items: [
    { href: "/admin/orders", label: "הזמנות", NavIc: Ic.Orders, displayHide: true,
      children: [{ href: "/admin/orders/stats", label: "סטטיסטיקות", NavIc: Ic.Stats, waiterHide: true, displayHide: true, ownerOnly: true }] },
    { href: "/admin/layout-builder", label: "פריסת שולחנות", NavIc: Ic.Layout, ownerOnly: true, waiterHide: true, displayHide: true },
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

/* ─── Nav row ────────────────────────────────────────────── */
function NavRow({
  href, label, NavIc, isActive, isExpanded, indent = false, onClick,
}: {
  href: string; label: string; NavIc: React.FC; isActive: boolean;
  isExpanded: boolean; indent?: boolean; onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={!isExpanded ? label : undefined}
      className={cn(
        "flex items-center rounded-xl transition-all duration-200 group relative",
        indent ? "py-2" : "py-2.5",
        isActive ? "bg-amber-500 text-white shadow" : "text-[#9ca3af] hover:bg-white/[0.07] hover:text-white",
        // when collapsed: center icon; when expanded: normal padding
      )}
      style={{
        paddingRight: 17,
        paddingLeft: isExpanded ? 12 : 17,
        justifyContent: isExpanded ? "flex-start" : "center",
        marginRight: indent ? 12 : 0,
      }}
    >
      {/* icon */}
      <span className={cn(
        "shrink-0 flex items-center justify-center transition-colors",
        isActive ? "text-white" : "text-[#6b7280] group-hover:text-amber-400"
      )}>
        <NavIc />
      </span>

      {/* label — fades in/out */}
      <span
        className="whitespace-nowrap text-sm font-medium overflow-hidden transition-all duration-200"
        style={{
          maxWidth: isExpanded ? 180 : 0,
          opacity: isExpanded ? 1 : 0,
          marginRight: isExpanded ? 10 : 0,
        }}
      >
        {label}
      </span>
    </Link>
  );
}

/* ─── Section header ─────────────────────────────────────── */
function SectionHeader({ label, isExpanded }: { label: string; isExpanded: boolean }) {
  return (
    <div className="px-4 pt-4 pb-1.5 overflow-hidden">
      {isExpanded ? (
        <p
          className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-600 transition-opacity duration-200"
          style={{ opacity: isExpanded ? 1 : 0 }}
        >
          {label}
        </p>
      ) : (
        <div className="border-t border-white/[0.07] mx-1" />
      )}
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────── */
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

  function filter(item: NavItem | Child): boolean {
    if (item.waiterHide  && isWaiter)  return false;
    if (item.displayHide && isDisplay) return false;
    if ("superAdmin" in item && item.superAdmin && user.role !== "SUPER_ADMIN") return false;
    if ("adminOnly"  in item && item.adminOnly  && !["SUPER_ADMIN","ADMIN"].includes(user.role)) return false;
    if (item.ownerOnly && (isEditor || isViewer || isWaiter || isDisplay)) return false;
    return true;
  }

  const initials = (user.name ?? user.email ?? "?")
    .split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  /* ── floating desktop sidebar ── */
  const desktopSidebar = (
    <aside
      className="hidden md:flex flex-col fixed z-30 select-none"
      style={{
        right: 8, top: 8, bottom: 8,
        width: isExpanded ? W_EXPANDED : W_COLLAPSED,
        borderRadius: 18,
        background: "#0f111a",
        boxShadow: isExpanded
          ? "0 20px 60px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.05) inset"
          : "0 8px 24px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.04) inset",
        transition: "width 230ms cubic-bezier(0.4,0,0.2,1), box-shadow 230ms ease",
        overflow: "hidden",
        direction: "rtl",
      }}
      onMouseEnter={() => !pinned && setHovered(true)}
      onMouseLeave={() => !pinned && setHovered(false)}
    >
      {/* inner — fixed W_EXPANDED wide, anchored to the right (RTL overflow clips left) */}
      <div className="flex flex-col flex-1 min-h-0" style={{ width: W_EXPANDED, minWidth: W_EXPANDED }}>

        {/* ── Logo + pin ── */}
        <div className="flex items-center justify-between px-4 pt-5 pb-4">
          <Link href="/" className="flex items-center gap-3 group" title="עמוד הבית">
            <div
              className="w-8 h-8 shrink-0 rounded-xl flex items-center justify-center font-black text-sm text-white transition-opacity group-hover:opacity-80"
              style={{ background: "linear-gradient(135deg,#c9a35d,#8B6914)" }}
            >M</div>
            <span
              className="font-extrabold text-white text-[17px] tracking-tight whitespace-nowrap transition-opacity group-hover:opacity-80"
              style={{ opacity: isExpanded ? 1 : 0, transition: "opacity 180ms" }}
            >
              Menu4U<span style={{ color: "#c9a35d" }}>.</span>
            </span>
          </Link>

          {/* Pin button — only visible when expanded */}
          <button
            onClick={onTogglePin}
            title={pinned ? "שחרר קיבוע" : "קבע סיידבר"}
            className={cn(
              "w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150 shrink-0",
              pinned
                ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                : "text-gray-600 hover:text-gray-400 hover:bg-white/10",
            )}
            style={{ opacity: isExpanded ? 1 : 0, pointerEvents: isExpanded ? "auto" : "none" }}
          >
            <Ic.Pin active={pinned} />
          </button>
        </div>

        {/* ── Nav ── */}
        <nav className="flex-1 px-3 overflow-y-auto overflow-x-hidden space-y-0">
          {NAV_GROUPS.map(group => {
            const visibleItems = group.items.filter(filter);
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.label}>
                <SectionHeader label={group.label} isExpanded={isExpanded} />
                <div className="space-y-0.5">
                  {visibleItems.map(item => {
                    const isActive = item.exact
                      ? pathname === item.href
                      : pathname === item.href || pathname.startsWith(item.href + "/");
                    const visibleChildren = item.children?.filter(filter) ?? [];
                    return (
                      <div key={item.href}>
                        <NavRow
                          href={item.href} label={item.label} NavIc={item.NavIc}
                          isActive={isActive} isExpanded={isExpanded} onClick={onClose}
                        />
                        {isActive && visibleChildren.length > 0 && (
                          <div className="mt-0.5 space-y-0.5">
                            {visibleChildren.map(child => (
                              <NavRow
                                key={child.href} href={child.href} label={child.label} NavIc={child.NavIc}
                                isActive={pathname === child.href || pathname.startsWith(child.href + "/")}
                                isExpanded={isExpanded} indent onClick={onClose}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* KDS group */}
          <div>
            <SectionHeader label="מטבח (KDS)" isExpanded={isExpanded} />
            <div className="space-y-0.5">
              {KDS_VIEWS.map(view => (
                <NavRow
                  key={view.href} href={view.href} label={view.label} NavIc={view.NavIc}
                  isActive={pathname === view.href || pathname.startsWith(view.href + "/")}
                  isExpanded={isExpanded} onClick={onClose}
                />
              ))}
            </div>
          </div>
        </nav>

        {/* ── User footer ── */}
        <div className="px-3 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {/* Avatar row */}
          <div
            className="flex items-center gap-3 px-2 py-2.5 rounded-xl mb-1"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}
            >{initials}</div>
            <div
              className="flex-1 min-w-0 overflow-hidden transition-all duration-200"
              style={{ maxWidth: isExpanded ? 160 : 0, opacity: isExpanded ? 1 : 0 }}
            >
              <div className="text-sm font-semibold text-white truncate">{user.name ?? user.email}</div>
              <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", ROLE_COLORS[user.role])}>
                {ROLE_LABELS[user.role]}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <button
            onClick={onChangePassword}
            title={!isExpanded ? "שנה סיסמה" : undefined}
            className="w-full flex items-center rounded-lg px-3 py-2 text-xs text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors"
            style={{ justifyContent: isExpanded ? "flex-start" : "center", gap: isExpanded ? 10 : 0 }}
          >
            <span className="shrink-0 flex"><Ic.Lock /></span>
            <span className="whitespace-nowrap overflow-hidden transition-all duration-200"
              style={{ maxWidth: isExpanded ? 160 : 0, opacity: isExpanded ? 1 : 0 }}>
              שנה סיסמה
            </span>
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title={!isExpanded ? "יציאה" : undefined}
            className="w-full flex items-center rounded-lg px-3 py-2 text-xs text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            style={{ justifyContent: isExpanded ? "flex-start" : "center", gap: isExpanded ? 10 : 0 }}
          >
            <span className="shrink-0 flex"><Ic.Logout /></span>
            <span className="whitespace-nowrap overflow-hidden transition-all duration-200"
              style={{ maxWidth: isExpanded ? 160 : 0, opacity: isExpanded ? 1 : 0 }}>
              יציאה מהמערכת
            </span>
          </button>
        </div>

      </div>
    </aside>
  );

  /* ── mobile overlay sidebar ── */
  const mobileSidebar = isOpen && (
    <div className="md:hidden fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-50 h-full overflow-y-auto flex flex-col"
        style={{ width: W_EXPANDED, background: "#0f111a", direction: "rtl" }}
      >
        {/* close btn */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 text-gray-500 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* logo */}
        <div className="px-4 pt-5 pb-4">
          <Link href="/" className="flex items-center gap-3" onClick={onClose}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm text-white" style={{ background: "linear-gradient(135deg,#c9a35d,#8B6914)" }}>M</div>
            <span className="font-extrabold text-white text-[17px] tracking-tight">Menu4U<span style={{ color: "#c9a35d" }}>.</span></span>
          </Link>
        </div>

        {/* nav */}
        <nav className="flex-1 px-3 space-y-0">
          {NAV_GROUPS.map(group => {
            const visibleItems = group.items.filter(filter);
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.label}>
                <SectionHeader label={group.label} isExpanded />
                <div className="space-y-0.5">
                  {visibleItems.map(item => {
                    const isActive = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
                    const visibleChildren = item.children?.filter(filter) ?? [];
                    return (
                      <div key={item.href}>
                        <NavRow href={item.href} label={item.label} NavIc={item.NavIc} isActive={isActive} isExpanded onClick={onClose} />
                        {isActive && visibleChildren.map(child => (
                          <NavRow key={child.href} href={child.href} label={child.label} NavIc={child.NavIc}
                            isActive={pathname === child.href || pathname.startsWith(child.href + "/")}
                            isExpanded indent onClick={onClose} />
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div>
            <SectionHeader label="מטבח (KDS)" isExpanded />
            <div className="space-y-0.5">
              {KDS_VIEWS.map(view => (
                <NavRow key={view.href} href={view.href} label={view.label} NavIc={view.NavIc}
                  isActive={pathname === view.href || pathname.startsWith(view.href + "/")}
                  isExpanded onClick={onClose} />
              ))}
            </div>
          </div>
        </nav>

        {/* user */}
        <div className="px-3 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-3 px-2 py-2.5 rounded-xl mb-1" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>{initials}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">{user.name ?? user.email}</div>
              <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", ROLE_COLORS[user.role])}>{ROLE_LABELS[user.role]}</span>
            </div>
          </div>
          <button onClick={onChangePassword} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors">
            <Ic.Lock /><span>שנה סיסמה</span>
          </button>
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
            <Ic.Logout /><span>יציאה מהמערכת</span>
          </button>
        </div>
      </div>
    </div>
  );

  return <>{desktopSidebar}{mobileSidebar}</>;
}
