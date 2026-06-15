"use client";

import { T } from "@/lib/ui";
import { useState, useEffect } from "react";
import { formatDate } from "@/lib/utils";
import ImageUpload from "@/components/admin/ImageUpload";
import { MENU_PALETTES } from "@/lib/menuPalettes";
import PageShell from "@/components/admin/PageShell";

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
  splashImage: string | null;
  waiterBg: string | null;
  waiterBgOpacity: number | null;
  waiterScreen: number | null;
  subscriptionFrom: string | null;
  subscriptionTo: string | null;
  instagram: string | null;
  facebook: string | null;
  whatsapp: string | null;
  tripadvisor: string | null;
  googleReview: string | null;
  showPhonePublic: boolean;
  showAddressPublic: boolean;
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
  { id: "general",      label: "כללי",       icon: "🏠" },
  { id: "menu",         label: "תפריט",      icon: "📋" },
  { id: "orders",       label: "הזמנות",     icon: "🛒" },
  { id: "waiter",       label: "מסך מלצר",   icon: "🧑‍🍳" },
  { id: "social",       label: "סושיאל",     icon: "🌐" },
  { id: "subscription", label: "מנוי",       icon: "📅" },
] as const;
type TabId = typeof TABS[number]["id"];

const emptyForm = {
  name: "", description: "", logo: "", email: "", phone: "",
  phone2: "", orderPhone: "", address: "", website: "", locationUrl: "",
  menuTheme: "elegant", subscriptionFrom: "", subscriptionTo: "",
  menuPalette: "0",
  menuCustomAc: T.gold as string,
  menuCustomBg: T.bg as string,
  ordersEnabled: false,
  kdsView: "STATION_DARK",
  language: "he",
  welcomeText: "",
  splashImage: "",
  waiterBg: "",
  waiterBgOpacity: 0,
  waiterScreen: 2,
  instagram: "",
  facebook: "",
  whatsapp: "",
  tripadvisor: "",
  googleReview: "",
  showPhonePublic: true,
  showAddressPublic: true,
};

/* ── Solid primary button style ── */
const BTN_PRIMARY = {
  background: T.gold,
  color: "#fff",
} as const;

/* ── Dark input style ── */
const DARK_INPUT: React.CSSProperties = {
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#fff",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 14,
  width: "100%",
  outline: "none",
};

/* ── Dark select style ── */
const DARK_SELECT: React.CSSProperties = {
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#fff",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 14,
  width: "100%",
  outline: "none",
};

/* ── Action button style ── */
const ACTION_BTN: React.CSSProperties = {
  background: T.raised,
  border: "1px solid #3a3f47",
  borderRadius: 8,
  width: 32,
  height: 32,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: T.sub,
};

function toDateInput(val: string | null | undefined): string {
  if (!val) return "";
  return new Date(val).toISOString().slice(0, 10);
}

