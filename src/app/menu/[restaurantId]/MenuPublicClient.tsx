"use client";

import { useState, useEffect, useCallback } from "react";
import "./menu.css";
import { buildPaletteStyle } from "@/lib/menuPalettes";
import { getT, getItemName, getItemDesc, getCatName, type Translations, type Lang } from "@/lib/translations";

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
      background: "var(--bg-card, #1c1c1c)", borderRadius: 16,
      padding: "28px 24px", width: "min(340px, 90vw)",
      border: "1px solid var(--border)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>👋</div>
      <div style={{ color: "var(--gold)", fontWeight: 700, fontSize: 20, marginBottom: 4 }}>{t.welcome}</div>
      <div style={{ color: "var(--text)", opacity: 0.6, fontSize: 14, marginBottom: 20 }}>
        {restaurantName} • {t.tableLabel} {tableNumber}
      </div>
      <div style={{ textAlign: t.dir === "rtl" ? "right" : "left", marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 12, color: "var(--text)", opacity: 0.6, marginBottom: 4 }}>{t.fullName}</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="ישראל ישראלי"
          autoFocus
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 9, fontSize: 15,
            background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)",
            color: "var(--text)", outline: "none", boxSizing: "border-box",
          }}
        />
      </div>
      <div style={{ textAlign: t.dir === "rtl" ? "right" : "left", marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 12, color: "var(--text)", opacity: 0.6, marginBottom: 4 }}>{t.phoneNumber}</label>
        <input
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="050-0000000"
          inputMode="numeric"
          dir="ltr"
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 9, fontSize: 15,
            background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)",
            color: "var(--text)", outline: "none", boxSizing: "border-box",
          }}
          onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }}
        />
      </div>
      {error && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <button
        onClick={handleSubmit}
        style={{
          width: "100%", padding: "12px 0", borderRadius: 10,
          background: "var(--gold)", color: "var(--bg)",
          border: "none", fontWeight: 700, fontSize: 16, cursor: "pointer",
        }}
      >
        {t.enter}
      </button>
      <div style={{ fontSize: 11, color: "var(--text)", opacity: 0.35, marginTop: 12 }}>
        הפרטים משמשים לזיהוי הזמנתך בלבד
      </div>
    </div>
  );
}

