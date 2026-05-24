"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/permissions";
import type { Role } from "@/generated/prisma/client";

/* ─── SVG Icon set ─────────────────────────────────────── */
const Icon = {
  Dashboard: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  Restaurant: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2l1.5 9H19.5L21 2"/><path d="M3 11v9h18v-9"/><line x1="12" y1="2" x2="12" y2="11"/>
    </svg>
  ),
  Menus: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="8" y1="9" x2="10" y2="9"/>
    </svg>
  ),
  Orders: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
  ),
  Stats: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  Layout: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
    </svg>
  ),
  Users: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  Logs: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  Kitchen: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
    </svg>
  ),
  KanbanIcon: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="5" height="18"/><rect x="10" y="3" width="5" height="11"/><rect x="17" y="3" width="5" height="15"/>
    </svg>
  ),
  Ticket: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z"/>
    </svg>
  ),
  TableView: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
    </svg>
  ),
  Password: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  Logout: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
};

/* ─── KDS views ─────────────────────────────────────────── */
const KDS_VIEWS = [
  { value: "DASHBOARD",    href: "/admin/kitchen-table",   label: "תצוגת שולחן",  Icon: Icon.TableView },
  { value: "STATION_DARK", href: "/admin/kitchen",         label: "Station Dark",  Icon: Icon.Kitchen },
  { value: "KANBAN",       href: "/admin/kitchen-kanban",  label: "Kanban",        Icon: Icon.KanbanIcon },
  { value: "TICKETS",      href: "/admin/kitchen-tickets", label: "Ticket Board",  Icon: Icon.Ticket },
];

/* ─── Nav groups ─────────────────────────────────────────── */
type NavChild = {
  href: string; label: string; Icon: React.FC;
  waiterHide?: boolean; displayHide?: boolean; ownerOnly?: boolean;
};
type NavItem = {
  href: string; label: string; Icon: React.FC; exact?: boolean;
  superAdmin?: boolean; adminOnly?: boolean; ownerOnly?: boolean;
  waiterHide?: boolean; displayHide?: boolean;
  children?: NavChild[];
};
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "כללי",
    items: [
      { href: "/admin", label: "דשבורד", Icon: Icon.Dashboard, exact: true, waiterHide: true, displayHide: true },
    ],
  },
  {
    label: "ניהול",
    items: [
      { href: "/admin/restaurants", label: "מסעדות",        Icon: Icon.Restaurant, superAdmin: true, waiterHide: true, displayHide: true },
      { href: "/admin/menus",       label: "תפריטים",       Icon: Icon.Menus,      waiterHide: true, displayHide: true },
      { href: "/admin/users",       label: "משתמשים",       Icon: Icon.Users,      adminOnly: true, waiterHide: true, displayHide: true },
      { href: "/admin/logs",        label: "לוגים",         Icon: Icon.Logs,       adminOnly: true, waiterHide: true, displayHide: true },
    ],
  },
  {
    label: "שירות",
    items: [
      {
        href: "/admin/orders",
        label: "הזמנות",
        Icon: Icon.Orders,
        displayHide: true,
        children: [
          { href: "/admin/orders/stats", label: "סטטיסטיקות", Icon: Icon.Stats, waiterHide: true, displayHide: true, ownerOnly: true },
        ],
      },
      { href: "/admin/layout-builder", label: "פריסת שולחנות", Icon: Icon.Layout, ownerOnly: true, waiterHide: true, displayHide: true },
    ],
  },
];

/* ─── Props ─────────────────────────────────────────────── */
interface SidebarProps {
  user: { name?: string | null; email?: string | null; role: Role };
  kdsView: string;
  isOpen?: boolean;
  onClose?: () => void;
  onChangePassword?: () => void;
}

/* ─── NavLink ────────────────────────────────────────────── */
function NavLink({ href, label, NavIcon, isActive, onClick, indent = false }: {
  href: string; label: string; NavIcon: React.FC;
  isActive: boolean; onClick?: () => void; indent?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "group flex items-center gap-3 rounded-lg transition-all duration-150 text-sm font-medium select-none",
        indent ? "px-3 py-2 mr-5" : "px-3 py-2.5",
        isActive
          ? "bg-amber-500 text-white shadow-sm"
          : "text-[#9ca3af] hover:text-white hover:bg-white/[0.06]"
      )}
    >
      <span className={cn(
        "shrink-0 transition-colors",
        isActive ? "text-white" : "text-[#6b7280] group-hover:text-[#d1a054]"
      )}>
        <NavIcon />
      </span>
      <span>{label}</span>
    </Link>
  );
}