function getSubscriptionStatus(r: Restaurant): { label: string; style: React.CSSProperties } {
  const now = new Date();
  if (!r.subscriptionFrom && !r.subscriptionTo)
    return { label: "ללא מנוי", style: { background: "rgba(108,117,125,0.15)", color: T.muted } };
  if (r.subscriptionFrom && now < new Date(r.subscriptionFrom))
    return { label: "טרם התחיל", style: { background: "rgba(51,154,240,0.15)", color: T.blue } };
  if (r.subscriptionTo && now > new Date(r.subscriptionTo))
    return { label: "פג תוקף", style: { background: "rgba(255,107,107,0.15)", color: T.red } };
  if (r.subscriptionTo) {
    const daysLeft = Math.ceil((new Date(r.subscriptionTo).getTime() - now.getTime()) / 86400000);
    if (daysLeft <= 7)
      return { label: `${daysLeft} ימים נותרו`, style: { background: "rgba(255,146,43,0.15)", color: T.orange } };
    return {
      label: `פעיל עד ${new Date(r.subscriptionTo).toLocaleDateString("he-IL")}`,
      style: { background: "rgba(81,207,102,0.15)", color: T.green },
    };
  }
  return { label: "פעיל", style: { background: "rgba(81,207,102,0.15)", color: T.green } };
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

  /* ── Run pending DB migrations silently on mount ── */
  useEffect(() => {
    fetch("/api/admin/run-migration", { method: "POST" }).catch(() => {});
  }, []);

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
      menuCustomAc: (() => { try { return JSON.parse(r.menuPaletteData ?? "{}").ac ?? T.gold; } catch { return T.gold; } })(),
      menuCustomBg: (() => { try { return JSON.parse(r.menuPaletteData ?? "{}").bg ?? T.bg; } catch { return T.bg; } })(),
      ordersEnabled: r.ordersEnabled ?? false,
      kdsView: r.kdsView ?? "STATION_DARK",
      language: r.language ?? "he",
      welcomeText: r.welcomeText ?? "",
      splashImage: r.splashImage ?? "",
      waiterBg: r.waiterBg ?? "",
      waiterBgOpacity: r.waiterBgOpacity ?? 0,
      waiterScreen: r.waiterScreen ?? 2,
      instagram: r.instagram ?? "",
      facebook: r.facebook ?? "",
      whatsapp: r.whatsapp ?? "",
      tripadvisor: r.tripadvisor ?? "",
      googleReview: r.googleReview ?? "",
      showPhonePublic: r.showPhonePublic ?? true,
      showAddressPublic: r.showAddressPublic ?? true,
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
      splashImage: form.splashImage || null,
      waiterBg: form.waiterBg || null,
      waiterBgOpacity: form.waiterBgOpacity,
      waiterScreen: form.waiterScreen,
      instagram: form.instagram || null,
      facebook: form.facebook || null,
      whatsapp: form.whatsapp || null,
      tripadvisor: form.tripadvisor || null,
      googleReview: form.googleReview || null,
      showPhonePublic: form.showPhonePublic,
      showAddressPublic: form.showAddressPublic,
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
      <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.65)", marginBottom: 4 }}>{label}</label>
      <input
        type={opts?.type ?? "text"}
        value={form[key] as string}
        onChange={e => setForm({ ...form, [key]: e.target.value })}
        dir={opts?.dir}
        placeholder={opts?.placeholder}
        style={DARK_INPUT}
      />
    </div>
  );

  // Dropdown open state for 3-dot menus
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!openDropdown) return;
    function handleOutside() { setOpenDropdown(null); }
    document.addEventListener("click", handleOutside);
    return () => document.removeEventListener("click", handleOutside);
  }, [openDropdown]);

  return (
    <PageShell>
      {/* ── Fleet header ── */}
      <div style={{
        background: "rgba(255,255,255,0.04)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.15)", borderRadius: 20, padding: "15px 25px",
        display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#fff" }}>ניהול מסעדות</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(255,255,255,0.55)" }}>
            {restaurants.length} מסעדות רשומות במערכת
          </p>
        </div>
        <button onClick={openCreate} style={{
          background: "linear-gradient(135deg,#D97706,#F59E0B)", border: "none", color: "#fff",
          padding: "10px 20px", borderRadius: 12, fontFamily: "inherit", fontSize: 14, fontWeight: 700,
          cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
          boxShadow: "0 4px 15px rgba(217,119,6,0.3)", transition: "all 0.2s",
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 20px rgba(217,119,6,0.45)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ""; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 15px rgba(217,119,6,0.3)"; }}>
          + הוסף מסעדה
        </button>
      </div>

      {/* ── Form modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}>
          <div className="flex min-h-full items-start justify-center p-4 py-6">
            <div className="shadow-xl w-full max-w-2xl" style={{ background: "rgba(10,10,18,0.96)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, backdropFilter: "blur(24px)" }}>

              {/* Modal header */}
              <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ background: "transparent", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                <h2 className="text-lg font-bold" style={{ color: "#fff" }}>
                  {editTarget ? `עריכת מסעדה — ${editTarget.name}` : "מסעדה חדשה"}
                </h2>
                <button onClick={() => setShowForm(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-lg transition-colors"
                  style={{ color: "rgba(255,255,255,0.5)", background: "transparent" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.15)"; (e.currentTarget as HTMLButtonElement).style.color = "#fff"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.5)"; }}>
                  ✕
                </button>
              </div>

              {/* Tabs */}
              <div className="flex px-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors"
                    style={{
                      borderBottom: activeTab === tab.id ? "2px solid #D97706" : "2px solid transparent",
                      color: activeTab === tab.id ? "#F59E0B" : "rgba(255,255,255,0.45)",
                      background: "transparent",
                    }}
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
                        <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.65)", marginBottom: 4 }}>
                          📍 לינק מיקום (Google Maps)
                        </label>
                        <input
                          type="url"
                          value={form.locationUrl}
                          onChange={e => setForm({ ...form, locationUrl: e.target.value })}
                          placeholder="https://maps.google.com/..."
                          dir="ltr"
                          style={DARK_INPUT}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.65)", marginBottom: 4 }}>תיאור</label>
                        <textarea
                          value={form.description}
                          onChange={e => setForm({ ...form, description: e.target.value })}
                          rows={2}
                          style={{ ...DARK_INPUT, resize: "vertical" } as React.CSSProperties}
                        />
                      </div>
                    </>
                  )}

                  {/* ── Tab: תפריט ── */}
                  {activeTab === "menu" && (
                    <>
                      {/* Theme selector */}
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.65)", marginBottom: 8 }}>עיצוב תפריט</label>
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
                          <span className="text-xs font-medium pl-1" style={{ color: "rgba(255,255,255,0.45)" }}>פלטה:</span>
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
                            className="flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-medium transition-all"
                            style={form.menuPalette === "custom"
                              ? { borderColor: T.gold, background: "rgba(252,196,25,0.1)", color: T.gold }
                              : { borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.45)", background: "transparent" }}>
                            🎨 מותאם
                          </button>
                        </div>

                        {form.menuPalette === "custom" && (
                          <div className="mt-3 flex gap-4 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
                            <div className="flex items-center gap-2">
                              <label className="text-xs font-medium whitespace-nowrap" style={{ color: "rgba(255,255,255,0.45)" }}>צבע ראשי</label>
                              <input type="color" value={form.menuCustomAc}
                                onChange={e => setForm(f => ({ ...f, menuCustomAc: e.target.value }))}
                                className="w-8 h-8 rounded cursor-pointer p-0.5"
                                style={{ border: "1px solid rgba(255,255,255,0.12)" }}
                              />
                              <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.45)" }}>{form.menuCustomAc}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-xs font-medium whitespace-nowrap" style={{ color: "rgba(255,255,255,0.45)" }}>רקע</label>
                              <input type="color" value={form.menuCustomBg}
                                onChange={e => setForm(f => ({ ...f, menuCustomBg: e.target.value }))}
                                className="w-8 h-8 rounded cursor-pointer p-0.5"
                                style={{ border: "1px solid rgba(255,255,255,0.12)" }}
                              />
                              <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.45)" }}>{form.menuCustomBg}</span>
                            </div>
                          </div>
                        )}

                        {editTarget && (
                          <button type="button" onClick={() => setPreviewOpen(true)}
                            className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl border-2 border-dashed text-sm font-medium transition-all"
                            style={{ borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.45)" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = T.gold; (e.currentTarget as HTMLButtonElement).style.color = T.gold; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.2)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.45)"; }}>
                            👁 תצוגה מקדימה של התפריט
                          </button>
                        )}
                      </div>

                      {/* Language */}
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.65)", marginBottom: 8 }}>🌐 שפת תפריט ציבורי</label>
                        <select value={form.language}
                          onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
                          style={DARK_SELECT}>
                          <option value="he">עברית (he)</option>
                          <option value="en">English (en)</option>
                          <option value="ru">Русский (ru)</option>
                          <option value="fr">Français (fr)</option>
                        </select>
                      </div>

                      {/* Splash / Landing background image */}
                      <div style={{ padding: "16px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)" }}>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.65)", marginBottom: 4 }}>
                          🖼 תמונת רקע לדף הנחיתה
                        </label>
                        <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.45)" }}>
                          תמונה זו תוצג כרקע מלא-מסך בדף הפתיחה של התפריט הציבורי.
                          אם לא תועלה, ייאספו תמונות מהקטגוריות אוטומטית.
                        </p>
                        <ImageUpload
                          label=""
                          value={form.splashImage}
                          onChange={url => setForm(f => ({ ...f, splashImage: url }))}
                        />
                        {form.splashImage && (
                          <div style={{ marginTop: 10, borderRadius: 10, overflow: "hidden", position: "relative", height: 120 }}>
                            <div style={{
                              position: "absolute", inset: 0,
                              backgroundImage: `url('${form.splashImage}')`,
                              backgroundSize: "cover", backgroundPosition: "center",
                              opacity: 0.4,
                            }} />
                            <div style={{
                              position: "absolute", inset: 0,
                              background: "rgba(0,0,0,0.55)",
                            }} />
                            <div style={{
                              position: "absolute", inset: 0,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontFamily: "'Cinzel', serif", fontSize: 18, fontStyle: "italic",
                              color: "#F59E0B", fontWeight: 700, letterSpacing: 2,
                              textShadow: "0 2px 12px rgba(0,0,0,0.8)",
                            }}>
                              {form.name || "שם המסעדה"}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Welcome text */}
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.65)", marginBottom: 8 }}>💬 טקסט ברוכים הבאים</label>
                        <p className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.45)" }}>יוצג בתפריט הציבורי מתחת לשם המסעדה</p>
                        <textarea value={form.welcomeText}
                          onChange={e => setForm(f => ({ ...f, welcomeText: e.target.value }))}
                          rows={4}
                          placeholder="ברוכים הבאים אלינו..."
                          style={{ ...DARK_INPUT, resize: "vertical" } as React.CSSProperties}
                          dir="auto"
                        />
                      </div>
                    </>
                  )}

                  {/* ── Tab: הזמנות ── */}
                  {activeTab === "orders" && (
                    <>
                      {/* Orders toggle */}
                      <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
                        <div>
                          <div className="font-semibold text-sm" style={{ color: "#fff" }}>הזמנות מהתפריט</div>
                          <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>לקוחות יוכלו להזמין ישירות מהתפריט</div>
                        </div>
                        <button type="button"
                          onClick={() => setForm(f => ({ ...f, ordersEnabled: !f.ordersEnabled }))}
                          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                          style={{ background: form.ordersEnabled ? T.gold : T.overlay }}>
                          <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                            style={{ transform: form.ordersEnabled ? "translateX(4px)" : "translateX(24px)" }} />
                        </button>
                      </div>

                      {/* KDS View */}
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.65)", marginBottom: 8 }}>תצוגת מטבח מועדפת (KDS)</label>
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
                                className="flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all"
                                style={{
                                  background: isActive ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
                                  borderColor: isActive ? "#F59E0B" : "rgba(255,255,255,0.12)",
                                }}>
                                <span className="text-xl mb-1">{opt.icon}</span>
                                <span className="text-sm font-semibold" style={{ color: isActive ? "#F59E0B" : "#fff" }}>{opt.label}</span>
                                <span className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{opt.desc}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}

                  {/* ── Tab: מסך מלצר ── */}
                  {activeTab === "waiter" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                      {/* Waiter screen version selector */}
                      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 16 }}>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.65)", marginBottom: 12 }}>
                          🖥 גרסת מסך מלצר פעילה
                        </label>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          {[
                            { value: 1, label: "מלצר חכם 1", desc: "מסך קלאסי", icon: "🍽️" },
                            { value: 2, label: "מלצר חכם 2", desc: "גלאסמורפיזם כהה", icon: "✨" },
                          ].map(opt => {
                            const isActive = form.waiterScreen === opt.value;
                            return (
                              <button key={opt.value} type="button"
                                onClick={() => setForm(f => ({ ...f, waiterScreen: opt.value }))}
                                style={{
                                  background: isActive ? "rgba(217,119,6,0.15)" : "rgba(255,255,255,0.04)",
                                  border: `2px solid ${isActive ? "#F59E0B" : "rgba(255,255,255,0.12)"}`,
                                  borderRadius: 12, padding: "14px 16px", cursor: "pointer",
                                  display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4,
                                  transition: "all 0.15s",
                                }}>
                                <span style={{ fontSize: 22 }}>{opt.icon}</span>
                                <span style={{ fontSize: 14, fontWeight: 700, color: isActive ? "#F59E0B" : "#fff" }}>{opt.label}</span>
                                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{opt.desc}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Waiter bg */}
                      <div style={{ padding: "16px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)" }}>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.65)", marginBottom: 4 }}>
                          🍽️ רקע למסך מלצר
                        </label>
                        <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.45)" }}>
                          תמונה זו תוצג כרקע במסכי מלצר חכם 1 ו-2. אם לא תוגדר, ייעשה שימוש בתמונת ברירת המחדל.
                        </p>
                        <ImageUpload
                          label=""
                          value={form.waiterBg}
                          onChange={url => setForm(f => ({ ...f, waiterBg: url }))}
                        />
                        {form.waiterBg && (
                          <div style={{ marginTop: 10, borderRadius: 10, overflow: "hidden", position: "relative", height: 100 }}>
                            <div style={{
                              position: "absolute", inset: 0,
                              backgroundImage: `url('${form.waiterBg}')`,
                              backgroundSize: "cover", backgroundPosition: "center",
                            }} />
                            <div style={{ position: "absolute", inset: 0, background: `rgba(8,8,20,${form.waiterBgOpacity})`, transition: "background 0.2s" }} />
                            <div style={{
                              position: "absolute", inset: 0,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              color: "#fff", fontSize: 12, fontWeight: 600, opacity: 0.8,
                            }}>
                              תצוגה מקדימה — מסך מלצר
                            </div>
                          </div>
                        )}
                        {/* Opacity slider */}
                        <div style={{ marginTop: 14 }}>
                          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.65)", marginBottom: 8 }}>
                            🌓 שקיפות רקע (מסך מלצר חכם 2)
                          </label>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap" }}>ללא כיסוי</span>
                            <input
                              type="range" min={0} max={1} step={0.05}
                              value={form.waiterBgOpacity}
                              onChange={e => setForm(f => ({ ...f, waiterBgOpacity: parseFloat(e.target.value) }))}
                              style={{ flex: 1, accentColor: "#D97706", cursor: "pointer", direction: "ltr" }}
                            />
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap" }}>כהה מלא</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#F59E0B", minWidth: 40, textAlign: "center" }}>
                              {Math.round(form.waiterBgOpacity * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>

                    </div>
                  )}

                  {/* ── Tab: סושיאל ── */}
                  {activeTab === "social" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                      {/* Social links */}
                      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.65)", marginBottom: 14 }}>🔗 קישורים סושיאל</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {([
                            { key: "instagram",   icon: "📸", label: "Instagram", placeholder: "https://instagram.com/yourpage" },
                            { key: "facebook",    icon: "👥", label: "Facebook",  placeholder: "https://facebook.com/yourpage" },
                            { key: "whatsapp",    icon: "💬", label: "WhatsApp (מספר)",  placeholder: "0501234567" },
                            { key: "tripadvisor", icon: "🦉", label: "TripAdvisor", placeholder: "https://tripadvisor.com/..." },
                            { key: "googleReview",icon: "⭐", label: "Google Review", placeholder: "https://g.page/r/..." },
                          ] as const).map(({ key, icon, label, placeholder }) => (
                            <div key={key}>
                              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.65)", marginBottom: 4 }}>
                                <span>{icon}</span> {label}
                              </label>
                              <input
                                type={key === "whatsapp" ? "tel" : "url"}
                                value={form[key] as string}
                                onChange={e => setForm({ ...form, [key]: e.target.value })}
                                placeholder={placeholder}
                                dir="ltr"
                                style={DARK_INPUT}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Public visibility */}
                      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.65)", marginBottom: 14 }}>👁 מה מוצג בדף הציבורי</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {([
                            { key: "showPhonePublic",   label: "מספר טלפון",  desc: "כפתורי WhatsApp וחיוג" },
                            { key: "showAddressPublic", label: "כתובת",       desc: "כתובת המסעדה בדף הנחיתה" },
                          ] as const).map(({ key, label, desc }) => (
                            <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{label}</div>
                                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{desc}</div>
                              </div>
                              <button type="button"
                                onClick={() => setForm(f => ({ ...f, [key]: !f[key] }))}
                                style={{
                                  position: "relative", display: "inline-flex", height: 24, width: 44,
                                  alignItems: "center", borderRadius: 999, border: "none", cursor: "pointer",
                                  background: form[key] ? T.gold : T.overlay, transition: "background 150ms",
                                  flexShrink: 0,
                                }}>
                                <span style={{
                                  display: "inline-block", height: 16, width: 16, borderRadius: "50%", background: "#fff",
                                  boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                                  transform: form[key] ? "translateX(24px)" : "translateX(4px)",
                                  transition: "transform 150ms",
                                }} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  )}

                  {/* ── Tab: מנוי ── */}
                  {activeTab === "subscription" && (
                    <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}>
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.65)" }}>📅 תוקף מנוי</label>
                        <button type="button" onClick={setTrial}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg border-2 transition-colors"
                          style={{ borderColor: T.gold, color: T.gold, background: "transparent" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(252,196,25,0.1)"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
                          🎁 30 ימים ניסיון
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>מתאריך</label>
                          <input type="date" value={form.subscriptionFrom}
                            onChange={e => setForm({ ...form, subscriptionFrom: e.target.value })}
                            style={DARK_INPUT}
                          />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>עד תאריך</label>
                          <input type="date" value={form.subscriptionTo}
                            onChange={e => setForm({ ...form, subscriptionTo: e.target.value })}
                            style={DARK_INPUT}
                          />
                        </div>
                      </div>
                      {(form.subscriptionFrom || form.subscriptionTo) && (
                        <button type="button"
                          onClick={() => setForm({ ...form, subscriptionFrom: "", subscriptionTo: "" })}
                          className="text-xs underline transition-colors"
                          style={{ color: "rgba(255,255,255,0.45)" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = T.red; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.45)"; }}>
                          הסר תאריכים (ללא הגבלת תוקף)
                        </button>
                      )}
                    </div>
                  )}

                </div>

                {/* Form footer */}
                <div className="px-6 pb-5 pt-4 flex gap-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                  {error && <p className="text-sm flex-1" style={{ color: T.red }}>{error}</p>}
                  <button type="submit" disabled={loading}
                    className="flex-1 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50 transition-opacity hover:opacity-80"
                    style={BTN_PRIMARY}>
                    {loading ? "שומר..." : editTarget ? "שמור שינויים" : "צור מסעדה"}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)}
                    className="flex-1 py-2.5 rounded-lg font-medium text-sm transition-colors"
                    style={{ background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }}>
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}>
          <div className="shadow-2xl w-full max-w-sm p-6" style={{ background: "rgba(10,10,18,0.96)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, backdropFilter: "blur(24px)" }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl mx-auto mb-4"
              style={{ background: "rgba(255,107,107,0.15)" }}>🗑️</div>
            <h3 className="text-lg font-bold text-center mb-1" style={{ color: "#fff" }}>מחיקת מסעדה</h3>
            <p className="text-sm text-center mb-4" style={{ color: "rgba(255,255,255,0.65)" }}>
              פעולה זו תמחק לצמיתות את <strong style={{ color: "#fff" }}>{deleteConfirm.name}</strong> עם כל התפריטים, הפריטים וההזמנות שלה.
            </p>
            <p className="text-xs font-semibold mb-2" style={{ color: "rgba(255,255,255,0.65)" }}>
              כדי לאשר, הקלד את שם המסעדה:
            </p>
            <input
              type="text"
              value={deleteInput}
              onChange={e => setDeleteInput(e.target.value)}
              placeholder={deleteConfirm.name}
              style={{ ...DARK_INPUT, marginBottom: 16 }}
              autoFocus
              onKeyDown={e => { if (e.key === "Enter" && deleteInput === deleteConfirm.name) confirmDelete(); }}
            />
            <div className="flex gap-3">
              <button
                onClick={confirmDelete}
                disabled={deleteInput !== deleteConfirm.name}
                className="flex-1 py-2.5 rounded-lg font-semibold text-sm text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                style={{ background: T.red }}
                onMouseEnter={e => { if (deleteInput === deleteConfirm.name) (e.currentTarget as HTMLButtonElement).style.background = T.red; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = T.red; }}>
                מחק לצמיתות
              </button>
              <button
                onClick={() => { setDeleteConfirm(null); setDeleteInput(""); }}
                className="flex-1 py-2.5 rounded-lg font-medium text-sm transition-colors"
                style={{ background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Preview modal ── */}
      {previewOpen && editTarget && (
        <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: T.bg }}>
          <div className="flex items-center justify-between px-4 py-2 shrink-0" style={{ background: "#111", borderBottom: "1px solid #222" }}>
            <span className="text-white font-semibold text-sm">{editTarget.name} — תצוגה מקדימה</span>
            <div className="flex items-center gap-2">
              <a href={buildPreviewUrl(editTarget.id)} target="_blank" rel="noopener noreferrer"
                className="text-xs px-3 py-1 rounded-full font-medium"
                style={{ background: "#222", color: T.gold, border: "1px solid #333" }}>
                פתח בטאב ↗
              </a>
              <button onClick={() => setPreviewOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-white"
                style={{ background: "#222" }}>✕</button>
            </div>
          </div>
          <div className="shrink-0 px-4 py-2.5 flex flex-wrap items-center gap-3" style={{ background: T.bg, borderBottom: "1px solid #252525" }}>
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
            <div style={{ width: 1, height: 20, background: T.surface, flexShrink: 0 }} />
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
                  ? { background: T.bg, color: T.orange, border: "1px solid #f59e0b" }
                  : { background: T.bg, color: "#666", border: "1px solid #2a2a2a" }}>
                🎨
              </button>
            </div>
            {form.menuPalette === "custom" && (
              <div className="flex items-center gap-3 px-3 py-1 rounded-lg" style={{ background: T.bg, border: "1px solid #2a2a2a" }}>
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

      {/* ── Restaurants list (glass cards) ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {restaurants.length === 0 ? (
          <div style={{
            background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 20, padding: "48px 24px", textAlign: "center",
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🍽️</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>אין מסעדות עדיין</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 20 }}>לחץ על &quot;הוסף מסעדה&quot; כדי להתחיל</div>
            <button onClick={openCreate} style={{
              background: "linear-gradient(135deg,#D97706,#F59E0B)", border: "none", color: "#fff",
              padding: "10px 24px", borderRadius: 12, fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>+ הוסף מסעדה ראשונה</button>
          </div>
        ) : restaurants.map(r => {
          const subStatus = getSubscriptionStatus(r);
          const hasData = r._count.menus > 0 || r._count.orders > 0 || r._count.restaurantUsers > 0;
          const isOpen = openDropdown === r.id;
          return (
            <div key={r.id} style={{
              background: "rgba(255,255,255,0.07)", backdropFilter: "blur(15px)", WebkitBackdropFilter: "blur(15px)",
              border: "1px solid rgba(255,255,255,0.15)", borderRadius: 20,
              padding: "10px 18px",
              display: "grid",
              gridTemplateColumns: "1.4fr 1.2fr 1.6fr 0.9fr 0.8fr 52px",
              alignItems: "center", gap: 8,
              transition: "all 0.25s",
              position: "relative" as const, zIndex: isOpen ? 10 : 1,
            }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.transform = "translateX(-3px)"; el.style.background = "rgba(255,255,255,0.13)"; el.style.borderColor = "rgba(255,255,255,0.25)"; el.style.boxShadow = "0 10px 30px rgba(0,0,0,0.2)"; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.transform = ""; el.style.background = "rgba(255,255,255,0.07)"; el.style.borderColor = "rgba(255,255,255,0.15)"; el.style.boxShadow = ""; }}>

              {/* Identity */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {r.logo ? (
                  <img src={r.logo} alt={r.name} style={{ width: 38, height: 38, borderRadius: 10, objectFit: "cover", flexShrink: 0, border: "1px solid rgba(255,255,255,0.15)" }} />
                ) : (
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg,#D97706,#F59E0B)", color: "#fff", fontWeight: 900, fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 10px rgba(217,119,6,0.25)" }}>
                    {r.name[0]}
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{r.name}</div>
                  {r.address && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 1 }}>{r.address}</div>}
                </div>
              </div>

              {/* Contact */}
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {r.email && <div style={{ fontSize: 12, color: "#fff", display: "flex", alignItems: "center", gap: 5 }}>✉️ <span dir="ltr">{r.email}</span></div>}
                {r.phone && <div style={{ fontSize: 12, color: "#60A5FA", display: "flex", alignItems: "center", gap: 5 }}>📞 <span dir="ltr">{r.phone}</span></div>}
                {!r.email && !r.phone && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>—</div>}
              </div>

              {/* Stats badges */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[
                  { icon: "📋", label: "תפריטים", val: r._count.menus },
                  { icon: "🛒", label: "הזמנות",  val: r._count.orders },
                  { icon: "👥", label: "משתמשים", val: r._count.restaurantUsers },
                ].map(({ icon, label, val }) => {
                  const lit = hasData && val > 0;
                  return (
                    <span key={label} style={{
                      background: lit ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${lit ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.08)"}`,
                      padding: "3px 8px", borderRadius: 7, fontSize: 11,
                      display: "flex", alignItems: "center", gap: 4,
                      color: lit ? "#93C5FD" : "rgba(255,255,255,0.5)",
                    }}>
                      {icon} {label}: <strong style={{ color: lit ? "#3B82F6" : "#fff", marginRight: 1 }}>{val}</strong>
                    </span>
                  );
                })}
              </div>

              {/* Date */}
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
                נוצר<br /><span style={{ color: "#fff", fontWeight: 500 }}>{formatDate(r.createdAt)}</span>
              </div>

              {/* Status + subscription */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                <span style={{
                  background: r.isActive ? "rgba(16,185,129,0.15)" : "rgba(108,117,125,0.15)",
                  color: r.isActive ? "#34D399" : "rgba(255,255,255,0.45)",
                  border: `1px solid ${r.isActive ? "rgba(16,185,129,0.25)" : "rgba(108,117,125,0.2)"}`,
                  padding: "2px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                }}>{r.isActive ? "פעיל" : "לא פעיל"}</span>
                <span style={{
                  ...subStatus.style,
                  background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)",
                  padding: "2px 8px", borderRadius: 6, fontSize: 11,
                }}>{subStatus.label}</span>
              </div>

              {/* 3-dot actions */}
              <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
                <button
                  onClick={e => { e.stopPropagation(); setOpenDropdown(isOpen ? null : r.id); }}
                  style={{
                    background: isOpen ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${isOpen ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.15)"}`,
                    color: isOpen ? "#fff" : "rgba(255,255,255,0.55)",
                    width: 34, height: 34, borderRadius: 9, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, transition: "all 0.15s", fontFamily: "inherit",
                  }}
                  onMouseEnter={e => { if (!isOpen) { const b = e.currentTarget as HTMLButtonElement; b.style.background = "rgba(255,255,255,0.15)"; b.style.color = "#fff"; } }}
                  onMouseLeave={e => { if (!isOpen) { const b = e.currentTarget as HTMLButtonElement; b.style.background = "rgba(255,255,255,0.05)"; b.style.color = "rgba(255,255,255,0.55)"; } }}>
                  ⋮
                </button>

                {isOpen && (
                  <div onClick={e => e.stopPropagation()} style={{
                    position: "absolute", top: 40, left: 0,
                    background: "rgba(20,20,28,0.97)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
                    border: "1px solid rgba(255,255,255,0.15)", borderRadius: 14,
                    padding: 6, minWidth: 165,
                    boxShadow: "0 10px 25px rgba(0,0,0,0.5)", zIndex: 200,
                    display: "flex", flexDirection: "column", gap: 2,
                    animation: "fadeInDrop 0.15s ease",
                  }}>
                    <style>{`@keyframes fadeInDrop { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }`}</style>
                    {[
                      { icon: "✏️", label: "עריכה", onClick: () => { openEdit(r); setOpenDropdown(null); }, danger: false },
                      { icon: "🌐", label: "תפריט ציבורי", onClick: () => { window.open(`/menu/${r.id}`, "_blank"); setOpenDropdown(null); }, danger: false },
                      { icon: r.isActive ? "⏸️" : "▶️", label: r.isActive ? "השהייה" : "הפעל", onClick: () => { toggleActive(r.id, r.isActive); setOpenDropdown(null); }, danger: false },
                      { icon: "🗑️", label: "מחיקה", onClick: () => { setDeleteConfirm({ id: r.id, name: r.name }); setDeleteInput(""); setOpenDropdown(null); }, danger: true },
                    ].map(item => (
                      <button key={item.label} onClick={item.onClick} style={{
                        background: "none", border: "none",
                        color: item.danger ? "#FCA5A5" : "rgba(255,255,255,0.8)",
                        fontFamily: "inherit", fontSize: 13, fontWeight: 500,
                        padding: "9px 12px", borderRadius: 8, cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 9, width: "100%",
                        textAlign: "right", direction: "rtl", transition: "all 0.12s",
                      }}
                        onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = item.danger ? "rgba(239,68,68,0.18)" : "rgba(255,255,255,0.08)"; b.style.color = "#fff"; }}
                        onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "none"; b.style.color = item.danger ? "#FCA5A5" : "rgba(255,255,255,0.8)"; }}>
                        <span>{item.icon}</span> {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </PageShell>
  );
}
