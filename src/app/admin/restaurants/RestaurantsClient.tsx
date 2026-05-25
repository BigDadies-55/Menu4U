"use client";

import { useState, useEffect } from "react";
import { formatDate, cn } from "@/lib/utils";
import ImageUpload from "@/components/admin/ImageUpload";
import { MENU_PALETTES } from "@/lib/menuPalettes";

type Restaurant = {
  id: string;
  name: string;
  description: string | null;
  logo: string | null;
  email: string | null;
  phone: string | null;
  phone2: string | null;
  orderPhone: string | null;
  address: string | null;
  website: string | null;
  locationUrl: string | null;
  isActive: boolean;
  menuTheme: string;
  menuPalette: string;
  menuPaletteData: string | null;
  ordersEnabled: boolean;
  kdsView: string;
  language: string;
  welcomeText: string | null;
  subscriptionFrom: string | null;
  subscriptionTo: string | null;
  createdAt: string;
  _count: { menus: number; orders: number; restaurantUsers: number };
};

const THEMES = [
  { value: 'elegant', label: 'Elegant',    labelHe: 'אלגנט',      icon: '✦', previewBg: '#0D0D0D', previewAccent: '#C5A880' },
  { value: 'luxury',  label: 'Luxury',     labelHe: 'יוקרה',      icon: '◈', previewBg: '#0a0a0a', previewAccent: '#c9a35d' },
  { value: 'fresh',   label: 'Industrial', labelHe: 'אינדסטריאל', icon: '⚙', previewBg: '#1a1a1a', previewAccent: '#f59e0b' },
  { value: 'nature',  label: 'Nature',     labelHe: 'טבע',        icon: '❧', previewBg: '#030f06', previewAccent: '#4ade80' },
  { value: 'bold',    label: 'Bold',       labelHe: 'נועז',       icon: '▲', previewBg: '#0f0512', previewAccent: '#f472b6' },
];

const TABS = [
  { id: "general",      label: "כללי",     icon: "🏠" },
  { id: "menu",         label: "תפריט",    icon: "📋" },
  { id: "orders",       label: "הזמנות",   icon: "🛒" },
  { id: "subscription", label: "מנוי",     icon: "📅" },
] as const;
type TabId = typeof TABS[number]["id"];

const emptyForm = {
  name: "", description: "", logo: "", email: "", phone: "",
  phone2: "", orderPhone: "", address: "", website: "", locationUrl: "",
  menuTheme: "elegant", subscriptionFrom: "", subscriptionTo: "",
  menuPalette: "0",
  menuCustomAc: "#c9a35d",
  menuCustomBg: "#0a0a0a",
  ordersEnabled: false,
  kdsView: "STATION_DARK",
  language: "he",
  welcomeText: "",
};

/* ── Solid primary button style ── */
const BTN_PRIMARY = {
  background: "#c9a84c",
  color: "#000",
  boxShadow: "0 2px 8px rgba(201,168,76,0.35)",
} as const;

function toDateInput(val: string | null | undefined): string {
  if (!val) return "";
  return new Date(val).toISOString().slice(0, 10);
}

function getSubscriptionStatus(r: Restaurant): { label: string; cls: string } {
  const now = new Date();
  if (!r.subscriptionFrom && !r.subscriptionTo) return { label: "ללא מנוי", cls: "bg-gray-100 text-gray-500" };
  if (r.subscriptionFrom && now < new Date(r.subscriptionFrom)) return { label: "טרם התחיל", cls: "bg-blue-100 text-blue-600" };
  if (r.subscriptionTo && now > new Date(r.subscriptionTo)) return { label: "פג תוקף", cls: "bg-red-100 text-red-600" };
  if (r.subscriptionTo) {
    const daysLeft = Math.ceil((new Date(r.subscriptionTo).getTime() - now.getTime()) / 86400000);
    if (daysLeft <= 7) return { label: `${daysLeft} ימים נותרו`, cls: "bg-orange-100 text-orange-600" };
    return { label: `פעיל עד ${new Date(r.subscriptionTo).toLocaleDateString("he-IL")}`, cls: "bg-green-100 text-green-700" };
  }
  return { label: "פעיל", cls: "bg-green-100 text-green-700" };
}

