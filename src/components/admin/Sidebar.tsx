"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/permissions";
import type { Role } from "@/generated/prisma";

const navItems = [
  { href: "/admin", label: "דשבורד", icon: "📊", exact: true },
  { href: "/admin/restaurants", label: "מסעדות", icon: "🍽️", superAdmin: true },
  { href: "/admin/menus", label: "תפריטים", icon: "📋" },
  { href: "/admin/orders", label: "הזמנות", icon: "🛒" },
  { href: "/admin/users", label: "משתמשים", icon: "👥", adminOnly: true },
];

interface SidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    role: Role;
  };
}

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  const visibleItems = navItems.filter((item) => {
    if (item.superAdmin && user.role !== "SUPER_ADMIN") return false;
    if (item.adminOnly && user.role === "VIEWER") return false;
    return true;
  });

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col min-h-screen">
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center font-bold text-lg">
            M
          </div>
          <div>
            <div className="font-bold text-lg">Menu4U</div>
            <div className="text-gray-400 text-xs">ממשק ניהול</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {visibleItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-sm font-medium",
                isActive
                  ? "bg-orange-500 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              )}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-gray-600 rounded-full flex items-center justify-center text-sm font-bold">
            {user.name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              {user.name ?? user.email}
            </div>
            <span
              className={cn(
                "text-xs px-2 py-0.5 rounded-full font-medium",
                ROLE_COLORS[user.role]
              )}
            >
              {ROLE_LABELS[user.role]}
            </span>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full text-sm text-gray-400 hover:text-white hover:bg-gray-800 py-2 rounded-lg transition-colors"
        >
          יציאה
        </button>
      </div>
    </aside>
  );
}