/* ─── Main component ─────────────────────────────────────── */
export default function Sidebar({ user, kdsView, isOpen = false, onClose, onChangePassword }: SidebarProps) {
  const pathname = usePathname();

  const isWaiter  = user.role === "WAITER";
  const isDisplay = user.role === "DISPLAY";
  const isEditor  = user.role === "EDITOR";
  const isViewer  = user.role === "VIEWER";

  function filterItem(item: NavItem | NavChild): boolean {
    if ("waiterHide"  in item && item.waiterHide  && isWaiter)  return false;
    if ("displayHide" in item && item.displayHide && isDisplay) return false;
    if ("superAdmin"  in item && item.superAdmin  && user.role !== "SUPER_ADMIN") return false;
    if ("adminOnly"   in item && item.adminOnly   && !["SUPER_ADMIN", "ADMIN"].includes(user.role)) return false;
    if ("ownerOnly"   in item && item.ownerOnly   && (isEditor || isViewer || isWaiter || isDisplay)) return false;
    return true;
  }

  const initials = (user.name ?? user.email ?? "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  const sidebarContent = (
    <aside
      className="w-64 flex flex-col min-h-screen relative"
      style={{ background: "#0f111a", borderRight: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* Mobile close */}
      <button
        onClick={onClose}
        className="md:hidden absolute top-4 left-4 text-gray-500 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
      >
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      {/* ── Logo ── */}
      <div className="px-5 py-6">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-base text-white shadow-lg shrink-0"
            style={{ background: "linear-gradient(135deg,#c9a35d,#8B6914)" }}
          >
            M
          </div>
          <div>
            <span className="font-extrabold text-white text-lg tracking-tight">Menu4U</span>
            <span className="text-gray-600 text-xs font-medium">.</span>
          </div>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 px-3 pb-4 space-y-5 overflow-y-auto">

        {/* Main groups */}
        {NAV_GROUPS.map(group => {
          const visibleItems = group.items.filter(filterItem);
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.label}>
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-600">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {visibleItems.map(item => {
                  const isActive = item.exact
                    ? pathname === item.href
                    : pathname === item.href || pathname.startsWith(item.href + "/");

                  const visibleChildren = item.children?.filter(filterItem) ?? [];

                  return (
                    <div key={item.href}>
                      <NavLink
                        href={item.href}
                        label={item.label}
                        NavIcon={item.Icon}
                        isActive={isActive}
                        onClick={onClose}
                      />
                      {visibleChildren.length > 0 && isActive && (
                        <div className="mt-0.5 space-y-0.5">
                          {visibleChildren.map(child => (
                            <NavLink
                              key={child.href}
                              href={child.href}
                              label={child.label}
                              NavIcon={child.Icon}
                              isActive={pathname === child.href || pathname.startsWith(child.href + "/")}
                              onClick={onClose}
                              indent
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
          <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-600">
            מטבח (KDS)
          </p>
          <div className="space-y-0.5">
            {KDS_VIEWS.map(view => {
              const isActive = pathname === view.href || pathname.startsWith(view.href + "/");
              return (
                <NavLink
                  key={view.href}
                  href={view.href}
                  label={view.label}
                  NavIcon={view.Icon}
                  isActive={isActive}
                  onClick={onClose}
                />
              );
            })}
          </div>
        </div>

      </nav>

      {/* ── User footer ── */}
      <div className="px-3 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        {/* User card */}
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl mb-2" style={{ background: "rgba(255,255,255,0.04)" }}>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white truncate">{user.name ?? user.email}</div>
            <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", ROLE_COLORS[user.role])}>
              {ROLE_LABELS[user.role]}
            </span>
          </div>
        </div>

        {/* Actions */}
        <button
          onClick={onChangePassword}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          <Icon.Password />
          <span>שנה סיסמה</span>
        </button>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Icon.Logout />
          <span>יציאה מהמערכת</span>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block shrink-0">{sidebarContent}</div>

      {/* Mobile drawer */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <div className="relative z-50 h-full overflow-y-auto">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
