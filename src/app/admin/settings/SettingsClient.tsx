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

/* ─── Background color presets ───────────────────────────── */
const BG_PRESETS = [
  { id: "#f0ece3", label: "Sand",     dark: false },
  { id: "#f8fafc", label: "White",    dark: false },
  { id: "#f1f5f9", label: "Gray",     dark: false },
  { id: "#1e2130", label: "Navy",     dark: true  },
  { id: "#111827", label: "Charcoal", dark: true  },
];

/* ─── Types ──────────────────────────────────────────────── */
type Config = {
  siteName: string; logo: string | null;
  domain: string | null; copyright: string | null;
  adminPalette: string; adminBg: string; adminBgImage: string | null;
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
  const [uploadingBg,   setUploadingBg]   = useState(false);
  const fileRef    = useRef<HTMLInputElement>(null);
  const bgImgRef   = useRef<HTMLInputElement>(null);
  const colorRef   = useRef<HTMLInputElement>(null);

  function update<K extends keyof Config>(field: K, value: Config[K]) {
    setForm(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  async function uploadFile(file: File, field: "logo" | "adminBgImage", setLoading: (v: boolean) => void) {
    setLoading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res  = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (data.url) update(field, data.url);
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

        {/* ── Background ── */}
        <Section title="רקע פאנל הניהול" icon="🖌️">

          {/* Tab: Color / Image */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-4 w-fit">
            <button
              onClick={() => update("adminBgImage", null)}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
              style={!form.adminBgImage
                ? { background: "white", color: "#1f2937", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }
                : { color: "#6b7280" }}
            >
              🎨 צבע
            </button>
            <button
              onClick={() => bgImgRef.current?.click()}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
              style={form.adminBgImage
                ? { background: "white", color: "#1f2937", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }
                : { color: "#6b7280" }}
            >
              🖼️ תמונה
            </button>
          </div>

          {/* ── Color mode ── */}
          {!form.adminBgImage && (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 mb-3">
                {BG_PRESETS.map(p => {
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

                {/* Custom color picker tile */}
                <button
                  onClick={() => colorRef.current?.click()}
                  title="צבע מותאם אישית"
                  className="relative flex flex-col items-center gap-1.5 rounded-xl p-2 border-2 transition-all overflow-hidden"
                  style={{
                    borderColor: isCustomBg ? "#f59e0b" : "rgba(0,0,0,0.08)",
                    boxShadow: isCustomBg ? "0 0 0 3px rgba(245,158,11,0.3)" : "none",
                    background: isCustomBg ? form.adminBg : "white",
                  }}
                >
                  <div
                    className="w-full h-8 rounded-md"
                    style={{
                      background: "conic-gradient(from 0deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #8b5cf6, #ef4444)",
                      opacity: isCustomBg ? 0.5 : 1,
                    }}
                  />
                  <span className="text-[10px] font-semibold text-gray-600">Custom</span>
                  {isCustomBg && (
                    <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                  )}
                </button>
                <input
                  ref={colorRef}
                  type="color"
                  className="sr-only"
                  value={isCustomBg ? form.adminBg : "#f0ece3"}
                  onChange={e => update("adminBg", e.target.value)}
                />
              </div>

              {/* Current color strip */}
              <div className="flex items-center gap-3 mt-1 p-3 rounded-xl border border-gray-100 bg-gray-50">
                <div className="w-8 h-8 rounded-lg border border-gray-200 shrink-0" style={{ background: form.adminBg }} />
                <span className="text-xs font-mono text-gray-600 uppercase flex-1">{form.adminBg}</span>
                <button
                  onClick={() => colorRef.current?.click()}
                  className="text-xs px-3 py-1.5 rounded-lg font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
                >
                  בחר צבע
                </button>
              </div>
            </>
          )}

          {/* ── Image mode ── */}
          {form.adminBgImage && (
            <div className="space-y-3">
              {/* Preview */}
              <div
                className="w-full h-36 rounded-xl border border-gray-200 overflow-hidden relative bg-gray-100"
                style={{
                  backgroundImage: `url(${form.adminBgImage})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => bgImgRef.current?.click()}
                    className="px-4 py-2 bg-white/90 rounded-xl text-sm font-semibold text-gray-800"
                  >
                    החלף תמונה
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => bgImgRef.current?.click()}
                  disabled={uploadingBg}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg,#8B6914,#C9A84C)" }}
                >
                  {uploadingBg ? "מעלה..." : "החלף תמונה"}
                </button>
                <button
                  onClick={() => update("adminBgImage", null)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-red-500 border border-red-200 hover:bg-red-50 transition-colors"
                >
                  הסר תמונה
                </button>
              </div>
              <p className="text-xs text-gray-400">התמונה תכסה את כל הרקע בגודל מלא (cover)</p>
            </div>
          )}

          {/* Hidden bg image file input */}
          <input
            ref={bgImgRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) uploadFile(f, "adminBgImage", setUploadingBg);
              e.target.value = "";
            }}
          />

          {/* Upload spinner overlay */}
          {uploadingBg && (
            <div className="flex items-center gap-2 mt-2 text-sm text-amber-700">
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>
              </svg>
              מעלה תמונה...
            </div>
          )}
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
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f, "logo", setUploadingLogo); e.target.value = ""; }}
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