export default function RestaurantsClient({ restaurants: initial }: { restaurants: Restaurant[] }) {
  const [restaurants, setRestaurants] = useState(initial);
  const [showForm,    setShowForm]    = useState(false);
  const [editTarget,  setEditTarget]  = useState<Restaurant | null>(null);
  const [form,        setForm]        = useState(emptyForm);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeTab,   setActiveTab]   = useState<TabId>("general");
  // Custom delete confirmation: stores the restaurant to delete
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deleteInput,   setDeleteInput]   = useState("");

  /* ── Escape key closes any open overlay ── */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (previewOpen) { setPreviewOpen(false); return; }
      if (deleteConfirm) { setDeleteConfirm(null); setDeleteInput(""); return; }
      if (showForm) { setShowForm(false); return; }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showForm, previewOpen, deleteConfirm]);

  function buildPreviewUrl(restaurantId: string): string {
    const params = new URLSearchParams({ previewTheme: form.menuTheme });
    params.set("previewPalette", form.menuPalette);
    if (form.menuPalette === "custom") {
      params.set("previewAc", form.menuCustomAc);
      params.set("previewBg", form.menuCustomBg);
    }
    return `/menu/${restaurantId}?${params.toString()}`;
  }

  function openCreate() {
    setEditTarget(null);
    setForm(emptyForm);
    setActiveTab("general");
    setShowForm(true);
  }

  function openEdit(r: Restaurant) {
    setEditTarget(r);
    setForm({
      name: r.name, description: r.description ?? "", logo: r.logo ?? "",
      email: r.email ?? "", phone: r.phone ?? "", phone2: r.phone2 ?? "",
      orderPhone: r.orderPhone ?? "", address: r.address ?? "",
      website: r.website ?? "", locationUrl: r.locationUrl ?? "",
      menuTheme: r.menuTheme ?? "elegant",
      subscriptionFrom: toDateInput(r.subscriptionFrom),
      subscriptionTo: toDateInput(r.subscriptionTo),
      menuPalette: r.menuPalette ?? "0",
      menuCustomAc: (() => { try { return JSON.parse(r.menuPaletteData ?? "{}").ac ?? "#c9a35d"; } catch { return "#c9a35d"; } })(),
      menuCustomBg: (() => { try { return JSON.parse(r.menuPaletteData ?? "{}").bg ?? "#0a0a0a"; } catch { return "#0a0a0a"; } })(),
      ordersEnabled: r.ordersEnabled ?? false,
      kdsView: r.kdsView ?? "STATION_DARK",
      language: r.language ?? "he",
      welcomeText: r.welcomeText ?? "",
    });
    setActiveTab("general");
    setShowForm(true);
  }

  function setTrial() {
    const from = new Date();
    const to = new Date(from);
    to.setDate(to.getDate() + 30);
    setForm(f => ({
      ...f,
      subscriptionFrom: from.toISOString().slice(0, 10),
      subscriptionTo: to.toISOString().slice(0, 10),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const body = {
      name: form.name,
      description: form.description || null,
      logo: form.logo || null,
      email: form.email || null,
      phone: form.phone || null,
      phone2: form.phone2 || null,
      orderPhone: form.orderPhone || null,
      address: form.address || null,
      website: form.website || null,
      locationUrl: form.locationUrl || null,
      menuTheme: form.menuTheme,
      menuPalette: form.menuPalette,
      menuPaletteData: form.menuPalette === "custom" ? JSON.stringify({ ac: form.menuCustomAc, bg: form.menuCustomBg }) : null,
      subscriptionFrom: form.subscriptionFrom ? new Date(form.subscriptionFrom).toISOString() : null,
      subscriptionTo: form.subscriptionTo ? new Date(form.subscriptionTo).toISOString() : null,
      ordersEnabled: form.ordersEnabled,
      kdsView: form.kdsView,
      language: form.language,
      welcomeText: form.welcomeText || null,
    };

    if (editTarget) {
      const res = await fetch(`/api/admin/restaurants/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated = await res.json();
        setRestaurants(restaurants.map(r => r.id === editTarget.id ? { ...r, ...updated } : r));
      }
    } else {
      const res = await fetch("/api/admin/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { setError("שגיאה ביצירת המסעדה"); setLoading(false); return; }
      const created = await res.json();
      setRestaurants([{ ...created, _count: { menus: 0, orders: 0, restaurantUsers: 0 } }, ...restaurants]);
    }

    setShowForm(false);
    setLoading(false);
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch(`/api/admin/restaurants/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    setRestaurants(restaurants.map(r => r.id === id ? { ...r, isActive: !isActive } : r));
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    await fetch(`/api/admin/restaurants/${deleteConfirm.id}`, { method: "DELETE" });
    setRestaurants(restaurants.filter(r => r.id !== deleteConfirm.id));
    setDeleteConfirm(null);
    setDeleteInput("");
  }

  const field = (label: string, key: keyof typeof form, opts?: { type?: string; dir?: string; placeholder?: string }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={opts?.type ?? "text"}
        value={form[key] as string}
        onChange={e => setForm({ ...form, [key]: e.target.value })}
        dir={opts?.dir}
        placeholder={opts?.placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
      />
    </div>
  );

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ניהול מסעדות</h1>
          <p className="text-gray-500 mt-1">{restaurants.length} מסעדות במערכת</p>
        </div>
        <button onClick={openCreate}
          className="text-black px-5 py-2.5 rounded-lg font-semibold text-sm transition-opacity hover:opacity-80"
          style={BTN_PRIMARY}>
          + הוסף מסעדה
        </button>
      </div>

      {/* ── Form modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
          <div className="flex min-h-full items-start justify-center p-4 py-6">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl">

              {/* Modal header */}
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">
                  {editTarget ? `עריכת מסעדה — ${editTarget.name}` : "מסעדה חדשה"}
                </h2>
                <button onClick={() => setShowForm(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 text-lg">
                  ✕
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-100 px-4">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                      activeTab === tab.id
                        ? "border-amber-500 text-amber-700"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    )}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit}>
                <div className="px-6 py-5 space-y-4">

                  {/* ── Tab: כללי ── */}
                  {activeTab === "general" && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {field("שם המסעדה *", "name")}
                        {field("כתובת", "address")}
                      </div>
                      <ImageUpload
                        label="לוגו מסעדה"
                        value={form.logo}
                        onChange={url => setForm({ ...form, logo: url })}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {field("אימייל", "email", { type: "email", dir: "ltr" })}
                        {field("אתר אינטרנט", "website", { dir: "ltr", placeholder: "https://..." })}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {field("טלפון ראשי", "phone", { dir: "ltr" })}
                        {field("טלפון נוסף", "phone2", { dir: "ltr" })}
                        {field("טלפון הזמנות", "orderPhone", { dir: "ltr" })}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          📍 לינק מיקום (Google Maps)
                        </label>
                        <input
                          type="url"
                          value={form.locationUrl}
                          onChange={e => setForm({ ...form, locationUrl: e.target.value })}
                          placeholder="https://maps.google.com/..."
                          dir="ltr"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">תיאור</label>
                        <textarea
                          value={form.description}
                          onChange={e => setForm({ ...form, description: e.target.value })}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                        />
                      </div>
                    </>
                  )}

                  {/* ── Tab: תפריט ── */}
                  {activeTab === "menu" && (
                    <>
                      {/* Theme selector */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">עיצוב תפריט</label>
                        <div className="grid grid-cols-5 gap-2 mb-3">
                          {THEMES.map(t => {
                            const isActive = form.menuTheme === t.value;
                            return (
                              <button key={t.value} type="button"
                                onClick={() => setForm(f => ({ ...f, menuTheme: t.value, menuPalette: "0" }))}
                                className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all"
                                style={{
                                  background: t.previewBg,
                                  borderColor: isActive ? t.previewAccent : "transparent",
                                  boxShadow: isActive ? `0 0 0 2px ${t.previewAccent}44` : "none",
                                }}
                              >
                                <div className="w-full h-6 rounded-md" style={{ background: t.previewAccent, opacity: 0.85 }} />
                                <span className="text-xs font-semibold" style={{ color: t.previewAccent }}>{t.icon} {t.labelHe}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Palette row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-gray-400 font-medium pl-1">פלטה:</span>
                          {(MENU_PALETTES[form.menuTheme] ?? []).map((p, i) => {
                            const pid = String(i);
                            const isActive = form.menuPalette === pid;
                            return (
                              <button key={pid} type="button" title={p.name}
                                onClick={() => setForm(f => ({ ...f, menuPalette: pid }))}
                                className="w-7 h-7 rounded-full border-2 transition-all hover:scale-110"
                                style={{
                                  background: p.color,
                                  borderColor: isActive ? "#fff" : "transparent",
                                  boxShadow: isActive ? `0 0 0 2px ${p.color}` : "none",
                                }}
                              />
                            );
                          })}
                          <button type="button"
                            onClick={() => setForm(f => ({ ...f, menuPalette: "custom" }))}
                            className={cn(
                              "flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-medium transition-all",
                              form.menuPalette === "custom"
                                ? "border-amber-400 bg-amber-50 text-amber-700"
                                : "border-gray-200 text-gray-500 hover:border-gray-400"
                            )}>
                            🎨 מותאם
                          </button>
                        </div>

                        {form.menuPalette === "custom" && (
                          <div className="mt-3 flex gap-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-gray-500 font-medium whitespace-nowrap">צבע ראשי</label>
                              <input type="color" value={form.menuCustomAc}
                                onChange={e => setForm(f => ({ ...f, menuCustomAc: e.target.value }))}
                                className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0.5"
                              />
                              <span className="text-xs text-gray-400 font-mono">{form.menuCustomAc}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-gray-500 font-medium whitespace-nowrap">רקע</label>
                              <input type="color" value={form.menuCustomBg}
                                onChange={e => setForm(f => ({ ...f, menuCustomBg: e.target.value }))}
                                className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0.5"
                              />
                              <span className="text-xs text-gray-400 font-mono">{form.menuCustomBg}</span>
                            </div>
                          </div>
                        )}

                        {editTarget && (
                          <button type="button" onClick={() => setPreviewOpen(true)}
                            className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 hover:border-amber-400 hover:text-amber-600 text-sm font-medium transition-all">
                            👁 תצוגה מקדימה של התפריט
                          </button>
                        )}
                      </div>

                      {/* Language */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">🌐 שפת תפריט ציבורי</label>
                        <select value={form.language}
                          onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm">
                          <option value="he">עברית (he)</option>
                          <option value="en">English (en)</option>
                          <option value="ru">Русский (ru)</option>
                          <option value="fr">Français (fr)</option>
                        </select>
                      </div>

                      {/* Welcome text */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">💬 טקסט ברוכים הבאים</label>
                        <p className="text-xs text-gray-400 mb-2">יוצג בתפריט הציבורי מתחת לשם המסעדה</p>
                        <textarea value={form.welcomeText}
                          onChange={e => setForm(f => ({ ...f, welcomeText: e.target.value }))}
                          rows={4}
                          placeholder="ברוכים הבאים אלינו..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm resize-y"
                          dir="auto"
                        />
                      </div>
                    </>
                  )}

                  {/* ── Tab: הזמנות ── */}
                  {activeTab === "orders" && (
                    <>
                      {/* Orders toggle */}
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <div>
                          <div className="font-semibold text-gray-800 text-sm">הזמנות מהתפריט</div>
                          <div className="text-xs text-gray-500 mt-0.5">לקוחות יוכלו להזמין ישירות מהתפריט</div>
                        </div>
                        <button type="button"
                          onClick={() => setForm(f => ({ ...f, ordersEnabled: !f.ordersEnabled }))}
                          className={cn(
                            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                            form.ordersEnabled ? "bg-amber-500" : "bg-gray-300"
                          )}>
                          <span className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                            form.ordersEnabled ? "translate-x-1" : "translate-x-6"
                          )} />
                        </button>
                      </div>

                      {/* KDS View */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">תצוגת מטבח מועדפת (KDS)</label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { value: "DASHBOARD",    label: "תצוגת שולחן", icon: "📺", desc: "קלאסי, לפי שולחן" },
                            { value: "STATION_DARK", label: "Station Dark", icon: "🍳", desc: "מודרני, כהה" },
                            { value: "KANBAN",       label: "Kanban",       icon: "📋", desc: "לפי סטטוס" },
                            { value: "TICKETS",      label: "Ticket Board", icon: "🎫", desc: "כרטיסיות קלאסי" },
                          ].map(opt => {
                            const isActive = form.kdsView === opt.value;
                            return (
                              <button key={opt.value} type="button"
                                onClick={() => setForm(f => ({ ...f, kdsView: opt.value }))}
                                className={cn(
                                  "flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all",
                                  isActive
                                    ? "border-amber-500 bg-amber-50"
                                    : "border-gray-200 hover:border-amber-300 hover:bg-amber-50/50"
                                )}>
                                <span className="text-xl mb-1">{opt.icon}</span>
                                <span className={cn("text-sm font-semibold", isActive ? "text-amber-800" : "text-gray-700")}>{opt.label}</span>
                                <span className="text-xs text-gray-400 mt-0.5">{opt.desc}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}

                  {/* ── Tab: מנוי ── */}
                  {activeTab === "subscription" && (
                    <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold text-gray-700">📅 תוקף מנוי</label>
                        <button type="button" onClick={setTrial}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg border-2 border-amber-400 text-amber-700 hover:bg-amber-50 transition-colors">
                          🎁 30 ימים ניסיון
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">מתאריך</label>
                          <input type="date" value={form.subscriptionFrom}
                            onChange={e => setForm({ ...form, subscriptionFrom: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">עד תאריך</label>
                          <input type="date" value={form.subscriptionTo}
                            onChange={e => setForm({ ...form, subscriptionTo: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                          />
                        </div>
                      </div>
                      {(form.subscriptionFrom || form.subscriptionTo) && (
                        <button type="button"
                          onClick={() => setForm({ ...form, subscriptionFrom: "", subscriptionTo: "" })}
                          className="text-xs text-gray-400 hover:text-red-500 underline">
                          הסר תאריכים (ללא הגבלת תוקף)
                        </button>
                      )}
                    </div>
                  )}

                </div>

                {/* Form footer */}
                <div className="px-6 pb-5 flex gap-3">
                  {error && <p className="text-red-600 text-sm flex-1">{error}</p>}
                  <button type="submit" disabled={loading}
                    className="flex-1 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50 transition-opacity hover:opacity-80"
                    style={BTN_PRIMARY}>
                    {loading ? "שומר..." : editTarget ? "שמור שינויים" : "צור מסעדה"}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium text-sm">
                    ביטול
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">🗑️</div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-1">מחיקת מסעדה</h3>
            <p className="text-sm text-gray-500 text-center mb-4">
              פעולה זו תמחק לצמיתות את <strong>{deleteConfirm.name}</strong> עם כל התפריטים, הפריטים וההזמנות שלה.
            </p>
            <p className="text-xs font-semibold text-gray-600 mb-2">
              כדי לאשר, הקלד את שם המסעדה:
            </p>
            <input
              type="text"
              value={deleteInput}
              onChange={e => setDeleteInput(e.target.value)}
              placeholder={deleteConfirm.name}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 mb-4"
              autoFocus
              onKeyDown={e => { if (e.key === "Enter" && deleteInput === deleteConfirm.name) confirmDelete(); }}
            />
            <div className="flex gap-3">
              <button
                onClick={confirmDelete}
                disabled={deleteInput !== deleteConfirm.name}
                className="flex-1 py-2.5 rounded-lg font-semibold text-sm text-white bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                מחק לצמיתות
              </button>
              <button
                onClick={() => { setDeleteConfirm(null); setDeleteInput(""); }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium text-sm">
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Preview modal ── */}
      {previewOpen && editTarget && (
        <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: "#0a0a0a" }}>
          <div className="flex items-center justify-between px-4 py-2 shrink-0" style={{ background: "#111", borderBottom: "1px solid #222" }}>
            <span className="text-white font-semibold text-sm">{editTarget.name} — תצוגה מקדימה</span>
            <div className="flex items-center gap-2">
              <a href={buildPreviewUrl(editTarget.id)} target="_blank" rel="noopener noreferrer"
                className="text-xs px-3 py-1 rounded-full font-medium"
                style={{ background: "#222", color: "#c9a35d", border: "1px solid #333" }}>
                פתח בטאב ↗
              </a>
              <button onClick={() => setPreviewOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-white"
                style={{ background: "#222" }}>✕</button>
            </div>
          </div>
          <div className="shrink-0 px-4 py-2.5 flex flex-wrap items-center gap-3" style={{ background: "#161616", borderBottom: "1px solid #252525" }}>
            <div className="flex items-center gap-1">
              {THEMES.map(t => {
                const active = form.menuTheme === t.value;
                return (
                  <button key={t.value} type="button"
                    onClick={() => setForm(f => ({ ...f, menuTheme: t.value, menuPalette: "0" }))}
                    className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                    style={active
                      ? { background: t.previewAccent, color: "#000" }
                      : { background: "#222", color: "#777", border: "1px solid #2a2a2a" }}>
                    {t.icon} {t.labelHe}
                  </button>
                );
              })}
            </div>
            <div style={{ width: 1, height: 20, background: "#2a2a2a", flexShrink: 0 }} />
            <div className="flex items-center gap-2">
              {(MENU_PALETTES[form.menuTheme] ?? []).map((p, i) => {
                const pid = String(i);
                const active = form.menuPalette === pid;
                return (
                  <button key={pid} type="button" title={p.name}
                    onClick={() => setForm(f => ({ ...f, menuPalette: pid }))}
                    className="transition-all hover:scale-110"
                    style={{ width: 22, height: 22, borderRadius: "50%", background: p.color,
                      border: active ? "2px solid #fff" : "2px solid transparent",
                      boxShadow: active ? `0 0 0 2px ${p.color}` : "none" }} />
                );
              })}
              <button type="button"
                onClick={() => setForm(f => ({ ...f, menuPalette: "custom" }))}
                className="text-xs px-2 py-0.5 rounded font-medium transition-all"
                style={form.menuPalette === "custom"
                  ? { background: "#2a2010", color: "#f59e0b", border: "1px solid #f59e0b" }
                  : { background: "#1e1e1e", color: "#666", border: "1px solid #2a2a2a" }}>
                🎨
              </button>
            </div>
            {form.menuPalette === "custom" && (
              <div className="flex items-center gap-3 px-3 py-1 rounded-lg" style={{ background: "#1e1e1e", border: "1px solid #2a2a2a" }}>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs" style={{ color: "#888" }}>צבע:</span>
                  <input type="color" value={form.menuCustomAc}
                    onChange={e => setForm(f => ({ ...f, menuCustomAc: e.target.value }))}
                    className="w-6 h-6 rounded cursor-pointer border-0 p-0" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs" style={{ color: "#888" }}>רקע:</span>
                  <input type="color" value={form.menuCustomBg}
                    onChange={e => setForm(f => ({ ...f, menuCustomBg: e.target.value }))}
                    className="w-6 h-6 rounded cursor-pointer border-0 p-0" />
                </div>
              </div>
            )}
          </div>
          <iframe key={buildPreviewUrl(editTarget.id)} src={buildPreviewUrl(editTarget.id)} className="flex-1 w-full" style={{ border: "none" }} />
        </div>
      )}

      {/* ── Restaurants table ── */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ border: "1px solid #e8ecf1" }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-right">
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">מסעדה</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">פרטי קשר</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">סטטיסטיקות</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">נוצר</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">סטטוס</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">מנוי</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {restaurants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="text-4xl mb-3">🍽️</div>
                    <div className="text-gray-500 font-medium mb-1">אין מסעדות עדיין</div>
                    <div className="text-gray-400 text-sm mb-4">לחץ על "הוסף מסעדה" כדי להתחיל</div>
                    <button onClick={openCreate}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
                      style={BTN_PRIMARY}>
                      + הוסף מסעדה ראשונה
                    </button>
                  </td>
                </tr>
              ) : (
                restaurants.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {r.logo ? (
                          <img src={r.logo} alt={r.name} className="w-10 h-10 rounded-xl object-cover border shrink-0" />
                        ) : (
                          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-700 font-bold shrink-0">
                            {r.name[0]}
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-gray-900">{r.name}</div>
                          {r.address && <div className="text-xs text-gray-400">{r.address}</div>}
                          <div className="flex items-center gap-2 mt-0.5">
                            {r.website && (
                              <a href={r.website} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-blue-400 hover:text-blue-600 transition-colors" dir="ltr">🌐 אתר</a>
                            )}
                            {r.locationUrl && (
                              <a href={r.locationUrl} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-amber-600 hover:text-amber-800 transition-colors font-medium">📍 מיקום</a>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 space-y-0.5">
                      {r.email && <div dir="ltr">{r.email}</div>}
                      {r.phone && <div dir="ltr">📞 {r.phone}</div>}
                      {r.phone2 && <div dir="ltr">📞 {r.phone2}</div>}
                      {r.orderPhone && <div dir="ltr">🛒 {r.orderPhone}</div>}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div>{r._count.menus} תפריטים</div>
                      <div>{r._count.orders} הזמנות</div>
                      <div>{r._count.restaurantUsers} משתמשים</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                    <td className="px-6 py-4">
                      <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium",
                        r.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
                        {r.isActive ? "פעיל" : "לא פעיל"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {(() => { const s = getSubscriptionStatus(r); return (
                        <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium", s.cls)}>{s.label}</span>
                      ); })()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <button onClick={() => openEdit(r)} title="ערוך" className="text-base hover:scale-110 transition-transform">✏️</button>
                        <a href={`/menu/${r.id}`} target="_blank" rel="noopener noreferrer"
                          title="תפריט ציבורי" className="text-base hover:scale-110 transition-transform inline-block">🌐</a>
                        <button onClick={() => toggleActive(r.id, r.isActive)} title={r.isActive ? "השבת" : "הפעל"}
                          className="text-base hover:scale-110 transition-transform">
                          {r.isActive ? "⏸️" : "▶️"}
                        </button>
                        <button
                          onClick={() => { setDeleteConfirm({ id: r.id, name: r.name }); setDeleteInput(""); }}
                          title="מחק" className="text-base hover:scale-110 transition-transform">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
