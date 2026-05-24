"use client";

import { useState, useRef } from "react";

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
    id: "imperial-bordeaux",
    name: "Imperial Bordeaux",
    nameHe: "בורדו אימפריאלי",
    emoji: "🍷",
    tagline: "בורגנדי צרפתי עשיר ומרהיב",
    mood: "Château Wine",
    adminBg: "linear-gradient(135deg,#14030a,#200510)",
    adminBgImage: null,
    adminPalette: "custom",
    adminSidebarBg: "linear-gradient(180deg,#100208,#1c040c)",
    adminSidebarAccent: "#fb7185",
    adminSidebarTextColor: "#fda4af",
    adminContentTextColor: "#fce7f3",
    adminTopBarBg: "rgba(20,3,10,0.93)",
    adminTopBarTextColor: "#fb7185",
    previewBg: "#1a040c",
    previewAccent: "#fb7185",
    previewSidebar: "#130207",
    previewTopBar: "#160308",
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

/* ─── Section wrapper ────────────────────────────────────── */
function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
        <span className="text-lg">{icon}</span>
        <h2 className="font-bold text-gray-900">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
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
            style={{ width: 38, background: tpl.adminSidebarBg ?? tpl.previewSidebar }}
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

/* ─── Main ───────────────────────────────────────────────── */
export default function SettingsClient({ config: initial }: { config: Config }) {
  const [form,          setForm]          = useState<Config>({ ...initial });
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBg,   setUploadingBg]   = useState(false);

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
    const data = await res.json();
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
      <div className="space-y-5">

        {/* ═══════════════════ DESIGN SECTION ═══════════════════ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
            <span className="text-lg">🎨</span>
            <h2 className="font-bold text-gray-900">עיצוב פאנל הניהול</h2>
          </div>

          {/* ── Two main boxes ── */}
          <div className="p-5 grid grid-cols-2 gap-3 border-b border-gray-100">

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
            <div className="px-5 py-5">
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
            <div className="px-5 py-5">

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
                  <SubTabs
                    tabs={[{id:"color",label:"🎨 צבע"},{id:"gradient",label:"🌈 Gradient"},{id:"image",label:"🖼️ תמונה"}]}
                    active={bgTab}
                    onChange={tab => { if (tab === "image") bgImgRef.current?.click(); else { setBgTab(tab); if (tab !== "image") update("adminBgImage", null); if (tab === "color" && isGradient(form.adminBg)) update("adminBg","#f0ece3"); if (tab === "gradient" && !isGradient(form.adminBg)) update("adminBg",GRADIENT_PRESETS[0].id); } }}
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
        </div>

        {/* ── Site name ── */}
        <Section title="שם האתר" icon="✏️">
          <input type="text" value={form.siteName} onChange={e => update("siteName", e.target.value)} placeholder="Menu4U"
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          <p className="text-xs text-gray-400 mt-1.5">מוצג בסיידבר לצד הלוגו</p>
        </Section>

        {/* ── Logo ── */}
        <Section title="לוגו האתר הראשי" icon="🖼️">
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
        </Section>

        {/* ── Domain ── */}
        <Section title="דומיין ראשי" icon="🌐">
          <input type="text" value={form.domain ?? ""} onChange={e => update("domain", e.target.value || null)} placeholder="לדוגמא: app.mysite.co.il" dir="ltr"
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          <p className="text-xs text-gray-400 mt-1.5">הדומיין הראשי של פלטפורמת Menu4U</p>
        </Section>

        {/* ── Copyright ── */}
        <Section title="כל הזכויות שמורות" icon="©">
          <input type="text" value={form.copyright ?? ""} onChange={e => update("copyright", e.target.value || null)}
            placeholder={`© ${new Date().getFullYear()} Menu4U · כל הזכויות שמורות`}
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          <p className="text-xs text-gray-400 mt-1.5">טקסט ברירת מחדל לכותרת תחתונה</p>
        </Section>

        {/* ── Save ── */}
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
    </div>
  );
}
