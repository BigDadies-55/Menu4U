"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Cinzel, Rubik } from "next/font/google";
import { buildPaletteStyle } from "@/lib/menuPalettes";
import { getT, getItemName, getItemDesc, getCatName, type Translations, type Lang } from "@/lib/translations";

// ── Fonts loaded at build time via next/font/google (no CDN, no flash) ───────
const cinzelFont = Cinzel({
  subsets: ["latin"],
  weight: ["400", "600", "900"],
  variable: "--font-cinzel",
  display: "swap",
});
const rubikFont = Rubik({
  subsets: ["latin", "hebrew"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-rubik",
  display: "swap",
});

// ── No fallback images — only show images that were explicitly uploaded ───────
// Categories/items without images render as clean dark gradient cards (text-only).


type TableOrderItem = {
  id: string;
  quantity: number;
  price: number;
  notes: string | null;
  itemStatus: string;
  item: { name: string };
};

const ITEM_STATUS_LABEL: Record<string, string> = {
  PENDING: "ממתין",
  PREPARING: "בהכנה 👨‍🍳",
  DONE: "הוכן ✓",
};

const ITEM_STATUS_COLOR: Record<string, string> = {
  PENDING: "#f59e0b",
  PREPARING: "#38bdf8",
  DONE: "#4ade80",
};

type TableOrder = {
  id: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  notes: string | null;
  customerName: string | null;
  customerPhone: string | null;
  items: TableOrderItem[];
};

type GuestIdentity = { name: string; phone: string };

const STATUS_LABEL: Record<string, string> = {
  PENDING: "ממתין לאישור",
  CONFIRMED: "אושר",
  PREPARING: "בהכנה",
  READY: "מוכן למסירה 🔔",
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: "#f59e0b",
  CONFIRMED: "#38bdf8",
  PREPARING: "#fb923c",
  READY: "#4ade80",
};

type Item = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image: string | null;
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  tags: string[];
  prepTime: number | null;
  translations?: Record<string, { name?: string; description?: string }> | null;
};

type Category = {
  id: string;
  name: string;
  image: string | null;
  items: Item[];
  translations?: Record<string, { name?: string }> | null;
};

type Restaurant = {
  id: string;
  name: string;
  logo: string | null;
  address: string | null;
  phone: string | null;
  orderPhone: string | null;
  website: string | null;
  locationUrl: string | null;
  menuTheme?: string;
  menuPalette?: string | null;
  menuPaletteData?: string | null;
  ordersEnabled?: boolean;
  language?: string | null;
  welcomeText?: string | null;
  splashImage?: string | null;
  menus: { id: string; categories: Category[] }[];
};

type CartModifier = { groupName: string; label: string; priceAdd: number };

type CartItem = {
  cartId: string;
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  person?: number;
  modifiers?: CartModifier[];
};

type ModOption = { id: string; label: string; priceAdd: number; order: number };
type ModGroup  = { id: string; name: string; required: boolean; maxSelect: number; order: number; options: ModOption[] };

function getItemBadges(item: Item, t: Translations): string[] {
  const badges: string[] = [];
  if (item.isVegetarian) badges.push(t.vegBadge);
  if (item.isVegan) badges.push(t.veganBadge);
  if (item.isGlutenFree) badges.push(t.gfBadge);
  return [...badges, ...item.tags];
}

function GuestRegistrationModal({
  onSave,
  restaurantName,
  tableNumber,
  t,
}: {
  onSave: (identity: { name: string; phone: string }) => void;
  restaurantName: string;
  tableNumber: string;
  t: Translations;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  function handleSubmit() {
    const trimName = name.trim();
    const trimPhone = phone.trim().replace(/\s/g, "");
    if (!trimName) { setError(t.nameRequired); return; }
    if (!trimPhone || trimPhone.length < 9) { setError(t.phoneInvalid); return; }
    onSave({ name: trimName, phone: trimPhone });
  }

  return (
    <div style={{
      position: "relative", zIndex: 71,
      background: "#1c1c1c", borderRadius: 16,
      padding: "28px 24px", width: "min(340px, 90vw)",
      border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>👋</div>
      <div style={{ color: "#C5A880", fontWeight: 700, fontSize: 20, marginBottom: 4 }}>{t.welcome}</div>
      <div style={{ color: "#fff", opacity: 0.6, fontSize: 14, marginBottom: 20 }}>
        {restaurantName} • {t.tableLabel} {tableNumber}
      </div>
      <div style={{ textAlign: t.dir === "rtl" ? "right" : "left", marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 12, color: "#fff", opacity: 0.6, marginBottom: 4 }}>{t.fullName}</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="ישראל ישראלי"
          autoFocus
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 9, fontSize: 15,
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)",
            color: "#fff", outline: "none", boxSizing: "border-box",
          }}
        />
      </div>
      <div style={{ textAlign: t.dir === "rtl" ? "right" : "left", marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 12, color: "#fff", opacity: 0.6, marginBottom: 4 }}>{t.phoneNumber}</label>
        <input
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="050-0000000"
          inputMode="numeric"
          dir="ltr"
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 9, fontSize: 15,
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)",
            color: "#fff", outline: "none", boxSizing: "border-box",
          }}
          onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }}
        />
      </div>
      {error && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <button
        onClick={handleSubmit}
        style={{
          width: "100%", padding: "12px 0", borderRadius: 10,
          background: "#C5A880", color: "#0D0D0D",
          border: "none", fontWeight: 700, fontSize: 16, cursor: "pointer",
        }}
      >
        {t.enter}
      </button>
      <div style={{ fontSize: 11, color: "#fff", opacity: 0.35, marginTop: 12 }}>
        הפרטים משמשים לזיהוי הזמנתך בלבד
      </div>
    </div>
  );
}