export default function MenuPublicClient({
  restaurant,
  tableNumber,
  openStatus,
}: {
  restaurant: Restaurant;
  tableNumber?: string | null;
  openStatus?: { open: boolean; label: string };
}) {
  const [showSplash, setShowSplash] = useState(true);
  const [splashFading, setSplashFading] = useState(false);

  const [view, setView] = useState<"home" | "category">("home");
  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  const [modalItem, setModalItem] = useState<Item | null>(null);
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState("");

  // Modifier modal state
  const [modifierItem, setModifierItem] = useState<Item | null>(null);
  const [modifierGroups, setModifierGroups] = useState<ModGroup[]>([]);
  const [modifierGroupsLoading, setModifierGroupsLoading] = useState(false);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({}); // groupId -> selected option labels

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
  // step: "form" | "otp" | "done"
  const [regStep,           setRegStep]           = useState<"form" | "otp" | "done">("form");
  const [regPendingId,      setRegPendingId]      = useState("");
  const [regOtp,            setRegOtp]            = useState("");
  const [regCoupon,         setRegCoupon]         = useState("");
  const [regError,          setRegError]          = useState("");
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  // Language state — user-selected, persisted in localStorage
  const [lang, setLang] = useState<Lang>((restaurant.language as Lang) ?? "he");

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
      // First time visiting this restaurant's menu → auto-open after 1.5 s
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
    // Silently register as Customer (name+phone only, no OTP)
    fetch(`/api/menu/${restaurant.id}/register-guest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: identity.name, phone: identity.phone }),
      keepalive: true,
    }).catch(() => {});
    // Immediately fetch my orders with new identity
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

  const theme = restaurant.menuTheme ?? 'luxury';
  const categories = restaurant.menus.flatMap(m => m.categories);

  const paletteStyle = buildPaletteStyle(
    restaurant.menuTheme ?? 'luxury',
    restaurant.menuPalette ?? '0',
    restaurant.menuPaletteData
  );

  function track(type: string, refId?: string, refName?: string) {
    fetch(`/api/menu/${restaurant.id}/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, refId, refName }),
      keepalive: true,
    }).catch(() => {});
  }

  useEffect(() => { track("page"); }, []);

  function dismissSplash() {
    setSplashFading(true);
    setTimeout(() => setShowSplash(false), 520);
  }

  function openCategory(cat: Category) {
    track("category", cat.id, cat.name);
    setSelectedCat(cat);
    setView("category");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goHome() {
    setView("home");
    setSelectedCat(null);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (zoomSrc) setZoomSrc(null);
      else if (modalItem) setModalItem(null);
      else if (cartOpen) setCartOpen(false);
      else if (myOrdersOpen) setMyOrdersOpen(false);
      else if (view === "category") goHome();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [zoomSrc, modalItem, view, cartOpen, myOrdersOpen]);

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
        // No modifier groups — add directly
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

  function addToCart(item: Item) {
    openAddToCart(item);
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
        // Single-select: replace
        return { ...prev, [grp.id]: cur.includes(label) ? [] : [label] };
      } else {
        // Multi-select
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

  function removeFromCart(cartId: string) {
    setCart(prev => prev.filter(c => c.cartId !== cartId));
  }

  function updateNotes(cartId: string, notes: string) {
    setCart(prev => prev.map(c => c.cartId === cartId ? { ...c, notes } : c));
  }

  function updatePerson(cartId: string, person: number | undefined) {
    setCart(prev => prev.map(c => c.cartId === cartId ? { ...c, person } : c));
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
      // Mark as registered in localStorage — hide button permanently
      try { localStorage.setItem(`menu4u_customer_registered_${restaurant.id}`, "1"); } catch { /* ignore */ }
      setAlreadyRegistered(true);
      setRegCoupon(data.couponCode ?? "");
      setRegStep("done");
    } finally {
      setRegLoading(false);
    }
  }

  // Collect up to 3 images for splash collage
  const splashImages: string[] = [];
  for (const cat of categories) {
    if (cat.image) splashImages.push(cat.image);
    else if (cat.items[0]?.image) splashImages.push(cat.items[0].image);
    if (splashImages.length >= 3) break;
  }
  // Pad to 3 with repeats if needed
  if (splashImages.length === 1) { splashImages.push(splashImages[0], splashImages[0]); }
  else if (splashImages.length === 2) { splashImages.push(splashImages[0]); }

  return (
    <div className={`menu-root menu-theme-${restaurant.menuTheme ?? 'luxury'}`} style={paletteStyle as React.CSSProperties}>

      {/* ── Splash Screen ── */}
      {showSplash && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#0d0c0b",
            transition: splashFading ? "opacity 520ms ease, transform 520ms ease" : "none",
            opacity: splashFading ? 0 : 1,
            transform: splashFading ? "scale(1.04)" : "scale(1)",
            overflow: "hidden",
          }}
        >
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
          ) : splashImages.length > 0 ? (
            /* ── Auto 3-panel collage ── */
            <div
              style={{
                position: "absolute", inset: 0,
                display: "grid",
                gridTemplateColumns: `repeat(${splashImages.length}, 1fr)`,
                gap: 3,
              }}
            >
              {splashImages.map((src, i) => (
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
            <div
              style={{
                position: "absolute", inset: 0,
                background: "radial-gradient(ellipse at 50% 30%, #1a160e 0%, #0a0908 100%)",
              }}
            />
          )}

          {/* Dark overlay — top/bottom heavy, lighter in the middle */}
          <div
            style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.38) 30%, rgba(0,0,0,0.5) 65%, rgba(0,0,0,0.88) 100%)",
              pointerEvents: "none",
            }}
          />
          {/* Vignette */}
          <div
            style={{
              position: "absolute", inset: 0,
              background: "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.5) 100%)",
              pointerEvents: "none",
            }}
          />

          {/* Content */}
          <div
            style={{
              position: "relative",
              zIndex: 2,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "0 28px",
              gap: 0,
              flex: 1,
            }}
          >
            {/* Logo */}
            {restaurant.logo && (
              <img
                src={restaurant.logo}
                alt={restaurant.name}
                style={{
                  height: 72,
                  objectFit: "contain",
                  marginBottom: 24,
                  filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.7))",
                }}
              />
            )}

            {/* Restaurant name */}
            <div
              style={{
                fontFamily: "'Cormorant Garamond', 'Playfair Display', 'Georgia', serif",
                fontStyle: "italic",
                fontWeight: 700,
                fontSize: "clamp(44px, 12vw, 80px)",
                color: "#c9a35d",
                lineHeight: 1.05,
                letterSpacing: "0.02em",
                textShadow: "0 2px 30px rgba(0,0,0,0.8), 0 0 60px rgba(201,163,93,0.25)",
                marginBottom: 14,
              }}
            >
              {restaurant.name}
            </div>

            {openStatus && openStatus.label && (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: openStatus.open ? "rgba(74,222,128,0.15)" : "rgba(255,107,107,0.15)",
                border: `1px solid ${openStatus.open ? "rgba(74,222,128,0.4)" : "rgba(255,107,107,0.4)"}`,
                color: openStatus.open ? "#4ade80" : "#ff6b6b",
                borderRadius: 999, padding: "4px 12px", fontSize: 13, fontWeight: 600,
                marginTop: 8, marginBottom: 8,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: openStatus.open ? "#4ade80" : "#ff6b6b", display: "inline-block" }} />
                {openStatus.label}
              </div>
            )}

            {/* Ornament divider */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 16,
                color: "rgba(201,163,93,0.6)",
              }}
            >
              <span style={{ display: "block", width: 48, height: 1, background: "rgba(201,163,93,0.4)" }} />
              <span style={{ fontSize: 14, letterSpacing: 3 }}>◆</span>
              <span style={{ display: "block", width: 48, height: 1, background: "rgba(201,163,93,0.4)" }} />
            </div>

            {/* Welcome text or address */}
            {(restaurant.welcomeText || restaurant.address) && (
              <div
                style={{
                  fontSize: 15,
                  color: "rgba(255,255,255,0.75)",
                  lineHeight: 1.6,
                  maxWidth: 320,
                  marginBottom: 36,
                  fontFamily: "'Cormorant Garamond', serif",
                  fontStyle: "italic",
                  textShadow: "0 1px 8px rgba(0,0,0,0.7)",
                }}
              >
                {restaurant.welcomeText || restaurant.address}
              </div>
            )}

            {/* CTA Button */}
            <button
              onClick={dismissSplash}
              style={{
                padding: "16px 42px",
                borderRadius: 50,
                background: "linear-gradient(135deg, #c9a35d 0%, #e8c87a 50%, #c9a35d 100%)",
                color: "#0d0c0b",
                border: "none",
                fontWeight: 700,
                fontSize: 17,
                cursor: "pointer",
                letterSpacing: "0.04em",
                fontFamily: "'Cormorant Garamond', serif",
                boxShadow: "0 8px 32px rgba(201,163,93,0.4), 0 2px 8px rgba(0,0,0,0.5)",
                transition: "transform 120ms, box-shadow 120ms",
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: restaurant.welcomeText || restaurant.address ? 0 : 36,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.04)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
            >
              <span style={{ fontSize: 20 }}>🍴</span>
              <span>לתפריט האינטראקטיבי</span>
            </button>
          </div>

          {/* Bottom action buttons */}
          <div
            style={{
              position: "relative",
              zIndex: 2,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 24,
              paddingBottom: "max(32px, env(safe-area-inset-bottom, 32px))",
              paddingTop: 16,
            }}
          >
            {/* WhatsApp */}
            {restaurant.phone && (
              <a
                href={`https://wa.me/${restaurant.phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.12)",
                  backdropFilter: "blur(8px)",
                  border: "1.5px solid rgba(255,255,255,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textDecoration: "none",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                  transition: "transform 120ms",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1.1)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1)"; }}
                aria-label="WhatsApp"
              >
                {/* WhatsApp SVG */}
                <svg width="26" height="26" viewBox="0 0 24 24" fill="#25D366">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12.004 2C6.477 2 2 6.484 2 12.017c0 1.99.52 3.86 1.428 5.484L2 22l4.619-1.401A9.956 9.956 0 0 0 12.004 22C17.523 22 22 17.516 22 11.983 22 6.478 17.523 2 12.004 2zm0 18.044a8.04 8.04 0 0 1-4.217-1.195l-.302-.18-3.13.95.922-3.046-.197-.312A8.029 8.029 0 0 1 3.972 12c0-4.42 3.602-8.016 8.032-8.016 4.428 0 8.03 3.596 8.03 8.016 0 4.423-3.602 8.044-8.03 8.044z"/>
                </svg>
              </a>
            )}

            {/* Registration / gift */}
            {!alreadyRegistered && (
              <button
                onClick={() => {
                  dismissSplash();
                  setTimeout(() => {
                    setRegStep("form");
                    setRegOtp(""); setRegError(""); setRegCoupon("");
                    setRegForm({ name: "", phone: "", email: "" });
                    setRegModalOpen(true);
                  }, 550);
                }}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #c9a35d, #e8c87a)",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: "0 6px 24px rgba(201,163,93,0.5), 0 2px 8px rgba(0,0,0,0.5)",
                  transition: "transform 120ms",
                  position: "relative",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.1)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
                aria-label="הצטרף ל- Club"
              >
                {/* notification dot */}
                <span style={{
                  position: "absolute", top: 6, right: 6,
                  width: 10, height: 10, borderRadius: "50%",
                  background: "#e53e3e", border: "2px solid #0d0c0b",
                }} />
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0d0c0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.12)",
                  backdropFilter: "blur(8px)",
                  border: "1.5px solid rgba(255,255,255,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textDecoration: "none",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                  transition: "transform 120ms",
                  color: "#fff",
                  fontSize: 22,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1.1)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1)"; }}
                aria-label="התקשר"
              >
                📞
              </a>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="menu-header">
        <div className="menu-header-content">
          <div className="menu-header-right-group">
            {restaurant.address && (
              <div className="menu-address-text">{restaurant.address}</div>
            )}
            {restaurant.logo && (
              <button className="menu-logo-link" onClick={goHome} aria-label="חזרה לדף הבית">
                <img src={restaurant.logo} alt={restaurant.name} className="menu-logo-img" />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="menu-container">

        {/* Home — categories grid */}
        {view === "home" && (
          <div className="menu-page-anim">
            <div style={{ height: 30 }} />
            <div className="menu-categories-grid">
              {categories.map((cat, idx) => {
                const img = cat.image || cat.items[0]?.image || null;

                if (theme === 'fresh') {
                  return (
                    <div key={cat.id} className="menu-category-tile" onClick={() => openCategory(cat)}>
                      <div className="menu-tile-image" style={img ? { backgroundImage: `url('${img}')` } : {}} />
                      <div className="menu-tile-overlay" />
                      <div className="menu-tile-bolt menu-tile-bolt-tl" />
                      <div className="menu-tile-bolt menu-tile-bolt-tr" />
                      <div className="menu-tile-bolt menu-tile-bolt-bl" />
                      <div className="menu-tile-bolt menu-tile-bolt-br" />
                      <div className="menu-tile-industrial-number">{String(idx + 1).padStart(2, '0')}</div>
                      <div className="menu-tile-content">
                        <h2 className="menu-tile-name">{getCatName(cat, lang)}</h2>
                        <div className="menu-tile-cta">לתפריט ←</div>
                      </div>
                    </div>
                  );
                }

                if (theme === 'nature') {
                  return (
                    <div key={cat.id} className="menu-category-tile" onClick={() => openCategory(cat)}>
                      <div className="menu-tile-nature-img" style={img ? { backgroundImage: `url('${img}')` } : {}} />
                      <div className="menu-tile-content">
                        <h2 className="menu-tile-name">{getCatName(cat, lang)}</h2>
                        <div className="menu-tile-divider" />
                        <div className="menu-tile-nature-count">{cat.items.length} מנות</div>
                        <div className="menu-tile-arrow">←</div>
                      </div>
                    </div>
                  );
                }

                if (theme === 'bold') {
                  return (
                    <div key={cat.id} className="menu-category-tile" onClick={() => openCategory(cat)}>
                      <div className="menu-tile-image" style={img ? { backgroundImage: `url('${img}')` } : {}} />
                      <div className="menu-tile-overlay" />
                      <div className="menu-tile-bold-number">{String(idx + 1).padStart(2, '0')}</div>
                      <div className="menu-tile-content">
                        <h2 className="menu-tile-name">{getCatName(cat, lang)}</h2>
                        <div className="menu-tile-cta">הכנס →</div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={cat.id} className="menu-category-tile" onClick={() => openCategory(cat)}>
                    <div className="menu-tile-image" style={img ? { backgroundImage: `url('${img}')` } : {}} />
                    <div className="menu-tile-overlay" />
                    <span className="menu-tile-corner-tl" />
                    <span className="menu-tile-corner-tr" />
                    <span className="menu-tile-corner-bl" />
                    <span className="menu-tile-corner-br" />
                    <div className="menu-tile-content">
                      <h2 className="menu-tile-name">{cat.name}</h2>
                      <div className="menu-tile-divider" />
                      <div className="menu-tile-arrow">←</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Category — items grid */}
        {view === "category" && selectedCat && (
          <div className="menu-page-anim">
            <button className="menu-back-btn" onClick={goHome}>{t.dir === "rtl" ? "→" : "←"} {t.back}</button>
            <div className="menu-page-header">
              <h2 className="menu-page-title">{getCatName(selectedCat, lang)}</h2>
              <div className="menu-page-ornament"><span>◆</span></div>
              <div className="menu-page-subtitle">{selectedCat.items.length} מנות מיוחדות</div>
            </div>
            <div className="menu-items-grid">
              {selectedCat.items.length === 0 ? (
                <p style={{ gridColumn: "1/-1", opacity: 0.5, padding: 40 }}>אין מנות בקטגוריה זו.</p>
              ) : (
                selectedCat.items.map(item => (
                  <div key={item.id} className="menu-card">
                    <div
                      className="menu-img-box"
                      onClick={() => { track("item", item.id, item.name); setModalItem(item); }}
                      style={{ cursor: "pointer" }}
                    >
                      {item.image
                        ? <img src={item.image} alt={item.name} loading="lazy" />
                        : <div className="menu-img-placeholder" />}
                    </div>
                    <div className="menu-card-content">
                      <div
                        onClick={() => { track("item", item.id, item.name); setModalItem(item); }}
                        style={{ cursor: "pointer" }}
                      >
                        <div className="menu-type-labels">
                          {getItemBadges(item, t).map(b => <span key={b} className="menu-type-tag">{b}</span>)}
                        </div>
                        <h3 className="menu-card-name">{getItemName(item, lang)}</h3>
                        <p className="menu-card-desc">{getItemDesc(item, lang) ?? ""}</p>
                        <div className="menu-price" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                          ₪{item.price}
                          {item.prepTime != null && (
                            <span className="menu-prep-time">⏱ {item.prepTime}&apos;</span>
                          )}
                        </div>
                      </div>
                      {restaurant.ordersEnabled && (
                        <button
                          onClick={e => { e.stopPropagation(); addToCart(item); }}
                          style={{
                            marginTop: 10,
                            width: "100%",
                            padding: "8px 0",
                            background: "var(--gold)",
                            color: "var(--bg)",
                            border: "none",
                            borderRadius: 8,
                            fontWeight: 700,
                            fontSize: 14,
                            cursor: "pointer",
                            letterSpacing: 0.5,
                          }}
                        >
                          {t.addToCart}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Floating action bar */}
      <div className="menu-floating-actions">
        {restaurant.phone && (
          <a href={`tel:${restaurant.phone}`} className="menu-action-btn menu-btn-phone">📞 {t.call}</a>
        )}
        {restaurant.locationUrl && (
          <a href={restaurant.locationUrl} target="_blank" rel="noopener noreferrer" className="menu-action-btn menu-btn-map">📍 {t.navigate}</a>
        )}
        {restaurant.website && (
          <a href={restaurant.website} target="_blank" rel="noopener noreferrer" className="menu-action-btn menu-btn-order">🌐 {t.website}</a>
        )}
      </div>

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
            background: "var(--bg-card, #1a1a1a)",
            color: "var(--gold)",
            border: "2px solid var(--gold)",
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

      {/* Cart button — fixed, above floating actions */}
      {restaurant.ordersEnabled && cartCount > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          style={{
            position: "fixed",
            bottom: 80,
            right: 16,
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "var(--gold)",
            color: "var(--bg)",
            border: "none",
            cursor: "pointer",
            fontSize: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            zIndex: 40,
          }}
          aria-label="פתח סל הזמנות"
        >
          🛒
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 20,
              height: 20,
              borderRadius: 10,
              background: "#e53e3e",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
            }}
          >
            {cartCount}
          </span>
        </button>
      )}

      {/* Cart drawer */}
      {cartOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
          }}
        >
          {/* Backdrop */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
            }}
            onClick={() => setCartOpen(false)}
          />
          {/* Drawer */}
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: "min(360px, 100vw)",
              background: "var(--bg-card)",
              borderRight: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              zIndex: 51,
            }}
          >
            {/* Drawer header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <span style={{ color: "var(--gold)", fontWeight: 700, fontSize: 18 }}>{t.cart}</span>
              <button
                onClick={() => setCartOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text)",
                  fontSize: 20,
                  cursor: "pointer",
                  opacity: 0.7,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* Table number + guest name indicator */}
            {tableNumber && (
              <div
                style={{
                  padding: "8px 20px",
                  borderBottom: "1px solid var(--border)",
                  fontSize: 13,
                  color: "var(--text)",
                  opacity: 0.8,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>{t.tableLabel}: <strong style={{ color: "var(--gold)" }}>{tableNumber}</strong></span>
                {guestIdentity && (
                  <span style={{ fontSize: 12, color: "var(--gold)" }}>👤 {guestIdentity.name}</span>
                )}
              </div>
            )}

            {/* Items list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
              {cart.length === 0 ? (
                <div style={{ textAlign: "center", opacity: 0.4, marginTop: 40, color: "var(--text)" }}>
                  הסל ריק
                </div>
              ) : (
                <>
                  {[...cart]
                    .map(c => (
                    <div
                      key={c.cartId}
                      style={{
                        margin: "8px 0",
                        padding: "12px 12px 10px",
                        borderRadius: 12,
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {/* Item row */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: "var(--text)", fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{c.name}</div>
                          <div style={{ color: "var(--gold)", fontSize: 12, marginTop: 1 }}>₪{c.price} ליחידה</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <button onClick={() => updateQty(c.cartId, -1)} style={{
                            width: 26, height: 26, borderRadius: "50%",
                            border: "1px solid var(--border)", background: "none",
                            color: "var(--text)", cursor: "pointer", fontSize: 15,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>−</button>
                          <span style={{ color: "var(--text)", fontSize: 13, minWidth: 18, textAlign: "center", fontWeight: 600 }}>
                            {c.quantity}
                          </span>
                          <button onClick={() => updateQty(c.cartId, 1)} style={{
                            width: 26, height: 26, borderRadius: "50%",
                            border: "1px solid var(--gold)", background: "none",
                            color: "var(--gold)", cursor: "pointer", fontSize: 15,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>+</button>
                        </div>
                        <div style={{ color: "var(--text)", fontSize: 13, fontWeight: 700, minWidth: 44, textAlign: "left" }}>
                          ₪{c.price * c.quantity}
                        </div>
                      </div>

                      {/* Notes */}
                      <input
                        type="text"
                        placeholder={t.notePlaceholder}
                        value={c.notes ?? ""}
                        onChange={e => updateNotes(c.cartId, e.target.value)}
                        style={{
                          marginTop: 5, width: "100%", padding: "4px 9px", fontSize: 11,
                          background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)",
                          borderRadius: 6, color: "var(--text)", outline: "none", boxSizing: "border-box",
                        }}
                      />
                    </div>
                  ))}

                </>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "16px 20px",
                borderTop: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 14,
                  color: "var(--text)",
                  fontSize: 16,
                  fontWeight: 700,
                }}
              >
                <span>סה"כ</span>
                <span style={{ color: "var(--gold)" }}>₪{cartTotal}</span>
              </div>
              {orderError && (
                <div style={{ color: "#e53e3e", fontSize: 13, marginBottom: 8, textAlign: "center" }}>
                  {orderError}
                </div>
              )}
              <button
                onClick={handleOrder}
                disabled={orderLoading || cart.length === 0}
                style={{
                  width: "100%",
                  padding: "12px 0",
                  background: "var(--gold)",
                  color: "var(--bg)",
                  border: "none",
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: 16,
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

      {/* Guest Registration Modal */}
      {showRegistration && tableNumber && restaurant.ordersEnabled && (
        <div style={{ position: "fixed", inset: 0, zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)" }} />
          <GuestRegistrationModal onSave={saveGuestIdentity} restaurantName={restaurant.name} tableNumber={tableNumber} t={t} />
        </div>
      )}

      {/* My orders panel */}
      {myOrdersOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
          <div
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }}
            onClick={() => { setMyOrdersOpen(false); setBillMode(null); }}
          />
          <div style={{
            position: "absolute", top: 0, bottom: 0, left: 0,
            width: "min(380px, 100vw)",
            background: "var(--bg-card, #1a1a1a)",
            borderRight: "1px solid var(--border)",
            display: "flex", flexDirection: "column", zIndex: 51,
          }}>
            {/* Header */}
            <div style={{
              borderBottom: "1px solid var(--border)",
            }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "16px 20px 12px",
              }}>
                <div>
                  <span style={{ color: "var(--gold)", fontWeight: 700, fontSize: 18 }}>📋 {t.myOrders}</span>
                  {tableNumber && (
                    <div style={{ fontSize: 12, color: "var(--text)", opacity: 0.55, marginTop: 2 }}>
                      {t.tableLabel} <strong style={{ color: "var(--gold)" }}>{tableNumber}</strong>
                      {guestIdentity && <span style={{ marginRight: 6, color: "var(--gold)", opacity: 0.8 }}>• {guestIdentity.name}</span>}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => fetchMyOrders(false)}
                    style={{ background: "none", border: "none", color: "var(--gold)", cursor: "pointer", fontSize: 18 }}
                    title="רענן"
                  >🔄</button>
                  <button
                    onClick={() => { setMyOrdersOpen(false); setBillMode(null); }}
                    style={{ background: "none", border: "none", color: "var(--text)", fontSize: 20, cursor: "pointer", opacity: 0.7 }}
                  >✕</button>
                </div>
              </div>
              {/* View toggle */}
              <div style={{ display: "flex", gap: 6, padding: "0 20px 12px" }}>
                {(["mine", "all"] as const).map(v => (
                  <button key={v} onClick={() => {
                    setOrdersView(v);
                    fetchMyOrders(false, v);
                  }} style={{
                    flex: 1, padding: "6px 0", borderRadius: 8, fontSize: 13, fontWeight: 600,
                    cursor: "pointer", transition: "all 0.15s",
                    border: ordersView === v ? "1.5px solid var(--gold)" : "1.5px solid var(--border)",
                    background: ordersView === v ? "var(--gold)" : "transparent",
                    color: ordersView === v ? "var(--bg)" : "var(--text)",
                  }}>
                    {v === "mine" ? t.myOrders : t.allOrders}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
              {myOrdersLoading ? (
                <div style={{ textAlign: "center", color: "var(--text)", opacity: 0.4, marginTop: 40 }}>
                  {t.loading}
                </div>
              ) : myOrders.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text)", opacity: 0.4, marginTop: 60 }}>
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
                      {/* Status bar */}
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "8px 14px",
                        background: `${statusColor}18`,
                        borderBottom: `1px solid ${statusColor}33`,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: statusColor }}>{statusLabel}</span>
                          {ordersView === "all" && order.customerName && (
                            <span style={{ fontSize: 11, color: "var(--gold)", fontWeight: 600 }}>👤 {order.customerName}</span>
                          )}
                        </div>
                        <span style={{ fontSize: 12, color: "var(--text)", opacity: 0.5 }}>
                          ₪{order.totalAmount.toFixed(0)}
                        </span>
                      </div>
                      {/* Items */}
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
                                  fontSize: 13, color: "var(--text)",
                                  textDecoration: oi.itemStatus === "DONE" ? "line-through" : "none",
                                  opacity: oi.itemStatus === "DONE" ? 0.5 : 1,
                                }}>{oi.item.name}</span>
                                {oi.notes && (
                                  <div style={{ fontSize: 11, color: "var(--text)", opacity: 0.45, fontStyle: "italic" }}>
                                    {oi.notes}
                                  </div>
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
                            marginTop: 6, fontSize: 12, color: "var(--text)", opacity: 0.5,
                            fontStyle: "italic", borderTop: "1px solid var(--border)", paddingTop: 6,
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

            {/* Bill / Payment request footer */}
            {myOrders.length > 0 && !billMode && (
              <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
                <div style={{ fontSize: 12, color: "var(--text)", opacity: 0.5, textAlign: "center", marginBottom: 8 }}>
                  {t.requestBill}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setBillMode("mine")} style={{
                    flex: 1, padding: "9px 0", borderRadius: 9, fontSize: 13, fontWeight: 600,
                    border: "1.5px solid var(--gold)", background: "transparent",
                    color: "var(--gold)", cursor: "pointer",
                  }}>💳 {t.myBill}</button>
                  <button onClick={() => { setOrdersView("all"); fetchMyOrders(false, "all"); setBillMode("all"); }} style={{
                    flex: 1, padding: "9px 0", borderRadius: 9, fontSize: 13, fontWeight: 600,
                    border: "1.5px solid var(--border)", background: "rgba(255,255,255,0.05)",
                    color: "var(--text)", cursor: "pointer",
                  }}>🧾 {t.allBill}</button>
                </div>
              </div>
            )}

            {/* Bill view */}
            {billMode && (
              <div style={{ borderTop: "1px solid var(--border)", padding: "16px", flexShrink: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ color: "var(--gold)", fontWeight: 700, fontSize: 15 }}>
                    🧾 {billMode === "mine" ? t.myBill : t.allBill}
                  </span>
                  <button onClick={() => setBillMode(null)} style={{ background: "none", border: "none", color: "var(--text)", cursor: "pointer", opacity: 0.6 }}>✕</button>
                </div>
                <div style={{ fontSize: 12, marginBottom: 10 }}>
                  {myOrders.flatMap(o => o.items).map((oi, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, color: "var(--text)" }}>
                      <span>{oi.quantity > 1 ? `×${oi.quantity} ` : ""}{oi.item.name}</span>
                      <span>₪{(oi.price * oi.quantity).toFixed(0)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15, color: "var(--gold)", borderTop: "1px solid var(--border)", paddingTop: 8, marginBottom: 12 }}>
                  <span>סה"כ</span>
                  <span>₪{myOrders.reduce((s, o) => s + o.totalAmount, 0).toFixed(0)}</span>
                </div>
                <div style={{ textAlign: "center", fontSize: 12, color: "var(--text)", opacity: 0.5, padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                  📱 הצג חשבון זה לצוות המסעדה לתשלום
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Order success overlay */}
      {orderSuccess && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "var(--bg)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
          }}
        >
          <div style={{ fontSize: 64 }}>✅</div>
          <div
            style={{
              color: "var(--gold)",
              fontSize: 28,
              fontWeight: 700,
              textAlign: "center",
            }}
          >
            {t.orderSent}
          </div>
          {tableNumber && (
            <div style={{ color: "var(--text)", fontSize: 18, opacity: 0.8 }}>
              {t.tableLabel} {tableNumber}
            </div>
          )}
          <button
            onClick={() => setOrderSuccess(false)}
            style={{
              marginTop: 12,
              padding: "10px 32px",
              background: "var(--gold)",
              color: "var(--bg)",
              border: "none",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            {t.close}
          </button>
        </div>
      )}

      {/* Product modal */}
      {modalItem && (
        <div className="menu-product-modal" onClick={e => { if (e.target === e.currentTarget) setModalItem(null); }}>
          <button className="menu-modal-close" onClick={() => setModalItem(null)}>✕</button>
          <div className="menu-modal-content">
            <span className="menu-modal-corner-tl" />
            <span className="menu-modal-corner-tr" />
            <span className="menu-modal-corner-bl" />
            <span className="menu-modal-corner-br" />
            {modalItem.image && (
              <div className="menu-modal-img-wrap">
                <img
                  src={modalItem.image}
                  alt={modalItem.name}
                  onClick={() => setZoomSrc(modalItem.image)}
                />
              </div>
            )}
            <div className="menu-modal-body">
              <div className="menu-modal-types">
                {getItemBadges(modalItem, t).map(b => <span key={b} className="menu-modal-type-tag">{b}</span>)}
              </div>
              <h2 className="menu-modal-name">{getItemName(modalItem, lang)}</h2>
              <div className="menu-modal-divider"><span>◆</span></div>
              {(getItemDesc(modalItem, lang)) && <p className="menu-modal-desc">{getItemDesc(modalItem, lang)}</p>}
              <div className="menu-modal-meta">
                <div className="menu-modal-price-box">
                  <div className="menu-modal-price-label">מחיר</div>
                  <div className="menu-modal-price" style={{ fontFamily: "'Cormorant Garamond', serif", letterSpacing: "0.03em" }}>₪{modalItem.price}</div>
                </div>
              </div>
              {restaurant.ordersEnabled && (
                <button
                  onClick={() => { addToCart(modalItem); setModalItem(null); }}
                  style={{
                    marginTop: 14,
                    width: "100%",
                    padding: "9px 0",
                    background: "var(--gold)",
                    color: "var(--bg)",
                    border: "none",
                    borderRadius: 10,
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  {t.addToCart}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image zoom */}
      {zoomSrc && (
        <div className="menu-image-zoom" onClick={() => setZoomSrc(null)}>
          <img src={zoomSrc} alt="zoom" />
        </div>
      )}

      {/* Modifier selection modal */}
      {modifierItem && modifierGroups.length > 0 && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) { setModifierItem(null); setModifierGroups([]); setSelectedModifiers({}); } }}
        >
          <div style={{
            background: "var(--bg-card, #1a1a1a)",
            borderRadius: "20px",
            width: "min(480px, 94vw)",
            maxHeight: "85vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            border: "1px solid var(--border, #ffffff20)",
          }}>
            {/* Header */}
            <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--border, #ffffff20)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ color: "var(--gold)", fontWeight: 700, fontSize: 17 }}>{modifierItem.name}</div>
                <div style={{ color: "var(--text)", opacity: 0.55, fontSize: 13 }}>בחר אפשרויות</div>
              </div>
              <button
                onClick={() => { setModifierItem(null); setModifierGroups([]); setSelectedModifiers({}); }}
                style={{ background: "none", border: "none", color: "var(--text)", fontSize: 20, cursor: "pointer", opacity: 0.7 }}
              >✕</button>
            </div>

            {/* Groups */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
              {modifierGroupsLoading ? (
                <div style={{ textAlign: "center", color: "var(--text)", opacity: 0.4 }}>{t.loading}</div>
              ) : modifierGroups.map(grp => (
                <div key={grp.id} style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <span style={{ color: "var(--text)", fontWeight: 700, fontSize: 15 }}>{grp.name}</span>
                    {grp.required && (
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: "#7f1d1d", color: "#fca5a5", fontWeight: 600 }}>חובה</span>
                    )}
                    {grp.maxSelect > 1 && (
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: "rgba(255,255,255,0.08)", color: "var(--text)", opacity: 0.6 }}>
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
                            padding: "8px 14px",
                            borderRadius: 20,
                            border: isSelected ? "2px solid var(--gold)" : "1.5px solid var(--border, #ffffff25)",
                            background: isSelected ? "var(--gold)" : "rgba(255,255,255,0.05)",
                            color: isSelected ? "var(--bg, #111)" : "var(--text)",
                            fontWeight: isSelected ? 700 : 400,
                            fontSize: 14,
                            cursor: "pointer",
                            transition: "all 0.15s",
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

            {/* Footer */}
            <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border, #ffffff20)" }}>
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
                      width: "100%",
                      padding: "9px 16px",
                      background: "var(--gold)",
                      color: "var(--bg, #111)",
                      border: "none",
                      borderRadius: 10,
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: isModifierValid() ? "pointer" : "not-allowed",
                      opacity: isModifierValid() ? 1 : 0.45,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <span>{t.addToCart}</span>
                    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontWeight: 600, letterSpacing: "0.02em" }}>₪{totalPrice}</span>
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Floating registration card — hidden once registered ── */}
      {!alreadyRegistered && <button
        onClick={() => { setRegModalOpen(true); setRegStep("form"); setRegOtp(""); setRegError(""); setRegCoupon(""); setRegForm({ name: "", phone: "", email: "" }); }}
        style={{
          position: "fixed",
          bottom: 24,
          left: 16,
          zIndex: 60,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          padding: "12px 16px 10px",
          borderRadius: 18,
          background: "var(--gold, #c9a35d)",
          color: "var(--bg, #111)",
          border: "none",
          fontWeight: 700,
          fontSize: 12,
          cursor: "pointer",
          boxShadow: "0 6px 28px rgba(0,0,0,0.45)",
          direction: "rtl",
          maxWidth: 130,
          textAlign: "center",
          lineHeight: 1.35,
        }}
        title={t.floatingBtn}
      >
        {/* Gift icon */}
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 2 }}>
          <polyline points="20 12 20 22 4 22 4 12"/>
          <rect x="2" y="7" width="20" height="5"/>
          <line x1="12" y1="22" x2="12" y2="7"/>
          <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
          <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
        </svg>
        {t.floatingBtn}
      </button>}

      {/* ── Registration modal (3 steps) ── */}
      {regModalOpen && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 70,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
          onClick={e => { if (e.target === e.currentTarget && regStep !== "done") setRegModalOpen(false); }}
        >
          <div style={{
            position: "relative", zIndex: 71,
            background: "var(--bg-card, #1c1c1c)",
            borderRadius: 18,
            padding: "28px 24px",
            width: "min(360px, 92vw)",
            border: "1px solid var(--border, rgba(255,255,255,0.12))",
            boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
            direction: "rtl",
          }}>
            {/* Close — not shown on done step */}
            {regStep !== "done" && (
              <button
                onClick={() => setRegModalOpen(false)}
                style={{
                  position: "absolute", top: 14, left: 14,
                  background: "rgba(255,255,255,0.08)", border: "none",
                  borderRadius: 8, width: 28, height: 28,
                  cursor: "pointer", color: "var(--text, #fff)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, fontWeight: 700,
                }}
              >×</button>
            )}

            {/* ── STEP 1: form ── */}
            {regStep === "form" && (
              <>
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <div style={{ fontSize: 36, marginBottom: 6 }}>🎁</div>
                  <div style={{ color: "var(--gold, #c9a35d)", fontWeight: 700, fontSize: 18, marginBottom: 6, lineHeight: 1.3 }}>
                    {t.get5Percent}
                  </div>
                  <div style={{ color: "var(--text, #fff)", opacity: 0.6, fontSize: 13, marginBottom: 2 }}>{t.registerGetCoupon}</div>
                  <div style={{ color: "var(--text, #fff)", opacity: 0.45, fontSize: 12 }}>{restaurant.name}</div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 11, color: "var(--text, #fff)", opacity: 0.55, marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{t.nameField}</label>
                  <input type="text" value={regForm.name} onChange={e => setRegForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="ישראל ישראלי" autoFocus
                    onKeyDown={e => { if (e.key === "Enter") handleRegisterSubmit(); }}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 10, fontSize: 14,
                      background: "rgba(255,255,255,0.07)", border: "1px solid var(--border, rgba(255,255,255,0.15))",
                      color: "var(--text, #fff)", outline: "none", boxSizing: "border-box" }} />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 11, color: "var(--text, #fff)", opacity: 0.55, marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{t.phoneField}</label>
                  <input type="tel" value={regForm.phone} onChange={e => setRegForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="050-0000000" dir="ltr"
                    onKeyDown={e => { if (e.key === "Enter") handleRegisterSubmit(); }}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 10, fontSize: 14,
                      background: "rgba(255,255,255,0.07)", border: "1px solid var(--border, rgba(255,255,255,0.15))",
                      color: "var(--text, #fff)", outline: "none", boxSizing: "border-box", textAlign: "right" }} />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 11, color: "var(--text, #fff)", opacity: 0.55, marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{t.emailField}</label>
                  <input type="email" value={regForm.email} onChange={e => setRegForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="email@example.com" dir="ltr"
                    onKeyDown={e => { if (e.key === "Enter") handleRegisterSubmit(); }}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 10, fontSize: 14,
                      background: "rgba(255,255,255,0.07)", border: "1px solid var(--border, rgba(255,255,255,0.15))",
                      color: "var(--text, #fff)", outline: "none", boxSizing: "border-box", textAlign: "right" }} />
                </div>

                {regError && (
                  <div style={{ background: "rgba(239,68,68,0.15)", color: "#fca5a5", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 14 }}>{regError}</div>
                )}
                <button onClick={handleRegisterSubmit} disabled={regLoading}
                  style={{ width: "100%", padding: "11px 16px", borderRadius: 50,
                    background: "var(--gold, #c9a35d)", color: "var(--bg, #111)",
                    border: "none", fontWeight: 700, fontSize: 14,
                    cursor: regLoading ? "not-allowed" : "pointer",
                    opacity: regLoading ? 0.55 : 1, transition: "opacity 150ms" }}>
                  {regLoading ? t.sending : t.registerBtn}
                </button>
              </>
            )}

            {/* ── STEP 2: OTP ── */}
            {regStep === "otp" && (
              <>
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📧</div>
                  <div style={{ color: "var(--gold, #c9a35d)", fontWeight: 700, fontSize: 18, marginBottom: 8 }}>
                    {t.otpSentTitle}
                  </div>
                  <div style={{ color: "var(--text, #fff)", opacity: 0.65, fontSize: 13, lineHeight: 1.5 }}>
                    {t.otpSentSub}<br />
                    <span style={{ fontWeight: 600, opacity: 1, direction: "ltr", display: "inline-block" }}>{regForm.email}</span>
                  </div>
                  <div style={{ color: "var(--text, #fff)", opacity: 0.4, fontSize: 12, marginTop: 6 }}>{t.otpValidFor}</div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 11, color: "var(--text, #fff)", opacity: 0.55, marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{t.otpCode}</label>
                  <input type="text" inputMode="numeric" value={regOtp} onChange={e => setRegOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="• • • • • •" autoFocus maxLength={6}
                    onKeyDown={e => { if (e.key === "Enter") handleVerifyOtp(); }}
                    style={{ width: "100%", padding: "14px 12px", borderRadius: 10, fontSize: 22,
                      background: "rgba(255,255,255,0.07)", border: "1px solid var(--border, rgba(255,255,255,0.15))",
                      color: "var(--gold, #c9a35d)", outline: "none", boxSizing: "border-box",
                      textAlign: "center", letterSpacing: 8, fontWeight: 700 }} />
                </div>

                {regError && (
                  <div style={{ background: "rgba(239,68,68,0.15)", color: "#fca5a5", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 14 }}>{regError}</div>
                )}
                <button onClick={handleVerifyOtp} disabled={regLoading || regOtp.length < 6}
                  style={{ width: "100%", padding: "11px 16px", borderRadius: 50,
                    background: "var(--gold, #c9a35d)", color: "var(--bg, #111)",
                    border: "none", fontWeight: 700, fontSize: 14,
                    cursor: regLoading || regOtp.length < 6 ? "not-allowed" : "pointer",
                    opacity: regLoading || regOtp.length < 6 ? 0.55 : 1, transition: "opacity 150ms" }}>
                  {regLoading ? t.verifying : t.verifyBtn}
                </button>
                <button onClick={() => { setRegStep("form"); setRegError(""); }}
                  style={{ width: "100%", marginTop: 10, padding: "8px", background: "none", border: "none",
                    color: "var(--text, #fff)", opacity: 0.45, fontSize: 12, cursor: "pointer" }}>
                  {t.backToForm}
                </button>
              </>
            )}

            {/* ── STEP 3: coupon ── */}
            {regStep === "done" && (
              <div style={{ textAlign: "center", padding: "12px 0" }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>🎉</div>
                <div style={{ color: "var(--gold, #c9a35d)", fontWeight: 700, fontSize: 20, marginBottom: 8 }}>
                  {t.couponTitle}
                </div>
                <div style={{ color: "var(--text, #fff)", opacity: 0.65, fontSize: 14, marginBottom: 20 }}>
                  {t.couponSub}
                </div>
                {/* Coupon display */}
                <div style={{
                  background: "rgba(201,163,93,0.12)", border: "2px dashed var(--gold, #c9a35d)",
                  borderRadius: 14, padding: "18px 24px", marginBottom: 24,
                }}>
                  <div style={{ fontSize: 11, color: "var(--gold, #c9a35d)", fontWeight: 600, letterSpacing: "0.08em", marginBottom: 8, opacity: 0.7 }}>קוד קופון</div>
                  <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: 4, color: "var(--gold, #c9a35d)", fontFamily: "'Courier New', monospace" }}>
                    {regCoupon}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text, #fff)", opacity: 0.45, marginTop: 8 }}>
                    {t.couponNote}
                  </div>
                </div>
                <button onClick={() => setRegModalOpen(false)}
                  style={{ padding: "11px 36px", borderRadius: 50,
                    background: "var(--gold, #c9a35d)", color: "var(--bg, #111)",
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
