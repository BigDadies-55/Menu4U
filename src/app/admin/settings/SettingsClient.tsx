"use client";

import { useState, useRef } from "react";

/* ─── Theme definitions ─────────────────────────────────────── */
const THEMES = [
  { id: "luxury", label: "Luxury",  icon: "✦", accent: "#c9a35d", bg: "#0a0a0a", desc: "זהב ושחור אלגנטי" },
  { id: "fresh",  label: "Fresh",   icon: "⚙", accent: "#f59e0b", bg: "#1a1a1a", desc: "תעשייתי מודרני" },
  { id: "nature", label: "Nature",  icon: "❧", accent: "#4ade80", bg: "#030f06", desc: "ירוק ורענן" },
  { id: "bold",   label: "Bold",    icon: "▲", accent: "#f472b6", bg: "#0f0512", desc: "סגול ורוד תוסס" },
] as const;

/* ─── Types ─────────────────────────────────────────────────── */
type Restaurant = {
  id: string; name: string; logo: string | null;
  menuTheme: string; menuPalette: string;
  customDomain: string | null; copyright: string | null;
};

/* ─── Section card ───────────────────────────────────────────── */
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

/* ─── Main ───────────────────────────────────────────────────── */
export default function SettingsClient({
  restaurants,
  isSuperAdmin,
}: {
  restaurants: Restaurant[];
  isSuperAdmin: boolean;
}) {
  const [selectedId, setSelectedId] = useState(restaurants[0].id);
  const [form, setForm]             = useState<Record<string, Restaurant>>(() =>
    Object.fromEntries(restaurants.map(r => [r.id, { ...r }]))
  );
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [uploadingLogo,setUploadingLogo]= useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const current = form[selectedId];

  function update(field: keyof Restaurant, value: string | null) {
    setForm(prev => ({ ...prev, [selectedId]: { ...prev[selectedId], [field]: value } }));
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
    const res = await fetch(`/api/admin/restaurants/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        menuTheme:    current.menuTheme,
        logo:         current.logo,
        customDomain: current.customDomain,
        copyright:    current.copyright,
      }),
    });
    setSaving(false);
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">

      {/* Restaurant selector */}
      {(isSuperAdmin || restaurants.length > 1) && (
        <div className="flex flex-wrap gap-2 mb-6">
          {restaurants.map(r => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold border transition-all"
              style={selectedId === r.id
                ? { background: "linear-gradient(135deg,#8B6914,#C9A84C)", color: "#fff", borderColor: "transparent" }
                : { background: "#fff", color: "#6b7280", borderColor: "#e5e7eb" }}
            >
              {r.name}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-5">

        {/* ── Theme ── */}
        <Section title="ערכת נושא לתפריט" icon="🎨">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {THEMES.map(t => {
              const active = current.menuTheme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => update("menuTheme", t.id)}
                  className="relative rounded-xl overflow-hidden transition-all"
                  style={{
                    background: t.bg,
                    border: `2px solid ${active ? t.accent : "transparent"}`,
                    boxShadow: active ? `0 0 0 3px ${t.accent}33` : "none",
                  }}
                >
                  {/* Preview */}
                  <div className="h-20 flex flex-col items-center justify-center gap-1">
                    <span className="text-2xl" style={{ color: t.accent }}>{t.icon}</span>
                    <div className="w-8 h-0.5 rounded-full" style={{ background: t.accent }} />
                    <div className="w-5 h-0.5 rounded-full opacity-50" style={{ background: t.accent }} />
                  </div>
                  <div className="px-2 py-2 text-center" style={{ borderTop: `1px solid ${t.accent}22` }}>
                    <div className="text-xs font-bold" style={{ color: t.accent }}>{t.label}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{t.desc}</div>
                  </div>
                  {active && (
                    <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: t.accent }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </Section>

        {/* ── Logo ── */}
        <Section title="לוגו האתר" icon="🖼️">
          <div className="flex items-center gap-5">
            {/* Preview */}
            <div
              className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center shrink-0 overflow-hidden bg-gray-50 cursor-pointer hover:border-amber-400 transition-colors"
              onClick={() => fileRef.current?.click()}
              title="לחץ להעלאת לוגו"
            >
              {current.logo ? (
                <img src={current.logo} alt="לוגו" className="w-full h-full object-contain" />
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
                {current.logo && (
                  <button
                    onClick={() => update("logo", null)}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-red-500 border border-red-200 hover:bg-red-50 transition-colors"
                  >
                    הסר
                  </button>
                )}
              </div>
              {current.logo && (
                <p className="text-xs text-gray-400 truncate max-w-[260px]">{current.logo}</p>
              )}
            </div>
          </div>
          <input
            ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ""; }}
          />
        </Section>

        {/* ── Domain ── */}
        <Section title="דומיין ראשי" icon="🌐">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              כתובת דומיין מותאם אישית
            </label>
            <input
              type="text"
              value={current.customDomain ?? ""}
              onChange={e => update("customDomain", e.target.value || null)}
              placeholder="לדוגמא: menu.myrestaurant.co.il"
              dir="ltr"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <p className="text-xs text-gray-400 mt-1.5">
              השאר ריק לשימוש בכתובת הברירת מחדל של Menu4U
            </p>
          </div>
        </Section>

        {/* ── Copyright ── */}
        <Section title="כל הזכויות שמורות" icon="©">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              טקסט כותרת תחתית
            </label>
            <input
              type="text"
              value={current.copyright ?? ""}
              onChange={e => update("copyright", e.target.value || null)}
              placeholder={`© ${new Date().getFullYear()} ${current.name} · כל הזכויות שמורות`}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <p className="text-xs text-gray-400 mt-1.5">
              יוצג בתחתית עמוד התפריט של הלקוחות
            </p>
          </div>
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
