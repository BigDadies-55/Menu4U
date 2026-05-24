"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Role } from "@/generated/prisma/client";
import { ROLE_LABELS } from "@/lib/permissions";

/* ─── Page-name map ────────────────────────────────────────── */
const PAGE_NAMES: { pattern: RegExp; name: string }[] = [
  { pattern: /^\/admin\/restaurants/,   name: "מסעדות" },
  { pattern: /^\/admin\/menus/,         name: "תפריטים" },
  { pattern: /^\/admin\/users/,         name: "משתמשים" },
  { pattern: /^\/admin\/logs/,          name: "לוגים" },
  { pattern: /^\/admin\/orders\/stats/, name: "סטטיסטיקות הזמנות" },
  { pattern: /^\/admin\/orders/,        name: "הזמנות" },
  { pattern: /^\/admin\/layout-builder/,name: "פריסת שולחנות" },
  { pattern: /^\/admin\/kitchen-table/, name: "KDS — תצוגת שולחן" },
  { pattern: /^\/admin\/kitchen-kanban/,name: "KDS — Kanban" },
  { pattern: /^\/admin\/kitchen-tickets/,name:"KDS — Ticket Board" },
  { pattern: /^\/admin\/kitchen/,       name: "KDS — Station Dark" },
  { pattern: /^\/admin\/?$/,            name: "דשבורד" },
];

function getPageName(pathname: string) {
  for (const { pattern, name } of PAGE_NAMES) {
    if (pattern.test(pathname)) return name;
  }
  return "ניהול";
}

/* ─── Props ────────────────────────────────────────────────── */
interface Props {
  user: { name?: string | null; email?: string | null; role: Role };
  onChangePassword: () => void;
  onOpenMobileSidebar: () => void;
}

export default function TopBar({ user, onChangePassword, onOpenMobileSidebar }: Props) {
  const pathname = usePathname();
  const pageName = getPageName(pathname);
  const [open, setOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initials = (user.name ?? user.email ?? "?")
    .split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  const displayName = user.name ?? user.email ?? "";

  return (
    <div
      className="sticky top-0 z-20 flex items-center justify-between px-4"
      style={{
        height: 40,
        background: "rgba(255,255,255,0.7)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(229,231,235,0.6)",
        direction: "rtl",
      }}
    >
      {/* Right side: hamburger (mobile) + page title */}
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          className="md:hidden text-gray-500 hover:text-gray-800 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          onClick={onOpenMobileSidebar}
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>

        {/* Logo mark */}
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center font-black text-[11px] text-white shrink-0"
          style={{ background: "linear-gradient(135deg,#c9a35d,#8B6914)" }}
        >
          M
        </div>

        {/* Page title */}
        <h1 className="text-[13px] font-semibold text-gray-800 tracking-tight">{pageName}</h1>
      </div>

      {/* Left side: avatar + dropdown */}
      <div ref={dropRef} className="relative">
        {/* Avatar button */}
        <button
          onClick={() => setOpen(v => !v)}
          title={`${displayName} · ${ROLE_LABELS[user.role]}`}
          className="relative flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-gray-50 transition-colors group"
        >
          {/* Name (hidden on small screens) */}
          <span className="hidden sm:block text-xs font-medium text-gray-600 max-w-[130px] truncate">
            {displayName}
          </span>

          {/* Avatar circle */}
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
            style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}
          >
            {initials}
          </div>

          {/* Hover tooltip */}
          <div className="pointer-events-none absolute left-0 top-full mt-1 hidden group-hover:block z-30">
            <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
              <div className="font-semibold">{displayName}</div>
              <div className="text-gray-400 mt-0.5">{ROLE_LABELS[user.role]}</div>
            </div>
          </div>
        </button>

        {/* Dropdown */}
        {open && (
          <div
            className="absolute left-0 top-full mt-1.5 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-40"
            style={{ direction: "rtl" }}
          >
            {/* User info header */}
            <div className="px-4 py-2.5 border-b border-gray-100 mb-1">
              <div className="text-sm font-semibold text-gray-900 truncate">{displayName}</div>
              <div className="text-xs text-gray-400 mt-0.5 truncate">{user.email}</div>
            </div>

            {/* Change password */}
            <button
              onClick={() => { setOpen(false); onChangePassword(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              שינוי סיסמה
            </button>

            {/* Divider */}
            <div className="my-1 border-t border-gray-100" />

            {/* Logout */}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
            >
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              יציאה
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
