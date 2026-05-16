"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/permissions";
import type { Role } from "@/generated/prisma/client";

const navItems = [
  { href: "/admin", label: "דשבורד", icon: "▣", exact: true },
  { href: "/admin/restaurants", label: "מסעדות", icon: "◈", superAdmin: true },
  { href: "/admin/menus", label: "תפריטים", icon: "◉" },
  { href: "/admin/orders", label: "הזמנות", icon: "◎" },
  { href: "/admin/users", label: "משתמשים", icon: "◍", adminOnly: true },
];

interface SidebarProps {
  user: { name?: string | null; email?: string | null; role: Role };
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ user, isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) => {
    if (item.superAdmin && user.role !== "SUPER_ADMIN") return false;
    if (item.adminOnly && user.role === "VIEWER") return false;
    return true;
  });
  const initials = (user.name ?? user.email ?? "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const sidebarContent = (
    <aside className="w-64 flex flex-col min-h-screen relative" style={{ background: "linear-gradient(180deg,#0f172a 0%,#1e293b 100%)" }}>
      {/* Close button - mobile only */}
      <button onClick={onClose} className="md:hidden absolute top-4 left-4 text-slate-400 hover:text-white p-1 rounded transition-colors">
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>

      {/* Logo */}
      <div className="px-6 py-7 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg text-white shadow-lg" style={{ background: "linear-gradient(135deg,#d97706,#f59e0b)" }}>M</div>
          <div>
            <div className="font-bold text-white text-lg tracking-wide">Menu4U</div>
            <div className="text-slate-400 text-xs tracking-wider uppercase">Management</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-0.5">
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest px-3 mb-3">ניווט</p>
        {visibleItems.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} onClick={onClose}
              className={cn("group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-sm font-medium",
                isActive ? "text-white shadow-md" : "text-slate-400 hover:text-white hover:bg-white/5")}
              style={isActive ? { background: "linear-gradient(90deg,#d97706,#f59e0b)" } : undefined}>
              <span className={cn("text-base transition-transform duration-150", isActive ? "text-white" : "text-slate-500 group-hover:text-amber-400")}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white/5 mb-2">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>{initials}</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white truncate">{user.name ?? user.email}</div>
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", ROLE_COLORS[user.role])}>{ROLE_LABELS[user.role]}</span>
          </div>
        </div>
        <button onClick={() => signOut({ callbackUrl: "/login" })} className="w-full text-xs text-slate-500 hover:text-white hover:bg-white/5 py-2 rounded-lg transition-colors">
          יציאה מהמערכת
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop: static in flex */}
      <div className="hidden md:block shrink-0">{sidebarContent}</div>

      {/* Mobile: fixed drawer */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <div className="relative z-50 h-full overflow-y-auto">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
