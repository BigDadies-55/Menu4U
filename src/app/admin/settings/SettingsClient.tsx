"use client";

import { useState, useRef, useEffect } from "react";

/* ─── Luxury templates ───────────────────────────────────── */
const LUXURY_TEMPLATES = [
  {
    id: "royal-obsidian",
    name: "Royal Obsidian",
    nameHe: "אובסידיאן מלכותי",
    emoji: "✨",
    tagline: "שחור בלתי מתפשר עם זהב מבריק",
    mood: "Rolls Royce",
    adminBg: "linear-gradient(135deg,#080a12,#111827)",
    adminBgImage: null,
    adminPalette: "custom",
    adminSidebarBg: "linear-gradient(180deg,#080a12,#0f1118)",
    adminSidebarAccent: "#c9a84c",
    adminSidebarTextColor: "#d4af37",
    adminContentTextColor: "#e8e0d0",
    adminTopBarBg: "rgba(8,10,18,0.95)",
    adminTopBarTextColor: "#c9a84c",
    // preview colors
    previewBg: "#0d1020",
    previewAccent: "#c9a84c",
    previewSidebar: "#080a12",
    previewTopBar: "#0a0c16",
  },
  {
    id: "midnight-sapphire",
    name: "Midnight Sapphire",
    nameHe: "ספיר חצות",
    emoji: "💠",
    tagline: "כחול קוסמי עמוק מרהיב",
    mood: "Private Jet",
    adminBg: "linear-gradient(135deg,#04091e,#091433)",
    adminBgImage: null,
    adminPalette: "custom",
    adminSidebarBg: "linear-gradient(180deg,#03060f,#07102a)",
    adminSidebarAccent: "#38bdf8",
    adminSidebarTextColor: "#7dd3fc",
    adminContentTextColor: "#e0f0ff",
    adminTopBarBg: "rgba(4,9,30,0.92)",
    adminTopBarTextColor: "#38bdf8",
    previewBg: "#060d28",
    previewAccent: "#38bdf8",
    previewSidebar: "#040810",
    previewTopBar: "#050b20",
  },
  {
    id: "emerald-dynasty",
    name: "Emerald Dynasty",
    nameHe: "שושלת הזמרד",
    emoji: "🌿",
    tagline: "ירוק בריטי מלכותי קלאסי",
    mood: "Bentley Racing Green",
    adminBg: "linear-gradient(135deg,#020f07,#041a0e)",
    adminBgImage: null,
    adminPalette: "custom",
    adminSidebarBg: "linear-gradient(180deg,#010a05,#062012)",
    adminSidebarAccent: "#34d399",
    adminSidebarTextColor: "#6ee7b7",
    adminContentTextColor: "#d1fae5",
    adminTopBarBg: "rgba(2,15,7,0.92)",
    adminTopBarTextColor: "#34d399",
    previewBg: "#031208",
    previewAccent: "#34d399",
    previewSidebar: "#020a04",
    previewTopBar: "#031008",
  },
  {
    id: "aurora-dream",
    name: "Aurora Dream",
    nameHe: "חלום האורורה",
    emoji: "🌅",
    tagline: "גרדיאנט ירוק-אינדיגו-סגול מרהיב",
    mood: "Northern Lights",
    adminBg: "linear-gradient(135deg,#042f2e,#1e1b4b,#2e1065)",
    adminBgImage: null,
    adminPalette: "custom",
    adminSidebarBg: "linear-gradient(180deg,#022020,#1e1b4b,#160936)",
    adminSidebarAccent: "#2dd4bf",
    adminSidebarTextColor: "#99f6e4",
    adminContentTextColor: "#f0fdfa",
    adminTopBarBg: "rgba(4,47,46,0.88)",
    adminTopBarTextColor: "#2dd4bf",
    previewBg: "#162040",
    previewAccent: "#2dd4bf",
    previewSidebar: "#031818",
    previewTopBar: "#042f2e",
  },
  {
    id: "galactic-platinum",
    name: "Galactic Platinum",
    nameHe: "פלטינום גלקטי",
    emoji: "🪐",
    tagline: "מינימליזם יוקרתי בהיר של Apple",
    mood: "Apple Pro",
    adminBg: "linear-gradient(135deg,#f0f4f8,#dce6f0)",
    adminBgImage: null,
    adminPalette: "custom",
    adminSidebarBg: "linear-gradient(180deg,#0f1624,#1a2236)",
    adminSidebarAccent: "#94a3b8",
    adminSidebarTextColor: "#e2e8f0",
    adminContentTextColor: "#1e293b",
    adminTopBarBg: "rgba(255,255,255,0.88)",
    adminTopBarTextColor: "#334155",
    previewBg: "#e8eef5",
    previewAccent: "#94a3b8",
    previewSidebar: "#131d2e",
    previewTopBar: "#f8fafc",
  },
  {
    id: "nebula-gradient",
    name: "Nebula Gradient",
    nameHe: "נבולה — גרדיאנט קוסמי",
    emoji: "🌌",
    tagline: "גרדיאנט רב-שלבי ססגוני מן החלל",
    mood: "Deep Space",
    adminBg: "linear-gradient(135deg,#0f0c29,#302b63,#24243e)",
    adminBgImage: null,
    adminPalette: "custom",
    adminSidebarBg: "linear-gradient(180deg,#0d0a24,#1f1a52,#160e3a)",
    adminSidebarAccent: "#818cf8",
    adminSidebarTextColor: "#a5b4fc",
    adminContentTextColor: "#e0e7ff",
    adminTopBarBg: "rgba(15,12,41,0.90)",
    adminTopBarTextColor: "#a5b4fc",
    previewBg: "#1e1840",
    previewAccent: "#818cf8",
    previewSidebar: "#100d30",
    previewTopBar: "#0f0c29",
  },
] as const;

/* ─── Sidebar palette presets ────────────────────────────── */
const PALETTES = [
  { id: "dark",   label: "Dark",   bg: "#0f111a", accent: "#f59e0b", preview: "linear-gradient(135deg,#0f111a,#1a1c27)", desc: "ברירת מחדל" },
  { id: "purple", label: "Purple", bg: "#130c1e", accent: "#7c3aed", preview: "linear-gradient(135deg,#130c1e,#1e1032)", desc: "סגול" },
  { id: "blue",   label: "Blue",   bg: "#080f1e", accent: "#2563eb", preview: "linear-gradient(135deg,#080f1e,#0d1a35)", desc: "כחול" },
  { id: "green",  label: "Green",  bg: "#071510", accent: "#16a34a", preview: "linear-gradient(135deg,#071510,#0d2218)", desc: "ירוק" },
  { id: "rose",   label: "Rose",   bg: "#150a0e", accent: "#e11d48", preview: "linear-gradient(135deg,#150a0e,#220c13)", desc: "אדום" },
] as const;

/* ─── Sidebar gradient presets ───────────────────────────── */
const SIDEBAR_GRADIENT_PRESETS = [
  { id: "linear-gradient(180deg,#0f111a,#1a1c2e)", label: "Dark Blue",   accent: "#f59e0b" },
  { id: "linear-gradient(180deg,#130c1e,#1e1032)", label: "Deep Purple", accent: "#7c3aed" },
  { id: "linear-gradient(180deg,#071510,#0d2218)", label: "Forest",      accent: "#16a34a" },
  { id: "linear-gradient(180deg,#0a0f1e,#0d1a35)", label: "Ocean",       accent: "#2563eb" },
  { id: "linear-gradient(180deg,#150a0e,#220c13)", label: "Crimson",     accent: "#e11d48" },
  { id: "linear-gradient(180deg,#1a0533,#2d0a5e)", label: "Galaxy",      accent: "#a855f7" },
  { id: "linear-gradient(180deg,#0a0a0a,#1a1a1a)", label: "Pure Black",  accent: "#ffffff" },
  { id: "linear-gradient(180deg,#1e293b,#334155)", label: "Slate",       accent: "#38bdf8" },
] as const;

const SIDEBAR_ANGLES = [
  { label: "↓", value: "180deg" },
  { label: "↘", value: "135deg" },
  { label: "→", value: "90deg"  },
  { label: "↗", value: "45deg"  },
];

/* ─── Sidebar text color presets ─────────────────────────── */
const SIDEBAR_TEXT_PRESETS = [
  { id: "#9ca3af", label: "Muted" },
  { id: "#d1d5db", label: "Light" },
  { id: "#ffffff", label: "White" },
  { id: "#fbbf24", label: "Gold"  },
];

/* ─── Background solid presets ───────────────────────────── */
const COLOR_PRESETS = [
  { id: "#f0ece3", label: "Sand",     dark: false },
  { id: "#f8fafc", label: "White",    dark: false },
  { id: "#f1f5f9", label: "Gray",     dark: false },
  { id: "#1e2130", label: "Navy",     dark: true  },
  { id: "#111827", label: "Charcoal", dark: true  },
];

