"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Role } from "@/generated/prisma/client";
import { ROLE_LABELS } from "@/lib/permissions";

/* ─── Page-name map ─────────────────────────────────────────── */
const PAGE_NAMES: { pattern: RegExp; name: string }[] = [
  { pattern: /^\/admin\/restaurants/,    name: "מסעדות" },
  { pattern: /^\/admin\/menus/,          name: "תפריטים" },
  { pattern: /^\/admin\/users/,          name: "משתמשים" },
  { pattern: /^\/admin\/logs/,           name: "לוגים" },
  { pattern: /^\/admin\/orders\/stats/,  name: "סטטיסטיקות הזמנות" },
  { pattern: /^\/admin\/orders/,         name: "הזמנות" },
  { pattern: /^\/admin\/layout-builder/, name: "פריסת שולחנות" },
  { pattern: /^\/admin\/kitchen-table/,  name: "KDS — תצוגת שולחן" },
  { pattern: /^\/admin\/kitchen-kanban/, name: "KDS — Kanban" },
  { pattern: /^\/admin\/kitchen-tickets/,name: "KDS — Ticket Board" },
  { pattern: /^\/admin\/kitchen/,        name: "KDS — Station Dark" },
  { pattern: /^\/admin\/?$/,             name: "דשבורד" },
];
function getPageName(pathname: string) {
  for (const { pattern, name } of PAGE_NAMES) {
    if (pattern.test(pathname)) return name;
  }
  return "ניהול";
}

/* ─── Type icons ─────────────────────────────────────────────── */
const TYPE_ICON: Record<string, string> = {
  restaurant: "🍽️",
  menu:       "📋",
  item:       "🍕",
  user:       "👤",
};

type SearchResult = { type: string; id: string; label: string; sub: string; href: string };

/* ─── Props ──────────────────────────────────────────────────── */
interface Props {
  user: { name?: string | null; email?: string | null; role: Role };
  onChangePassword: () => void;
  onOpenMobileSidebar: () => void;
}

export default function TopBar({ user, onChangePassword, onOpenMobileSidebar }: Props) {
  const pathname = usePathname();
  const router   = useRouter();
  const pageName = getPageName(pathname);

  /* ── Avatar dropdown ── */
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  /* ── Search ── */
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [query,         setQuery]         = useState("");
  const [results,       setResults]       = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);

  /* Close dropdowns on outside click */
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) setAvatarOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false); setQuery(""); setResults([]);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* Focus input when search opens */
  useEffect(() => {
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 50);
  }, [searchOpen]);

  /* Debounced search */
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doSearch(query), 280);
    return () => clearTimeout(t);
  }, [query, doSearch]);

  function navigate(href: string) {
    router.push(href);
    setSearchOpen(false); setQuery(""); setResults([]);
  }

  const initials    = (user.name ?? user.email ?? "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const displayName = user.name ?? user.email ?? "";

  return (
    <div
      className="sticky top-0 z-20 flex items-center justify-between px-4 gap-3"
      style={{
        height: 40,
        background: "rgba(255,255,255,0.7)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(229,231,235,0.6)",
        direction: "rtl",
      }}
    >
      {/* ── Right: hamburger + page title ── */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          className="text-gray-500 hover:text-gray-800 p-1 rounded-lg hover:bg-gray-100/80 transition-colors"
          onClick={onOpenMobileSidebar}
          style={{ transform: "scaleX(-1)" }}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="15" y2="18"/>
          </svg>
        </button>
        <h1 className="text-[13px] font-semibold text-gray-800 tracking-tight whitespace-nowrap">{pageName}</h1>
      </div>

      {/* ── Left: search + avatar ── */}
      <div className="flex items-center gap-1 shrink-0">

        {/* Search */}
        <div ref={searchRef} className="flex items-center relative" style={{ direction: "rtl" }}>
          {/* Expanding input — grows to the right */}
          <div
            className="flex items-center overflow-hidden transition-all duration-200 rounded-lg"
            style={{
              width: searchOpen ? 210 : 0,
              opacity: searchOpen ? 1 : 0,
              background: "rgba(243,244,246,0.9)",
              border: searchOpen ? "1px solid #e5e7eb" : "1px solid transparent",
            }}
          >
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Escape" && (setSearchOpen(false), setQuery(""), setResults([]))}
              placeholder="חיפוש בכל האתר..."
              className="flex-1 bg-transparent text-xs text-gray-700 placeholder-gray-400 px-3 py-1.5 outline-none min-w-0"
              style={{ direction: "rtl" }}
            />
            {searchLoading && (
              <svg className="animate-spin shrink-0 ml-2" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            )}
          </div>

          {/* Magnifying glass / X button */}
          <button
            onClick={() => { setSearchOpen(v => !v); if (searchOpen) { setQuery(""); setResults([]); } }}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100/80 transition-colors shrink-0"
            title="חיפוש"
          >
            {searchOpen ? (
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            ) : (
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            )}
          </button>

          {/* Results dropdown */}
          {searchOpen && query.length >= 2 && (
            <div
              className="absolute top-full mt-1.5 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50"
              style={{ left: 0, minWidth: 280, maxWidth: 340, direction: "rtl" }}
            >
              {results.length === 0 && !searchLoading ? (
                <div className="px-4 py-5 text-center text-sm text-gray-400">לא נמצאו תוצאות</div>
              ) : (
                <div className="py-1">
                  {results.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => navigate(r.href)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-right"
                    >
                      <span className="text-base shrink-0">{TYPE_ICON[r.type] ?? "🔍"}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 truncate">{r.label}</div>
                        <div className="text-xs text-gray-400 truncate">{r.sub}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Avatar */}
        <div ref={avatarRef} className="relative shrink-0">
        <button
          onClick={() => setAvatarOpen(v => !v)}
          title={`${displayName} · ${ROLE_LABELS[user.role]}`}
          className="relative flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-gray-50/80 transition-colors group"
        >
          <span className="hidden sm:block text-xs font-medium text-gray-600 max-w-[130px] truncate">
            {displayName}
          </span>
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

        {/* Avatar dropdown */}
        {avatarOpen && (
          <div
            className="absolute left-0 top-full mt-1.5 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-40"
            style={{ direction: "rtl" }}
          >
            <div className="px-4 py-2.5 border-b border-gray-100 mb-1">
              <div className="text-sm font-semibold text-gray-900 truncate">{displayName}</div>
              <div className="text-xs text-gray-400 mt-0.5 truncate">{user.email}</div>
            </div>
            <button
              onClick={() => { setAvatarOpen(false); onChangePassword(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              שינוי סיסמה
            </button>
            <div className="my-1 border-t border-gray-100" />
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

      </div>{/* end left group */}
    </div>
  );
}
