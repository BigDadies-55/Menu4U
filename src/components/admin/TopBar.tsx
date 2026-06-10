"use client";

import { T } from "@/lib/ui";
import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { signOut } from "next-auth/react";
import type { Role } from "@/generated/prisma/client";
import { ROLE_LABELS } from "@/lib/permissions";
import type { Favorite } from "./Sidebar";

/* ─── Page map: page name + group label ────────────────────── */
type PageEntry = { pattern: RegExp; name: string; group?: string };
const PAGE_ENTRIES: PageEntry[] = [
  { pattern: /^\/admin\/restaurants/,    name: "מסעדות",              group: "ניהול"  },
  { pattern: /^\/admin\/menus/,          name: "תפריטים",             group: "ניהול"  },
  { pattern: /^\/admin\/users/,          name: "משתמשים",             group: "ניהול"  },
  { pattern: /^\/admin\/logs/,           name: "לוגים",               group: "ניהול"  },
  { pattern: /^\/admin\/settings/,       name: "הגדרות",              group: "ניהול"  },
  { pattern: /^\/admin\/orders\/stats/,  name: "סטטיסטיקות",         group: "שירות"  },
  { pattern: /^\/admin\/orders/,         name: "הזמנות",              group: "שירות"  },
  { pattern: /^\/admin\/layout-builder/, name: "פריסת שולחנות",      group: "שירות"  },
  { pattern: /^\/admin\/customers/,      name: "לקוחות",              group: "שירות"  },
  { pattern: /^\/admin\/kitchen-table/,  name: "תצוגת שולחן",        group: "KDS"    },
  { pattern: /^\/admin\/kitchen-kanban/, name: "Kanban",              group: "KDS"    },
  { pattern: /^\/admin\/kitchen-tickets/,name: "Ticket Board",        group: "KDS"    },
  { pattern: /^\/admin\/kitchen/,        name: "Station Dark",        group: "KDS"    },
  { pattern: /^\/admin\/?$/,             name: "דשבורד" },
];
function getPageEntry(pathname: string): PageEntry {
  for (const entry of PAGE_ENTRIES) {
    if (entry.pattern.test(pathname)) return entry;
  }
  return { pattern: /.*/, name: "ניהול" };
}

/* ─── Type icons ─────────────────────────────────────────────── */
const TYPE_ICON: Record<string, string> = {
  page:       "📄",
  restaurant: "🍽️",
  menu:       "📋",
  item:       "🍕",
  order:      "🧾",
  user:       "👤",
};

type SearchResult = { type: string; id: string; label: string; sub: string; href: string };

/* ─── Props ──────────────────────────────────────────────────── */
interface Props {
  user: { name?: string | null; email?: string | null; role: Role };
  onChangePassword: () => void;
  onOpenMobileSidebar: () => void;
  adminTopBarBg?: string | null;
  adminTopBarTextColor?: string;
  favorites?: Favorite[];
  onToggleFavorite?: (href: string, label: string) => void;
}