/* ─── Background gradient presets ────────────────────────── */
const GRADIENT_PRESETS = [
  { id: "linear-gradient(135deg,#f0ece3,#ddd0c0)", label: "Sand Warm",   dark: false },
  { id: "linear-gradient(135deg,#e0f2fe,#bfdbfe)", label: "Sky Blue",    dark: false },
  { id: "linear-gradient(135deg,#dcfce7,#a7f3d0)", label: "Mint",        dark: false },
  { id: "linear-gradient(135deg,#fef3c7,#fde68a)", label: "Sunrise",     dark: false },
  { id: "linear-gradient(135deg,#f3e8ff,#e9d5ff)", label: "Lavender",    dark: false },
  { id: "linear-gradient(135deg,#fce7f3,#fbcfe8)", label: "Rose Blush",  dark: false },
  { id: "linear-gradient(135deg,#1e1b4b,#312e81)", label: "Deep Indigo", dark: true  },
  { id: "linear-gradient(135deg,#0f172a,#1e293b)", label: "Midnight",    dark: true  },
  { id: "linear-gradient(135deg,#052e16,#14532d)", label: "Forest",      dark: true  },
  { id: "linear-gradient(135deg,#450a0a,#7f1d1d)", label: "Crimson",     dark: true  },
  { id: "linear-gradient(135deg,#0c1445,#1e3a5f)", label: "Ocean Deep",  dark: true  },
  { id: "linear-gradient(135deg,#1a0533,#2d0a5e)", label: "Galaxy",      dark: true  },
] as const;

const ANGLES = [
  { label: "↘", value: "135deg" },
  { label: "→", value: "90deg"  },
  { label: "↓", value: "180deg" },
  { label: "↗", value: "45deg"  },
];

/* ─── Content text color presets ─────────────────────────── */
const CONTENT_TEXT_PRESETS = [
  { id: "#111827", label: "Dark"  },
  { id: "#374151", label: "Gray"  },
  { id: "#6b7280", label: "Muted" },
  { id: "#f8fafc", label: "Light" },
];

/* ─── TopBar background presets ──────────────────────────── */
const TOPBAR_BG_PRESETS = [
  { id: "#ffffff",              label: "לבן",          dark: false },
  { id: "rgba(255,255,255,0.85)", label: "Frosted",    dark: false },
  { id: "#f8fafc",              label: "אפור בהיר",    dark: false },
  { id: "#1f2937",              label: "כהה",          dark: true  },
  { id: "#0f111a",              label: "Night",        dark: true  },
  { id: "rgba(15,17,26,0.85)",  label: "Frosted Dark", dark: true  },
];

/* ─── TopBar text color presets ──────────────────────────── */
const TOPBAR_TEXT_PRESETS = [
  { id: "#374151", label: "Gray"  },
  { id: "#111827", label: "Dark"  },
  { id: "#6b7280", label: "Muted" },
  { id: "#ffffff", label: "White" },
  { id: "#f59e0b", label: "Gold"  },
];

/* ─── Helpers ────────────────────────────────────────────── */
function isGradient(v: string) { return v.includes("gradient"); }

/* ─── Types ──────────────────────────────────────────────── */
type Config = {
  siteName: string; logo: string | null;
  domain: string | null; copyright: string | null;
  adminPalette: string; adminBg: string; adminBgImage: string | null;
  adminSidebarBg: string | null; adminSidebarAccent: string | null;
  adminSidebarTextColor: string; adminContentTextColor: string;
  adminTopBarBg: string | null; adminTopBarTextColor: string;
};

type DesignSection = "templates" | "custom";
type MainTab    = "sidebar" | "topbar" | "background";
type BgTab      = "color" | "gradient" | "image";
type SidebarTab = "presets" | "gradient" | "custom";
type TopTab     = "הגדרות" | "גיבוי";

/* ─── BackupJSON type ────────────────────────────────────── */
interface BackupMeta {
  version: number;
  exportedAt?: string;
  exportedBy?: string;
  restaurantIds?: string[];
  counts?: Record<string, number>;
}

interface BackupJSON {
  _meta: BackupMeta;
  restaurants?: unknown[];
  menus?: unknown[];
  categories?: unknown[];
  items?: unknown[];
  modifierGroups?: unknown[];
  modifiers?: unknown[];
  [key: string]: unknown;
}

/* ─── CollapsibleSection (accordion) ────────────────────── */
function CollapsibleSection({
  title, icon, children, redBorder,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  redBorder?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="bg-white rounded-2xl shadow-sm overflow-hidden"
      style={{ border: redBorder ? "1px solid #fca5a5" : "1px solid #f3f4f6" }}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-6 py-4 text-right hover:bg-gray-50 transition-colors"
        style={{ borderBottom: open ? (redBorder ? "1px solid #fca5a5" : "1px solid #f3f4f6") : "none" }}
      >
        <span className="text-lg">{icon}</span>
        <h2 className="font-bold text-gray-900 flex-1 text-right">{title}</h2>
        <span className="text-gray-400 text-sm select-none">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="px-6 py-5">{children}</div>}
    </div>
  );
}

