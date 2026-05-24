"use client";

import { useState, useRef } from "react";

/* ─── Sidebar palette options ────────────────────────────── */
const PALETTES = [
  { id: "dark",   label: "Dark",   bg: "#0f111a", accent: "#f59e0b", preview: "linear-gradient(135deg,#0f111a,#1a1c27)", desc: "ברירת מחדל — כהה עם זהב" },
  { id: "purple", label: "Purple", bg: "#130c1e", accent: "#7c3aed", preview: "linear-gradient(135deg,#130c1e,#1e1032)", desc: "סגול כהה" },
  { id: "blue",   label: "Blue",   bg: "#080f1e", accent: "#2563eb", preview: "linear-gradient(135deg,#080f1e,#0d1a35)", desc: "כחול כהה" },
  { id: "green",  label: "Green",  bg: "#071510", accent: "#16a34a", preview: "linear-gradient(135deg,#071510,#0d2218)", desc: "ירוק כהה" },
  { id: "rose",   label: "Rose",   bg: "#150a0e", accent: "#e11d48", preview: "linear-gradient(135deg,#150a0e,#220c13)", desc: "אדום כהה" },
] as const;

/* ─── Sidebar gradient presets ──────────────────────────── */
const SIDEBAR_GRADIENT_PRESETS = [
  { id: "linear-gradient(180deg,#0f111a,#1a1c2e)", label: "Dark Blue",   accent: "#f59e0b" },
  { id: "linear-gradient(180deg,#130c1e,#1e1032)", label: "Deep Purple", accent: "#7c3aed" },
  { id: "linear-gradient(180deg,#071510,#0d2218)", label: "Forest",      accent: "#16a34a" },
  { id: "linear-gradient(180deg,#0a0f1e,#0d1a35)", label: "Ocean",      accent: "#2563eb" },
  { id: "linear-gradient(180deg,#150a0e,#220c13)", label: "Crimson",     accent: "#e11d48" },
  { id: "linear-gradient(180deg,#1a0533,#2d0a5e)", label: "Galaxy",      accent: "#a855f7" },
  { id: "linear-gradient(180deg,#0a0a0a,#1a1a1a)", label: "Pure Black", accent: "#ffffff" },
  { id: "linear-gradient(180deg,#1e293b,#334155)", label: "Slate",      accent: "#38bdf8" },
] as const;

const SIDEBAR_ANGLES = [
  { label: "↓", value: "180deg" },
  { label: "↘", value: "135deg" },
  { label: "→", value: "90deg"  },
  { label: "↗", value: "45deg"  },
];

/* ─── Solid color presets ────────────────────────────────── */
const COLOR_PRESETS = [
  { id: "#f0ece3", label: "Sand",     dark: false },
  { id: "#f8fafc", label: "White",    dark: false },
  { id: "#f1f5f9", label: "Gray",     dark: false },
  { id: "#1e2130", label: "Navy",     dark: true  },
  { id: "#111827", label: "Charcoal", dark: true  },
];

/* ─── Gradient presets ───────────────────────────────────── */
const GRADIENT_PRESETS = [
  { id: "linear-gradient(135deg,#f0ece3,#ddd0c0)",        label: "Sand Warm",   dark: false },
  { id: "linear-gradient(135deg,#e0f2fe,#bfdbfe)",        label: "Sky Blue",    dark: false },
  { id: "linear-gradient(135deg,#dcfce7,#a7f3d0)",        label: "Mint",        dark: false },
  { id: "linear-gradient(135deg,#fef3c7,#fde68a)",        label: "Sunrise",     dark: false },
  { id: "linear-gradient(135deg,#f3e8ff,#e9d5ff)",        label: "Lavender",    dark: false },
  { id: "linear-gradient(135deg,#fce7f3,#fbcfe8)",        label: "Rose Blush",  dark: false },
  { id: "linear-gradient(135deg,#1e1b4b,#312e81)",        label: "Deep Indigo", dark: true  },
  { id: "linear-gradient(135deg,#0f172a,#1e293b)",        label: "Midnight",    dark: true  },
  { id: "linear-gradient(135deg,#052e16,#14532d)",        label: "Forest",      dark: true  },
  { id: "linear-gradient(135deg,#450a0a,#7f1d1d)",        label: "Crimson",     dark: true  },
  { id: "linear-gradient(135deg,#0c1445,#1e3a5f)",        label: "Ocean Deep",  dark: true  },
  { id: "linear-gradient(135deg,#1a0533,#2d0a5e)",        label: "Galaxy",      dark: true  },
] as const;

