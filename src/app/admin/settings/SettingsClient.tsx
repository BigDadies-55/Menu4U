"use client";

import { useState, useRef } from "react";

/* ─── Admin sidebar palette options ─────────────────────── */
const PALETTES = [
  { id: "dark",   label: "Dark",   bg: "#0f111a", accent: "#f59e0b", preview: "linear-gradient(135deg,#0f111a,#1a1c27)", desc: "ברירת מחדל — כהה עם זהב" },
  { id: "purple", label: "Purple", bg: "#130c1e", accent: "#7c3aed", preview: "linear-gradient(135deg,#130c1e,#1e1032)", desc: "סגול כהה" },
  { id: "blue",   label: "Blue",   bg: "#080f1e", accent: "#2563eb", preview: "linear-gradient(135deg,#080f1e,#0d1a35)", desc: "כחול כהה" },
  { id: "green",  label: "Green",  bg: "#071510", accent: "#16a34a", preview: "linear-gradient(135deg,#071510,#0d2218)", desc: "ירוק כהה" },
  { id: "rose",   label: "Rose",   bg: "#150a0e", accent: "#e11d48", preview: "linear-gradient(135deg,#150a0e,#220c13)", desc: "אדום כהה" },
] as const;

/* ─── Background presets ─────────────────────────────────── */
const BG_PRESETS = [
  { id: "#f0ece3", label: "Sand",    desc: "חם — ברירת מחדל" },
  { id: "#f8fafc", label: "White",   desc: "בהיר קריר" },
  { id: "#f1f5f9", label: "Gray",    desc: "אפור בהיר" },
  { id: "#1e2130", label: "Navy",    desc: "כחול כהה" },
  { id: "#111827", label: "Charcoal",desc: "אפור כהה" },
];