export default function TopBar({ user, onChangePassword, onOpenMobileSidebar, adminTopBarBg, adminTopBarTextColor = T.panel, favorites = [], onToggleFavorite }: Props) {
  const pathname = usePathname();
  const router   = useRouter();

  /* ── Avatar dropdown ── */
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  /* ── Favorites dropdown ── */
  const [favsOpen, setFavsOpen] = useState(false);
  const favsRef = useRef<HTMLDivElement>(null);

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
      if (favsRef.current  && !favsRef.current.contains(e.target as Node))   setFavsOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false); setQuery(""); setResults([]);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* Cmd+K / Ctrl+K opens search (#9) */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
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
  const pageEntry   = getPageEntry(pathname);
  const isRoot      = !pageEntry.group;

  // Derive a slightly muted version for secondary elements (icons, username)
  const iconColor   = adminTopBarTextColor;
  const borderColor = adminTopBarTextColor + "33"; // 20% opacity version

  return (
    <div
      className="sticky top-0 z-20 flex items-center justify-between px-4 gap-3"
      style={{
        height: 40,
        background: adminTopBarBg ?? "transparent",
        borderTop:    "none",
        borderBottom: "none",
        direction: "rtl",
      }}
    >
      {/* ── Right: hamburger + page title ── */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          className="p-1 rounded-lg transition-colors hover:bg-black/[0.06]"
          onClick={onOpenMobileSidebar}
          style={{ color: iconColor, transform: "scaleX(-1)" }}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="15" y2="18"/>
          </svg>
        </button>
        {/* Breadcrumb (#10) */}
        <h1
          className="text-[13px] font-semibold tracking-tight whitespace-nowrap flex items-center gap-1"
          style={{ color: adminTopBarTextColor }}
        >
          {isRoot ? (
            pageEntry.name
          ) : (
            <>
              <span style={{ color: adminTopBarTextColor, opacity: 0.5, fontWeight: 400 }}>
                {pageEntry.group}
              </span>
              <span style={{ opacity: 0.35, fontSize: 11 }}>/</span>
              <span>{pageEntry.name}</span>
            </>
          )}
        </h1>
      </div>

      {/* ── Left: favorites + search + avatar ── */}
      <div className="flex items-center gap-1 shrink-0">

        {/* ── Favorites dropdown ── */}
        <div ref={favsRef} className="relative">
          <button
            onClick={() => setFavsOpen(v => !v)}
            className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:bg-black/[0.06] relative"
            style={{ color: favsOpen ? T.orange : iconColor }}
            title="מועדפים"
          >
            <svg width="15" height="15" viewBox="0 0 24 24"
              fill={favorites.length > 0 ? T.orange : "none"}
              stroke={favorites.length > 0 ? T.orange : "currentColor"}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            {favorites.length > 0 && (
              <span className="absolute -top-0.5 -left-0.5 min-w-[14px] h-[14px] rounded-full text-[9px] font-bold text-white flex items-center justify-center px-0.5"
                style={{ background: T.orange, lineHeight: 1 }}>
                {favorites.length}
              </span>
            )}
          </button>

          {favsOpen && (
            <div
              className="absolute top-full mt-1.5 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50"
              style={{ left: 0, minWidth: 200, maxWidth: 260, direction: "rtl" }}
            >
              <div className="px-4 py-2.5 border-b border-gray-100">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">מועדפים</div>
              </div>
              {favorites.length === 0 ? (
                <div className="px-4 py-5 text-center text-sm text-gray-400">
                  <div className="text-2xl mb-1">⭐</div>
                  אין מועדפים עדיין
                </div>
              ) : (
                <div className="py-1">
                  {favorites.map(fav => (
                    <div key={fav.href} className="flex items-center group hover:bg-gray-50 transition-colors">
                      <Link
                        href={fav.href}
                        onClick={() => setFavsOpen(false)}
                        className="flex items-center gap-2.5 flex-1 px-4 py-2.5 text-sm text-gray-700"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24"
                          fill={T.orange} stroke={T.orange} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          className="shrink-0">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                        <span className="font-medium truncate">{fav.label}</span>
                      </Link>
                      {onToggleFavorite && (
                        <button
                          onClick={() => onToggleFavorite(fav.href, fav.label)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity px-3 py-2 text-gray-300 hover:text-red-400"
                          title="הסר ממועדפים"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

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
              <svg className="animate-spin shrink-0 ml-2" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2.5">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            )}
          </div>

          {/* Magnifying glass / X button */}
          <button
            onClick={() => { setSearchOpen(v => !v); if (searchOpen) { setQuery(""); setResults([]); } }}
            className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:bg-black/[0.06] shrink-0"
            style={{ color: iconColor }}
            title="חיפוש (Ctrl+K)"
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
          className="relative flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-black/[0.06] group"
        >
          <span
            className="hidden sm:block text-xs font-medium max-w-[130px] truncate"
            style={{ color: iconColor }}
          >
            {displayName}
          </span>
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
            style={{ background: "linear-gradient(135deg,#8B6914,#c9a84c)" }}
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
            {/* Settings — SUPER_ADMIN only */}
            {user.role === "SUPER_ADMIN" && (
              <Link
                href="/admin/settings"
                onClick={() => setAvatarOpen(false)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>
                </svg>
                הגדרות
              </Link>
            )}

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