/* ─── Gradient angles ────────────────────────────────────── */
const ANGLES = [
  { label: "↘", value: "135deg" },
  { label: "→", value: "90deg"  },
  { label: "↓", value: "180deg" },
  { label: "↗", value: "45deg"  },
];

/* ─── Helpers ────────────────────────────────────────────── */
function isGradient(v: string) { return v.includes("gradient"); }
function isImage(v: string | null) { return !!v; }

/* ─── Types ──────────────────────────────────────────────── */
type Config = {
  siteName: string; logo: string | null;
  domain: string | null; copyright: string | null;
  adminPalette: string; adminBg: string; adminBgImage: string | null;
  adminSidebarBg: string | null;
  adminSidebarAccent: string | null;
};

type BgTab = "color" | "gradient" | "image";
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

/* ─── Main ───────────────────────────────────────────────── */
export default function SettingsClient({ config: initial }: { config: Config }) {
  const [form,          setForm]          = useState<Config>({ ...initial });
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBg,   setUploadingBg]   = useState(false);

  // Determine initial tab
  const initTab = (): BgTab => {
    if (initial.adminBgImage) return "image";
    if (isGradient(initial.adminBg)) return "gradient";
    return "color";
  };
  const [bgTab, setBgTab] = useState<BgTab>(initTab);

  // Custom gradient state
  const [customFrom,  setCustomFrom]  = useState("#f0ece3");
  const [customTo,    setCustomTo]    = useState("#ddd0c0");
  const [customAngle, setCustomAngle] = useState("135deg");

  // Sidebar tab & custom gradient state
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("presets");
  const [sbFrom,  setSbFrom]  = useState("#0f111a");
  const [sbTo,    setSbTo]    = useState("#1a1c2e");
  const [sbAngle, setSbAngle] = useState("180deg");

  const fileRef    = useRef<HTMLInputElement>(null);
  const bgImgRef   = useRef<HTMLInputElement>(null);
  const colorRef   = useRef<HTMLInputElement>(null);

  function update<K extends keyof Config>(field: K, value: Config[K]) {
    setForm(prev => ({ ...prev, [field]: value }));
    setSaved(false);
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
    if (data.url) {
      update(field, data.url);
      if (field === "adminBgImage") setBgTab("image");
    }
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
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      setTimeout(() => window.location.reload(), 400);
    }
  }

  const isCustomColor = !COLOR_PRESETS.some(p => p.id === form.adminBg) && !isGradient(form.adminBg);
  const isCustomGrad  = isGradient(form.adminBg) && !GRADIENT_PRESETS.some(p => p.id === form.adminBg);

  function switchTab(tab: BgTab) {
    setBgTab(tab);
    if (tab !== "image") update("adminBgImage", null);
    if (tab === "color" && isGradient(form.adminBg)) update("adminBg", "#f0ece3");
    if (tab === "gradient" && !isGradient(form.adminBg)) update("adminBg", GRADIENT_PRESETS[0].id);
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="space-y-5">

        {/* ── Sidebar palette ── */}
        <Section title="פלטת צבעים לסיידבר" icon="🎨">
          {/* Tab switcher */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-5 w-fit">
            {(["presets","gradient","custom"] as SidebarTab[]).map(tab => {
              const labels = { presets: "🎨 פריסטים", gradient: "🌈 Gradient", custom: "✨ מותאם" };
              return (
                <button key={tab} onClick={() => setSidebarTab(tab)}
                  className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap"
                  style={sidebarTab === tab
                    ? { background: "white", color: "#1f2937", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }
                    : { color: "#6b7280" }}>
                  {labels[tab]}
                </button>
              );
            })}
          </div>

          {/* ── PRESETS tab ── */}
          {sidebarTab === "presets" && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {PALETTES.map(p => {
                  const active = form.adminPalette === p.id;
                  return (
                    <button key={p.id}
                      onClick={() => { update("adminPalette", p.id); update("adminSidebarBg", null); update("adminSidebarAccent", null); }}
                      className="relative rounded-xl overflow-hidden transition-all"
                      style={{
                        background: p.preview,
                        border: `2px solid ${active ? p.accent : "transparent"}`,
                        boxShadow: active ? `0 0 0 3px ${p.accent}33` : "none",
                      }}
                    >
                      <div className="h-16 flex flex-col items-center justify-center gap-1.5 px-2">
                        <div className="w-4 h-8 rounded-sm opacity-60" style={{ background: p.bg }} />
                        <div className="w-6 h-1 rounded-full" style={{ background: p.accent }} />
                      </div>
                      <div className="px-1.5 py-2 text-center border-t" style={{ borderColor: `${p.accent}22` }}>
                        <div className="text-[11px] font-bold" style={{ color: p.accent }}>{p.label}</div>
                        <div className="text-[9px] text-gray-400 leading-tight mt-0.5">{p.desc}</div>
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
              <p className="text-xs text-gray-400 mt-3">הצבע ישתנה בסיידבר לאחר שמירה ורענון הדף</p>
            </>
          )}

          {/* ── GRADIENT tab ── */}
          {sidebarTab === "gradient" && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
                {SIDEBAR_GRADIENT_PRESETS.map(p => {
                  const isActive = form.adminPalette === "custom" && form.adminSidebarBg === p.id;
                  return (
                    <button key={p.id} onClick={() => { update("adminPalette","custom"); update("adminSidebarBg", p.id); update("adminSidebarAccent", p.accent); }}
                      title={p.label}
                      className="relative flex flex-col items-center gap-1.5 rounded-xl p-2 border-2 transition-all overflow-hidden"
                      style={{
                        borderColor: isActive ? "#f59e0b" : "transparent",
                        boxShadow: isActive ? "0 0 0 3px rgba(245,158,11,0.3)" : "0 0 0 1px rgba(0,0,0,0.1)",
                      }}
                    >
                      {/* Mini sidebar preview */}
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

              {/* Custom gradient builder for sidebar */}
              <div className="border border-dashed border-gray-200 rounded-xl p-4 space-y-3">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">בנה גרדיאנט מותאם לסיידבר</div>
                <div className="h-16 rounded-xl border border-gray-100" style={{ background: `linear-gradient(${sbAngle},${sbFrom},${sbTo})` }} />
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs text-gray-500">מ:</label>
                    <div className="w-8 h-8 rounded-lg border border-gray-300 cursor-pointer" style={{ background: sbFrom }} onClick={() => document.getElementById("sb-from")?.click()} />
                    <input id="sb-from" type="color" className="sr-only" value={sbFrom}
                      onChange={e => { setSbFrom(e.target.value); }} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs text-gray-500">עד:</label>
                    <div className="w-8 h-8 rounded-lg border border-gray-300 cursor-pointer" style={{ background: sbTo }} onClick={() => document.getElementById("sb-to")?.click()} />
                    <input id="sb-to" type="color" className="sr-only" value={sbTo}
                      onChange={e => { setSbTo(e.target.value); }} />
                  </div>
                  <div className="flex items-center gap-1">
                    {SIDEBAR_ANGLES.map(a => (
                      <button key={a.value} onClick={() => setSbAngle(a.value)}
                        className="w-7 h-7 rounded-lg text-sm font-bold border transition-all"
                        style={sbAngle === a.value
                          ? { background: "#f59e0b", color: "#fff", borderColor: "#f59e0b" }
                          : { background: "white", color: "#6b7280", borderColor: "#e5e7eb" }}>
                        {a.label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => { update("adminPalette","custom"); update("adminSidebarBg", `linear-gradient(${sbAngle},${sbFrom},${sbTo})`); }}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white"
                    style={{ background: "linear-gradient(135deg,#8B6914,#C9A84C)" }}>
                    החל
                  </button>
                </div>
                {/* Accent color for gradient */}
                <div className="flex items-center gap-3 pt-1 border-t border-gray-100">
                  <span className="text-xs text-gray-500">צבע אקסנט:</span>
                  <div className="w-7 h-7 rounded-lg border border-gray-300 cursor-pointer" style={{ background: form.adminSidebarAccent ?? "#f59e0b" }} onClick={() => document.getElementById("sb-accent-grad")?.click()} />
                  <input id="sb-accent-grad" type="color" className="sr-only" value={form.adminSidebarAccent ?? "#f59e0b"}
                    onChange={e => update("adminSidebarAccent", e.target.value)} />
                  <span className="text-xs font-mono text-gray-500">{form.adminSidebarAccent ?? "#f59e0b"}</span>
                </div>
              </div>
            </>
          )}

          {/* ── CUSTOM tab ── */}
          {sidebarTab === "custom" && (
            <div className="space-y-4">
              {/* Preview */}
              <div className="w-full h-24 rounded-xl overflow-hidden flex" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
                {/* Fake sidebar strip */}
                <div className="w-16 h-full flex flex-col justify-start p-2 gap-1.5" style={{ background: form.adminSidebarBg ?? "#0f111a" }}>
                  <div className="w-full h-2 rounded-full" style={{ background: form.adminSidebarAccent ?? "#f59e0b" }} />
                  <div className="w-3/4 h-1.5 rounded-full bg-white opacity-20" />
                  <div className="w-2/3 h-1.5 rounded-full bg-white opacity-20" />
                  <div className="w-3/4 h-1.5 rounded-full bg-white opacity-20" />
                </div>
                {/* Content area */}
                <div className="flex-1 flex items-center justify-center bg-gray-50">
                  <span className="text-xs text-gray-400">תצוגה מקדימה</span>
                </div>
              </div>

              {/* Sidebar BG color */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">רקע סיידבר</label>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl border border-gray-200 cursor-pointer shrink-0"
                    style={{ background: form.adminSidebarBg ?? "#0f111a" }}
                    onClick={() => document.getElementById("sb-bg-custom")?.click()} />
                  <input id="sb-bg-custom" type="color" className="sr-only"
                    value={form.adminSidebarBg ?? "#0f111a"}
                    onChange={e => { update("adminPalette","custom"); update("adminSidebarBg", e.target.value); }} />
                  <span className="text-xs font-mono text-gray-600">{form.adminSidebarBg ?? "#0f111a"}</span>
                  <button onClick={() => document.getElementById("sb-bg-custom")?.click()}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors">
                    בחר צבע
                  </button>
                </div>
              </div>

              {/* Accent color */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">צבע אקסנט (פריטים פעילים)</label>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl border border-gray-200 cursor-pointer shrink-0"
                    style={{ background: form.adminSidebarAccent ?? "#f59e0b" }}
                    onClick={() => document.getElementById("sb-accent-custom")?.click()} />
                  <input id="sb-accent-custom" type="color" className="sr-only"
                    value={form.adminSidebarAccent ?? "#f59e0b"}
                    onChange={e => { update("adminPalette","custom"); update("adminSidebarAccent", e.target.value); }} />
                  <span className="text-xs font-mono text-gray-600">{form.adminSidebarAccent ?? "#f59e0b"}</span>
                  <button onClick={() => document.getElementById("sb-accent-custom")?.click()}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors">
                    בחר צבע
                  </button>
                </div>
              </div>
            </div>
          )}
        </Section>

        {/* ── Background ── */}
        <Section title="רקע פאנל הניהול" icon="🖌️">

          {/* Tab switcher */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-5 w-fit">
            {(["color","gradient","image"] as BgTab[]).map(tab => {
              const labels = { color: "🎨 צבע", gradient: "🌈 Gradient", image: "🖼️ תמונה" };
              return (
                <button
                  key={tab}
                  onClick={() => tab === "image" ? bgImgRef.current?.click() : switchTab(tab)}
                  className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap"
                  style={bgTab === tab
                    ? { background: "white", color: "#1f2937", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }
                    : { color: "#6b7280" }}
                >
                  {labels[tab]}
                </button>
              );
            })}
          </div>

          {/* ── SOLID COLOR ── */}
          {bgTab === "color" && (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 mb-3">
                {COLOR_PRESETS.map(p => {
                  const active = form.adminBg === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => update("adminBg", p.id)}
                      title={p.label}
                      className="relative flex flex-col items-center gap-1.5 rounded-xl p-2 border-2 transition-all"
                      style={{
                        background: p.id,
                        borderColor: active ? "#f59e0b" : "rgba(0,0,0,0.08)",
                        boxShadow: active ? "0 0 0 3px rgba(245,158,11,0.3)" : "none",
                      }}
                    >
                      <div className="w-full h-8 rounded-md" style={{ background: p.id, border: "1px solid rgba(0,0,0,0.06)" }} />
                      <span className="text-[10px] font-semibold" style={{ color: p.dark ? "#d1d5db" : "#4b5563" }}>
                        {p.label}
                      </span>
                      {active && (
                        <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center">
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3.5">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}

                {/* Custom color tile */}
                <button
                  onClick={() => colorRef.current?.click()}
                  title="צבע מותאם אישית"
                  className="relative flex flex-col items-center gap-1.5 rounded-xl p-2 border-2 transition-all"
                  style={{
                    background: isCustomColor ? form.adminBg : "white",
                    borderColor: isCustomColor ? "#f59e0b" : "rgba(0,0,0,0.08)",
                    boxShadow: isCustomColor ? "0 0 0 3px rgba(245,158,11,0.3)" : "none",
                  }}
                >
                  <div className="w-full h-8 rounded-md" style={{ background: "conic-gradient(from 0deg,#ef4444,#f97316,#eab308,#22c55e,#3b82f6,#8b5cf6,#ef4444)", opacity: isCustomColor ? 0.5 : 1 }} />
                  <span className="text-[10px] font-semibold text-gray-600">Custom</span>
                  {isCustomColor && (
                    <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                  )}
                </button>
                <input ref={colorRef} type="color" className="sr-only"
                  value={isCustomColor ? form.adminBg : "#f0ece3"}
                  onChange={e => update("adminBg", e.target.value)}
                />
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                <div className="w-8 h-8 rounded-lg border border-gray-200 shrink-0" style={{ background: form.adminBg }} />
                <span className="text-xs font-mono text-gray-600 uppercase flex-1">{form.adminBg}</span>
                <button onClick={() => colorRef.current?.click()}
                  className="text-xs px-3 py-1.5 rounded-lg font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors">
                  בחר צבע
                </button>
              </div>
            </>
          )}

          {/* ── GRADIENT ── */}
          {bgTab === "gradient" && (
            <>
              {/* Preset gradient grid */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 mb-4">
                {GRADIENT_PRESETS.map(p => {
                  const active = form.adminBg === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => { update("adminBg", p.id); update("adminBgImage", null); }}
                      title={p.label}
                      className="relative flex flex-col items-center gap-1.5 rounded-xl p-2 border-2 transition-all overflow-hidden"
                      style={{
                        borderColor: active ? "#f59e0b" : "transparent",
                        boxShadow: active ? "0 0 0 3px rgba(245,158,11,0.3)" : "0 0 0 1px rgba(0,0,0,0.08)",
                      }}
                    >
                      <div className="w-full h-10 rounded-lg" style={{ background: p.id }} />
                      <span className="text-[10px] font-semibold" style={{ color: p.dark ? "#374151" : "#374151" }}>
                        {p.label}
                      </span>
                      {active && (
                        <div className="absolute top-1.5 left-1.5 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center">
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3.5">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Custom gradient builder */}
              <div className="border border-dashed border-gray-200 rounded-xl p-4 space-y-3"
                style={{ background: isCustomGrad ? "rgba(245,158,11,0.04)" : undefined,
                         borderColor: isCustomGrad ? "#f59e0b" : undefined }}>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {isCustomGrad ? "✨ גרדיאנט מותאם אישית" : "בנה גרדיאנט מותאם"}
                </div>

                {/* Preview strip */}
                <div className="w-full h-10 rounded-xl border border-gray-100"
                  style={{ background: `linear-gradient(${customAngle},${customFrom},${customTo})` }} />

                <div className="flex items-center gap-3 flex-wrap">
                  {/* From color */}
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs text-gray-500">מ:</label>
                    <div className="relative">
                      <div className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer" style={{ background: customFrom }}
                        onClick={() => document.getElementById("grad-from")?.click()} />
                      <input id="grad-from" type="color" className="sr-only" value={customFrom}
                        onChange={e => { setCustomFrom(e.target.value); applyCustomGradient(e.target.value, customTo, customAngle); }} />
                    </div>
                    <span className="text-xs font-mono text-gray-500">{customFrom}</span>
                  </div>

                  {/* To color */}
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs text-gray-500">עד:</label>
                    <div className="relative">
                      <div className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer" style={{ background: customTo }}
                        onClick={() => document.getElementById("grad-to")?.click()} />
                      <input id="grad-to" type="color" className="sr-only" value={customTo}
                        onChange={e => { setCustomTo(e.target.value); applyCustomGradient(customFrom, e.target.value, customAngle); }} />
                    </div>
                    <span className="text-xs font-mono text-gray-500">{customTo}</span>
                  </div>

                  {/* Angle */}
                  <div className="flex items-center gap-1">
                    {ANGLES.map(a => (
                      <button key={a.value} onClick={() => { setCustomAngle(a.value); applyCustomGradient(customFrom, customTo, a.value); }}
                        className="w-7 h-7 rounded-lg text-sm font-bold border transition-all"
                        style={customAngle === a.value
                          ? { background: "#f59e0b", color: "#fff", borderColor: "#f59e0b" }
                          : { background: "white", color: "#6b7280", borderColor: "#e5e7eb" }}>
                        {a.label}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => applyCustomGradient()}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white"
                    style={{ background: "linear-gradient(135deg,#8B6914,#C9A84C)" }}>
                    החל
                  </button>
                </div>
              </div>

              {/* Current gradient preview */}
              {isGradient(form.adminBg) && (
                <div className="flex items-center gap-3 mt-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                  <div className="w-8 h-8 rounded-lg border border-gray-200 shrink-0" style={{ background: form.adminBg }} />
                  <span className="text-xs font-mono text-gray-500 flex-1 truncate">{form.adminBg}</span>
                </div>
              )}
            </>
          )}

          {/* ── IMAGE ── */}
          {bgTab === "image" && (
            <div className="space-y-3">
              {form.adminBgImage ? (
                <>
                  <div className="w-full h-40 rounded-xl border border-gray-200 overflow-hidden relative"
                    style={{ backgroundImage: `url(${form.adminBgImage})`, backgroundSize: "cover", backgroundPosition: "center" }}>
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <button onClick={() => bgImgRef.current?.click()}
                        className="px-4 py-2 bg-white/90 rounded-xl text-sm font-semibold text-gray-800">
                        החלף תמונה
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => bgImgRef.current?.click()} disabled={uploadingBg}
                      className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                      style={{ background: "linear-gradient(135deg,#8B6914,#C9A84C)" }}>
                      {uploadingBg ? "מעלה..." : "החלף תמונה"}
                    </button>
                    <button onClick={() => { update("adminBgImage", null); setBgTab("color"); }}
                      className="px-4 py-2 rounded-lg text-sm font-semibold text-red-500 border border-red-200 hover:bg-red-50 transition-colors">
                      הסר תמונה
                    </button>
                  </div>
                </>
              ) : (
                <div
                  className="w-full h-32 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-amber-400 transition-colors bg-gray-50"
                  onClick={() => bgImgRef.current?.click()}
                >
                  {uploadingBg ? (
                    <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>
                    </svg>
                  ) : (
                    <>
                      <span className="text-3xl text-gray-300">🖼️</span>
                      <span className="text-sm text-gray-400">לחץ להעלאת תמונת רקע</span>
                      <span className="text-xs text-gray-300">JPG / PNG / WebP</span>
                    </>
                  )}
                </div>
              )}
              <p className="text-xs text-gray-400">התמונה תכסה את כל הרקע (cover) ותישאר קבועה בגלילה</p>
            </div>
          )}

          {/* Hidden image file input */}
          <input ref={bgImgRef} type="file" accept="image/*" className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) uploadFile(f, "adminBgImage", setUploadingBg);
              e.target.value = "";
            }}
          />
        </Section>

        {/* ── Site name ── */}
        <Section title="שם האתר" icon="✏️">
          <input type="text" value={form.siteName} onChange={e => update("siteName", e.target.value)}
            placeholder="Menu4U"
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <p className="text-xs text-gray-400 mt-1.5">מוצג בסיידבר לצד הלוגו</p>
        </Section>

        {/* ── Logo ── */}
        <Section title="לוגו האתר הראשי" icon="🖼️">
          <div className="flex items-center gap-5">
            <div
              className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center shrink-0 overflow-hidden bg-gray-50 cursor-pointer hover:border-amber-400 transition-colors"
              onClick={() => fileRef.current?.click()} title="לחץ להעלאת לוגו"
            >
              {form.logo
                ? <img src={form.logo} alt="לוגו" className="w-full h-full object-contain" />
                : <span className="text-2xl text-gray-300">🏪</span>}
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-sm text-gray-500">מומלץ: PNG/SVG שקוף, לפחות 200×200px</p>
              <div className="flex gap-2">
                <button onClick={() => fileRef.current?.click()} disabled={uploadingLogo}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60 transition-all"
                  style={{ background: "linear-gradient(135deg,#8B6914,#C9A84C)" }}>
                  {uploadingLogo ? "מעלה..." : "העלה לוגו"}
                </button>
                {form.logo && (
                  <button onClick={() => update("logo", null)}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-red-500 border border-red-200 hover:bg-red-50 transition-colors">
                    הסר
                  </button>
                )}
              </div>
              {form.logo && <p className="text-xs text-gray-400 truncate max-w-[260px]">{form.logo}</p>}
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f, "logo", setUploadingLogo); e.target.value = ""; }}
          />
        </Section>

        {/* ── Domain ── */}
        <Section title="דומיין ראשי" icon="🌐">
          <input type="text" value={form.domain ?? ""} onChange={e => update("domain", e.target.value || null)}
            placeholder="לדוגמא: app.mysite.co.il" dir="ltr"
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <p className="text-xs text-gray-400 mt-1.5">הדומיין הראשי של פלטפורמת Menu4U</p>
        </Section>

        {/* ── Copyright ── */}
        <Section title="כל הזכויות שמורות" icon="©">
          <input type="text" value={form.copyright ?? ""} onChange={e => update("copyright", e.target.value || null)}
            placeholder={`© ${new Date().getFullYear()} Menu4U · כל הזכויות שמורות`}
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
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
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              נשמר בהצלחה!
            </span>
          )}
        </div>

      </div>
    </div>
  );
}