/* ─── Types ──────────────────────────────────────────────── */
type Config = {
  siteName: string; logo: string | null;
  domain: string | null; copyright: string | null;
  adminPalette: string; adminBg: string;
};

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
  const fileRef    = useRef<HTMLInputElement>(null);
  const colorRef   = useRef<HTMLInputElement>(null);

  function update<K extends keyof Config>(field: K, value: Config[K]) {
    setForm(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  async function uploadLogo(file: File) {
    setUploadingLogo(true);
    const fd = new FormData();
    fd.append("file", file);
    const res  = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (data.url) update("logo", data.url);
    setUploadingLogo(false);
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

  /* Is the current bg a custom color (not one of the presets)? */
  const isCustomBg = !BG_PRESETS.some(p => p.id === form.adminBg);

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="space-y-5">

        {/* ── Sidebar palette ── */}
        <Section title="פלטת צבעים לסיידבר" icon="🎨">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {PALETTES.map(p => {
              const active = form.adminPalette === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => update("adminPalette", p.id)}
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
                    <div className="absolute top-1.5 left-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background: p.accent }}>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-3">הצבע ישתנה בסיידבר לאחר שמירה ורענון הדף</p>
        </Section>

        {/* ── Background color ── */}
        <Section title="צבע רקע הפאנל" icon="🖌️">
          {/* 5 presets */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 mb-3">
            {BG_PRESETS.map(p => {
              const active = form.adminBg === p.id;
              const isDark = p.id.startsWith("#1") || p.id.startsWith("#0");
              return (
                <button
                  key={p.id}
                  onClick={() => update("adminBg", p.id)}
                  title={`${p.label} — ${p.desc}`}
                  className="relative flex flex-col items-center gap-1.5 rounded-xl p-2.5 border-2 transition-all"
                  style={{
                    background: p.id,
                    borderColor: active ? "#f59e0b" : "rgba(0,0,0,0.08)",
                    boxShadow: active ? "0 0 0 3px rgba(245,158,11,0.25)" : "none",
                  }}
                >
                  {/* Color swatch fill */}
                  <div className="w-full h-7 rounded-md" style={{ background: p.id, border: "1px solid rgba(0,0,0,0.06)" }} />
                  <span className="text-[10px] font-semibold leading-tight" style={{ color: isDark ? "#e5e7eb" : "#374151" }}>
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

            {/* Custom color button */}
            <button
              onClick={() => colorRef.current?.click()}
              title="בחר צבע מותאם אישית"
              className="relative flex flex-col items-center gap-1.5 rounded-xl p-2.5 border-2 transition-all"
              style={{
                borderColor: isCustomBg ? "#f59e0b" : "rgba(0,0,0,0.08)",
                boxShadow: isCustomBg ? "0 0 0 3px rgba(245,158,11,0.25)" : "none",
                background: isCustomBg ? form.adminBg : "white",
              }}
            >
              <div
                className="w-full h-7 rounded-md flex items-center justify-center"
                style={{
                  background: isCustomBg
                    ? `conic-gradient(from 0deg, #f59e0b, #ec4899, #3b82f6, #10b981, #f59e0b)`
                    : `conic-gradient(from 0deg, #f59e0b, #ec4899, #3b82f6, #10b981, #f59e0b)`,
                  opacity: isCustomBg ? 0.6 : 1,
                }}
              />
              <span className="text-[10px] font-semibold text-gray-600 leading-tight">Custom</span>
              {isCustomBg && (
                <div className="absolute top-1.5 left-1.5 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
              )}
            </button>
            {/* Hidden native color picker */}
            <input
              ref={colorRef}
              type="color"
              className="sr-only"
              value={isCustomBg ? form.adminBg : "#f0ece3"}
              onChange={e => update("adminBg", e.target.value)}
            />
          </div>

          {/* Current color preview */}
          <div className="flex items-center gap-3 mt-2">
            <div className="w-8 h-8 rounded-lg border border-gray-200 shrink-0" style={{ background: form.adminBg }} />
            <span className="text-xs font-mono text-gray-500 uppercase">{form.adminBg}</span>
            <button
              onClick={() => colorRef.current?.click()}
              className="text-xs text-amber-700 underline hover:no-underline"
            >
              שנה צבע
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">רקע אזור התוכן הראשי של פאנל הניהול</p>
        </Section>

        {/* ── Site name ── */}
        <Section title="שם האתר" icon="✏️">
          <input
            type="text"
            value={form.siteName}
            onChange={e => update("siteName", e.target.value)}
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
              onClick={() => fileRef.current?.click()}
              title="לחץ להעלאת לוגו"
            >
              {form.logo ? (
                <img src={form.logo} alt="לוגו" className="w-full h-full object-contain" />
              ) : (
                <span className="text-2xl text-gray-300">🏪</span>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-sm text-gray-500">מומלץ: PNG/SVG שקוף, לפחות 200×200px</p>
              <div className="flex gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingLogo}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60 transition-all"
                  style={{ background: "linear-gradient(135deg,#8B6914,#C9A84C)" }}
                >
                  {uploadingLogo ? "מעלה..." : "העלה לוגו"}
                </button>
                {form.logo && (
                  <button
                    onClick={() => update("logo", null)}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-red-500 border border-red-200 hover:bg-red-50 transition-colors"
                  >
                    הסר
                  </button>
                )}
              </div>
              {form.logo && <p className="text-xs text-gray-400 truncate max-w-[260px]">{form.logo}</p>}
            </div>
          </div>
          <input
            ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ""; }}
          />
        </Section>

        {/* ── Domain ── */}
        <Section title="דומיין ראשי" icon="🌐">
          <input
            type="text"
            value={form.domain ?? ""}
            onChange={e => update("domain", e.target.value || null)}
            placeholder="לדוגמא: app.mysite.co.il"
            dir="ltr"
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <p className="text-xs text-gray-400 mt-1.5">הדומיין הראשי של פלטפורמת Menu4U</p>
        </Section>

        {/* ── Copyright ── */}
        <Section title="כל הזכויות שמורות" icon="©">
          <input
            type="text"
            value={form.copyright ?? ""}
            onChange={e => update("copyright", e.target.value || null)}
            placeholder={`© ${new Date().getFullYear()} Menu4U · כל הזכויות שמורות`}
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <p className="text-xs text-gray-400 mt-1.5">טקסט ברירת מחדל לכותרת תחתונה</p>
        </Section>

        {/* ── Save ── */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={save}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60 transition-all"
            style={{ background: "linear-gradient(135deg,#8B6914,#C9A84C)" }}
          >
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
