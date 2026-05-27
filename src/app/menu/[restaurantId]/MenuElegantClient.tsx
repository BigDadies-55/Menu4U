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
  orderNumber: number | null;
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

type LoyaltyTransaction = {
  id: string;
  type: string;
  points: number;
  note: string | null;
  createdAt: string;
};

type LoyaltyMemberData = {
  id: string;
  name: string;
  phone: string;
  memberNumber: string;
  points: number;
  totalSpent: number;
  createdAt: string;
  transactions: LoyaltyTransaction[];
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


export default function MenuElegantClient({
  restaurant,
  tableNumber,
}: {
  restaurant: Restaurant;
  tableNumber?: string | null;
}) {
  // Elegant theme view state
  const [elegantView, setElegantView] = useState<"landing" | "clubwelcome" | "categories" | "items">("landing");
  const elegantHistory = useRef<("landing" | "clubwelcome" | "categories" | "items")[]>(["landing"]);

  function elegantNavigateTo(v: "landing" | "clubwelcome" | "categories" | "items") {
    if (elegantHistory.current[elegantHistory.current.length - 1] !== v) {
      elegantHistory.current.push(v);
    }
    setElegantView(v);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function elegantGoBack() {
    if (elegantHistory.current.length > 1) {
      elegantHistory.current.pop();
      const prev = elegantHistory.current[elegantHistory.current.length - 1];
      setElegantView(prev);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  const [modalItem, setModalItem] = useState<Item | null>(null);
  const [catSearch, setCatSearch] = useState("");

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

  // Thank-you screen (shown when an order transitions to PAID)
  const [showThankYou, setShowThankYou] = useState(false);
  const prevOrderStatusesRef = useRef<Map<string, string>>(new Map());

  // Club welcome/onboarding screen
  const [clubStep, setClubStep] = useState<"promo" | "register" | "login" | "otp" | "welcome_back">("promo");
  const [clubForm, setClubForm] = useState({ name: "", phone: "", email: "", birthDate: "" });
  const [clubLoginPhone, setClubLoginPhone] = useState("");
  const [clubLoading, setClubLoading] = useState(false);
  const [clubError, setClubError] = useState("");
  const [clubOtp, setClubOtp] = useState("");
  const [clubEmailVerified, setClubEmailVerified] = useState(false);
  const [clubOtpSending, setClubOtpSending] = useState(false);
  const [clubOtpSent, setClubOtpSent] = useState(false);
  const [clubWelcomeBackName, setClubWelcomeBackName] = useState("");
  const [clubWelcomeBonus, setClubWelcomeBonus] = useState(0);

  // Loyalty club state
  const [showLoyalty, setShowLoyalty] = useState(false);
  const [loyaltyMember, setLoyaltyMember] = useState<LoyaltyMemberData | null>(null);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);
  const [loyaltyNotFound, setLoyaltyNotFound] = useState(false);
  const [loyaltyForm, setLoyaltyForm] = useState({ name: "", phone: "", email: "", birthDate: "" });
  const [loyaltyFormError, setLoyaltyFormError] = useState("");
  const [loyaltyRegistering, setLoyaltyRegistering] = useState(false);
  const [loyaltyJustJoined, setLoyaltyJustJoined] = useState(false);

  // Language state
  const [lang, setLang] = useState<Lang>((restaurant.language as Lang) ?? "he");

  // Fonts loaded via next/font/google module-level declarations above

  // On mount: auto-detect known loyalty member by stored phone
  useEffect(() => {
    try {
      const storedPhone = localStorage.getItem(`menu4u_loyalty_phone_${restaurant.id}`);
      if (storedPhone) {
        // Will be fetched when clubwelcome screen loads
        setClubLoginPhone(storedPhone);
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
      if (res.ok) {
        const fetchedOrders: TableOrder[] = await res.json();

        // Detect PAID transitions — if any previously-active order is now PAID → thank-you
        const prev = prevOrderStatusesRef.current;
        let justPaid = false;
        for (const order of fetchedOrders) {
          const prevStatus = prev.get(order.id);
          if (prevStatus && prevStatus !== "PAID" && order.status === "PAID") {
            justPaid = true;
          }
        }
        // Update ref with current statuses
        const next = new Map<string, string>();
        for (const order of fetchedOrders) { next.set(order.id, order.status); }
        prevOrderStatusesRef.current = next;

        setMyOrders(fetchedOrders);

        if (justPaid) {
          setShowThankYou(true);
          setTimeout(() => {
            setShowThankYou(false);
            setCart([]);
            setGuestIdentity(null);
            try {
              const guestKey = `menu4u_guest_${restaurant.id}_${tableNumber}`;
              localStorage.removeItem(guestKey);
            } catch { /* ignore */ }
            prevOrderStatusesRef.current = new Map();
            setElegantView("landing");
          }, 4000);
        }
      }
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
        }
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function saveGuestIdentity(identity: GuestIdentity) {
    if (tableNumber) {
      const key = `menu4u_guest_${restaurant.id}_${tableNumber}`;
      try { localStorage.setItem(key, JSON.stringify(identity)); } catch { /* ignore */ }
    }
    setGuestIdentity(identity);
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

  async function fetchLoyaltyMember(phone: string) {
    setLoyaltyLoading(true);
    setLoyaltyNotFound(false);
    try {
      const res = await fetch(`/api/loyalty/${restaurant.id}/member?phone=${encodeURIComponent(phone)}`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setLoyaltyMember(data);
          setLoyaltyNotFound(false);
        } else {
          setLoyaltyMember(null);
          setLoyaltyNotFound(true);
          // Pre-fill form
          setLoyaltyForm(f => ({
            ...f,
            phone,
            name: guestIdentity?.name ?? "",
          }));
        }
      } else {
        setLoyaltyMember(null);
        setLoyaltyNotFound(true);
        setLoyaltyForm(f => ({ ...f, phone, name: guestIdentity?.name ?? "" }));
      }
    } catch {
      setLoyaltyMember(null);
      setLoyaltyNotFound(true);
    } finally {
      setLoyaltyLoading(false);
    }
  }

  async function handleLoyaltyOpen() {
    setShowLoyalty(true);
    setLoyaltyJustJoined(false);
    setLoyaltyFormError("");
    const phone = guestIdentity?.phone;
    if (phone) {
      await fetchLoyaltyMember(phone);
    } else {
      setLoyaltyMember(null);
      setLoyaltyNotFound(true);
      setLoyaltyForm({ name: "", phone: "", email: "", birthDate: "" });
    }
  }

  async function handleLoyaltyRegister() {
    const name = loyaltyForm.name.trim();
    const phone = loyaltyForm.phone.trim().replace(/\s/g, "");
    if (!name) { setLoyaltyFormError("נא להזין שם"); return; }
    if (!phone || phone.length < 9) { setLoyaltyFormError("נא להזין מספר טלפון תקין"); return; }
    setLoyaltyRegistering(true);
    setLoyaltyFormError("");
    try {
      const res = await fetch(`/api/loyalty/${restaurant.id}/member`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          email: loyaltyForm.email || null,
          birthDate: loyaltyForm.birthDate || null,
        }),
      });
      const data = await res.json();
      if (res.ok || res.status === 201) {
        setLoyaltyMember(data);
        setLoyaltyNotFound(false);
        setLoyaltyJustJoined(true);
      } else if (res.status === 409) {
        // Already member
        setLoyaltyMember(data.member);
        setLoyaltyNotFound(false);
      } else {
        setLoyaltyFormError(data.error ?? "שגיאה בהרשמה");
      }
    } catch {
      setLoyaltyFormError("שגיאת חיבור");
    } finally {
      setLoyaltyRegistering(false);
    }
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
    setCatSearch("");
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

  async function handleClubAutoLogin(phone: string) {
    setClubLoading(true);
    try {
      const res = await fetch(`/api/loyalty/${restaurant.id}/member?phone=${encodeURIComponent(phone)}`);
      if (res.ok) {
        const member = await res.json();
        if (member) {
          setLoyaltyMember(member);
          setGuestIdentity({ name: member.name, phone: member.phone });
          saveGuestIdentity({ name: member.name, phone: member.phone });
          setClubWelcomeBackName(member.name);
          setClubWelcomeBonus(member.points);
          setClubStep("welcome_back");
          setTimeout(() => elegantNavigateTo("categories"), 2500);
        }
      }
    } catch {}
    setClubLoading(false);
  }

  async function handleClubLogin() {
    if (!clubLoginPhone || clubLoginPhone.length < 9) {
      setClubError("נא להזין מספר טלפון תקין");
      return;
    }
    setClubLoading(true);
    setClubError("");
    try {
      const res = await fetch(`/api/loyalty/${restaurant.id}/member?phone=${encodeURIComponent(clubLoginPhone)}`);
      if (res.ok) {
        const member = await res.json();
        if (member) {
          setLoyaltyMember(member);
          setGuestIdentity({ name: member.name, phone: member.phone });
          saveGuestIdentity({ name: member.name, phone: member.phone });
          try { localStorage.setItem(`menu4u_loyalty_phone_${restaurant.id}`, member.phone); } catch {}
          setClubWelcomeBackName(member.name);
          setClubWelcomeBonus(member.points);
          setClubStep("welcome_back");
          setTimeout(() => elegantNavigateTo("categories"), 2500);
        } else {
          setClubError("לא מצאנו חבר עם הטלפון הזה");
        }
      }
    } catch {
      setClubError("שגיאה בחיבור, נסה שוב");
    }
    setClubLoading(false);
  }

  async function handleClubRegister() {
    if (!clubForm.name.trim() || !clubForm.phone || clubForm.phone.length < 9) {
      setClubError("שם וטלפון הם שדות חובה");
      return;
    }
    if (clubForm.email && !clubEmailVerified) {
      setClubError("יש לאמת את כתובת האימייל");
      return;
    }
    setClubLoading(true);
    setClubError("");
    try {
      const res = await fetch(`/api/loyalty/${restaurant.id}/member`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: clubForm.name.trim(),
          phone: clubForm.phone.trim(),
          email: clubForm.email || null,
          birthDate: clubForm.birthDate || null,
        }),
      });
      const data = await res.json();
      if (res.ok || res.status === 409) {
        const member = res.status === 409 ? data.member : data;
        setLoyaltyMember(member);
        setGuestIdentity({ name: member.name, phone: member.phone });
        saveGuestIdentity({ name: member.name, phone: member.phone });
        try { localStorage.setItem(`menu4u_loyalty_phone_${restaurant.id}`, member.phone); } catch {}
        setClubWelcomeBonus(member.points);
        setClubWelcomeBackName(member.name);
        setClubStep("welcome_back");
        setTimeout(() => elegantNavigateTo("categories"), 3000);
      } else {
        setClubError(data.error || "שגיאה בהרשמה");
      }
    } catch {
      setClubError("שגיאה בחיבור");
    }
    setClubLoading(false);
  }

  async function handleSendEmailOtp() {
    if (!clubForm.email || !clubForm.email.includes("@")) return;
    setClubOtpSending(true);
    setClubError("");
    try {
      await fetch(`/api/loyalty/${restaurant.id}/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", email: clubForm.email }),
      });
      setClubOtpSent(true);
    } catch {}
    setClubOtpSending(false);
  }

  async function handleVerifyEmailOtp() {
    if (!clubOtp || clubOtp.length !== 6) return;
    setClubLoading(true);
    try {
      const res = await fetch(`/api/loyalty/${restaurant.id}/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", email: clubForm.email, code: clubOtp }),
      });
      const data = await res.json();
      if (data.verified) {
        setClubEmailVerified(true);
        setClubOtpSent(false);
        setClubOtp("");
      } else {
        setClubError("קוד שגוי, נסה שוב");
      }
    } catch {
      setClubError("שגיאה באימות");
    }
    setClubLoading(false);
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

      {/* ── Sticky Header (hidden on landing and clubwelcome views) ── */}
      {elegantView !== "landing" && elegantView !== "clubwelcome" && (
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

          {/* Returning member welcome chip */}
          {loyaltyMember && (
            <div style={{
              position: "absolute", top: 20, zIndex: 3,
              background: "rgba(197,168,128,0.15)",
              border: "1px solid rgba(197,168,128,0.4)",
              borderRadius: 20, padding: "8px 18px",
              display: "flex", alignItems: "center", gap: 8,
              backdropFilter: "blur(8px)",
            }}>
              <span style={{ fontSize: 16 }}>⭐</span>
              <span style={{ color: "#C5A880", fontSize: 13, fontWeight: 600 }}>
                ברוך הבא, {loyaltyMember.name}! {loyaltyMember.points} נקודות
              </span>
            </div>
          )}

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
              onClick={() => {
                setClubStep("promo");
                elegantNavigateTo("clubwelcome");
              }}
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

            {/* Loyalty club button */}
            <button
              onClick={() => {
                if (loyaltyMember) {
                  setShowLoyalty(true);
                } else {
                  setClubStep("promo");
                  elegantNavigateTo("clubwelcome");
                }
              }}
              style={{
                width: loyaltyMember ? 66 : 58,
                height: loyaltyMember ? 66 : 58,
                borderRadius: "50%",
                background: loyaltyMember
                  ? "linear-gradient(135deg, #C5A880, #dfc090)"
                  : "rgba(255,255,255,0.11)",
                backdropFilter: "blur(10px)",
                border: loyaltyMember ? "none" : "1.5px solid rgba(197,168,128,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
                boxShadow: loyaltyMember
                  ? "0 6px 28px rgba(197,168,128,0.5), 0 2px 8px rgba(0,0,0,0.5)"
                  : "0 4px 20px rgba(0,0,0,0.45)",
                transition: "transform 150ms",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.12)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
              aria-label={loyaltyMember ? "כרטיס החבר שלי" : "מועדון לקוחות"}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke={loyaltyMember ? "#0D0D0D" : "#C5A880"}
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </button>

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

      {/* ── CLUB WELCOME SCREEN ── */}
      {elegantView === "clubwelcome" && (
        <ClubWelcomeScreen
          restaurantId={restaurant.id}
          restaurantName={restaurant.name}
          restaurantLogo={restaurant.logo}
          clubStep={clubStep}
          setClubStep={setClubStep}
          clubForm={clubForm}
          setClubForm={setClubForm}
          clubLoginPhone={clubLoginPhone}
          setClubLoginPhone={setClubLoginPhone}
          clubLoading={clubLoading}
          clubError={clubError}
          setClubError={setClubError}
          clubOtp={clubOtp}
          setClubOtp={setClubOtp}
          clubEmailVerified={clubEmailVerified}
          clubOtpSending={clubOtpSending}
          clubOtpSent={clubOtpSent}
          clubWelcomeBackName={clubWelcomeBackName}
          clubWelcomeBonus={clubWelcomeBonus}
          loyaltyMember={loyaltyMember}
          handleClubAutoLogin={handleClubAutoLogin}
          handleClubLogin={handleClubLogin}
          handleClubRegister={handleClubRegister}
          handleSendEmailOtp={handleSendEmailOtp}
          handleVerifyEmailOtp={handleVerifyEmailOtp}
          onSkip={() => elegantNavigateTo("categories")}
          onGoBack={() => elegantGoBack()}
        />
      )}

      {/* ── CATEGORIES SCREEN ── */}
      {elegantView === "categories" && (
        <section style={{ padding: "28px 20px 80px", maxWidth: 540, margin: "0 auto" }}>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <h2 style={{ fontSize: 26, fontWeight: 300, letterSpacing: "0.05em", marginBottom: 6 }}>
              {lang === "he" ? "התפריט שלנו" : lang === "en" ? "Our Menu" : lang === "ru" ? "Наше меню" : "Notre Menu"}
            </h2>
            <div style={{ width: 36, height: 1, background: "rgba(197,168,128,0.4)", margin: "12px auto 0" }} />
          </div>

          {/* Search bar */}
          {categories.length > 3 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${catSearch ? "rgba(197,168,128,0.4)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 14, padding: "11px 16px",
              marginBottom: 20,
              transition: "border-color 200ms",
            }}>
              {/* Search icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke={catSearch ? "#C5A880" : "#555"} strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: "stroke 200ms" }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                value={catSearch}
                onChange={e => setCatSearch(e.target.value)}
                placeholder={
                  lang === "he" ? "חפש קטגוריה או מנה..." :
                  lang === "en" ? "Search category or dish..." :
                  lang === "ru" ? "Поиск..." : "Rechercher..."
                }
                style={{
                  flex: 1, background: "none", border: "none", outline: "none",
                  color: "#fff", fontSize: 14,
                  fontFamily: "var(--font-rubik, 'Rubik', sans-serif)",
                }}
                dir={t.dir}
              />
              {catSearch && (
                <button
                  onClick={() => setCatSearch("")}
                  style={{
                    background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "50%",
                    width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#aaa", fontSize: 13, cursor: "pointer", flexShrink: 0,
                  }}
                >✕</button>
              )}
            </div>
          )}

          {/* Filtered categories */}
          {(() => {
            const q = catSearch.trim().toLowerCase();
            const filtered = q
              ? categories.filter(cat =>
                  getCatName(cat, lang).toLowerCase().includes(q) ||
                  cat.items.some(i => getItemName(i, lang).toLowerCase().includes(q))
                )
              : categories;

            if (filtered.length === 0) {
              return (
                <div style={{ textAlign: "center", padding: "48px 0", color: "#555" }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
                  <div style={{ fontSize: 14 }}>
                    {lang === "he" ? `לא נמצאו תוצאות עבור "${catSearch}"` : `No results for "${catSearch}"`}
                  </div>
                  <button
                    onClick={() => setCatSearch("")}
                    style={{
                      marginTop: 16, background: "none", border: "1px solid rgba(197,168,128,0.3)",
                      color: "#C5A880", borderRadius: 20, padding: "6px 18px",
                      fontSize: 13, cursor: "pointer",
                    }}
                  >
                    {lang === "he" ? "נקה חיפוש" : "Clear search"}
                  </button>
                </div>
              );
            }

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {filtered.map((cat) => {
                  const catQty = cartQtyByCat(cat.id);
                  // highlight matching item names when searching
                  const matchingItems = q
                    ? cat.items.filter(i => getItemName(i, lang).toLowerCase().includes(q))
                    : [];
                  // best image: cat.image → first item with image → null
                  const catImg = cat.image
                    || cat.items.find(i => i.image)?.image
                    || null;
                  return (
                  <div key={cat.id} onClick={() => openCategory(cat)}
                onMouseEnter={e => { (e.currentTarget.querySelector(".cat-bg") as HTMLElement | null)?.style && ((e.currentTarget.querySelector(".cat-bg") as HTMLElement).style.transform = "scale(1.06)"); }}
                onMouseLeave={e => { (e.currentTarget.querySelector(".cat-bg") as HTMLElement | null)?.style && ((e.currentTarget.querySelector(".cat-bg") as HTMLElement).style.transform = "scale(1)"); }}
                style={{
                  position: "relative", height: 140, borderRadius: 18, overflow: "hidden",
                  cursor: "pointer",
                  boxShadow: catQty > 0
                    ? "0 4px 24px rgba(197,168,128,0.22), 0 0 0 1.5px rgba(197,168,128,0.35)"
                    : "0 4px 16px rgba(0,0,0,0.4)",
                  transition: "box-shadow 200ms",
                }}>
                {/* Category background image */}
                {catImg ? (
                  <>
                    {/* actual photo — behind the text overlay */}
                    <div className="cat-bg" style={{
                      position: "absolute", inset: 0,
                      backgroundImage: `url('${catImg}')`,
                      backgroundSize: "cover", backgroundPosition: "center",
                      transition: "transform 350ms ease",
                    }} />
                    {/* dark overlay: strong on the text side, transparent on photo side */}
                    <div style={{
                      position: "absolute", inset: 0,
                      background: t.dir === "rtl"
                        ? "linear-gradient(to right, rgba(10,10,10,0.92) 38%, rgba(10,10,10,0.35) 100%)"
                        : "linear-gradient(to left,  rgba(10,10,10,0.92) 38%, rgba(10,10,10,0.35) 100%)",
                    }} />
                  </>
                ) : (
                  /* no image at all → dark branded gradient */
                  <div className="cat-bg" style={{
                    position: "absolute", inset: 0,
                    background: "linear-gradient(135deg, #1a130a 0%, #1e1a10 50%, #131313 100%)",
                    transition: "transform 350ms ease",
                  }} />
                )}
                {/* Text */}
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", flexDirection: "column", justifyContent: "center",
                  padding: "0 24px",
                }}>
                  <h3 style={{ fontSize: 20, fontWeight: 500, color: "#fff", letterSpacing: "0.03em", marginBottom: 4 }}>
                    {getCatName(cat, lang)}
                  </h3>
                  {/* show matching dishes when searching, otherwise item count */}
                  {matchingItems.length > 0 ? (
                    <p style={{ color: "#C5A880", fontSize: 11, fontWeight: 500 }}>
                      🔍 {matchingItems.slice(0, 2).map(i => getItemName(i, lang)).join(" · ")}
                      {matchingItems.length > 2 ? ` +${matchingItems.length - 2}` : ""}
                    </p>
                  ) : (
                    <p style={{ color: "#a3a3a3", fontSize: 12, fontWeight: 300 }}>
                      {cat.items.filter(i => i.isActive !== false).length} {lang === "he" ? "מנות" : lang === "en" ? "dishes" : lang === "ru" ? "блюд" : "plats"}
                    </p>
                  )}
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
            );
          })()}

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
                  {(item.image || restaurant.logo) && (
                    <div style={{ position: "relative", width: 88, height: 88, borderRadius: 12, overflow: "visible", flexShrink: 0 }}>
                      <div style={{
                        width: 88, height: 88, borderRadius: 12, overflow: "hidden",
                        background: item.image ? undefined : "rgba(255,255,255,0.04)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        border: item.image ? undefined : "1px solid rgba(197,168,128,0.15)",
                      }}>
                        <img
                          src={item.image || restaurant.logo!}
                          alt={getItemName(item, lang)}
                          style={{
                            width: "100%", height: "100%",
                            objectFit: item.image ? "cover" : "contain",
                            padding: item.image ? 0 : 10,
                            opacity: item.image ? 1 : 0.45,
                          }}
                        />
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

                  {/* Qty badge when neither item image nor logo */}
                  {!item.image && !restaurant.logo && inCart && (
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
          position: "fixed", bottom: loyaltyMember ? 24 : 100, right: 20, zIndex: 50,
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

      {/* ── Floating club button (non-members on categories/items) ── */}
      {!loyaltyMember && (elegantView === "categories" || elegantView === "items") && (
        <button onClick={() => { setClubStep("promo"); elegantNavigateTo("clubwelcome"); }}
          style={{
            position: "fixed", bottom: 24, left: 16, zIndex: 60,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            padding: "12px 16px 10px", borderRadius: 18,
            background: "linear-gradient(135deg, #C5A880 0%, #dfc090 100%)", color: "#0D0D0D",
            border: "none", fontWeight: 700, fontSize: 11,
            cursor: "pointer", boxShadow: "0 6px 28px rgba(197,168,128,0.35)",
            maxWidth: 130, textAlign: "center", lineHeight: 1.35,
          }}>
          <span style={{ fontSize: 20 }}>⭐</span>
          הצטרף למועדון
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
                  const isPaid = order.status === "PAID";
                  const statusColor = isPaid ? "#4ade80" : (STATUS_COLOR[order.status] ?? "#999");
                  const statusLabel = isPaid ? "✓ שולם" : (STATUS_LABEL[order.status] ?? order.status);
                  return (
                    <div key={order.id} style={{
                      marginBottom: 14, borderRadius: 12, overflow: "hidden",
                      border: isPaid ? "1.5px solid rgba(74,222,128,0.4)" : `1.5px solid ${statusColor}44`,
                      background: isPaid ? "rgba(74,222,128,0.05)" : `${statusColor}0a`,
                      opacity: isPaid ? 0.85 : 1,
                    }}>
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "8px 14px",
                        background: isPaid ? "rgba(74,222,128,0.1)" : `${statusColor}18`,
                        borderBottom: isPaid ? "1px solid rgba(74,222,128,0.25)" : `1px solid ${statusColor}33`,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {order.orderNumber && (
                            <span style={{
                              fontSize: 13, fontWeight: 900, color: statusColor,
                              fontFamily: "'Cinzel', serif", letterSpacing: "0.04em",
                            }}>#{order.orderNumber}</span>
                          )}
                          <span style={{ fontSize: 13, fontWeight: 700, color: statusColor }}>{statusLabel}</span>
                          {ordersView === "all" && order.customerName && (
                            <span style={{ fontSize: 11, color: "#C5A880", fontWeight: 600 }}>👤 {order.customerName}</span>
                          )}
                        </div>
                        <span style={{ fontSize: 12, color: "#fff", opacity: 0.5 }}>₪{order.totalAmount.toFixed(0)}</span>
                      </div>
                      {!isPaid && (
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
                      )}
                      {isPaid && (
                        <div style={{ padding: "8px 14px", fontSize: 12, color: "#4ade80", opacity: 0.7, textAlign: "center" }}>
                          {order.items.length} פריטים · ₪{order.totalAmount.toFixed(0)}
                        </div>
                      )}
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

      {/* ── Thank-you / payment received overlay ── */}
      {showThankYou && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(10,9,8,0.97)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 20,
        }}>
          <div style={{ fontSize: 64 }}>🙏</div>
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 28, color: "#C5A880", fontWeight: 700 }}>תודה רבה</div>
          <div style={{ color: "#9e9e9e", fontSize: 16 }}>התשלום התקבל. נשמח לראותך שוב!</div>
        </div>
      )}

      {/* ── Loyalty Club Panel ── */}
      {showLoyalty && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 80,
            background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowLoyalty(false); }}
        >
          <div style={{
            width: "min(480px, 100vw)",
            background: "#111",
            borderRadius: "20px 20px 0 0",
            padding: "24px 24px max(24px, env(safe-area-inset-bottom, 24px))",
            border: "1px solid rgba(197,168,128,0.2)",
            borderBottom: "none",
            boxShadow: "0 -20px 60px rgba(0,0,0,0.7)",
            maxHeight: "85vh",
            overflowY: "auto",
            direction: "rtl",
          }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22 }}>⭐</span>
                <span style={{ fontFamily: "var(--font-cinzel, 'Cinzel', serif)", fontSize: 18, color: "#C5A880", fontWeight: 600, letterSpacing: 2 }}>
                  מועדון לקוחות
                </span>
              </div>
              <button
                onClick={() => setShowLoyalty(false)}
                style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, width: 30, height: 30, cursor: "pointer", color: "#fff", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}
              >✕</button>
            </div>

            {/* Loading state */}
            {loyaltyLoading && (
              <div style={{ textAlign: "center", padding: "32px 0", color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
                טוען...
              </div>
            )}

            {/* Member card */}
            {!loyaltyLoading && loyaltyMember && (
              <div>
                {loyaltyJustJoined && (
                  <div style={{
                    background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)",
                    borderRadius: 10, padding: "10px 14px", marginBottom: 16,
                    color: "#4ade80", fontSize: 14, textAlign: "center", fontWeight: 600,
                  }}>
                    🎉 ברוכים הבאים למועדון! קיבלתם נקודות בונוס הצטרפות
                  </div>
                )}

                {/* Card */}
                <div style={{
                  background: "linear-gradient(135deg, #1a1200 0%, #2a1f00 50%, #1a1200 100%)",
                  border: "1px solid rgba(197,168,128,0.4)",
                  borderRadius: 16, padding: "20px 22px", marginBottom: 20,
                  boxShadow: "0 4px 24px rgba(197,168,128,0.15)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                    <div>
                      <div style={{ fontFamily: "var(--font-cinzel, 'Cinzel', serif)", fontSize: 12, color: "#C5A880", letterSpacing: 3, opacity: 0.7, marginBottom: 4 }}>
                        חבר מועדון
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>{loyaltyMember.name}</div>
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: 13, color: "rgba(197,168,128,0.6)", fontWeight: 600 }}>
                      #{loyaltyMember.memberNumber}
                    </div>
                  </div>

                  <div style={{ borderTop: "1px solid rgba(197,168,128,0.2)", paddingTop: 14 }}>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 2 }}>
                      הנקודות שלי
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontFamily: "var(--font-cinzel, 'Cinzel', serif)", fontSize: 36, fontWeight: 900, color: "#C5A880" }}>
                        {loyaltyMember.points.toLocaleString()}
                      </span>
                      <span style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>נקודות</span>
                    </div>
                    <div style={{ fontSize: 13, color: "rgba(197,168,128,0.6)", marginTop: 2 }}>
                      שווי: ₪{(loyaltyMember.points * 0.1).toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Recent transactions */}
                {loyaltyMember.transactions.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>
                      עסקאות אחרונות
                    </div>
                    {loyaltyMember.transactions.slice(0, 5).map(tx => (
                      <div key={tx.id} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)",
                      }}>
                        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
                          {tx.note ?? (tx.type === "EARN" ? "צבירה" : tx.type === "REDEEM" ? "מימוש" : tx.type === "BONUS" ? "בונוס" : "ידני")}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: tx.points > 0 ? "#4ade80" : "#f87171" }}>
                          {tx.points > 0 ? "+" : ""}{tx.points}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Registration form (not a member yet) */}
            {!loyaltyLoading && loyaltyNotFound && !loyaltyMember && (
              <div>
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <div style={{ fontSize: 34, marginBottom: 8 }}>⭐</div>
                  <div style={{ color: "#C5A880", fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
                    הצטרפו למועדון הלקוחות
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.5 }}>
                    צברו נקודות על כל רכישה וקבלו הטבות בלעדיות
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    שם מלא
                  </label>
                  <input
                    type="text"
                    value={loyaltyForm.name}
                    onChange={e => setLoyaltyForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="ישראל ישראלי"
                    style={{
                      width: "100%", padding: "10px 12px", borderRadius: 10, fontSize: 14,
                      background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)",
                      color: "#fff", outline: "none", boxSizing: "border-box" as const,
                    }}
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    טלפון
                  </label>
                  <input
                    type="tel"
                    value={loyaltyForm.phone}
                    onChange={e => setLoyaltyForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="050-0000000"
                    dir="ltr"
                    style={{
                      width: "100%", padding: "10px 12px", borderRadius: 10, fontSize: 14,
                      background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)",
                      color: "#fff", outline: "none", boxSizing: "border-box" as const,
                    }}
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    אימייל (אופציונלי)
                  </label>
                  <input
                    type="email"
                    value={loyaltyForm.email}
                    onChange={e => setLoyaltyForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="email@example.com"
                    dir="ltr"
                    style={{
                      width: "100%", padding: "10px 12px", borderRadius: 10, fontSize: 14,
                      background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)",
                      color: "#fff", outline: "none", boxSizing: "border-box" as const,
                    }}
                  />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    תאריך לידה (אופציונלי)
                  </label>
                  <input
                    type="date"
                    value={loyaltyForm.birthDate}
                    onChange={e => setLoyaltyForm(f => ({ ...f, birthDate: e.target.value }))}
                    style={{
                      width: "100%", padding: "10px 12px", borderRadius: 10, fontSize: 14,
                      background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)",
                      color: "#fff", outline: "none", boxSizing: "border-box" as const,
                    }}
                  />
                </div>

                {loyaltyFormError && (
                  <div style={{ background: "rgba(239,68,68,0.15)", color: "#fca5a5", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 14 }}>
                    {loyaltyFormError}
                  </div>
                )}

                <button
                  onClick={handleLoyaltyRegister}
                  disabled={loyaltyRegistering}
                  style={{
                    width: "100%", padding: "12px 16px", borderRadius: 50,
                    background: "#C5A880", color: "#0D0D0D",
                    border: "none", fontWeight: 700, fontSize: 15,
                    cursor: loyaltyRegistering ? "not-allowed" : "pointer",
                    opacity: loyaltyRegistering ? 0.55 : 1,
                    fontFamily: "var(--font-rubik, 'Rubik', sans-serif)",
                  }}
                >
                  {loyaltyRegistering ? "מצרף..." : "⭐ הצטרף למועדון"}
                </button>

                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textAlign: "center", marginTop: 10 }}>
                  הצטרפות חינם • קבל נקודות בונוס מיד עם ההרשמה
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

// ── Club Welcome Screen Component ──────────────────────────────────────────────
function ClubWelcomeScreen({
  restaurantId,
  restaurantName,
  restaurantLogo,
  clubStep,
  setClubStep,
  clubForm,
  setClubForm,
  clubLoginPhone,
  setClubLoginPhone,
  clubLoading,
  clubError,
  setClubError,
  clubOtp,
  setClubOtp,
  clubEmailVerified,
  clubOtpSending,
  clubOtpSent,
  clubWelcomeBackName,
  clubWelcomeBonus,
  loyaltyMember,
  handleClubAutoLogin,
  handleClubLogin,
  handleClubRegister,
  handleSendEmailOtp,
  handleVerifyEmailOtp,
  onSkip,
  onGoBack,
}: {
  restaurantId: string;
  restaurantName: string;
  restaurantLogo: string | null;
  clubStep: "promo" | "register" | "login" | "otp" | "welcome_back";
  setClubStep: (s: "promo" | "register" | "login" | "otp" | "welcome_back") => void;
  clubForm: { name: string; phone: string; email: string; birthDate: string };
  setClubForm: React.Dispatch<React.SetStateAction<{ name: string; phone: string; email: string; birthDate: string }>>;
  clubLoginPhone: string;
  setClubLoginPhone: (v: string) => void;
  clubLoading: boolean;
  clubError: string;
  setClubError: (e: string) => void;
  clubOtp: string;
  setClubOtp: (v: string) => void;
  clubEmailVerified: boolean;
  clubOtpSending: boolean;
  clubOtpSent: boolean;
  clubWelcomeBackName: string;
  clubWelcomeBonus: number;
  loyaltyMember: LoyaltyMemberData | null;
  handleClubAutoLogin: (phone: string) => Promise<void>;
  handleClubLogin: () => Promise<void>;
  handleClubRegister: () => Promise<void>;
  handleSendEmailOtp: () => Promise<void>;
  handleVerifyEmailOtp: () => Promise<void>;
  onSkip: () => void;
  onGoBack: () => void;
}) {
  // Auto-check localStorage for stored phone on mount
  useEffect(() => {
    const storedPhone = localStorage.getItem(`menu4u_loyalty_phone_${restaurantId}`);
    if (storedPhone && clubStep === "promo") {
      handleClubAutoLogin(storedPhone);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 10,
    fontSize: 15,
    background: "#1a1d23",
    border: "1px solid #2d3239",
    color: "#e9ecef",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "var(--font-rubik, 'Rubik', sans-serif)",
  };

  return (
    <section style={{
      minHeight: "100vh",
      background: "#0a0908",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 24px max(40px, env(safe-area-inset-bottom, 40px))",
      direction: "rtl",
      position: "relative",
    }}>

      {/* Back button */}
      {clubStep !== "welcome_back" && (
        <button
          onClick={clubStep === "promo" ? onGoBack : () => { setClubStep("promo"); setClubError(""); }}
          style={{
            position: "absolute", top: 20, right: 20,
            background: "none", border: "none",
            color: "#C5A880", fontSize: 14, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 4,
            fontFamily: "var(--font-rubik, 'Rubik', sans-serif)",
          }}
        >
          › חזרה
        </button>
      )}

      {/* Small logo */}
      {restaurantLogo && (
        <img
          src={restaurantLogo}
          alt={restaurantName}
          style={{ height: 44, objectFit: "contain", marginBottom: 16, opacity: 0.85 }}
        />
      )}

      <div style={{ width: "100%", maxWidth: 400 }}>

        {/* ── PROMO STEP ── */}
        {clubStep === "promo" && (
          <div style={{ textAlign: "center" }}>
            {clubLoading ? (
              <div style={{ color: "rgba(197,168,128,0.6)", fontSize: 14, padding: "40px 0" }}>
                מחפש את הכרטיס שלך...
              </div>
            ) : (
              <>
                <div style={{ fontSize: 48, marginBottom: 12 }}>⭐</div>
                <h2 style={{
                  fontFamily: "var(--font-cinzel, 'Cinzel', serif)",
                  fontSize: "clamp(22px, 6vw, 32px)",
                  fontWeight: 600,
                  color: "#C5A880",
                  letterSpacing: "0.04em",
                  margin: "0 0 8px 0",
                }}>
                  מועדון {restaurantName}
                </h2>

                <p style={{ color: "#d4cdc7", fontSize: 15, marginBottom: 28, lineHeight: 1.6 }}>
                  הצטרף עכשיו וקבל {clubWelcomeBonus > 0 ? `${clubWelcomeBonus} נקודות מתנה` : "נקודות בונוס"}
                </p>

                {/* Benefit bullets */}
                <div style={{ textAlign: "right", marginBottom: 32, display: "flex", flexDirection: "column", gap: 12 }}>
                  {[
                    "נקודות על כל הזמנה",
                    "הטבות בלעדיות לחברים",
                    "מבצעים ועדכונים ראשון",
                  ].map((benefit, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ color: "#C5A880", fontSize: 18, flexShrink: 0 }}>✓</span>
                      <span style={{ color: "#d4cdc7", fontSize: 14 }}>{benefit}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <button
                  onClick={() => { setClubStep("register"); setClubError(""); }}
                  style={{
                    width: "100%",
                    padding: "16px 0",
                    borderRadius: 50,
                    background: "linear-gradient(135deg, #C5A880 0%, #dfc090 100%)",
                    color: "#0D0D0D",
                    border: "none",
                    fontWeight: 700,
                    fontSize: 16,
                    cursor: "pointer",
                    marginBottom: 14,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    fontFamily: "var(--font-rubik, 'Rubik', sans-serif)",
                  }}
                >
                  <span>⭐</span> הצטרף עכשיו
                </button>

                <button
                  onClick={() => { setClubStep("login"); setClubError(""); }}
                  style={{
                    width: "100%",
                    padding: "14px 0",
                    borderRadius: 50,
                    background: "transparent",
                    color: "#C5A880",
                    border: "1.5px solid #C5A880",
                    fontWeight: 600,
                    fontSize: 15,
                    cursor: "pointer",
                    marginBottom: 20,
                    fontFamily: "var(--font-rubik, 'Rubik', sans-serif)",
                  }}
                >
                  כבר רשום? כניסה לפי טלפון
                </button>

                <button
                  onClick={onSkip}
                  style={{
                    background: "none",
                    border: "none",
                    color: "rgba(255,255,255,0.35)",
                    fontSize: 13,
                    cursor: "pointer",
                    fontFamily: "var(--font-rubik, 'Rubik', sans-serif)",
                  }}
                >
                  דלג לתפריט ›
                </button>
              </>
            )}
          </div>
        )}

        {/* ── REGISTER STEP ── */}
        {clubStep === "register" && (
          <div>
            <h2 style={{
              fontFamily: "var(--font-cinzel, 'Cinzel', serif)",
              fontSize: 22,
              fontWeight: 600,
              color: "#C5A880",
              marginBottom: 24,
              textAlign: "center",
            }}>
              הצטרפות למועדון
            </h2>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, color: "#d4cdc7", marginBottom: 6, fontWeight: 600 }}>
                שם מלא *
              </label>
              <input
                type="text"
                value={clubForm.name}
                onChange={e => setClubForm(f => ({ ...f, name: e.target.value }))}
                placeholder="ישראל ישראלי"
                autoFocus
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, color: "#d4cdc7", marginBottom: 6, fontWeight: 600 }}>
                טלפון *
              </label>
              <input
                type="tel"
                value={clubForm.phone}
                onChange={e => setClubForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="050-0000000"
                dir="ltr"
                style={{ ...inputStyle, textAlign: "right" }}
              />
            </div>

            <div style={{ marginBottom: clubOtpSent || clubEmailVerified ? 8 : 14 }}>
              <label style={{ display: "block", fontSize: 12, color: "#d4cdc7", marginBottom: 6, fontWeight: 600 }}>
                אימייל (אופציונלי)
                {clubEmailVerified && <span style={{ color: "#4ade80", marginRight: 6 }}>✓ מאומת</span>}
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="email"
                  value={clubForm.email}
                  onChange={e => { setClubForm(f => ({ ...f, email: e.target.value })); }}
                  placeholder="email@example.com"
                  dir="ltr"
                  style={{ ...inputStyle, flex: 1, textAlign: "right" }}
                  disabled={clubEmailVerified}
                />
                {clubForm.email && clubForm.email.includes("@") && !clubEmailVerified && !clubOtpSent && (
                  <button
                    onClick={handleSendEmailOtp}
                    disabled={clubOtpSending}
                    style={{
                      flexShrink: 0,
                      padding: "0 14px",
                      borderRadius: 10,
                      background: "transparent",
                      color: "#C5A880",
                      border: "1.5px solid #C5A880",
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: clubOtpSending ? "not-allowed" : "pointer",
                      whiteSpace: "nowrap",
                      fontFamily: "var(--font-rubik, 'Rubik', sans-serif)",
                    }}
                  >
                    {clubOtpSending ? "שולח..." : "שלח קוד"}
                  </button>
                )}
              </div>
            </div>

            {/* Inline OTP verification */}
            {clubOtpSent && !clubEmailVerified && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, color: "#d4cdc7", marginBottom: 6, fontWeight: 600 }}>
                  קוד אימות (נשלח לאימייל)
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={clubOtp}
                    onChange={e => setClubOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="• • • • • •"
                    maxLength={6}
                    autoFocus
                    style={{ ...inputStyle, flex: 1, textAlign: "center", letterSpacing: 6, fontWeight: 700, fontSize: 20, color: "#C5A880" }}
                  />
                  <button
                    onClick={handleVerifyEmailOtp}
                    disabled={clubOtp.length !== 6 || clubLoading}
                    style={{
                      flexShrink: 0,
                      padding: "0 14px",
                      borderRadius: 10,
                      background: "#C5A880",
                      color: "#0D0D0D",
                      border: "none",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: clubOtp.length !== 6 || clubLoading ? "not-allowed" : "pointer",
                      opacity: clubOtp.length !== 6 ? 0.5 : 1,
                      fontFamily: "var(--font-rubik, 'Rubik', sans-serif)",
                    }}
                  >
                    אמת
                  </button>
                </div>
              </div>
            )}

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 12, color: "#d4cdc7", marginBottom: 6, fontWeight: 600 }}>
                תאריך לידה (אופציונלי)
              </label>
              <input
                type="date"
                value={clubForm.birthDate}
                onChange={e => setClubForm(f => ({ ...f, birthDate: e.target.value }))}
                style={inputStyle}
              />
            </div>

            {clubError && (
              <div style={{
                background: "rgba(239,68,68,0.15)", color: "#fca5a5",
                borderRadius: 8, padding: "10px 14px",
                fontSize: 13, marginBottom: 16, textAlign: "center",
              }}>
                {clubError}
              </div>
            )}

            <button
              onClick={handleClubRegister}
              disabled={clubLoading || (!!clubForm.email && !clubEmailVerified && clubForm.email.includes("@"))}
              style={{
                width: "100%",
                padding: "15px 0",
                borderRadius: 50,
                background: "linear-gradient(135deg, #C5A880 0%, #dfc090 100%)",
                color: "#0D0D0D",
                border: "none",
                fontWeight: 700,
                fontSize: 16,
                cursor: clubLoading ? "not-allowed" : "pointer",
                opacity: clubLoading ? 0.6 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontFamily: "var(--font-rubik, 'Rubik', sans-serif)",
              }}
            >
              {clubLoading ? "מצרף..." : "⭐ הצטרף"}
            </button>

            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textAlign: "center", marginTop: 12 }}>
              הצטרפות חינם • ניתן לדלג בכל עת
            </div>
          </div>
        )}

        {/* ── LOGIN STEP ── */}
        {clubStep === "login" && (
          <div style={{ textAlign: "center" }}>
            <h2 style={{
              fontFamily: "var(--font-cinzel, 'Cinzel', serif)",
              fontSize: 22,
              fontWeight: 600,
              color: "#C5A880",
              marginBottom: 8,
            }}>
              כניסה לפי טלפון
            </h2>
            <p style={{ color: "#d4cdc7", fontSize: 14, marginBottom: 28 }}>
              הזן את מספר הטלפון שנרשמת איתו
            </p>

            <input
              type="tel"
              value={clubLoginPhone}
              onChange={e => setClubLoginPhone(e.target.value)}
              placeholder="050-0000000"
              dir="ltr"
              autoFocus
              onKeyDown={e => { if (e.key === "Enter") handleClubLogin(); }}
              style={{ ...inputStyle, fontSize: 18, textAlign: "center", marginBottom: 20 }}
            />

            {clubError && (
              <div style={{
                background: "rgba(239,68,68,0.15)", color: "#fca5a5",
                borderRadius: 8, padding: "10px 14px",
                fontSize: 13, marginBottom: 16,
              }}>
                {clubError}
              </div>
            )}

            <button
              onClick={handleClubLogin}
              disabled={clubLoading}
              style={{
                width: "100%",
                padding: "15px 0",
                borderRadius: 50,
                background: "linear-gradient(135deg, #C5A880 0%, #dfc090 100%)",
                color: "#0D0D0D",
                border: "none",
                fontWeight: 700,
                fontSize: 16,
                cursor: clubLoading ? "not-allowed" : "pointer",
                opacity: clubLoading ? 0.6 : 1,
                fontFamily: "var(--font-rubik, 'Rubik', sans-serif)",
                marginBottom: 14,
              }}
            >
              {clubLoading ? "מחפש..." : "אחפש את הכרטיס שלך"}
            </button>

            {clubError && clubError.includes("לא מצאנו") && (
              <button
                onClick={() => { setClubStep("register"); setClubError(""); }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#C5A880",
                  fontSize: 14,
                  cursor: "pointer",
                  fontFamily: "var(--font-rubik, 'Rubik', sans-serif)",
                  textDecoration: "underline",
                }}
              >
                הצטרף עכשיו ›
              </button>
            )}
          </div>
        )}

        {/* ── WELCOME BACK STEP ── */}
        {clubStep === "welcome_back" && (
          <div style={{ textAlign: "center" }}>
            <div style={{
              fontSize: 64,
              marginBottom: 16,
              animation: "pulse 1.5s ease-in-out infinite",
            }}>⭐</div>
            <style>{`@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.15); } }`}</style>

            <h2 style={{
              fontFamily: "var(--font-cinzel, 'Cinzel', serif)",
              fontSize: "clamp(20px, 5vw, 28px)",
              fontWeight: 600,
              color: "#C5A880",
              marginBottom: 8,
            }}>
              יופי שחזרת, {clubWelcomeBackName}! 🎉
            </h2>

            {loyaltyMember && loyaltyMember.points > 0 && (
              <p style={{ color: "#d4cdc7", fontSize: 16, marginBottom: 28 }}>
                <span style={{ fontFamily: "var(--font-cinzel, 'Cinzel', serif)", fontSize: 36, color: "#C5A880", fontWeight: 900, display: "block", lineHeight: 1.2 }}>
                  {loyaltyMember.points.toLocaleString()}
                </span>
                נקודות מחכות לך
              </p>
            )}

            {(!loyaltyMember || loyaltyMember.points === 0) && clubWelcomeBonus > 0 && (
              <p style={{ color: "#d4cdc7", fontSize: 16, marginBottom: 28 }}>
                <span style={{ fontFamily: "var(--font-cinzel, 'Cinzel', serif)", fontSize: 36, color: "#C5A880", fontWeight: 900, display: "block", lineHeight: 1.2 }}>
                  {clubWelcomeBonus}
                </span>
                נקודות מחכות לך
              </p>
            )}

            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 24 }}>
              עובר לתפריט...
            </p>
          </div>
        )}

      </div>
    </section>
  );
}