/* ─── Small tabs ─────────────────────────────────────────── */
function SubTabs<T extends string>({ tabs, active, onChange }: { tabs: {id: T; label: string}[]; active: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-5 w-fit">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className="px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap"
          style={active === t.id
            ? { background: "white", color: "#1f2937", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }
            : { color: "#6b7280" }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Color picker row ───────────────────────────────────── */
function ColorPickerRow({ label, presets, value, onChange, inputId }: {
  label: string;
  presets: { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  inputId: string;
}) {
  const isCustom = !presets.some(p => p.id === value);
  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">{label}</label>
      <div className="flex items-center gap-2 flex-wrap">
        {presets.map(p => (
          <button key={p.id} onClick={() => onChange(p.id)} title={p.label}
            className="w-8 h-8 rounded-lg border-2 transition-all flex items-center justify-center"
            style={{ background: p.id, borderColor: value === p.id ? "#f59e0b" : "rgba(0,0,0,0.12)",
              boxShadow: value === p.id ? "0 0 0 2px rgba(245,158,11,0.3)" : "none" }}>
            {value === p.id && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                stroke={["#ffffff","#f8fafc","#f0ece3"].includes(p.id) ? "#000" : "#fff"} strokeWidth="3.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
          </button>
        ))}
        <button onClick={() => document.getElementById(inputId)?.click()}
          className="w-8 h-8 rounded-lg border-2 transition-all overflow-hidden relative"
          style={{ borderColor: isCustom ? "#f59e0b" : "rgba(0,0,0,0.12)",
            boxShadow: isCustom ? "0 0 0 2px rgba(245,158,11,0.3)" : "none",
            background: isCustom ? value : "white" }}
          title="צבע מותאם">
          {!isCustom && (
            <div className="w-full h-full rounded-md"
              style={{ background: "conic-gradient(from 0deg,#ef4444,#f97316,#eab308,#22c55e,#3b82f6,#8b5cf6,#ef4444)" }} />
          )}
        </button>
        <input id={inputId} type="color" className="sr-only" value={isCustom ? value : "#9ca3af"}
          onChange={e => onChange(e.target.value)} />
        <div className="w-6 h-6 rounded-md border border-gray-200" style={{ background: value }} />
        <span className="text-xs font-mono text-gray-500">{value}</span>
      </div>
    </div>
  );
}

/* ─── Luxury template card ───────────────────────────────── */
function TemplateCard({
  tpl, isActive, onApply,
}: {
  tpl: typeof LUXURY_TEMPLATES[number];
  isActive: boolean;
  onApply: () => void;
}) {
  const isLight = tpl.id === "galactic-platinum";

  return (
    <div
      className="relative rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer group"
      style={{
        border: isActive ? `2px solid ${tpl.previewAccent}` : "2px solid transparent",
        boxShadow: isActive
          ? `0 0 0 3px ${tpl.previewAccent}33, 0 8px 32px rgba(0,0,0,0.22)`
          : "0 2px 12px rgba(0,0,0,0.13)",
      }}
      onClick={onApply}
    >
      {/* ── Mini panel preview ── */}
      <div
        className="h-28 relative flex flex-col"
        style={{ background: tpl.adminBg }}
      >
        {/* Top bar strip */}
        <div
          className="flex items-center justify-between px-2 shrink-0"
          style={{
            height: 20,
            background: tpl.adminTopBarBg ?? "transparent",
            borderBottom: `1px solid ${tpl.adminTopBarTextColor}22`,
          }}
        >
          <div className="flex items-center gap-1">
            <div className="flex flex-col gap-[2px]">
              <div className="h-[1.5px] w-5 rounded-full" style={{ background: tpl.adminTopBarTextColor }} />
              <div className="h-[1.5px] w-5 rounded-full" style={{ background: tpl.adminTopBarTextColor }} />
              <div className="h-[1.5px] w-3 rounded-full" style={{ background: tpl.adminTopBarTextColor }} />
            </div>
            <div className="h-1.5 w-10 rounded-full ml-1.5 opacity-70" style={{ background: tpl.adminTopBarTextColor }} />
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ background: `linear-gradient(135deg,#7c3aed,#a855f7)` }} />
          </div>
        </div>

        {/* Body: sidebar (right, RTL) + content */}
        <div className="flex-1 flex flex-row-reverse">
          {/* Sidebar strip */}
          <div
            className="flex flex-col justify-start p-1.5 gap-1 shrink-0"
            style={{ width: 38, background: tpl.adminSidebarBg ?? (tpl as { previewSidebar: string }).previewSidebar }}
          >
            <div className="w-full h-2 rounded-full" style={{ background: tpl.previewAccent }} />
            <div className="w-4/5 h-1 rounded-full opacity-40" style={{ background: tpl.adminSidebarTextColor }} />
            <div className="w-3/5 h-1 rounded-full opacity-40" style={{ background: tpl.adminSidebarTextColor }} />
            <div className="w-4/5 h-1 rounded-full opacity-40" style={{ background: tpl.adminSidebarTextColor }} />
            <div className="w-3/5 h-1 rounded-full opacity-40" style={{ background: tpl.adminSidebarTextColor }} />
            <div className="w-4/5 h-1 rounded-full opacity-40" style={{ background: tpl.adminSidebarTextColor }} />
          </div>

          {/* Content area */}
          <div className="flex-1 p-2 flex flex-col gap-1.5">
            <div className="flex gap-1">
              <div className="h-5 flex-1 rounded-md opacity-20" style={{ background: tpl.adminContentTextColor }} />
              <div className="h-5 w-10 rounded-md opacity-20" style={{ background: tpl.adminContentTextColor }} />
            </div>
            <div className="grid grid-cols-3 gap-1">
              {[1,2,3].map(i => (
                <div key={i} className="h-7 rounded-md opacity-[0.12]" style={{ background: tpl.adminContentTextColor }} />
              ))}
            </div>
            <div className="h-1 w-3/4 rounded-full opacity-[0.15]" style={{ background: tpl.adminContentTextColor }} />
          </div>
        </div>

        {/* Active badge */}
        {isActive && (
          <div
            className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{ background: tpl.previewAccent, color: isLight ? "#000" : "#fff" }}
          >
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>
            פעיל
          </div>
        )}
      </div>

      {/* ── Card footer ── */}
      <div className="px-3.5 py-3 bg-white">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-base">{tpl.emoji}</span>
              <span className="text-sm font-bold text-gray-900 truncate">{tpl.nameHe}</span>
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5 truncate">{tpl.tagline}</div>
          </div>
          {/* Accent dot */}
          <div className="w-4 h-4 rounded-full shrink-0 mt-0.5" style={{ background: tpl.previewAccent }} />
        </div>

        <button
          onClick={e => { e.stopPropagation(); onApply(); }}
          className="mt-2.5 w-full py-1.5 rounded-xl text-xs font-bold transition-all"
          style={isActive
            ? { background: `${tpl.previewAccent}22`, color: isLight ? "#334155" : tpl.previewAccent, border: `1px solid ${tpl.previewAccent}44` }
            : { background: "linear-gradient(135deg,#8B6914,#C9A84C)", color: "#fff" }
          }
        >
          {isActive ? "✓ עיצוב פעיל" : "החל עיצוב"}
        </button>
      </div>
    </div>
  );
}

/* ─── Backup section ─────────────────────────────────────── */
function BackupSection() {
  const [restaurants, setRestaurants] = useState<{ id: string; name: string }[]>([]);
  const [restaurantId, setRestaurantId] = useState(""); // "" = all
  const [downloading, setDownloading] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/restaurants").then(r => r.json()).then(d => {
      if (Array.isArray(d)) setRestaurants(d);
    }).catch(() => {});
  }, []);

  async function downloadBackup() {
    setDownloading(true);
    setError("");
    try {
      const url = restaurantId
        ? `/api/admin/backup?restaurantId=${restaurantId}`
        : "/api/admin/backup";
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `שגיאה ${res.status}`);
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `menu4u-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      const now = new Date().toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
      setLastBackup(now);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "שגיאה בהורדת הגיבוי");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-blue-100 overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-blue-100">
        <span className="text-lg">💾</span>
        <h2 className="font-bold text-gray-900">גיבוי נתוני המערכת</h2>
      </div>
      <div className="px-6 py-5 space-y-4">
        {/* Info */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
          <span className="text-xl shrink-0">ℹ️</span>
          <div className="text-sm text-blue-800">
            <div className="font-semibold mb-1">מה כלול בגיבוי?</div>
            <div className="text-xs text-blue-700 space-y-0.5">
              <div>• מסעדות, משתמשים, תפריטים, קטגוריות, פריטים ותוספות</div>
              <div>• הזמנות, פריטי הזמנות, לוגי סטטוס, לקוחות, ישיבות שולחן</div>
              <div>• לוגי ביקורת (Audit logs) ונתוני צפיות</div>
              <div className="text-blue-600 font-medium pt-1">🔒 סיסמאות לא נכללות בגיבוי</div>
            </div>
          </div>
        </div>

        {/* Restaurant selector */}
        {restaurants.length > 1 && (
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
              היקף הגיבוי
            </label>
            <select
              value={restaurantId}
              onChange={e => setRestaurantId(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            >
              <option value="">כל המסעדות</option>
              {restaurants.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-4 py-3 rounded-xl border border-red-200">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {error}
          </div>
        )}

        {/* Success / last backup */}
        {lastBackup && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-4 py-3 rounded-xl">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            גיבוי הורד בהצלחה — {lastBackup}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={downloadBackup}
            disabled={downloading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 transition-all"
            style={{ background: "linear-gradient(135deg,#1d4ed8,#3b82f6)" }}
          >
            {downloading ? (
              <>
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg>
                מכין גיבוי...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                הורד גיבוי (JSON)
              </>
            )}
          </button>

          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg>
            מומלץ: גבה לפחות פעם בשבוע
          </div>
        </div>

        {/* Google Drive hint */}
        <div className="border border-dashed border-gray-200 rounded-xl p-4 bg-gray-50">
          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0 mt-0.5">📁</span>
            <div>
              <div className="text-sm font-semibold text-gray-700">Google Drive</div>
              <div className="text-xs text-gray-500 mt-1">
                להעלאה אוטומטית ל-Google Drive, הורד את קובץ ה-JSON ואחסן אותו ב-Drive ידנית,
                או הגדר Google Drive API עם{" "}
                <code className="bg-gray-200 px-1 rounded text-xs">GOOGLE_CLIENT_ID</code>
                {" "}ו-<code className="bg-gray-200 px-1 rounded text-xs">GOOGLE_CLIENT_SECRET</code>
                {" "}בהגדרות Vercel.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Restore diff types ─────────────────────────────────── */
type FieldChange = { field: string; from: string; to: string };
type DiffEntry   = { type: string; name: string; action: "create" | "update"; changes?: FieldChange[] };
type DiffResult  = { toCreate: number; toUpdate: number; noChange: number; entries: DiffEntry[] };

const TYPE_LABELS: Record<string, string> = {
  restaurant: "מסעדה", menu: "תפריט", category: "קטגוריה",
  item: "פריט", modifierGroup: "קבוצת תוספות", modifier: "תוספת",
};

/* ─── Restore section ────────────────────────────────────── */
function RestoreSection() {
  const [file,          setFile]          = useState<File | null>(null);
  const [backupData,    setBackupData]    = useState<BackupJSON | null>(null);
  const [previewing,    setPreviewing]    = useState(false);
  const [diff,          setDiff]          = useState<DiffResult | null>(null);
  const [confirm,       setConfirm]       = useState(false);
  const [restoring,     setRestoring]     = useState(false);
  const [restoreResult, setRestoreResult] = useState<{ created: number; updated: number } | null>(null);
  const [error,         setError]         = useState("");
  const [showAllDiff,   setShowAllDiff]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function parseFile(f: File) {
    setFile(f); setError(""); setRestoreResult(null); setBackupData(null); setDiff(null); setConfirm(false);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string) as BackupJSON;
        if (!json._meta?.version) throw new Error("קובץ לא תקין: חסר _meta.version");
        setBackupData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "שגיאה בפענוח הקובץ");
        setFile(null);
      }
    };
    reader.readAsText(f);
  }

  async function previewDiff() {
    if (!backupData) return;
    setPreviewing(true); setError(""); setDiff(null); setConfirm(false);
    try {
      const res = await fetch("/api/admin/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backup: backupData, scope: "menus", mode: "preview" }),
      });
      const data = await res.json() as DiffResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `שגיאה ${res.status}`);
      setDiff(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בבדיקת שינויים");
    } finally {
      setPreviewing(false);
    }
  }

  async function doRestore() {
    if (!backupData) return;
    setRestoring(true); setError(""); setRestoreResult(null); setConfirm(false);
    try {
      const res = await fetch("/api/admin/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backup: backupData, scope: "menus", mode: "restore" }),
      });
      const data = await res.json() as { created?: number; updated?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? `שגיאה ${res.status}`);
      setRestoreResult({ created: data.created ?? 0, updated: data.updated ?? 0 });
      setDiff(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בשחזור");
    } finally {
      setRestoring(false);
    }
  }

  const meta   = backupData?._meta;
  const counts = meta?.counts;
  const SHOW_N = 8;
  const diffEntries  = diff?.entries ?? [];
  const createItems  = diffEntries.filter(e => e.action === "create");
  const updateItems  = diffEntries.filter(e => e.action === "update");
  const visibleEntries = showAllDiff ? diffEntries : diffEntries.slice(0, SHOW_N);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-green-100 overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-green-100">
        <span className="text-lg">🔄</span>
        <h2 className="font-bold text-gray-900">שחזור גיבוי</h2>
      </div>
      <div className="px-6 py-5 space-y-4">

        {/* Drop zone */}
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) parseFile(f); }}
          onClick={() => inputRef.current?.click()}
          className="w-full border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 py-7 cursor-pointer transition-colors"
          style={{ borderColor: backupData ? "#34d399" : "#d1d5db", background: backupData ? "rgba(52,211,153,0.04)" : "#f9fafb" }}
        >
          <span className="text-3xl">{backupData ? "✅" : "📂"}</span>
          <span className="text-sm text-gray-500">
            {file ? file.name : "גרור קובץ גיבוי (JSON) לכאן, או לחץ לבחירה"}
          </span>
          {file && !backupData && <span className="text-xs text-gray-400">מנתח...</span>}
          {backupData && (
            <button
              className="text-xs text-gray-400 underline mt-1"
              onClick={e => { e.stopPropagation(); setFile(null); setBackupData(null); setDiff(null); setRestoreResult(null); setError(""); }}
            >
              החלף קובץ
            </button>
          )}
        </div>
        <input ref={inputRef} type="file" accept=".json,application/json" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f); e.target.value = ""; }} />

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-4 py-3 rounded-xl border border-red-200">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {error}
          </div>
        )}

        {/* Backup metadata */}
        {backupData && meta && (
          <div className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50">
            <div className="text-sm font-bold text-gray-800">פרטי הגיבוי</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-600">
              {meta.exportedAt && (<><span className="text-gray-400">יוצא ב:</span><span>{new Date(meta.exportedAt).toLocaleString("he-IL", { dateStyle: "medium", timeStyle: "short" })}</span></>)}
              {meta.exportedBy && (<><span className="text-gray-400">יוצא ע״י:</span><span className="font-mono">{meta.exportedBy}</span></>)}
              {meta.restaurantIds && (<><span className="text-gray-400">מסעדות:</span><span>{meta.restaurantIds.length}</span></>)}
              <span className="text-gray-400">גרסה:</span><span>{meta.version}</span>
            </div>
            {counts && Object.keys(counts).length > 0 && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                {Object.entries(counts).map(([key, val]) => (
                  <div key={key} className="bg-white rounded-lg px-3 py-2 border border-gray-100 text-center">
                    <div className="text-base font-bold text-gray-800">{val}</div>
                    <div className="text-[10px] text-gray-400">{key}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Check changes button */}
            {!diff && (
              <button
                onClick={previewDiff}
                disabled={previewing}
                className="flex items-center gap-2 mt-2 px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#6366f1,#818cf8)", color: "#fff" }}
              >
                {previewing ? (
                  <><svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg>בודק...</>
                ) : (
                  <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="15.65" y2="15.65"/></svg>🔍 בדוק שינויים לפני שחזור</>
                )}
              </button>
            )}
          </div>
        )}

        {/* ── DIFF PANEL ── */}
        {diff && (
          <div className="border border-indigo-100 rounded-xl overflow-hidden">
            {/* Summary bar */}
            <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 border-b border-indigo-100 flex-wrap">
              <span className="text-sm font-bold text-indigo-800">תוצאת הבדיקה</span>
              <div className="flex gap-2 flex-wrap">
                {diff.toCreate > 0 && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
                    ✚ {diff.toCreate} רשומות חדשות
                  </span>
                )}
                {diff.toUpdate > 0 && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                    ✎ {diff.toUpdate} רשומות יידרסו
                  </span>
                )}
                {diff.noChange > 0 && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
                    ✓ {diff.noChange} ללא שינוי
                  </span>
                )}
                {diff.toCreate === 0 && diff.toUpdate === 0 && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
                    ✓ אין שינויים — הנתונים זהים
                  </span>
                )}
              </div>
              <button onClick={() => { setDiff(null); setShowAllDiff(false); }} className="mr-auto text-xs text-indigo-400 hover:text-indigo-600">× סגור</button>
            </div>

            {/* Entries list */}
            {diffEntries.length > 0 && (
              <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                {visibleEntries.map((entry, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                    {/* Badge */}
                    <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      entry.action === "create" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {entry.action === "create" ? "חדש" : "עדכון"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-gray-800 truncate">
                        {entry.name}
                        <span className="font-normal text-gray-400 mr-1">— {TYPE_LABELS[entry.type] ?? entry.type}</span>
                      </div>
                      {entry.changes && entry.changes.length > 0 && (
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                          {entry.changes.map((fc, j) => (
                            <span key={j} className="text-[11px] text-gray-500">
                              <span className="font-medium text-gray-700">{fc.field}:</span>{" "}
                              <span className="line-through text-red-400">{fc.from}</span>
                              {" → "}
                              <span className="text-green-600 font-medium">{fc.to}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {diffEntries.length > SHOW_N && (
                  <div className="px-4 py-2 bg-gray-50 text-center">
                    <button onClick={() => setShowAllDiff(v => !v)} className="text-xs text-indigo-500 font-semibold hover:underline">
                      {showAllDiff ? "הצג פחות ▲" : `הצג עוד ${diffEntries.length - SHOW_N} שינויים ▼`}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Warning for overwrites */}
            {diff.toUpdate > 0 && !confirm && (
              <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border-t border-amber-100">
                <span className="text-lg shrink-0">⚠️</span>
                <div className="flex-1">
                  <div className="text-xs font-bold text-amber-800">{diff.toUpdate} רשומות קיימות יידרסו</div>
                  <div className="text-xs text-amber-700 mt-0.5">שינויים שביצעת מאז הגיבוי יאבדו לנצח.</div>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-2 flex-wrap">
              {!confirm ? (
                <>
                  <button
                    onClick={() => diff.toUpdate > 0 ? setConfirm(true) : doRestore()}
                    disabled={restoring || (diff.toCreate === 0 && diff.toUpdate === 0)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all"
                    style={{ background: "linear-gradient(135deg,#059669,#34d399)" }}
                  >
                    {restoring
                      ? <><svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg>משחזר...</>
                      : "🔄 שחזר תפריטים"}
                  </button>
                  <button onClick={() => { setDiff(null); setShowAllDiff(false); }} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors">
                    ביטול
                  </button>
                </>
              ) : (
                <>
                  <div className="w-full text-xs font-bold text-red-700 mb-1">⚠️ האם לדרוס {diff.toUpdate} רשומות קיימות?</div>
                  <button onClick={doRestore} disabled={restoring}
                    className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 transition-colors">
                    {restoring ? "משחזר..." : "כן, דרוס והמשך"}
                  </button>
                  <button onClick={() => setConfirm(false)} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors">
                    חזור
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Success result */}
        {restoreResult && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-4 py-3 rounded-xl border border-green-200">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              שחזור הושלם! נוצרו {restoreResult.created} רשומות חדשות, עודכנו {restoreResult.updated} רשומות קיימות.
            </div>
          </div>
        )}

        {/* Neon note */}
        <p className="text-xs text-gray-400 pt-1">
          לשחזור מלא של הזמנות, לקוחות ולוגים — השתמש בגיבוי Neon DB.
        </p>
      </div>
    </div>
  );
}

/* ─── Clear orders section ───────────────────────────────── */
function ClearOrdersSection() {
  const [confirm,  setConfirm]  = useState(false);
  const [clearing, setClearing] = useState(false);
  const [result,   setResult]   = useState<{ count: number } | null>(null);
  const [error,    setError]    = useState("");

  async function handleClear() {
    setClearing(true); setError(""); setResult(null);
    const res = await fetch("/api/admin/orders/clear", { method: "DELETE" });
    const data = await res.json() as { deleted?: { orders?: number }; error?: string };
    setClearing(false);
    if (res.ok) { setResult({ count: data.deleted?.orders ?? 0 }); setConfirm(false); }
    else setError(data.error ?? "שגיאה");
  }

  return (
    <>
      {result ? (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-4 py-3 rounded-xl">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          נמחקו {result.count} הזמנות בהצלחה — הנתונים מתחילים מאפס.
        </div>
      ) : confirm ? (
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
            <span className="text-xl shrink-0">⚠️</span>
            <div>
              <div className="text-sm font-bold text-red-800">פעולה בלתי הפיכה!</div>
              <div className="text-xs text-red-600 mt-0.5">כל ההזמנות, פריטי ההזמנות, ולוגי הסטטוס יימחקו לצמיתות. לא ניתן לשחזר.</div>
            </div>
          </div>
          {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleClear} disabled={clearing}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 transition-colors">
              {clearing ? "מוחק..." : "כן, מחק הכל"}
            </button>
            <button onClick={() => setConfirm(false)}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
              ביטול
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-gray-500">מחק את כל ההזמנות מהמערכת והתחל מאפס. <span className="text-red-500 font-medium">פעולה בלתי הפיכה.</span></p>
          <button onClick={() => setConfirm(true)}
            className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-colors whitespace-nowrap">
            מחק היסטוריה
          </button>
        </div>
      )}
    </>
  );
}

/* ─── Main ───────────────────────────────────────────────── */
export default function SettingsClient({ config: initial }: { config: Config }) {
  const [form,          setForm]          = useState<Config>({ ...initial });
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBg,   setUploadingBg]   = useState(false);

  // Top-level tab
  const [topTab, setTopTab] = useState<TopTab>("הגדרות");

  // Design section: templates vs DIY
  const [designSection, setDesignSection] = useState<DesignSection>("templates");

  // Custom sub-tabs
  const [mainTab,    setMainTab]    = useState<MainTab>("sidebar");
  const [bgTab,      setBgTab]      = useState<BgTab>(() => {
    if (initial.adminBgImage) return "image";
    if (isGradient(initial.adminBg)) return "gradient";
    return "color";
  });
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("presets");

  // Custom gradient state
  const [customFrom,  setCustomFrom]  = useState("#f0ece3");
  const [customTo,    setCustomTo]    = useState("#ddd0c0");
  const [customAngle, setCustomAngle] = useState("135deg");
  const [sbFrom,  setSbFrom]  = useState("#0f111a");
  const [sbTo,    setSbTo]    = useState("#1a1c2e");
  const [sbAngle, setSbAngle] = useState("180deg");

  const fileRef     = useRef<HTMLInputElement>(null);
  const bgImgRef    = useRef<HTMLInputElement>(null);
  const colorRef    = useRef<HTMLInputElement>(null);
  const topBarBgRef = useRef<HTMLInputElement>(null);

  function update<K extends keyof Config>(field: K, value: Config[K]) {
    setForm(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  function applyTemplate(tpl: typeof LUXURY_TEMPLATES[number]) {
    setForm(prev => ({
      ...prev,
      adminBg: tpl.adminBg,
      adminBgImage: tpl.adminBgImage,
      adminPalette: tpl.adminPalette,
      adminSidebarBg: tpl.adminSidebarBg,
      adminSidebarAccent: tpl.adminSidebarAccent,
      adminSidebarTextColor: tpl.adminSidebarTextColor,
      adminContentTextColor: tpl.adminContentTextColor,
      adminTopBarBg: tpl.adminTopBarBg,
      adminTopBarTextColor: tpl.adminTopBarTextColor,
    }));
    setSaved(false);
  }

  function isActiveTemplate(tpl: typeof LUXURY_TEMPLATES[number]) {
    return (
      form.adminSidebarBg    === tpl.adminSidebarBg    &&
      form.adminSidebarAccent === tpl.adminSidebarAccent &&
      form.adminBg           === tpl.adminBg
    );
  }

  function applyCustomGradient(from = customFrom, to = customTo, angle = customAngle) {
    update("adminBg", `linear-gradient(${angle},${from},${to})`);
    update("adminBgImage", null);
  }

  async function uploadFile(file: File, field: "logo" | "adminBgImage", setLoading: (v: boolean) => void) {
    setLoading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res  = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const data = await res.json() as { url?: string };
    if (data.url) { update(field, data.url); if (field === "adminBgImage") setBgTab("image"); }
    setLoading(false);
  }

  async function save() {
    setSaving(true);
    const res = await fetch("/api/admin/site-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); setTimeout(() => window.location.reload(), 400); }
  }

  const isCustomBgColor  = !COLOR_PRESETS.some(p => p.id === form.adminBg) && !isGradient(form.adminBg);
  const isCustomBgGrad   = isGradient(form.adminBg) && !GRADIENT_PRESETS.some(p => p.id === form.adminBg);
  const isCustomTopBarBg = form.adminTopBarBg !== null && !TOPBAR_BG_PRESETS.some(p => p.id === form.adminTopBarBg);

  return (
    <div className="p-4 md:p-8 max-w-2xl">

      {/* ═══════════════════ TOP-LEVEL TABS ═══════════════════ */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl mb-6 w-fit">
        {(["הגדרות", "גיבוי"] as TopTab[]).map(tab => {
          const label = tab === "הגדרות" ? "⚙️ הגדרות" : "💾 גיבוי ושחזור";
          return (
            <button key={tab} onClick={() => setTopTab(tab)}
              className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap"
              style={topTab === tab
                ? { background: "white", color: "#1f2937", boxShadow: "0 1px 4px rgba(0,0,0,0.12)" }
                : { color: "#6b7280" }}>
              {label}
            </button>
          );
        })}
      </div>

      {/* ═══════════════════ TAB 1: הגדרות ═══════════════════ */}
      {topTab === "הגדרות" && (
        <div className="space-y-3">

          {/* 1. עיצוב פאנל הניהול */}
          <CollapsibleSection title="עיצוב פאנל הניהול" icon="🎨">

            {/* ── Two main boxes ── */}
            <div className="grid grid-cols-2 gap-3 border-b border-gray-100 pb-5 mb-5">

              {/* Box 1: עיצוב */}
              <button
                onClick={() => setDesignSection("templates")}
                className="relative rounded-2xl overflow-hidden transition-all group"
                style={{
                  border: designSection === "templates" ? "2px solid #c9a84c" : "2px solid #e5e7eb",
                  boxShadow: designSection === "templates" ? "0 0 0 3px rgba(201,168,76,0.15), 0 4px 16px rgba(0,0,0,0.08)" : "none",
                }}
              >
                {/* Gradient preview background */}
                <div className="h-20 relative flex flex-col" style={{ background: "linear-gradient(135deg,#080a12,#111827)" }}>
                  {/* mini topbar */}
                  <div className="h-5 flex items-center px-2 gap-1.5 shrink-0" style={{ background: "rgba(8,10,18,0.95)", borderBottom: "1px solid rgba(201,168,76,0.2)" }}>
                    <div className="h-1 w-6 rounded-full" style={{ background: "#c9a84c", opacity: 0.8 }} />
                  </div>
                  <div className="flex-1 flex flex-row-reverse">
                    <div className="w-8 h-full p-1 flex flex-col gap-0.5" style={{ background: "linear-gradient(180deg,#080a12,#0f1118)" }}>
                      <div className="h-1.5 w-full rounded-full" style={{ background: "#c9a84c" }} />
                      <div className="h-0.5 w-3/4 rounded-full" style={{ background: "#d4af37", opacity: 0.4 }} />
                      <div className="h-0.5 w-1/2 rounded-full" style={{ background: "#d4af37", opacity: 0.4 }} />
                      <div className="h-0.5 w-3/4 rounded-full" style={{ background: "#d4af37", opacity: 0.4 }} />
                    </div>
                    <div className="flex-1 p-1.5 flex flex-col gap-1">
                      <div className="h-3 rounded opacity-20" style={{ background: "#e8e0d0" }} />
                      <div className="grid grid-cols-3 gap-0.5">
                        {[1,2,3].map(i => <div key={i} className="h-4 rounded opacity-[0.1]" style={{ background: "#e8e0d0" }} />)}
                      </div>
                    </div>
                  </div>
                  {/* Stars decoration */}
                  <div className="absolute inset-0 pointer-events-none">
                    {[{x:"20%",y:"15%"},{x:"70%",y:"25%"},{x:"45%",y:"65%"},{x:"80%",y:"70%"}].map((s,i) => (
                      <div key={i} className="absolute w-0.5 h-0.5 rounded-full bg-white opacity-60" style={{ left:s.x, top:s.y }} />
                    ))}
                  </div>
                </div>
                <div className="px-3 py-2.5 text-right">
                  <div className="text-sm font-bold text-gray-900">עיצוב</div>
                  <div className="text-[11px] text-gray-400">5 תבניות יוקרה מוכנות</div>
                </div>
                {designSection === "templates" && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "#c9a84c" }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                )}
              </button>

              {/* Box 2: עשה זאת בעצמך */}
              <button
                onClick={() => setDesignSection("custom")}
                className="relative rounded-2xl overflow-hidden transition-all group"
                style={{
                  border: designSection === "custom" ? "2px solid #6366f1" : "2px solid #e5e7eb",
                  boxShadow: designSection === "custom" ? "0 0 0 3px rgba(99,102,241,0.12), 0 4px 16px rgba(0,0,0,0.08)" : "none",
                }}
              >
                {/* Colorful DIY preview */}
                <div className="h-20 relative overflow-hidden" style={{ background: "linear-gradient(135deg,#f0f4f8,#dce6f0)" }}>
                  {/* color swatches grid */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="grid grid-cols-4 gap-1 p-2">
                      {["#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#8b5cf6","#ec4899","#06b6d4"].map(c => (
                        <div key={c} className="w-5 h-5 rounded-md" style={{ background: c }} />
                      ))}
                    </div>
                  </div>
                  {/* paint icon */}
                  <div className="absolute bottom-1.5 left-1.5 text-lg opacity-30">🎨</div>
                </div>
                <div className="px-3 py-2.5 text-right">
                  <div className="text-sm font-bold text-gray-900">עשה זאת בעצמך</div>
                  <div className="text-[11px] text-gray-400">התאמה אישית מלאה</div>
                </div>
                {designSection === "custom" && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "#6366f1" }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                )}
              </button>
            </div>

            {/* ══════════ TEMPLATES SECTION ══════════ */}
            {designSection === "templates" && (
              <div>
                <p className="text-xs text-gray-400 mb-4">לחץ על תבנית להחלתה — לאחר מכן לחץ שמור</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {LUXURY_TEMPLATES.map(tpl => (
                    <TemplateCard
                      key={tpl.id}
                      tpl={tpl}
                      isActive={isActiveTemplate(tpl)}
                      onApply={() => applyTemplate(tpl)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ══════════ CUSTOM / DIY SECTION ══════════ */}
            {designSection === "custom" && (
              <div>
                {/* Inner tabs: Sidebar / TopBar / Background */}
                <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6 w-fit">
                  {([["sidebar","🗂️ סיידבר"],["topbar","🔝 פאנל עליון"],["background","🖼️ רקע"]] as [MainTab,string][]).map(([id,label]) => (
                    <button key={id} onClick={() => setMainTab(id)}
                      className="px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap"
                      style={mainTab === id
                        ? { background: "white", color: "#1f2937", boxShadow: "0 1px 4px rgba(0,0,0,0.12)" }
                        : { color: "#6b7280" }}>
                      {label}
                    </button>
                  ))}
                </div>

                {/* ── SIDEBAR ── */}
                {mainTab === "sidebar" && (
                  <>
                    <SubTabs
                      tabs={[{id:"presets",label:"🎨 פריסטים"},{id:"gradient",label:"🌈 Gradient"},{id:"custom",label:"✨ מותאם"}]}
                      active={sidebarTab} onChange={setSidebarTab} />

                    {sidebarTab === "presets" && (
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        {PALETTES.map(p => {
                          const active = form.adminPalette === p.id;
                          return (
                            <button key={p.id}
                              onClick={() => { update("adminPalette", p.id); update("adminSidebarBg", null); update("adminSidebarAccent", null); }}
                              className="relative rounded-xl overflow-hidden transition-all"
                              style={{ background: p.preview, border: `2px solid ${active ? p.accent : "transparent"}`,
                                boxShadow: active ? `0 0 0 3px ${p.accent}33` : "none" }}>
                              <div className="h-16 flex flex-col items-center justify-center gap-1.5 px-2">
                                <div className="w-4 h-8 rounded-sm opacity-60" style={{ background: p.bg }} />
                                <div className="w-6 h-1 rounded-full" style={{ background: p.accent }} />
                              </div>
                              <div className="px-1.5 py-2 text-center border-t" style={{ borderColor: `${p.accent}22` }}>
                                <div className="text-[11px] font-bold" style={{ color: p.accent }}>{p.label}</div>
                                <div className="text-[9px] text-gray-400 mt-0.5">{p.desc}</div>
                              </div>
                              {active && (
                                <div className="absolute top-1.5 left-1.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: p.accent }}>
                                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {sidebarTab === "gradient" && (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
                          {SIDEBAR_GRADIENT_PRESETS.map(p => {
                            const isActive = form.adminPalette === "custom" && form.adminSidebarBg === p.id;
                            return (
                              <button key={p.id}
                                onClick={() => { update("adminPalette","custom"); update("adminSidebarBg",p.id); update("adminSidebarAccent",p.accent); }}
                                className="relative flex flex-col items-center gap-1.5 rounded-xl p-2 border-2 transition-all"
                                style={{ borderColor: isActive ? "#f59e0b" : "transparent",
                                  boxShadow: isActive ? "0 0 0 3px rgba(245,158,11,0.3)" : "0 0 0 1px rgba(0,0,0,0.1)" }}>
                                <div className="w-full h-14 rounded-lg flex flex-col justify-start p-1.5 gap-1" style={{ background: p.id }}>
                                  <div className="w-full h-1.5 rounded-full" style={{ background: p.accent, opacity: 0.9 }} />
                                  <div className="w-3/4 h-1 rounded-full bg-white opacity-20" />
                                  <div className="w-2/3 h-1 rounded-full bg-white opacity-20" />
                                  <div className="w-3/4 h-1 rounded-full bg-white opacity-20" />
                                </div>
                                <span className="text-[10px] font-semibold text-gray-600">{p.label}</span>
                                {isActive && (
                                  <div className="absolute top-1.5 left-1.5 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center">
                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        <div className="border border-dashed border-gray-200 rounded-xl p-4 space-y-3">
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">בנה גרדיאנט מותאם לסיידבר</div>
                          <div className="h-14 rounded-xl border border-gray-100" style={{ background: `linear-gradient(${sbAngle},${sbFrom},${sbTo})` }} />
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <label className="text-xs text-gray-500">מ:</label>
                              <div className="w-8 h-8 rounded-lg border border-gray-300 cursor-pointer" style={{ background: sbFrom }} onClick={() => document.getElementById("sb-from")?.click()} />
                              <input id="sb-from" type="color" className="sr-only" value={sbFrom} onChange={e => setSbFrom(e.target.value)} />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <label className="text-xs text-gray-500">עד:</label>
                              <div className="w-8 h-8 rounded-lg border border-gray-300 cursor-pointer" style={{ background: sbTo }} onClick={() => document.getElementById("sb-to")?.click()} />
                              <input id="sb-to" type="color" className="sr-only" value={sbTo} onChange={e => setSbTo(e.target.value)} />
                            </div>
                            <div className="flex gap-1">
                              {SIDEBAR_ANGLES.map(a => (
                                <button key={a.value} onClick={() => setSbAngle(a.value)}
                                  className="w-7 h-7 rounded-lg text-sm font-bold border transition-all"
                                  style={sbAngle === a.value ? { background: "#f59e0b", color: "#fff", borderColor: "#f59e0b" } : { background: "white", color: "#6b7280", borderColor: "#e5e7eb" }}>
                                  {a.label}
                                </button>
                              ))}
                            </div>
                            <button onClick={() => { update("adminPalette","custom"); update("adminSidebarBg",`linear-gradient(${sbAngle},${sbFrom},${sbTo})`); }}
                              className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white"
                              style={{ background: "linear-gradient(135deg,#8B6914,#C9A84C)" }}>
                              החל
                            </button>
                          </div>
                          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                            <span className="text-xs text-gray-500">אקסנט:</span>
                            <div className="w-7 h-7 rounded-lg border border-gray-300 cursor-pointer" style={{ background: form.adminSidebarAccent ?? "#f59e0b" }} onClick={() => document.getElementById("sb-accent-grad")?.click()} />
                            <input id="sb-accent-grad" type="color" className="sr-only" value={form.adminSidebarAccent ?? "#f59e0b"} onChange={e => update("adminSidebarAccent", e.target.value)} />
                            <span className="text-xs font-mono text-gray-500">{form.adminSidebarAccent ?? "#f59e0b"}</span>
                          </div>
                        </div>
                      </>
                    )}

                    {sidebarTab === "custom" && (
                      <div className="space-y-4">
                        <div className="w-full h-24 rounded-xl overflow-hidden flex border border-gray-100">
                          <div className="w-16 h-full flex flex-col justify-start p-2 gap-1.5" style={{ background: form.adminSidebarBg ?? "#0f111a" }}>
                            <div className="w-full h-2 rounded-full" style={{ background: form.adminSidebarAccent ?? "#f59e0b" }} />
                            <div className="w-3/4 h-1.5 rounded-full" style={{ background: form.adminSidebarTextColor, opacity: 0.5 }} />
                            <div className="w-2/3 h-1.5 rounded-full" style={{ background: form.adminSidebarTextColor, opacity: 0.5 }} />
                            <div className="w-3/4 h-1.5 rounded-full" style={{ background: form.adminSidebarTextColor, opacity: 0.5 }} />
                          </div>
                          <div className="flex-1 flex items-center justify-center" style={{ background: form.adminBg }}>
                            <span className="text-xs" style={{ color: form.adminContentTextColor, opacity: 0.6 }}>תצוגה מקדימה</span>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">רקע סיידבר</label>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl border border-gray-200 cursor-pointer" style={{ background: form.adminSidebarBg ?? "#0f111a" }} onClick={() => document.getElementById("sb-bg-custom")?.click()} />
                            <input id="sb-bg-custom" type="color" className="sr-only" value={form.adminSidebarBg ?? "#0f111a"} onChange={e => { update("adminPalette","custom"); update("adminSidebarBg", e.target.value); }} />
                            <span className="text-xs font-mono text-gray-600">{form.adminSidebarBg ?? "#0f111a"}</span>
                            <button onClick={() => document.getElementById("sb-bg-custom")?.click()} className="text-xs px-3 py-1.5 rounded-lg font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors">בחר</button>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">צבע אקסנט (פריטים פעילים)</label>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl border border-gray-200 cursor-pointer" style={{ background: form.adminSidebarAccent ?? "#f59e0b" }} onClick={() => document.getElementById("sb-accent-custom")?.click()} />
                            <input id="sb-accent-custom" type="color" className="sr-only" value={form.adminSidebarAccent ?? "#f59e0b"} onChange={e => { update("adminPalette","custom"); update("adminSidebarAccent", e.target.value); }} />
                            <span className="text-xs font-mono text-gray-600">{form.adminSidebarAccent ?? "#f59e0b"}</span>
                            <button onClick={() => document.getElementById("sb-accent-custom")?.click()} className="text-xs px-3 py-1.5 rounded-lg font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors">בחר</button>
                          </div>
                        </div>
                      </div>
                    )}

                    <ColorPickerRow label="צבע טקסט סיידבר" presets={SIDEBAR_TEXT_PRESETS} value={form.adminSidebarTextColor} onChange={v => update("adminSidebarTextColor", v)} inputId="sb-text-custom" />
                  </>
                )}

                {/* ── TOP BAR ── */}
                {mainTab === "topbar" && (
                  <>
                    <div className="w-full rounded-xl overflow-hidden border border-gray-100 mb-5">
                      <div className="flex items-center justify-between px-3 gap-2"
                        style={{ height: 36, background: form.adminTopBarBg ?? "transparent", borderBottom: `1px solid ${form.adminTopBarTextColor}33`, backgroundColor: form.adminTopBarBg ?? "rgba(240,236,227,0.5)" }}>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-3 flex flex-col gap-0.5">
                            <div className="h-0.5 rounded-full w-full" style={{ background: form.adminTopBarTextColor }} />
                            <div className="h-0.5 rounded-full w-full" style={{ background: form.adminTopBarTextColor }} />
                            <div className="h-0.5 rounded-full w-3/4" style={{ background: form.adminTopBarTextColor }} />
                          </div>
                          <span className="text-[11px] font-semibold" style={{ color: form.adminTopBarTextColor }}>שם הדף</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={form.adminTopBarTextColor} strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="15.65" y2="15.65"/></svg>
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>A</div>
                        </div>
                      </div>
                      <div className="h-8 flex items-center px-3" style={{ background: form.adminBg }}>
                        <span className="text-[10px] opacity-40" style={{ color: form.adminContentTextColor }}>תוכן הדף...</span>
                      </div>
                    </div>

                    <div className="mb-5">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-3">רקע פאנל עליון</label>
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <button onClick={() => update("adminTopBarBg", null)}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-semibold transition-all"
                          style={{ borderColor: form.adminTopBarBg === null ? "#f59e0b" : "rgba(0,0,0,0.1)", boxShadow: form.adminTopBarBg === null ? "0 0 0 3px rgba(245,158,11,0.2)" : "none", background: form.adminTopBarBg === null ? "rgba(245,158,11,0.06)" : "white", color: form.adminTopBarBg === null ? "#92400e" : "#6b7280" }}>
                          <span>✦</span> שקוף (ברירת מחדל)
                        </button>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 mb-3">
                        {TOPBAR_BG_PRESETS.map(p => {
                          const active = form.adminTopBarBg === p.id;
                          return (
                            <button key={p.id} onClick={() => update("adminTopBarBg", p.id)} title={p.label}
                              className="relative flex flex-col items-center gap-1 rounded-xl p-2 border-2 transition-all"
                              style={{ background: p.id, borderColor: active ? "#f59e0b" : "rgba(0,0,0,0.08)", boxShadow: active ? "0 0 0 3px rgba(245,158,11,0.3)" : "none" }}>
                              <div className="w-full h-7 rounded-md border border-black/[0.06]" style={{ background: p.id }} />
                              <span className="text-[9px] font-semibold" style={{ color: p.dark ? "#d1d5db" : "#4b5563" }}>{p.label}</span>
                              {active && <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg></div>}
                            </button>
                          );
                        })}
                        <button onClick={() => topBarBgRef.current?.click()} title="צבע מותאם"
                          className="relative flex flex-col items-center gap-1 rounded-xl p-2 border-2 transition-all"
                          style={{ background: isCustomTopBarBg ? (form.adminTopBarBg ?? "white") : "white", borderColor: isCustomTopBarBg ? "#f59e0b" : "rgba(0,0,0,0.08)", boxShadow: isCustomTopBarBg ? "0 0 0 3px rgba(245,158,11,0.3)" : "none" }}>
                          <div className="w-full h-7 rounded-md" style={{ background: "conic-gradient(from 0deg,#ef4444,#f97316,#eab308,#22c55e,#3b82f6,#8b5cf6,#ef4444)", opacity: isCustomTopBarBg ? 0.5 : 1 }} />
                          <span className="text-[9px] font-semibold text-gray-600">Custom</span>
                          {isCustomTopBarBg && <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg></div>}
                        </button>
                        <input ref={topBarBgRef} type="color" className="sr-only" value={isCustomTopBarBg ? (form.adminTopBarBg ?? "#ffffff") : "#ffffff"} onChange={e => update("adminTopBarBg", e.target.value)} />
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                        <div className="w-7 h-7 rounded-lg border border-gray-200 shrink-0" style={{ background: form.adminTopBarBg ?? "transparent", backgroundImage: form.adminTopBarBg === null ? "repeating-conic-gradient(#e5e7eb 0% 25%, white 0% 50%) 0 0 / 8px 8px" : undefined }} />
                        <span className="text-xs font-mono text-gray-600 flex-1">{form.adminTopBarBg ?? "transparent"}</span>
                        <button onClick={() => topBarBgRef.current?.click()} className="text-xs px-3 py-1.5 rounded-lg font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors">בחר צבע</button>
                      </div>
                    </div>
                    <ColorPickerRow label="צבע טקסט פאנל עליון" presets={TOPBAR_TEXT_PRESETS} value={form.adminTopBarTextColor} onChange={v => update("adminTopBarTextColor", v)} inputId="topbar-text-custom" />
                  </>
                )}

                {/* ── BACKGROUND ── */}
                {mainTab === "background" && (
                  <>
                    <SubTabs<BgTab>
                      tabs={[{id:"color" as BgTab,label:"🎨 צבע"},{id:"gradient" as BgTab,label:"🌈 Gradient"},{id:"image" as BgTab,label:"🖼️ תמונה"}]}
                      active={bgTab}
                      onChange={(tab) => { const t = tab as BgTab; if (t === "image") bgImgRef.current?.click(); else { setBgTab(t); update("adminBgImage", null); if (t === "color" && isGradient(form.adminBg)) update("adminBg","#f0ece3"); if (t === "gradient" && !isGradient(form.adminBg)) update("adminBg",GRADIENT_PRESETS[0].id); } }}
                    />

                    {bgTab === "color" && (
                      <>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 mb-3">
                          {COLOR_PRESETS.map(p => {
                            const active = form.adminBg === p.id;
                            return (
                              <button key={p.id} onClick={() => update("adminBg", p.id)} title={p.label}
                                className="relative flex flex-col items-center gap-1.5 rounded-xl p-2 border-2 transition-all"
                                style={{ background: p.id, borderColor: active ? "#f59e0b" : "rgba(0,0,0,0.08)", boxShadow: active ? "0 0 0 3px rgba(245,158,11,0.3)" : "none" }}>
                                <div className="w-full h-8 rounded-md" style={{ background: p.id, border: "1px solid rgba(0,0,0,0.06)" }} />
                                <span className="text-[10px] font-semibold" style={{ color: p.dark ? "#d1d5db" : "#4b5563" }}>{p.label}</span>
                                {active && <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg></div>}
                              </button>
                            );
                          })}
                          <button onClick={() => colorRef.current?.click()} title="צבע מותאם"
                            className="relative flex flex-col items-center gap-1.5 rounded-xl p-2 border-2 transition-all"
                            style={{ background: isCustomBgColor ? form.adminBg : "white", borderColor: isCustomBgColor ? "#f59e0b" : "rgba(0,0,0,0.08)", boxShadow: isCustomBgColor ? "0 0 0 3px rgba(245,158,11,0.3)" : "none" }}>
                            <div className="w-full h-8 rounded-md" style={{ background: "conic-gradient(from 0deg,#ef4444,#f97316,#eab308,#22c55e,#3b82f6,#8b5cf6,#ef4444)", opacity: isCustomBgColor ? 0.5 : 1 }} />
                            <span className="text-[10px] font-semibold text-gray-600">Custom</span>
                            {isCustomBgColor && <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg></div>}
                          </button>
                          <input ref={colorRef} type="color" className="sr-only" value={isCustomBgColor ? form.adminBg : "#f0ece3"} onChange={e => update("adminBg", e.target.value)} />
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                          <div className="w-8 h-8 rounded-lg border border-gray-200 shrink-0" style={{ background: form.adminBg }} />
                          <span className="text-xs font-mono text-gray-600 uppercase flex-1">{form.adminBg}</span>
                          <button onClick={() => colorRef.current?.click()} className="text-xs px-3 py-1.5 rounded-lg font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors">בחר צבע</button>
                        </div>
                      </>
                    )}

                    {bgTab === "gradient" && (
                      <>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 mb-4">
                          {GRADIENT_PRESETS.map(p => {
                            const active = form.adminBg === p.id;
                            return (
                              <button key={p.id} onClick={() => { update("adminBg", p.id); update("adminBgImage", null); }} title={p.label}
                                className="relative flex flex-col items-center gap-1.5 rounded-xl p-2 border-2 transition-all"
                                style={{ borderColor: active ? "#f59e0b" : "transparent", boxShadow: active ? "0 0 0 3px rgba(245,158,11,0.3)" : "0 0 0 1px rgba(0,0,0,0.08)" }}>
                                <div className="w-full h-10 rounded-lg" style={{ background: p.id }} />
                                <span className="text-[10px] font-semibold text-gray-600">{p.label}</span>
                                {active && <div className="absolute top-1.5 left-1.5 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg></div>}
                              </button>
                            );
                          })}
                        </div>
                        <div className="border border-dashed border-gray-200 rounded-xl p-4 space-y-3"
                          style={{ borderColor: isCustomBgGrad ? "#f59e0b" : undefined, background: isCustomBgGrad ? "rgba(245,158,11,0.03)" : undefined }}>
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{isCustomBgGrad ? "✨ גרדיאנט מותאם" : "בנה גרדיאנט מותאם"}</div>
                          <div className="w-full h-10 rounded-xl border border-gray-100" style={{ background: `linear-gradient(${customAngle},${customFrom},${customTo})` }} />
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <label className="text-xs text-gray-500">מ:</label>
                              <div className="w-8 h-8 rounded-lg border border-gray-300 cursor-pointer" style={{ background: customFrom }} onClick={() => document.getElementById("grad-from")?.click()} />
                              <input id="grad-from" type="color" className="sr-only" value={customFrom} onChange={e => { setCustomFrom(e.target.value); applyCustomGradient(e.target.value, customTo, customAngle); }} />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <label className="text-xs text-gray-500">עד:</label>
                              <div className="w-8 h-8 rounded-lg border border-gray-300 cursor-pointer" style={{ background: customTo }} onClick={() => document.getElementById("grad-to")?.click()} />
                              <input id="grad-to" type="color" className="sr-only" value={customTo} onChange={e => { setCustomTo(e.target.value); applyCustomGradient(customFrom, e.target.value, customAngle); }} />
                            </div>
                            <div className="flex gap-1">
                              {ANGLES.map(a => (
                                <button key={a.value} onClick={() => { setCustomAngle(a.value); applyCustomGradient(customFrom, customTo, a.value); }}
                                  className="w-7 h-7 rounded-lg text-sm font-bold border transition-all"
                                  style={customAngle === a.value ? { background: "#f59e0b", color: "#fff", borderColor: "#f59e0b" } : { background: "white", color: "#6b7280", borderColor: "#e5e7eb" }}>
                                  {a.label}
                                </button>
                              ))}
                            </div>
                            <button onClick={() => applyCustomGradient()} className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white" style={{ background: "linear-gradient(135deg,#8B6914,#C9A84C)" }}>החל</button>
                          </div>
                        </div>
                      </>
                    )}

                    {bgTab === "image" && (
                      <div className="space-y-3">
                        {form.adminBgImage ? (
                          <>
                            <div className="w-full h-40 rounded-xl border border-gray-200 overflow-hidden relative"
                              style={{ backgroundImage: `url(${form.adminBgImage})`, backgroundSize: "cover", backgroundPosition: "center" }}>
                              <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                <button onClick={() => bgImgRef.current?.click()} className="px-4 py-2 bg-white/90 rounded-xl text-sm font-semibold text-gray-800">החלף תמונה</button>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => bgImgRef.current?.click()} disabled={uploadingBg} className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: "linear-gradient(135deg,#8B6914,#C9A84C)" }}>{uploadingBg ? "מעלה..." : "החלף"}</button>
                              <button onClick={() => { update("adminBgImage", null); setBgTab("color"); }} className="px-4 py-2 rounded-lg text-sm font-semibold text-red-500 border border-red-200 hover:bg-red-50 transition-colors">הסר</button>
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-32 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-amber-400 transition-colors bg-gray-50" onClick={() => bgImgRef.current?.click()}>
                            {uploadingBg ? <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg>
                              : <><span className="text-3xl text-gray-300">🖼️</span><span className="text-sm text-gray-400">לחץ להעלאת תמונת רקע</span></>}
                          </div>
                        )}
                        <p className="text-xs text-gray-400">התמונה תכסה את כל הרקע (cover + fixed)</p>
                      </div>
                    )}

                    <ColorPickerRow label="צבע טקסט אזור התוכן" presets={CONTENT_TEXT_PRESETS} value={form.adminContentTextColor} onChange={v => update("adminContentTextColor", v)} inputId="content-text-custom" />
                    <input ref={bgImgRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f,"adminBgImage",setUploadingBg); e.target.value = ""; }} />
                  </>
                )}
              </div>
            )}
          </CollapsibleSection>

          {/* 2. שם האתר */}
          <CollapsibleSection title="שם האתר" icon="✏️">
            <input type="text" value={form.siteName} onChange={e => update("siteName", e.target.value)} placeholder="Menu4U"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            <p className="text-xs text-gray-400 mt-1.5">מוצג בסיידבר לצד הלוגו</p>
          </CollapsibleSection>

          {/* 3. לוגו האתר */}
          <CollapsibleSection title="לוגו האתר" icon="🖼️">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center shrink-0 overflow-hidden bg-gray-50 cursor-pointer hover:border-amber-400 transition-colors" onClick={() => fileRef.current?.click()}>
                {form.logo ? <img src={form.logo} alt="לוגו" className="w-full h-full object-contain" /> : <span className="text-2xl text-gray-300">🏪</span>}
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-sm text-gray-500">מומלץ: PNG/SVG שקוף, לפחות 200×200px</p>
                <div className="flex gap-2">
                  <button onClick={() => fileRef.current?.click()} disabled={uploadingLogo} className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: "linear-gradient(135deg,#8B6914,#C9A84C)" }}>{uploadingLogo ? "מעלה..." : "העלה לוגו"}</button>
                  {form.logo && <button onClick={() => update("logo", null)} className="px-4 py-2 rounded-lg text-sm font-semibold text-red-500 border border-red-200 hover:bg-red-50 transition-colors">הסר</button>}
                </div>
                {form.logo && <p className="text-xs text-gray-400 truncate max-w-[260px]">{form.logo}</p>}
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f,"logo",setUploadingLogo); e.target.value = ""; }} />
          </CollapsibleSection>

          {/* 4. דומיין ראשי */}
          <CollapsibleSection title="דומיין ראשי" icon="🌐">
            <input type="text" value={form.domain ?? ""} onChange={e => update("domain", e.target.value || null)} placeholder="לדוגמא: app.mysite.co.il" dir="ltr"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            <p className="text-xs text-gray-400 mt-1.5">הדומיין הראשי של פלטפורמת Menu4U</p>
          </CollapsibleSection>

          {/* 5. זכויות יוצרים */}
          <CollapsibleSection title="זכויות יוצרים" icon="©">
            <input type="text" value={form.copyright ?? ""} onChange={e => update("copyright", e.target.value || null)}
              placeholder={`© ${new Date().getFullYear()} Menu4U · כל הזכויות שמורות`}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            <p className="text-xs text-gray-400 mt-1.5">טקסט ברירת מחדל לכותרת תחתונה</p>
          </CollapsibleSection>

          {/* 6. ניקוי הזמנות */}
          <CollapsibleSection title="ניקוי הזמנות" icon="🗑️" redBorder>
            <ClearOrdersSection />
          </CollapsibleSection>

          {/* ── Save button ── */}
          <div className="flex items-center gap-3 pt-1">
            <button onClick={save} disabled={saving}
              className="px-6 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60 transition-all"
              style={{ background: "linear-gradient(135deg,#8B6914,#C9A84C)" }}>
              {saving ? "שומר..." : "שמור הגדרות"}
            </button>
            {saved && (
              <span className="text-sm text-green-600 font-medium flex items-center gap-1.5">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                נשמר בהצלחה!
              </span>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════ TAB 2: גיבוי ושחזור ═══════════════════ */}
      {topTab === "גיבוי" && (
        <div className="space-y-5">
          <BackupSection />
          <RestoreSection />
        </div>
      )}
    </div>
  );
}