export default function MenuElegantClient({
  restaurant,
  tableNumber,
}: {
  restaurant: Restaurant;
  tableNumber?: string | null;
}) {
  // Elegant theme view state
  const [elegantView, setElegantView] = useState<"landing" | "categories" | "items">("landing");
  const elegantHistory = useRef<("landing" | "categories" | "items")[]>(["landing"]);

  function elegantNavigateTo(v: "landing" | "categories" | "items") {
    if (elegantHistory.current[elegantHistory.current.length - 1] !== v) {
      elegantHistory.current.push(v);
    }
    setElegantView(v);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function elegantGoBack() {
    if (elegantHistory.current.length > 1) {
      elegantHistory.current.pop();
      setElegantView(elegantHistory.current[elegantHistory.current.length - 1]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  const [modalItem, setModalItem] = useState<Item | null>(null);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [editNoteCartId, setEditNoteCartId] = useState<string | null>(null);
  const [editNoteValue, setEditNoteValue] = useState("");

  // Modifier modal state
  const [modifierItem, setModifierItem] = useState<Item | null>(null);
  const [modifierGroups, setModifierGroups] = useState<ModGroup[]>([]);
  const [modifierGroupsLoading, setModifierGroupsLoading] = useState(false);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({});

  // My orders (current table)
  const [myOrdersOpen, setMyOrdersOpen] = useState(false);
  const [myOrders, setMyOrders] = useState<TableOrder[]>([]);
  const [myOrdersLoading, setMyOrdersLoading] = useState(false);
  const [ordersView, setOrdersView] = useState<"mine" | "all">("mine");
  const [billMode, setBillMode] = useState<"mine" | "all" | null>(null);

  // Guest identity (name + phone stored in localStorage)
  const [guestIdentity, setGuestIdentity] = useState<GuestIdentity | null>(null);
  const [showRegistration, setShowRegistration] = useState(false);

  // Customer newsletter/updates registration
  const [regModalOpen,      setRegModalOpen]      = useState(false);
  const [regForm,           setRegForm]           = useState({ name: "", phone: "", email: "" });
  const [regLoading,        setRegLoading]        = useState(false);
  const [regStep,           setRegStep]           = useState<"form" | "otp" | "done">("form");
  const [regPendingId,      setRegPendingId]      = useState("");
  const [regOtp,            setRegOtp]            = useState("");
  const [regCoupon,         setRegCoupon]         = useState("");
  const [regError,          setRegError]          = useState("");
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  // Language state
  const [lang, setLang] = useState<Lang>((restaurant.language as Lang) ?? "he");

  // Fonts loaded via next/font/google module-level declarations above

  // On mount: check if already registered; if not — auto-open modal on first ever visit
  useEffect(() => {
    try {
      const regKey     = `menu4u_customer_registered_${restaurant.id}`;
      const shownKey   = `menu4u_reg_shown_${restaurant.id}`;
      const registered = localStorage.getItem(regKey) === "1";
      if (registered) {
        setAlreadyRegistered(true);
        return;
      }
      if (!localStorage.getItem(shownKey)) {
        localStorage.setItem(shownKey, "1");
        setTimeout(() => {
          setRegStep("form");
          setRegOtp(""); setRegError(""); setRegCoupon("");
          setRegForm({ name: "", phone: "", email: "" });
          setRegModalOpen(true);
        }, 1500);
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMyOrders = useCallback(async (silent = false, view?: "mine" | "all", identity?: GuestIdentity | null) => {
    if (!tableNumber) return;
    if (!silent) setMyOrdersLoading(true);
    const currentView = view ?? ordersView;
    const currentIdentity = identity !== undefined ? identity : guestIdentity;
    try {
      let url = `/api/menu/${restaurant.id}/orders?table=${encodeURIComponent(tableNumber)}`;
      if (currentView === "mine" && currentIdentity?.phone) {
        url += `&phone=${encodeURIComponent(currentIdentity.phone)}`;
      }
      const res = await fetch(url);
      if (res.ok) setMyOrders(await res.json());
    } finally {
      if (!silent) setMyOrdersLoading(false);
    }
  }, [restaurant.id, tableNumber, ordersView, guestIdentity]);

  // Auto-refresh my orders every 10s when panel is open
  useEffect(() => {
    if (!myOrdersOpen) return;
    const iv = setInterval(() => fetchMyOrders(true), 10000);
    return () => clearInterval(iv);
  }, [myOrdersOpen, fetchMyOrders]);

  // SSE for real-time order updates
  useEffect(() => {
    const es = new EventSource(`/api/menu/${restaurant.id}/stream`);
    es.onmessage = () => { fetchMyOrders(true); };
    es.onerror = () => es.close();
    return () => es.close();
  }, [restaurant.id, fetchMyOrders]);

  // Load guest identity from localStorage on mount
  useEffect(() => {
    if (!tableNumber || !restaurant.ordersEnabled) return;
    const key = `menu4u_guest_${restaurant.id}_${tableNumber}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed: GuestIdentity = JSON.parse(stored);
        if (parsed.name && parsed.phone) {
          setGuestIdentity(parsed);
          return;
        }
      }
    } catch { /* ignore */ }
    setShowRegistration(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function saveGuestIdentity(identity: GuestIdentity) {
    const key = `menu4u_guest_${restaurant.id}_${tableNumber}`;
    localStorage.setItem(key, JSON.stringify(identity));
    setGuestIdentity(identity);
    setShowRegistration(false);
    fetch(`/api/menu/${restaurant.id}/register-guest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: identity.name, phone: identity.phone }),
      keepalive: true,
    }).catch(() => {});
    fetchMyOrders(true, "mine", identity);
  }

  // Read language preference from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`menu4u_lang_${restaurant.id}`) as Lang | null;
      const initial: Lang = (saved && ["he","en","ru","fr"].includes(saved) ? saved : (restaurant.language as Lang)) ?? "he";
      setLang(initial);
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function switchLang(l: Lang) {
    setLang(l);
    try { localStorage.setItem(`menu4u_lang_${restaurant.id}`, l); } catch {}
  }

  const t = getT(lang);
  const categories = restaurant.menus.flatMap(m => m.categories);

  // Collect up to 3 images for landing collage background
  const landingImages: string[] = [];
  for (const cat of categories) {
    if (cat.image) landingImages.push(cat.image);
    else if (cat.items[0]?.image) landingImages.push(cat.items[0].image);
    if (landingImages.length >= 3) break;
  }
  if (landingImages.length === 1) { landingImages.push(landingImages[0], landingImages[0]); }
  else if (landingImages.length === 2) { landingImages.push(landingImages[0]); }

  // Suppress unused import warning for buildPaletteStyle — kept for parity
  void buildPaletteStyle;

  function track(type: string, refId?: string, refName?: string) {
    fetch(`/api/menu/${restaurant.id}/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, refId, refName }),
      keepalive: true,
    }).catch(() => {});
  }

  useEffect(() => { track("page"); }, []);

  function openCategory(cat: Category) {
    track("category", cat.id, cat.name);
    setSelectedCat(cat);
    elegantNavigateTo("items");
  }

  function goHome() {
    setSelectedCat(null);
    setElegantView("categories");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (modalItem) setModalItem(null);
      else if (cartOpen) setCartOpen(false);
      else if (myOrdersOpen) setMyOrdersOpen(false);
      else if (elegantView === "items") elegantGoBack();
      else if (elegantView === "categories") elegantGoBack();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalItem, elegantView, cartOpen, myOrdersOpen]);

  useEffect(() => {
    document.body.style.overflow = (modalItem || cartOpen || myOrdersOpen) ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [modalItem, cartOpen, myOrdersOpen]);

  useEffect(() => {
    document.documentElement.dir = t.dir;
    document.documentElement.lang = lang;
    return () => { document.documentElement.dir = "rtl"; document.documentElement.lang = "he"; };
  }, [t.dir, lang]);

  async function openAddToCart(item: Item) {
    setModifierGroupsLoading(true);
    setModifierItem(item);
    setSelectedModifiers({});
    try {
      const res = await fetch(`/api/menu/${restaurant.id}/items/${item.id}/modifiers`);
      const groups: ModGroup[] = res.ok ? await res.json() : [];
      setModifierGroups(groups);
      if (groups.length === 0) {
        addToCartDirect(item, []);
        setModifierItem(null);
      }
    } catch {
      setModifierGroups([]);
      addToCartDirect(item, []);
      setModifierItem(null);
    } finally {
      setModifierGroupsLoading(false);
    }
  }

  function addToCartDirect(item: Item, modifiers: CartModifier[]) {
    const priceAdd = modifiers.reduce((s, m) => s + m.priceAdd, 0);
    setCart(prev => [...prev, {
      cartId: `${item.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      itemId: item.id,
      name: item.name,
      price: item.price + priceAdd,
      quantity: 1,
      modifiers: modifiers.length > 0 ? modifiers : undefined,
    }]);
  }

  function confirmModifiers() {
    if (!modifierItem) return;
    const modifiers: CartModifier[] = [];
    for (const grp of modifierGroups) {
      const sel = selectedModifiers[grp.id] ?? [];
      for (const label of sel) {
        const opt = grp.options.find(o => o.label === label);
        if (opt) modifiers.push({ groupName: grp.name, label, priceAdd: opt.priceAdd });
      }
    }
    addToCartDirect(modifierItem, modifiers);
    setModifierItem(null);
    setModifierGroups([]);
    setSelectedModifiers({});
  }

  function toggleModifierOption(grp: ModGroup, label: string) {
    setSelectedModifiers(prev => {
      const cur = prev[grp.id] ?? [];
      if (grp.maxSelect === 1) {
        return { ...prev, [grp.id]: cur.includes(label) ? [] : [label] };
      } else {
        if (cur.includes(label)) {
          return { ...prev, [grp.id]: cur.filter(l => l !== label) };
        } else if (cur.length < grp.maxSelect) {
          return { ...prev, [grp.id]: [...cur, label] };
        }
        return prev;
      }
    });
  }

  function isModifierValid(): boolean {
    for (const grp of modifierGroups) {
      if (grp.required && (selectedModifiers[grp.id] ?? []).length === 0) return false;
    }
    return true;
  }

  function updateQty(cartId: string, delta: number) {
    setCart(prev => {
      const updated = prev.map(c => c.cartId === cartId ? { ...c, quantity: c.quantity + delta } : c);
      return updated.filter(c => c.quantity > 0);
    });
  }

  function updateNotes(cartId: string, notes: string) {
    setCart(prev => prev.map(c => c.cartId === cartId ? { ...c, notes } : c));
  }

  /** Remove one unit from the most-recently-added entry of a given itemId */
  function removeOneByItemId(itemId: string) {
    const entry = [...cart].reverse().find(c => c.itemId === itemId);
    if (entry) updateQty(entry.cartId, -1);
  }

  /** Total qty across all cart entries for a given itemId */
  function cartQtyByItem(itemId: string): number {
    return cart.filter(c => c.itemId === itemId).reduce((s, c) => s + c.quantity, 0);
  }

  /** Total qty for all items belonging to a category */
  function cartQtyByCat(catId: string): number {
    const ids = new Set(categories.find(c => c.id === catId)?.items.map(i => i.id) ?? []);
    return cart.filter(c => ids.has(c.itemId)).reduce((s, c) => s + c.quantity, 0);
  }

  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);
  const cartTotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);

  async function handleOrder() {
    if (cart.length === 0) return;
    setOrderLoading(true);
    setOrderError("");
    try {
      const res = await fetch(`/api/menu/${restaurant.id}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableNumber: tableNumber || "",
          items: cart.map(c => ({ itemId: c.itemId, quantity: c.quantity, notes: c.notes || null, modifiers: c.modifiers ?? [] })),
          customerName: guestIdentity?.name || "",
          customerPhone: guestIdentity?.phone || "",
          notes: "",
        }),
      });
      if (!res.ok) throw new Error(t.orderError);
      setCart([]);
      setCartOpen(false);
      setOrderSuccess(true);
    } catch (err: unknown) {
      setOrderError(err instanceof Error ? err.message : t.orderError);
    } finally {
      setOrderLoading(false);
    }
  }

  async function handleRegisterSubmit() {
    const name  = regForm.name.trim();
    const phone = regForm.phone.trim().replace(/\s/g, "");
    const email = regForm.email.trim();
    if (!name)  { setRegError(t.nameField); return; }
    if (!phone || phone.length < 9) { setRegError(t.phoneField); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setRegError(t.emailInvalid); return; }
    setRegLoading(true); setRegError("");
    try {
      const res = await fetch(`/api/menu/${restaurant.id}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email }),
      });
      const data = await res.json();
      if (!res.ok) { setRegError(data.error ?? t.registrationError); return; }
      setRegPendingId(data.pendingId);
      setRegOtp("");
      setRegStep("otp");
    } finally {
      setRegLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (!regOtp.trim()) { setRegError(t.otpRequired); return; }
    setRegLoading(true); setRegError("");
    try {
      const res = await fetch(`/api/menu/${restaurant.id}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingId: regPendingId, otp: regOtp.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setRegError(data.error ?? t.verifyError); return; }
      try { localStorage.setItem(`menu4u_customer_registered_${restaurant.id}`, "1"); } catch { /* ignore */ }
      setAlreadyRegistered(true);
      setRegCoupon(data.couponCode ?? "");
      setRegStep("done");
    } finally {
      setRegLoading(false);
    }
  }

  return (
    <div
      className={`${cinzelFont.variable} ${rubikFont.variable}`}
      style={{
        minHeight: "100vh", background: "#0D0D0D", color: "#fff",
        fontFamily: "var(--font-rubik, 'Rubik', sans-serif)", direction: t.dir,
        overflowX: "hidden",
      }}
    >

      {/* ── Sticky Header (hidden on landing view) ── */}
      {elegantView !== "landing" && (
        <header style={{
          position: "sticky", top: 0, zIndex: 40,
          background: "rgba(13,13,13,0.95)", backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          padding: "14px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          {/* Back button */}
          <button onClick={elegantGoBack} style={{
            display: "flex", alignItems: "center", gap: 6,
            color: "#C5A880", background: "none", border: "none",
            fontSize: 14, fontWeight: 500, cursor: "pointer", padding: "6px 10px",
            borderRadius: 8, transition: "background 150ms",
          }}>
            ‹ {t.back}
          </button>

          {/* Restaurant name */}
          <span style={{ fontFamily: "var(--font-cinzel, 'Cinzel', serif)", fontSize: 18, letterSpacing: 3, color: "#C5A880" }}>
            {restaurant.name}
          </span>

          {/* Spacer to keep header balanced */}
          <div style={{ width: 60 }} />
        </header>
      )}

      {/* ── LANDING SCREEN ── */}
      {elegantView === "landing" && (
        <section style={{
          minHeight: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          position: "relative", overflow: "hidden",
          background: "#0a0908",
        }}>

          {/* Background: custom splashImage OR auto-collage from categories */}
          {restaurant.splashImage ? (
            /* ── Single custom image ── */
            <div style={{ position: "absolute", inset: 0 }}>
              <div style={{
                position: "absolute", inset: 0,
                backgroundImage: `url('${restaurant.splashImage}')`,
                backgroundSize: "cover", backgroundPosition: "center",
                opacity: 0.45,
              }} />
            </div>
          ) : landingImages.length > 0 ? (
            /* ── Auto 3-panel collage ── */
            <div style={{
              position: "absolute", inset: 0,
              display: "grid",
              gridTemplateColumns: `repeat(${landingImages.length}, 1fr)`,
              gap: 3,
            }}>
              {landingImages.map((src, i) => (
                <div key={i} style={{ position: "relative" }}>
                  <div style={{
                    position: "absolute", inset: 0,
                    backgroundImage: `url('${src}')`,
                    backgroundSize: "cover", backgroundPosition: "center",
                    opacity: 0.45,
                  }} />
                </div>
              ))}
            </div>
          ) : (
            /* ── No images: dark radial fallback ── */
            <div style={{
              position: "absolute", inset: 0,
              background: "radial-gradient(ellipse at 50% 30%, #1a130a 0%, #0a0908 100%)",
            }} />
          )}

          {/* Dark overlay — top heavy + bottom heavy, lighter in the middle */}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.38) 30%, rgba(0,0,0,0.5) 65%, rgba(0,0,0,0.88) 100%)",
            pointerEvents: "none",
          }} />
          {/* Vignette */}
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.5) 100%)",
            pointerEvents: "none",
          }} />

          {/* Main content */}
          <div style={{
            position: "relative", zIndex: 2,
            display: "flex", flexDirection: "column", alignItems: "center",
            textAlign: "center", padding: "0 28px",
            flex: 1, justifyContent: "center",
          }}>

            {/* Logo */}
            {restaurant.logo && (
              <img src={restaurant.logo} alt={restaurant.name}
                style={{
                  height: 68, objectFit: "contain", marginBottom: 22,
                  filter: "drop-shadow(0 4px 18px rgba(0,0,0,0.7))",
                }} />
            )}

            {/* Restaurant name */}
            <h1 style={{
              fontFamily: "var(--font-cinzel, 'Cinzel', serif)",
              fontSize: "clamp(38px, 10vw, 72px)",
              fontWeight: 900,
              fontStyle: "italic",
              letterSpacing: "0.04em",
              color: "#C5A880",
              lineHeight: 1.05,
              margin: 0,
              textShadow: "0 2px 32px rgba(0,0,0,0.85), 0 0 64px rgba(197,168,128,0.22)",
            }}>
              {restaurant.name}
            </h1>

            {/* Gold ornament divider */}
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              marginTop: 18, marginBottom: 18,
              color: "rgba(197,168,128,0.55)",
            }}>
              <span style={{ display: "block", width: 52, height: 1, background: "rgba(197,168,128,0.4)" }} />
              <span style={{ fontSize: 13, letterSpacing: 3 }}>◆</span>
              <span style={{ display: "block", width: 52, height: 1, background: "rgba(197,168,128,0.4)" }} />
            </div>

            {/* Welcome text or address */}
            {(restaurant.welcomeText || restaurant.address) && (
              <p style={{
                maxWidth: 400, color: "rgba(255,255,255,0.72)",
                fontSize: 15, fontWeight: 300, lineHeight: 1.75,
                marginBottom: 36, whiteSpace: "pre-line",
                fontFamily: "var(--font-rubik, 'Rubik', sans-serif)",
                textShadow: "0 1px 8px rgba(0,0,0,0.7)",
              }}>
                {restaurant.welcomeText || restaurant.address}
              </p>
            )}

            {/* CTA button */}
            <button
              onClick={() => elegantNavigateTo("categories")}
              style={{
                background: "linear-gradient(135deg, #C5A880 0%, #dfc090 50%, #C5A880 100%)",
                color: "#0D0D0D",
                fontWeight: 700,
                fontSize: 17,
                letterSpacing: "0.04em",
                padding: "17px 48px",
                borderRadius: 50,
                border: "none",
                cursor: "pointer",
                boxShadow: "0 8px 32px rgba(197,168,128,0.38), 0 2px 8px rgba(0,0,0,0.5)",
                transition: "transform 150ms, box-shadow 150ms",
                display: "flex", alignItems: "center", gap: 10,
                fontFamily: "var(--font-rubik, 'Rubik', sans-serif)",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.04)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 12px 40px rgba(197,168,128,0.48), 0 2px 8px rgba(0,0,0,0.5)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 32px rgba(197,168,128,0.38), 0 2px 8px rgba(0,0,0,0.5)";
              }}
            >
              <span style={{ fontSize: 20 }}>🍴</span>
              <span>{lang === "he" ? "לתפריט האינטראקטיבי" : lang === "en" ? "View Interactive Menu" : lang === "ru" ? "К меню" : "Voir le menu"}</span>
            </button>
          </div>

          {/* Bottom circular action buttons */}
          <div style={{
            position: "relative", zIndex: 2,
            display: "flex", justifyContent: "center", alignItems: "center",
            gap: 28, paddingBottom: "max(36px, env(safe-area-inset-bottom, 36px))",
            paddingTop: 16,
          }}>

            {/* WhatsApp */}
            {restaurant.phone && (
              <a
                href={`https://wa.me/${restaurant.phone.replace(/\D/g, "")}`}
                target="_blank" rel="noopener noreferrer"
                style={{
                  width: 58, height: 58, borderRadius: "50%",
                  background: "rgba(255,255,255,0.11)",
                  backdropFilter: "blur(10px)",
                  border: "1.5px solid rgba(255,255,255,0.22)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  textDecoration: "none",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.45)",
                  transition: "transform 150ms",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1.12)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1)"; }}
                aria-label="WhatsApp"
              >
                <svg width="27" height="27" viewBox="0 0 24 24" fill="#25D366">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12.004 2C6.477 2 2 6.484 2 12.017c0 1.99.52 3.86 1.428 5.484L2 22l4.619-1.401A9.956 9.956 0 0 0 12.004 22C17.523 22 22 17.516 22 11.983 22 6.478 17.523 2 12.004 2zm0 18.044a8.04 8.04 0 0 1-4.217-1.195l-.302-.18-3.13.95.922-3.046-.197-.312A8.029 8.029 0 0 1 3.972 12c0-4.42 3.602-8.016 8.032-8.016 4.428 0 8.03 3.596 8.03 8.016 0 4.423-3.602 8.044-8.03 8.044z"/>
                </svg>
              </a>
            )}

            {/* Registration / gift — center, gold, larger */}
            {!alreadyRegistered && (
              <button
                onClick={() => {
                  setRegStep("form");
                  setRegOtp(""); setRegError(""); setRegCoupon("");
                  setRegForm({ name: "", phone: "", email: "" });
                  setRegModalOpen(true);
                }}
                style={{
                  width: 66, height: 66, borderRadius: "50%",
                  background: "linear-gradient(135deg, #C5A880, #dfc090)",
                  border: "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: "0 6px 28px rgba(197,168,128,0.5), 0 2px 8px rgba(0,0,0,0.5)",
                  transition: "transform 150ms",
                  position: "relative",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.12)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
                aria-label="הצטרף לקלאב"
              >
                <span style={{
                  position: "absolute", top: 5, right: 5,
                  width: 11, height: 11, borderRadius: "50%",
                  background: "#e53e3e", border: "2px solid #0a0908",
                }} />
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0D0D0D" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 12 20 22 4 22 4 12"/>
                  <rect x="2" y="7" width="20" height="5"/>
                  <line x1="12" y1="22" x2="12" y2="7"/>
                  <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
                  <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
                </svg>
              </button>
            )}

            {/* Phone */}
            {restaurant.phone && (
              <a
                href={`tel:${restaurant.phone}`}
                style={{
                  width: 58, height: 58, borderRadius: "50%",
                  background: "rgba(255,255,255,0.11)",
                  backdropFilter: "blur(10px)",
                  border: "1.5px solid rgba(255,255,255,0.22)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  textDecoration: "none",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.45)",
                  transition: "transform 150ms",
                  color: "#C5A880", fontSize: 22,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1.12)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1)"; }}
                aria-label="התקשר"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C5A880" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
              </a>
            )}
          </div>

        </section>
      )}

      {/* ── CATEGORIES SCREEN ── */}
      {elegantView === "categories" && (
        <section style={{ padding: "32px 20px", maxWidth: 540, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <h2 style={{ fontSize: 28, fontWeight: 300, letterSpacing: "0.05em", marginBottom: 8 }}>
              {lang === "he" ? "התפריט שלנו" : lang === "en" ? "Our Menu" : lang === "ru" ? "Наше меню" : "Notre Menu"}
            </h2>
            <p style={{ color: "#a3a3a3", fontSize: 12, fontWeight: 300 }}>
              {lang === "he" ? "בחרו קטגוריה" : lang === "en" ? "Choose a category" : lang === "ru" ? "Выберите категорию" : "Choisissez une catégorie"}
            </p>
            <div style={{ width: 40, height: 1, background: "rgba(197,168,128,0.4)", margin: "16px auto 0" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {categories.map((cat) => {
              const catQty = cartQtyByCat(cat.id);
              return (
              <div key={cat.id} onClick={() => openCategory(cat)}
                onMouseEnter={e => { (e.currentTarget.querySelector(".cat-bg") as HTMLElement | null)?.style && ((e.currentTarget.querySelector(".cat-bg") as HTMLElement).style.transform = "scale(1.04)"); }}
                onMouseLeave={e => { (e.currentTarget.querySelector(".cat-bg") as HTMLElement | null)?.style && ((e.currentTarget.querySelector(".cat-bg") as HTMLElement).style.transform = "scale(1)"); }}
                style={{
                  position: "relative", height: 140, borderRadius: 18, overflow: "hidden",
                  cursor: "pointer",
                  boxShadow: catQty > 0
                    ? "0 4px 24px rgba(197,168,128,0.22), 0 0 0 1.5px rgba(197,168,128,0.35)"
                    : "0 4px 16px rgba(0,0,0,0.4)",
                  transition: "box-shadow 200ms",
                }}>
                {/* Category background */}
                <div className="cat-bg" style={{
                  position: "absolute", inset: 0,
                  backgroundImage: cat.image
                    ? `linear-gradient(to ${t.dir === "rtl" ? "right" : "left"}, rgba(13,13,13,0.95) 40%, rgba(13,13,13,0.3) 100%), url('${cat.image}')`
                    : `linear-gradient(135deg, #161208 0%, #1e1a10 40%, #141414 100%)`,
                  backgroundSize: "cover", backgroundPosition: "center",
                  transition: "transform 350ms ease",
                }} />
                {/* Text */}
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", flexDirection: "column", justifyContent: "center",
                  padding: "0 24px",
                }}>
                  <h3 style={{ fontSize: 20, fontWeight: 500, color: "#fff", letterSpacing: "0.03em", marginBottom: 4 }}>
                    {getCatName(cat, lang)}
                  </h3>
                  <p style={{ color: "#a3a3a3", fontSize: 12, fontWeight: 300 }}>
                    {cat.items.filter(i => i.isActive !== false).length} {lang === "he" ? "מנות" : lang === "en" ? "dishes" : lang === "ru" ? "блюд" : "plats"}
                  </p>
                </div>
                {/* Arrow */}
                <div style={{
                  position: "absolute", top: "50%", transform: "translateY(-50%)",
                  ...(t.dir === "rtl" ? { left: 20 } : { right: 20 }),
                  color: "rgba(197,168,128,0.6)", fontSize: 18,
                }}>
                  {t.dir === "rtl" ? "‹" : "›"}
                </div>
                {/* Cart qty badge */}
                {catQty > 0 && (
                  <div style={{
                    position: "absolute", top: 12,
                    ...(t.dir === "rtl" ? { left: 12 } : { right: 50 }),
                    minWidth: 24, height: 24, borderRadius: 12,
                    background: "#C5A880", color: "#0D0D0D",
                    fontSize: 12, fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "0 6px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                  }}>
                    {catQty}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── ITEMS SCREEN ── */}
      {elegantView === "items" && selectedCat && (
        <section style={{ padding: "24px 16px", maxWidth: 540, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
            <h2 style={{ fontSize: 24, fontWeight: 300, letterSpacing: "0.03em" }}>{getCatName(selectedCat, lang)}</h2>
            <span style={{ fontSize: 11, background: "#1F1F1F", border: "1px solid rgba(197,168,128,0.2)",
              color: "#C5A880", padding: "5px 12px", borderRadius: 20, fontWeight: 500 }}>
              {selectedCat.items.filter(i => i.isActive !== false).length} {lang === "he" ? "מנות" : lang === "en" ? "dishes" : lang === "ru" ? "блюд" : "plats"}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {selectedCat.items.filter(i => i.isActive !== false).map((item) => {
              const badges = getItemBadges(item, t);
              const qty = cartQtyByItem(item.id);
              const inCart = qty > 0;
              return (
                <div key={item.id} onClick={() => { track("item", item.id, item.name); setModalItem(item); }}
                  style={{
                    position: "relative",
                    background: inCart ? "rgba(197,168,128,0.06)" : "#161616",
                    border: inCart
                      ? "1px solid rgba(197,168,128,0.3)"
                      : "1px solid rgba(255,255,255,0.05)",
                    borderRadius: 18, overflow: "hidden",
                    display: "flex", alignItems: "center", padding: 12,
                    cursor: "pointer", gap: 12,
                    transition: "border-color 200ms, background 200ms",
                  }}>

                  {/* Gold left accent bar when in cart */}
                  {inCart && (
                    <div style={{
                      position: "absolute",
                      top: 0, bottom: 0,
                      ...(t.dir === "rtl" ? { right: 0 } : { left: 0 }),
                      width: 3, borderRadius: "18px 0 0 18px",
                      background: "linear-gradient(to bottom, #C5A880, #a8895e)",
                    }} />
                  )}

                  {/* Text side */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                      <h4 style={{ fontSize: 15, fontWeight: 500, color: inCart ? "#e8d4b4" : "#fff", letterSpacing: "0.02em", margin: 0 }}>
                        {getItemName(item, lang)}
                      </h4>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0, marginRight: 8 }}>
                        <span style={{ color: "#C5A880", fontWeight: 700, fontSize: 14 }}>
                          ₪{item.price}
                        </span>
                        {restaurant.ordersEnabled && (
                          inCart ? (
                            /* ── +/− inline controls ── */
                            <div
                              onClick={e => e.stopPropagation()}
                              style={{ display: "flex", alignItems: "center", gap: 4 }}
                            >
                              <button
                                onClick={e => { e.stopPropagation(); removeOneByItemId(item.id); }}
                                style={{
                                  width: 28, height: 28, borderRadius: "50%",
                                  border: "1.5px solid rgba(197,168,128,0.6)",
                                  background: "none", color: "#C5A880",
                                  fontSize: 18, fontWeight: 700, lineHeight: 1,
                                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                                }}
                              >−</button>
                              <span style={{ color: "#C5A880", fontWeight: 800, fontSize: 14, minWidth: 20, textAlign: "center" }}>
                                {qty}
                              </span>
                              <button
                                onClick={e => { e.stopPropagation(); openAddToCart(item); }}
                                style={{
                                  width: 28, height: 28, borderRadius: "50%",
                                  background: "#C5A880", color: "#0D0D0D",
                                  border: "none", fontSize: 18, fontWeight: 700, lineHeight: 1,
                                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                                }}
                              >+</button>
                            </div>
                          ) : (
                            /* ── Add to cart button ── */
                            <button
                              onClick={e => { e.stopPropagation(); openAddToCart(item); }}
                              style={{
                                width: 30, height: 30, borderRadius: "50%",
                                background: "#C5A880", color: "#0D0D0D",
                                border: "none",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 20, fontWeight: 700, lineHeight: 1,
                                cursor: "pointer", flexShrink: 0,
                              }}
                              title={t.addToCart}
                            >+</button>
                          )
                        )}
                      </div>
                    </div>
                    {getItemDesc(item, lang) && (
                      <p style={{ color: "#a3a3a3", fontSize: 12, fontWeight: 300, lineHeight: 1.5,
                        overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                        margin: 0 } as React.CSSProperties}>
                        {getItemDesc(item, lang)}
                      </p>
                    )}
                    {badges.length > 0 && (
                      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                        {badges.map((b, i) => (
                          <span key={i} style={{ fontSize: 10, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)",
                            color: "#4ade80", padding: "2px 8px", borderRadius: 4, fontWeight: 500 }}>{b}</span>
                        ))}
                      </div>
                    )}
                    {/* Prep time chip */}
                    {item.prepTime != null && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8,
                        fontSize: 10, color: "#6c757d", background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: "2px 8px" }}>
                        ⏱ {item.prepTime}&apos;
                      </div>
                    )}
                  </div>

                  {/* Thumbnail + qty badge */}
                  {item.image && (
                    <div style={{ position: "relative", width: 88, height: 88, borderRadius: 12, overflow: "visible", flexShrink: 0 }}>
                      <div style={{ width: 88, height: 88, borderRadius: 12, overflow: "hidden" }}>
                        <img src={item.image} alt={getItemName(item, lang)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                      {/* Quantity badge — bottom left of thumbnail */}
                      {inCart && (
                        <div style={{
                          position: "absolute", bottom: -6, left: -6,
                          minWidth: 22, height: 22, borderRadius: 11,
                          background: "#C5A880", color: "#0D0D0D",
                          fontSize: 11, fontWeight: 900,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          padding: "0 5px",
                          border: "2px solid #161616",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
                        }}>
                          {qty}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Qty badge when NO image */}
                  {!item.image && inCart && (
                    <div style={{
                      position: "absolute", bottom: 10, left: 10,
                      minWidth: 22, height: 22, borderRadius: 11,
                      background: "#C5A880", color: "#0D0D0D",
                      fontSize: 11, fontWeight: 900,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      padding: "0 5px",
                      border: "2px solid #161616",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
                    }}>
                      {qty}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Cart floating button (if ordersEnabled) ── */}
      {restaurant.ordersEnabled && cart.length > 0 && (
        <button onClick={() => setCartOpen(true)} style={{
          position: "fixed", bottom: alreadyRegistered ? 24 : 100, right: 20, zIndex: 50,
          background: "#C5A880", color: "#0D0D0D",
          border: "none", borderRadius: 50, padding: "12px 20px",
          fontWeight: 700, fontSize: 14, cursor: "pointer",
          boxShadow: "0 4px 20px rgba(197,168,128,0.3)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          🛒 {t.cart} ({cart.reduce((s,c) => s + c.quantity, 0)}) — ₪{cart.reduce((s,c) => s + c.price * c.quantity, 0).toFixed(0)}
        </button>
      )}

      {/* My orders button — only when table number is known */}
      {restaurant.ordersEnabled && tableNumber && (
        <button
          onClick={() => { setMyOrdersOpen(true); fetchMyOrders(); }}
          style={{
            position: "fixed",
            bottom: cartCount > 0 ? 144 : 80,
            right: 16,
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "#161616",
            color: "#C5A880",
            border: "2px solid #C5A880",
            cursor: "pointer",
            fontSize: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            zIndex: 40,
          }}
          aria-label={t.myOrders}
          title={t.myOrders}
        >
          📋
        </button>
      )}

      {/* ── Floating gift button (coupon registration) ── */}
      {!alreadyRegistered && elegantView !== "landing" && (
        <button onClick={() => { setRegModalOpen(true); setRegStep("form"); setRegOtp(""); setRegError(""); setRegCoupon(""); setRegForm({ name: "", phone: "", email: "" }); }}
          style={{
            position: "fixed", bottom: 24, left: 16, zIndex: 60,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            padding: "12px 16px 10px", borderRadius: 18,
            background: "#C5A880", color: "#0D0D0D",
            border: "none", fontWeight: 700, fontSize: 11,
            cursor: "pointer", boxShadow: "0 6px 28px rgba(197,168,128,0.35)",
            maxWidth: 130, textAlign: "center", lineHeight: 1.35,
          }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 12 20 22 4 22 4 12"/>
            <rect x="2" y="7" width="20" height="5"/>
            <line x1="12" y1="22" x2="12" y2="7"/>
            <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
            <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
          </svg>
          {t.floatingBtn}
        </button>
      )}

      {/* ── Item Modal (slides up) ── */}
      {modalItem && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50,
          background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) setModalItem(null); }}>
          <div style={{
            width: "100%", maxWidth: 540, background: "#161616",
            borderRadius: "24px 24px 0 0", border: "1px solid rgba(255,255,255,0.08)",
            maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column",
            direction: t.dir, position: "relative",
          }}>
            {/* Drag handle */}
            <div onClick={() => setModalItem(null)} style={{ width: 48, height: 4, background: "rgba(255,255,255,0.2)", borderRadius: 2, margin: "12px auto", cursor: "pointer" }} />
            {/* Close button */}
            <button onClick={() => setModalItem(null)} style={{
              position: "absolute", top: 16, ...(t.dir === "rtl" ? { left: 16 } : { right: 16 }),
              background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.15)",
              color: "#fff", width: 36, height: 36, borderRadius: "50%",
              cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
            }}>×</button>

            {modalItem.image && (
              <img
                src={modalItem.image}
                alt={getItemName(modalItem, lang)}
                style={{ width: "100%", height: 220, objectFit: "cover" }}
              />
            )}

            <div style={{ padding: "20px 24px", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: 20, fontWeight: 500, color: "#fff", margin: 0, marginBottom: 8 }}>
                    {getItemName(modalItem, lang)}
                  </h3>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {getItemBadges(modalItem, t).map((b, i) => (
                      <span key={i} style={{ fontSize: 11, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)",
                        color: "#4ade80", padding: "3px 10px", borderRadius: 4 }}>{b}</span>
                    ))}
                  </div>
                </div>
                <span style={{ fontSize: 20, fontWeight: 700, color: "#C5A880", flexShrink: 0 }}>₪{modalItem.price}</span>
              </div>

              {getItemDesc(modalItem, lang) && (
                <p style={{ color: "#d4d4d4", fontSize: 14, lineHeight: 1.7, fontWeight: 300, marginBottom: 20 }}>
                  {getItemDesc(modalItem, lang)}
                </p>
              )}

              {/* Add to cart button (if orders enabled) */}
              {restaurant.ordersEnabled && (
                <button onClick={() => { openAddToCart(modalItem); setModalItem(null); }} style={{
                  width: "100%", background: "#C5A880", color: "#0D0D0D",
                  border: "none", borderRadius: 14, padding: "14px", fontWeight: 600,
                  fontSize: 15, cursor: "pointer", marginBottom: 8,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                  + {t.addToCart}
                </button>
              )}

              <button onClick={() => setModalItem(null)} style={{
                width: "100%", background: "none",
                border: "1px solid rgba(255,255,255,0.1)", color: "#a3a3a3",
                borderRadius: 14, padding: "12px", cursor: "pointer", fontSize: 14,
              }}>
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cart drawer ── */}
      {cartOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
          <div
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }}
            onClick={() => setCartOpen(false)}
          />
          <div style={{
            position: "absolute", top: 0, bottom: 0, left: 0,
            width: "min(360px, 100vw)",
            background: "#161616",
            borderRight: "1px solid rgba(255,255,255,0.08)",
            display: "flex", flexDirection: "column", zIndex: 51,
            overflow: "hidden",  // needed so inner overlay is clipped to the panel
          }}>
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}>
              <span style={{ color: "#C5A880", fontWeight: 700, fontSize: 18 }}>{t.cart}</span>
              <button onClick={() => setCartOpen(false)} style={{
                background: "none", border: "none", color: "#fff",
                fontSize: 20, cursor: "pointer", opacity: 0.7, lineHeight: 1,
              }}>✕</button>
            </div>

            {/* Table + guest */}
            {tableNumber && (
              <div style={{
                padding: "8px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)",
                fontSize: 13, color: "#fff", opacity: 0.8,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span>{t.tableLabel}: <strong style={{ color: "#C5A880" }}>{tableNumber}</strong></span>
                {guestIdentity && (
                  <span style={{ fontSize: 12, color: "#C5A880" }}>👤 {guestIdentity.name}</span>
                )}
              </div>
            )}

            {/* Items */}
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
              {cart.length === 0 ? (
                <div style={{ textAlign: "center", opacity: 0.4, marginTop: 40, color: "#fff" }}>הסל ריק</div>
              ) : (
                cart.map(c => (
                  <div key={c.cartId} style={{
                    margin: "8px 0", padding: "12px 12px 10px", borderRadius: 12,
                    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: "#fff", fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{c.name}</div>
                        <div style={{ color: "#C5A880", fontSize: 12, marginTop: 1 }}>₪{c.price} ליחידה</div>
                        {c.notes && (
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 3, fontStyle: "italic",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            💬 {c.notes}
                          </div>
                        )}
                      </div>
                      {/* Note edit icon */}
                      <button
                        onClick={() => { setEditNoteCartId(c.cartId); setEditNoteValue(c.notes ?? ""); }}
                        title="הוסף הערה"
                        style={{
                          width: 28, height: 28, borderRadius: "50%", border: "none",
                          background: c.notes ? "rgba(197,168,128,0.2)" : "rgba(255,255,255,0.06)",
                          color: c.notes ? "#C5A880" : "rgba(255,255,255,0.3)",
                          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0, fontSize: 13, transition: "all .15s",
                        }}>
                        ✏️
                      </button>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <button onClick={() => updateQty(c.cartId, -1)} style={{
                          width: 26, height: 26, borderRadius: "50%",
                          border: "1px solid rgba(255,255,255,0.15)", background: "none",
                          color: "#fff", cursor: "pointer", fontSize: 15,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>−</button>
                        <span style={{ color: "#fff", fontSize: 13, minWidth: 18, textAlign: "center", fontWeight: 600 }}>{c.quantity}</span>
                        <button onClick={() => updateQty(c.cartId, 1)} style={{
                          width: 26, height: 26, borderRadius: "50%",
                          border: "1px solid #C5A880", background: "none",
                          color: "#C5A880", cursor: "pointer", fontSize: 15,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>+</button>
                      </div>
                      <div style={{ color: "#fff", fontSize: 13, fontWeight: 700, minWidth: 44, textAlign: "left" }}>
                        ₪{c.price * c.quantity}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* ── Note edit mini-modal ── */}
            {editNoteCartId && (() => {
              const editingItem = cart.find(c => c.cartId === editNoteCartId);
              return (
              <div style={{
                position: "absolute", inset: 0, zIndex: 10,
                background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
                display: "flex", alignItems: "flex-end",
              }} onClick={() => setEditNoteCartId(null)}>
                <div style={{
                  width: "100%", background: "#1a1612", borderRadius: "18px 18px 0 0",
                  padding: "20px 20px 28px", boxShadow: "0 -8px 32px rgba(0,0,0,0.4)",
                }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>
                      <span style={{ color: "rgba(255,255,255,0.6)" }}>הוסף הערה ל- </span>
                      <span style={{ color: "#C5A880" }}>{editingItem?.name}</span>
                    </span>
                    <button onClick={() => setEditNoteCartId(null)}
                      style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 20, cursor: "pointer" }}>✕</button>
                  </div>
                  <textarea
                    autoFocus
                    rows={3}
                    value={editNoteValue}
                    onChange={e => setEditNoteValue(e.target.value)}
                    placeholder={t.notePlaceholder || "ללא בצל, בצד, אלרגיה..."}
                    style={{
                      width: "100%", background: "rgba(255,255,255,0.07)",
                      border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10,
                      color: "#fff", fontSize: 14, padding: "10px 12px", outline: "none",
                      resize: "none", fontFamily: "inherit", boxSizing: "border-box",
                    }}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    {editNoteValue && (
                      <button onClick={() => { updateNotes(editNoteCartId, ""); setEditNoteCartId(null); }}
                        style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)",
                          background: "none", color: "rgba(255,255,255,0.45)", fontSize: 13, cursor: "pointer" }}>
                        🗑 נקה
                      </button>
                    )}
                    <button onClick={() => { updateNotes(editNoteCartId, editNoteValue.trim()); setEditNoteCartId(null); }}
                      style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none",
                        background: "#C5A880", color: "#0D0D0D", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                      אישור
                    </button>
                  </div>
                </div>
              </div>
            );})()}

            {/* Footer */}
            <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{
                display: "flex", justifyContent: "space-between", marginBottom: 14,
                color: "#fff", fontSize: 16, fontWeight: 700,
              }}>
                <span>סה&quot;כ</span>
                <span style={{ color: "#C5A880" }}>₪{cartTotal}</span>
              </div>
              {orderError && (
                <div style={{ color: "#e53e3e", fontSize: 13, marginBottom: 8, textAlign: "center" }}>{orderError}</div>
              )}
              <button
                onClick={handleOrder}
                disabled={orderLoading || cart.length === 0}
                style={{
                  width: "100%", padding: "12px 0", background: "#C5A880", color: "#0D0D0D",
                  border: "none", borderRadius: 10, fontWeight: 700, fontSize: 16,
                  cursor: cart.length === 0 || orderLoading ? "not-allowed" : "pointer",
                  opacity: cart.length === 0 || orderLoading ? 0.5 : 1,
                }}
              >
                {orderLoading ? t.sending : t.sendOrder}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Guest Registration Modal ── */}
      {showRegistration && tableNumber && restaurant.ordersEnabled && (
        <div style={{ position: "fixed", inset: 0, zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)" }} />
          <GuestRegistrationModal onSave={saveGuestIdentity} restaurantName={restaurant.name} tableNumber={tableNumber} t={t} />
        </div>
      )}

      {/* ── My orders panel ── */}
      {myOrdersOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
          <div
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }}
            onClick={() => { setMyOrdersOpen(false); setBillMode(null); }}
          />
          <div style={{
            position: "absolute", top: 0, bottom: 0, left: 0,
            width: "min(380px, 100vw)",
            background: "#161616",
            borderRight: "1px solid rgba(255,255,255,0.08)",
            display: "flex", flexDirection: "column", zIndex: 51,
          }}>
            <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "16px 20px 12px",
              }}>
                <div>
                  <span style={{ color: "#C5A880", fontWeight: 700, fontSize: 18 }}>📋 {t.myOrders}</span>
                  {tableNumber && (
                    <div style={{ fontSize: 12, color: "#fff", opacity: 0.55, marginTop: 2 }}>
                      {t.tableLabel} <strong style={{ color: "#C5A880" }}>{tableNumber}</strong>
                      {guestIdentity && <span style={{ marginRight: 6, color: "#C5A880", opacity: 0.8 }}>• {guestIdentity.name}</span>}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => fetchMyOrders(false)}
                    style={{ background: "none", border: "none", color: "#C5A880", cursor: "pointer", fontSize: 18 }}
                    title="רענן"
                  >🔄</button>
                  <button
                    onClick={() => { setMyOrdersOpen(false); setBillMode(null); }}
                    style={{ background: "none", border: "none", color: "#fff", fontSize: 20, cursor: "pointer", opacity: 0.7 }}
                  >✕</button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, padding: "0 20px 12px" }}>
                {(["mine", "all"] as const).map(v => (
                  <button key={v} onClick={() => {
                    setOrdersView(v);
                    fetchMyOrders(false, v);
                  }} style={{
                    flex: 1, padding: "6px 0", borderRadius: 8, fontSize: 13, fontWeight: 600,
                    cursor: "pointer", transition: "all 0.15s",
                    border: ordersView === v ? "1.5px solid #C5A880" : "1.5px solid rgba(255,255,255,0.1)",
                    background: ordersView === v ? "#C5A880" : "transparent",
                    color: ordersView === v ? "#0D0D0D" : "#fff",
                  }}>
                    {v === "mine" ? t.myOrders : t.allOrders}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
              {myOrdersLoading ? (
                <div style={{ textAlign: "center", color: "#fff", opacity: 0.4, marginTop: 40 }}>{t.loading}</div>
              ) : myOrders.length === 0 ? (
                <div style={{ textAlign: "center", color: "#fff", opacity: 0.4, marginTop: 60 }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🍽</div>
                  <div>{t.noOrders}</div>
                </div>
              ) : (
                myOrders.map(order => {
                  const statusColor = STATUS_COLOR[order.status] ?? "#999";
                  const statusLabel = STATUS_LABEL[order.status] ?? order.status;
                  return (
                    <div key={order.id} style={{
                      marginBottom: 14, borderRadius: 12, overflow: "hidden",
                      border: `1.5px solid ${statusColor}44`,
                      background: `${statusColor}0a`,
                    }}>
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "8px 14px",
                        background: `${statusColor}18`,
                        borderBottom: `1px solid ${statusColor}33`,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: statusColor }}>{statusLabel}</span>
                          {ordersView === "all" && order.customerName && (
                            <span style={{ fontSize: 11, color: "#C5A880", fontWeight: 600 }}>👤 {order.customerName}</span>
                          )}
                        </div>
                        <span style={{ fontSize: 12, color: "#fff", opacity: 0.5 }}>₪{order.totalAmount.toFixed(0)}</span>
                      </div>
                      <div style={{ padding: "10px 14px" }}>
                        {order.items.map(oi => {
                          const iColor = ITEM_STATUS_COLOR[oi.itemStatus] ?? statusColor;
                          const iLabel = ITEM_STATUS_LABEL[oi.itemStatus];
                          return (
                            <div key={oi.id} style={{
                              display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
                              padding: "6px 8px", borderRadius: 8,
                              background: oi.itemStatus === "DONE" ? "rgba(74,222,128,0.06)" : "rgba(255,255,255,0.03)",
                            }}>
                              <span style={{
                                width: 20, height: 20, borderRadius: "50%", fontSize: 11, fontWeight: 700,
                                background: iColor, color: "#000",
                                display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                              }}>{oi.quantity}</span>
                              <div style={{ flex: 1 }}>
                                <span style={{
                                  fontSize: 13, color: "#fff",
                                  textDecoration: oi.itemStatus === "DONE" ? "line-through" : "none",
                                  opacity: oi.itemStatus === "DONE" ? 0.5 : 1,
                                }}>{oi.item.name}</span>
                                {oi.notes && (
                                  <div style={{ fontSize: 11, color: "#fff", opacity: 0.45, fontStyle: "italic" }}>{oi.notes}</div>
                                )}
                              </div>
                              <span style={{
                                fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 20,
                                background: iColor + "22", color: iColor, whiteSpace: "nowrap",
                              }}>{iLabel}</span>
                            </div>
                          );
                        })}
                        {order.notes && (
                          <div style={{
                            marginTop: 6, fontSize: 12, color: "#fff", opacity: 0.5,
                            fontStyle: "italic", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 6,
                          }}>
                            💬 {order.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {myOrders.length > 0 && !billMode && (
              <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
                <div style={{ fontSize: 12, color: "#fff", opacity: 0.5, textAlign: "center", marginBottom: 8 }}>
                  {t.requestBill}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setBillMode("mine")} style={{
                    flex: 1, padding: "9px 0", borderRadius: 9, fontSize: 13, fontWeight: 600,
                    border: "1.5px solid #C5A880", background: "transparent",
                    color: "#C5A880", cursor: "pointer",
                  }}>💳 {t.myBill}</button>
                  <button onClick={() => { setOrdersView("all"); fetchMyOrders(false, "all"); setBillMode("all"); }} style={{
                    flex: 1, padding: "9px 0", borderRadius: 9, fontSize: 13, fontWeight: 600,
                    border: "1.5px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)",
                    color: "#fff", cursor: "pointer",
                  }}>🧾 {t.allBill}</button>
                </div>
              </div>
            )}

            {billMode && (
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: "16px", flexShrink: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ color: "#C5A880", fontWeight: 700, fontSize: 15 }}>
                    🧾 {billMode === "mine" ? t.myBill : t.allBill}
                  </span>
                  <button onClick={() => setBillMode(null)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", opacity: 0.6 }}>✕</button>
                </div>
                <div style={{ fontSize: 12, marginBottom: 10 }}>
                  {myOrders.flatMap(o => o.items).map((oi, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, color: "#fff" }}>
                      <span>{oi.quantity > 1 ? `×${oi.quantity} ` : ""}{oi.item.name}</span>
                      <span>₪{(oi.price * oi.quantity).toFixed(0)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15, color: "#C5A880", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 8, marginBottom: 12 }}>
                  <span>סה&quot;כ</span>
                  <span>₪{myOrders.reduce((s, o) => s + o.totalAmount, 0).toFixed(0)}</span>
                </div>
                <div style={{ textAlign: "center", fontSize: 12, color: "#fff", opacity: 0.5, padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  📱 הצג חשבון זה לצוות המסעדה לתשלום
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Order success overlay ── */}
      {orderSuccess && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 60,
          background: "#0D0D0D",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20,
        }}>
          <div style={{ fontSize: 64 }}>✅</div>
          <div style={{ color: "#C5A880", fontSize: 28, fontWeight: 700, textAlign: "center" }}>{t.orderSent}</div>
          {tableNumber && (
            <div style={{ color: "#fff", fontSize: 18, opacity: 0.8 }}>{t.tableLabel} {tableNumber}</div>
          )}
          <button onClick={() => setOrderSuccess(false)} style={{
            marginTop: 12, padding: "10px 32px",
            background: "#C5A880", color: "#0D0D0D",
            border: "none", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer",
          }}>
            {t.close}
          </button>
        </div>
      )}

      {/* ── Modifier selection modal ── */}
      {modifierItem && modifierGroups.length > 0 && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) { setModifierItem(null); setModifierGroups([]); setSelectedModifiers({}); } }}
        >
          <div style={{
            background: "#161616", borderRadius: 20, width: "min(480px, 94vw)", maxHeight: "85vh",
            display: "flex", flexDirection: "column", overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.1)",
          }}>
            <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ color: "#C5A880", fontWeight: 700, fontSize: 17 }}>{modifierItem.name}</div>
                <div style={{ color: "#fff", opacity: 0.55, fontSize: 13 }}>בחר אפשרויות</div>
              </div>
              <button
                onClick={() => { setModifierItem(null); setModifierGroups([]); setSelectedModifiers({}); }}
                style={{ background: "none", border: "none", color: "#fff", fontSize: 20, cursor: "pointer", opacity: 0.7 }}
              >✕</button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
              {modifierGroupsLoading ? (
                <div style={{ textAlign: "center", color: "#fff", opacity: 0.4 }}>{t.loading}</div>
              ) : modifierGroups.map(grp => (
                <div key={grp.id} style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{grp.name}</span>
                    {grp.required && (
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: "#7f1d1d", color: "#fca5a5", fontWeight: 600 }}>חובה</span>
                    )}
                    {grp.maxSelect > 1 && (
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: "rgba(255,255,255,0.08)", color: "#fff", opacity: 0.6 }}>
                        עד {grp.maxSelect}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {grp.options.map(opt => {
                      const isSelected = (selectedModifiers[grp.id] ?? []).includes(opt.label);
                      return (
                        <button
                          key={opt.id}
                          onClick={() => toggleModifierOption(grp, opt.label)}
                          style={{
                            padding: "8px 14px", borderRadius: 20,
                            border: isSelected ? "2px solid #C5A880" : "1.5px solid rgba(255,255,255,0.15)",
                            background: isSelected ? "#C5A880" : "rgba(255,255,255,0.05)",
                            color: isSelected ? "#0D0D0D" : "#fff",
                            fontWeight: isSelected ? 700 : 400, fontSize: 14,
                            cursor: "pointer", transition: "all 0.15s",
                          }}
                        >
                          {opt.label}
                          {opt.priceAdd > 0 && (
                            <span style={{ fontSize: 12, opacity: isSelected ? 0.75 : 0.55, marginRight: 4 }}> +₪{opt.priceAdd}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: "14px 20px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              {(() => {
                const priceAdd = modifierGroups.flatMap(g =>
                  (selectedModifiers[g.id] ?? []).map(label => {
                    const opt = g.options.find(o => o.label === label);
                    return opt?.priceAdd ?? 0;
                  })
                ).reduce((s, v) => s + v, 0);
                const totalPrice = modifierItem.price + priceAdd;
                return (
                  <button
                    onClick={confirmModifiers}
                    disabled={!isModifierValid()}
                    style={{
                      width: "100%", padding: "9px 16px",
                      background: "#C5A880", color: "#0D0D0D",
                      border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14,
                      cursor: isModifierValid() ? "pointer" : "not-allowed",
                      opacity: isModifierValid() ? 1 : 0.45,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    }}
                  >
                    <span>{t.addToCart}</span>
                    <span style={{ fontFamily: "var(--font-cinzel, 'Cinzel', serif)", fontSize: 17, fontWeight: 600, letterSpacing: "0.02em" }}>₪{totalPrice}</span>
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Registration modal (3 steps) ── */}
      {regModalOpen && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 70,
            background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
          onClick={e => { if (e.target === e.currentTarget && regStep !== "done") setRegModalOpen(false); }}
        >
          <div style={{
            position: "relative", zIndex: 71,
            background: "#1c1c1c", borderRadius: 18, padding: "28px 24px",
            width: "min(360px, 92vw)",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.6)", direction: "rtl",
          }}>
            {regStep !== "done" && (
              <button
                onClick={() => setRegModalOpen(false)}
                style={{
                  position: "absolute", top: 14, left: 14,
                  background: "rgba(255,255,255,0.08)", border: "none",
                  borderRadius: 8, width: 28, height: 28,
                  cursor: "pointer", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, fontWeight: 700,
                }}
              >×</button>
            )}

            {/* STEP 1: form */}
            {regStep === "form" && (
              <>
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <div style={{ fontSize: 36, marginBottom: 6 }}>🎁</div>
                  <div style={{ color: "#C5A880", fontWeight: 700, fontSize: 18, marginBottom: 6, lineHeight: 1.3 }}>{t.get5Percent}</div>
                  <div style={{ color: "#fff", opacity: 0.6, fontSize: 13, marginBottom: 2 }}>{t.registerGetCoupon}</div>
                  <div style={{ color: "#fff", opacity: 0.45, fontSize: 12 }}>{restaurant.name}</div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 11, color: "#fff", opacity: 0.55, marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{t.nameField}</label>
                  <input type="text" value={regForm.name} onChange={e => setRegForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="ישראל ישראלי" autoFocus
                    onKeyDown={e => { if (e.key === "Enter") handleRegisterSubmit(); }}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 10, fontSize: 14,
                      background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)",
                      color: "#fff", outline: "none", boxSizing: "border-box" }} />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 11, color: "#fff", opacity: 0.55, marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{t.phoneField}</label>
                  <input type="tel" value={regForm.phone} onChange={e => setRegForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="050-0000000" dir="ltr"
                    onKeyDown={e => { if (e.key === "Enter") handleRegisterSubmit(); }}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 10, fontSize: 14,
                      background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)",
                      color: "#fff", outline: "none", boxSizing: "border-box", textAlign: "right" }} />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 11, color: "#fff", opacity: 0.55, marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{t.emailField}</label>
                  <input type="email" value={regForm.email} onChange={e => setRegForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="email@example.com" dir="ltr"
                    onKeyDown={e => { if (e.key === "Enter") handleRegisterSubmit(); }}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 10, fontSize: 14,
                      background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)",
                      color: "#fff", outline: "none", boxSizing: "border-box", textAlign: "right" }} />
                </div>

                {regError && (
                  <div style={{ background: "rgba(239,68,68,0.15)", color: "#fca5a5", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 14 }}>{regError}</div>
                )}
                <button onClick={handleRegisterSubmit} disabled={regLoading}
                  style={{ width: "100%", padding: "11px 16px", borderRadius: 50,
                    background: "#C5A880", color: "#0D0D0D",
                    border: "none", fontWeight: 700, fontSize: 14,
                    cursor: regLoading ? "not-allowed" : "pointer",
                    opacity: regLoading ? 0.55 : 1, transition: "opacity 150ms" }}>
                  {regLoading ? t.sending : t.registerBtn}
                </button>
              </>
            )}

            {/* STEP 2: OTP */}
            {regStep === "otp" && (
              <>
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📧</div>
                  <div style={{ color: "#C5A880", fontWeight: 700, fontSize: 18, marginBottom: 8 }}>{t.otpSentTitle}</div>
                  <div style={{ color: "#fff", opacity: 0.65, fontSize: 13, lineHeight: 1.5 }}>
                    {t.otpSentSub}<br />
                    <span style={{ fontWeight: 600, opacity: 1, direction: "ltr", display: "inline-block" }}>{regForm.email}</span>
                  </div>
                  <div style={{ color: "#fff", opacity: 0.4, fontSize: 12, marginTop: 6 }}>{t.otpValidFor}</div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 11, color: "#fff", opacity: 0.55, marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{t.otpCode}</label>
                  <input type="text" inputMode="numeric" value={regOtp} onChange={e => setRegOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="• • • • • •" autoFocus maxLength={6}
                    onKeyDown={e => { if (e.key === "Enter") handleVerifyOtp(); }}
                    style={{ width: "100%", padding: "14px 12px", borderRadius: 10, fontSize: 22,
                      background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)",
                      color: "#C5A880", outline: "none", boxSizing: "border-box",
                      textAlign: "center", letterSpacing: 8, fontWeight: 700 }} />
                </div>

                {regError && (
                  <div style={{ background: "rgba(239,68,68,0.15)", color: "#fca5a5", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 14 }}>{regError}</div>
                )}
                <button onClick={handleVerifyOtp} disabled={regLoading || regOtp.length < 6}
                  style={{ width: "100%", padding: "11px 16px", borderRadius: 50,
                    background: "#C5A880", color: "#0D0D0D",
                    border: "none", fontWeight: 700, fontSize: 14,
                    cursor: regLoading || regOtp.length < 6 ? "not-allowed" : "pointer",
                    opacity: regLoading || regOtp.length < 6 ? 0.55 : 1, transition: "opacity 150ms" }}>
                  {regLoading ? t.verifying : t.verifyBtn}
                </button>
                <button onClick={() => { setRegStep("form"); setRegError(""); }}
                  style={{ width: "100%", marginTop: 10, padding: "8px", background: "none", border: "none",
                    color: "#fff", opacity: 0.45, fontSize: 12, cursor: "pointer" }}>
                  {t.backToForm}
                </button>
              </>
            )}

            {/* STEP 3: coupon */}
            {regStep === "done" && (
              <div style={{ textAlign: "center", padding: "12px 0" }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>🎉</div>
                <div style={{ color: "#C5A880", fontWeight: 700, fontSize: 20, marginBottom: 8 }}>{t.couponTitle}</div>
                <div style={{ color: "#fff", opacity: 0.65, fontSize: 14, marginBottom: 20 }}>{t.couponSub}</div>
                <div style={{
                  background: "rgba(197,168,128,0.12)", border: "2px dashed #C5A880",
                  borderRadius: 14, padding: "18px 24px", marginBottom: 24,
                }}>
                  <div style={{ fontSize: 11, color: "#C5A880", fontWeight: 600, letterSpacing: "0.08em", marginBottom: 8, opacity: 0.7 }}>קוד קופון</div>
                  <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: 4, color: "#C5A880", fontFamily: "'Courier New', monospace" }}>
                    {regCoupon}
                  </div>
                  <div style={{ fontSize: 12, color: "#fff", opacity: 0.45, marginTop: 8 }}>{t.couponNote}</div>
                </div>
                <button onClick={() => setRegModalOpen(false)}
                  style={{ padding: "11px 36px", borderRadius: 50,
                    background: "#C5A880", color: "#0D0D0D",
                    border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                  {t.closeThanks}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
