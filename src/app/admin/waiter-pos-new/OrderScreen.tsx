"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { CartItemModifier } from "./OrderPanel";
import type { OrderDetail, OrderItemDetail } from "./TableOverlay";
import { ALLERGEN_LIST } from "@/lib/allergens";
import { ManagerPinModal } from "./ManagerPinModal";
import Receipt from "./Receipt";
import { idbSet, idbGet } from "@/lib/waiter-db";

type ModifierOption = { id: string; label: string; priceAdd: number };
type ModifierGroup  = { id: string; name: string; required: boolean; maxSelect: number; options: ModifierOption[] };

type MenuItem = {
  id: string; name: string; description: string | null;
  price: number; image: string | null; allergens: string[];
  isVegetarian: boolean; isVegan: boolean; isGlutenFree: boolean;
  course?: number;
  modifierGroups: ModifierGroup[];
};
type MenuCategory = { id: string; name: string; items: MenuItem[] };

type CartItem = {
  key: string; itemId: string; name: string; price: number;
  quantity: number; course: number; notes: string; allergens: string[]; modifiers: CartItemModifier[];
};

type Props = {
  tableNum: string;
  orderId: string | null;
  guestCount: number;
  tableAllergens: string[];
  restaurantId: string;
  existingOrder: OrderDetail | null;
  isOffline?: boolean;
  enqueueOffline?: (payload: object) => string;
  areaName?: string;
  shiftName?: string;
  waiterName?: string;
  restaurantName?: string;
  onClose: () => void;
  onSuccess: (newOrderId?: string) => void;
  onQueued?: () => void;
};

const POPULAR_CAT_ID = "__popular__";
// Course → single-letter badge (first letter of the Hebrew course name).
const COURSE_LETTER: Record<number, string> = { 1: "ר", 2: "ע", 3: "ק" };
const courseLetter = (c: number) => COURSE_LETTER[c] ?? String(c);

export function OrderScreen({
  tableNum, orderId, guestCount, tableAllergens, restaurantId, existingOrder,
  isOffline = false, enqueueOffline, areaName, shiftName, waiterName, restaurantName,
  onClose, onSuccess, onQueued,
}: Props) {
  const router = useRouter();
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<string>("");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<OrderDetail | null>(existingOrder);
  const [modifierItem, setModifierItem] = useState<MenuItem | null>(null);
  const [modifierSel, setModifierSel] = useState<Record<string, string[]>>({});
  const [covers, setCovers] = useState(guestCount || 1);
  const [allergens, setAllergens] = useState<string[]>(tableAllergens);
  const [coversOpen, setCoversOpen] = useState(false);
  const [allergensOpen, setAllergensOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [firingCourse, setFiringCourse] = useState<number | null>(null);
  const [voidItem, setVoidItem] = useState<{ id: string; name: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Load popular + menu (IDB fallback offline) ──
  useEffect(() => {
    fetch(`/api/admin/waiter-pos/popular?restaurantId=${restaurantId}`)
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => {
        if ((d.items ?? []).length > 0) {
          setCategories(prev => prev.some(c => c.id === POPULAR_CAT_ID) ? prev : [{ id: POPULAR_CAT_ID, name: "⭐ פופולרי", items: d.items }, ...prev]);
        }
      }).catch(() => {});
  }, [restaurantId]);

  useEffect(() => {
    fetch(`/api/admin/waiter-pos/menu?restaurantId=${restaurantId}`)
      .then(async r => {
        const text = await r.text();
        let d: Record<string, unknown>;
        try { d = JSON.parse(text); } catch { setMenuError(`שגיאה ${r.status}`); return; }
        if (!r.ok) { setMenuError(`שגיאה ${r.status}: ${String(d?.error ?? "")}`); return; }
        const cats = (d.categories as MenuCategory[]) ?? [];
        setCategories(prev => {
          const pop = prev.filter(c => c.id === POPULAR_CAT_ID);
          return [...pop, ...cats];
        });
        if (cats.length > 0) setActiveCat(a => a || (categoriesHasPopular() ? POPULAR_CAT_ID : cats[0].id));
        else setMenuError("אין קטגוריות פעילות בתפריט");
        idbSet("menu", restaurantId, cats).catch(() => {});
      })
      .catch(async () => {
        const cached = await idbGet<MenuCategory[]>("menu", restaurantId).catch(() => undefined);
        if (cached?.length) { setCategories(cached); setActiveCat(cached[0].id); setMenuError(""); }
        else setMenuError("אין חיבור ואין תפריט שמור");
      })
      .finally(() => setLoadingMenu(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  function categoriesHasPopular() { return categories.some(c => c.id === POPULAR_CAT_ID); }

  useEffect(() => { if (!activeCat && categories.length > 0) setActiveCat(categories[0].id); }, [categories, activeCat]);

  const refreshOrder = useCallback(async (id?: string | null) => {
    const oid = id ?? orderId;
    if (!oid) return null;
    const r = await fetch(`/api/admin/orders/${oid}`);
    if (r.ok) { const o = await r.json(); setOrder(o); return o as OrderDetail; }
    return null;
  }, [orderId]);

  // ── Cart helpers ──
  function addItem(item: MenuItem) {
    if (item.modifierGroups?.length > 0) { setModifierItem(item); setModifierSel({}); return; }
    pushToCart(item, []);
  }
  function pushToCart(item: MenuItem, modifiers: CartItemModifier[]) {
    const extra = modifiers.reduce((s, m) => s + m.priceAdd, 0);
    const course = item.course ?? 1;
    const sig = modifiers.map(m => m.label).sort().join("|");
    setCart(p => {
      // Re-ordering the same dish (identical modifiers/course) bumps the quantity
      // of the existing cart line instead of adding a new row.
      const idx = p.findIndex(ci => ci.itemId === item.id && ci.course === course && ci.modifiers.map(m => m.label).sort().join("|") === sig);
      if (idx >= 0) {
        const next = [...p];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      const key = `${item.id}-c${course}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      return [...p, { key, itemId: item.id, name: item.name, price: Number(item.price) + extra, quantity: 1, course, notes: "", allergens: item.allergens ?? [], modifiers }];
    });
  }
  function confirmModifiers() {
    if (!modifierItem) return;
    for (const g of modifierItem.modifierGroups) if (g.required && (modifierSel[g.id] ?? []).length === 0) return;
    const mods: CartItemModifier[] = [];
    for (const g of modifierItem.modifierGroups) for (const optId of (modifierSel[g.id] ?? [])) {
      const opt = g.options.find(o => o.id === optId); if (opt) mods.push({ groupName: g.name, label: opt.label, priceAdd: opt.priceAdd });
    }
    pushToCart(modifierItem, mods); setModifierItem(null);
  }
  function toggleModOption(groupId: string, optId: string, maxSelect: number) {
    setModifierSel(prev => {
      const cur = prev[groupId] ?? [];
      if (cur.includes(optId)) return { ...prev, [groupId]: cur.filter(id => id !== optId) };
      if (maxSelect === 1) return { ...prev, [groupId]: [optId] };
      if (cur.length >= maxSelect) return prev;
      return { ...prev, [groupId]: [...cur, optId] };
    });
  }
  function changeQty(key: string, qty: number) {
    if (qty <= 0) setCart(p => p.filter(i => i.key !== key));
    else setCart(p => p.map(i => i.key === key ? { ...i, quantity: qty } : i));
  }
  function changeNotes(key: string, notes: string) { setCart(p => p.map(i => i.key === key ? { ...i, notes } : i)); }
  function cartQtyForItem(itemId: string) { return cart.filter(i => i.itemId === itemId).reduce((s, i) => s + i.quantity, 0); }

  const toggleAllergen = (k: string) => setAllergens(a => a.includes(k) ? a.filter(x => x !== k) : [...a, k]);
  const hasAllergy = (item: MenuItem) => (item.allergens ?? []).some(a => allergens.includes(a));

  // ── Save cart → returns order id (or null) ──
  async function submitCart(): Promise<string | null> {
    if (cart.length === 0) return orderId;
    const items = cart.map(i => ({ itemId: i.itemId, quantity: i.quantity, course: i.course, notes: i.notes || null, modifiers: i.modifiers }));
    if (orderId) {
      await fetch(`/api/admin/orders/${orderId}/add-items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items, tableAllergens: allergens }) });
      setCart([]);
      return orderId;
    }
    const payload = { restaurantId, tableNumber: tableNum, coversCount: covers, tableAllergens: allergens, items };
    if (isOffline && enqueueOffline) { enqueueOffline(payload); onQueued?.(); return null; }
    const r = await fetch("/api/admin/orders/waiter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const newOrder = await r.json();
    setCart([]);
    return newOrder?.id ?? null;
  }

  // "שחרר מנה" — final approval: save the cart, then open the per-course release modal.
  async function handleRelease() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const oid = await submitCart();
      if (!oid) return; // offline queued → closed via onQueued
      await refreshOrder(oid);
      setReleaseOpen(true);
    } finally { setSubmitting(false); }
  }

  async function fireCourse(course: number) {
    if (!order) return;
    setFiringCourse(course);
    await fetch(`/api/admin/orders/${order.id}/fire-course`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ course }) });
    await refreshOrder(order.id);
    setFiringCourse(null);
  }

  async function doVoid(token: string) {
    if (!voidItem || !order) return;
    setActionLoading(true);
    await fetch(`/api/admin/orders/${order.id}/items/${voidItem.id}/void`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ managerToken: token }) });
    setActionLoading(false); setVoidItem(null);
    await refreshOrder(order.id);
  }

  function goPayment() {
    router.push(`/admin/cashier?tableNumber=${encodeURIComponent(tableNum)}&restaurantId=${encodeURIComponent(restaurantId)}&waiter=1&returnTo=/admin/waiter-pos`);
  }

  // ── Derived ──
  const activeCategory = categories.find(c => c.id === activeCat);
  const filteredItems = (activeCategory?.items ?? []).filter(item => !search || item.name.toLowerCase().includes(search.toLowerCase()));
  const existingItems = (order?.items ?? []).filter(i => !i.voidedAt);
  const existingTotal = existingItems.reduce((s, i) => s + (i.isComped ? 0 : i.price * i.quantity), 0);
  const newTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const total = existingTotal + newTotal;
  const avgPerDiner = covers > 0 ? total / covers : 0;
  const courseNums = Array.from(new Set((order?.items ?? []).filter(i => !i.voidedAt).map(i => i.course))).sort();

  // ── Styles ──
  const T = { bar: "#171a23", barLine: "rgba(255,255,255,0.08)", gold: "#d4a017", goldGrad: "linear-gradient(135deg,#D97706,#F59E0B)" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "#0c0c12", display: "flex", flexDirection: "column", fontFamily: "'Heebo', sans-serif", direction: "rtl" }}>

      {/* ══ TOP BAR — full-bleed, equal spacing between cells ══ */}
      <div style={{ background: T.bar, borderBottom: `1px solid ${T.barLine}`, height: 64, flexShrink: 0, display: "flex", alignItems: "stretch", padding: 0 }}>
        <button onClick={onClose} title="חזרה" style={{ width: 62, height: "100%", border: "none", background: T.gold, color: "#fff", fontSize: 24, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>▶</button>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 22px" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>הזמנה</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: T.gold }}>#{order?.orderNumber ?? "—"}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>אזור ישיבה</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{areaName ?? `שולחן ${tableNum}`}</div>
          </div>
          <div style={{ textAlign: "center", opacity: avgPerDiner > 60 ? 1 : 0.35 }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>ממוצע לסועד {avgPerDiner > 60 ? "😊" : ""}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: avgPerDiner > 60 ? "#34d399" : "rgba(255,255,255,0.6)" }}>₪{avgPerDiner.toFixed(0)}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>סועדים</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>👤 {covers}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: T.gold }}>{shiftName ?? "משמרת"}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>{waiterName ?? ""}</div>
          </div>
        </div>
      </div>

      {/* ══ BODY: 20% categories | 30% dishes | 50% order ══ */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* ── Categories (right, 20% / 17% mobile) ── */}
        <div style={{ width: isMobile ? "17%" : "20%", background: "#ededed", borderLeft: "1px solid #dcdcdc", overflowY: "auto", flexShrink: 0 }}>
          {loadingMenu ? (
            <div style={{ padding: 20, color: "#888", fontSize: 13 }}>טוען...</div>
          ) : categories.map(c => (
            <button key={c.id} onClick={() => setActiveCat(c.id)} style={{
              display: "block", width: "100%", textAlign: "right", padding: isMobile ? "14px 10px" : "19px 22px", border: "none",
              borderBottom: "1px solid #dcdcdc", cursor: "pointer", fontFamily: "inherit",
              fontSize: isMobile ? 13 : 16, fontWeight: activeCat === c.id ? 800 : 600,
              background: activeCat === c.id ? T.gold : "transparent",
              color: activeCat === c.id ? "#fff" : "#1a1612",
            }}>{c.name}</button>
          ))}
        </div>

        {/* ── Dishes (middle, 30%) ── */}
        <div style={{ width: isMobile ? "25%" : "30%", background: "#fff", color: "#1a1612", display: "flex", flexDirection: "column", flexShrink: 0, borderLeft: "1px solid #e3ded5" }}>
          <div style={{ padding: "10px 12px", borderBottom: "1px solid #eee", flexShrink: 0 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 חיפוש..." style={{ width: "100%", background: "#f7f6f3", border: "1px solid #e8e2da", borderRadius: 99, padding: "8px 12px", fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box", color: "#1a1612" }} />
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {menuError ? (
              <div style={{ textAlign: "center", color: "#c0392b", padding: 24, fontSize: 13, fontWeight: 700 }}>⚠️ {menuError}</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(3,1fr)", borderTop: "1px solid #eee", borderRight: "1px solid #eee" }}>
                {filteredItems.map(item => {
                  const qty = cartQtyForItem(item.id);
                  const warn = hasAllergy(item);
                  const safe = allergens.length > 0 && !warn;
                  const domeColor = warn ? "#e23b3b" : safe ? "#16a34a" : "#6f6f6f";
                  return (
                    <div key={item.id} onClick={() => addItem(item)} style={{
                      background: qty > 0 ? "rgba(200,161,58,0.08)" : "#fff",
                      borderLeft: "1px solid #eee", borderBottom: "1px solid #eee",
                      boxShadow: qty > 0 ? `inset 0 0 0 2px ${T.gold}` : "none",
                      cursor: "pointer", position: "relative", aspectRatio: "1 / 1",
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: 4, minWidth: 0,
                    }}>
                      {qty > 0 && <div style={{ position: "absolute", top: 4, left: 4, background: T.gold, color: "#fff", borderRadius: 99, minWidth: 18, height: 18, padding: "0 4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, zIndex: 2 }}>×{qty}</div>}
                      {/* Dome (cloche) — coloured by allergen status: red=contains / green=allowed / grey=no table allergens */}
                      <svg style={{ width: "clamp(20px, 2.4vw, 30px)", height: "clamp(16px, 2vw, 24px)" }} viewBox="0 0 48 40" fill="none" stroke={domeColor} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 34h40" /><path d="M8 34a16 16 0 0 1 32 0" /><line x1="24" y1="18" x2="24" y2="14" /><circle cx="24" cy="12" r="1.8" />
                      </svg>
                      <div style={{ fontSize: "clamp(11px, 1.35vw, 15px)", fontWeight: 600, color: "#333", textAlign: "center", lineHeight: 1.25, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", wordBreak: "break-word" }}>{item.name}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Order (left, fills rest) ── */}
        <div style={{ flex: 1, minWidth: 0, background: "#fff", color: "#1a1612", display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {allergens.length > 0 && (
              <div style={{ background: "#fdecea", borderBottom: "1px solid #f5c4bc", color: "#b91c1c", padding: "11px 14px", display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700 }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
                <span>שולחן עם אלרגנים: {allergens.map(k => ALLERGEN_LIST.find(a => a.key === k)?.label ?? k).join(", ")}</span>
              </div>
            )}
            {existingItems.length === 0 && cart.length === 0 && (
              <div style={{ textAlign: "center", color: "#9b8f82", fontSize: 14, padding: 40 }}>לחץ על מנה כדי להוסיף להזמנה</div>
            )}

            {/* Existing (sent) items — no X; cancel needs manager PIN */}
            {existingItems.map(i => <ExistingRow key={i.id} item={i} allergens={allergens} isMobile={isMobile} onVoid={() => setVoidItem({ id: i.id, name: i.itemName })} />)}

            {/* New cart items — deletable */}
            {cart.map(i => (
              <CartRow key={i.key} item={i} warn={i.allergens.some(a => allergens.includes(a))} isMobile={isMobile}
                onQty={q => changeQty(i.key, q)} onNotes={n => changeNotes(i.key, n)} />
            ))}
          </div>
        </div>
      </div>

      {/* ══ BOTTOM BAR — uniform full-bleed strip, flat square cells ══ */}
      <div style={{ background: T.bar, borderTop: `1px solid ${T.barLine}`, height: 66, flexShrink: 0, display: "flex", alignItems: "stretch", padding: 0 }}>
        <BCell icon="👤＋" label="סועדים" onClick={() => setCoversOpen(true)} active={false} />
        <BCell icon="⚠️" label="אלרגנים" onClick={() => setAllergensOpen(true)} active={allergens.length > 0} />
        <BCell icon="🖨" label="הדפס" onClick={() => order && setPrintOpen(true)} disabled={!order} />
        <BCell icon="💳" label="תשלום" onClick={goPayment} disabled={!order} />
        <button onClick={handleRelease} disabled={submitting || (cart.length === 0 && courseNums.length === 0)} style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, padding: "0 26px",
          border: "none", cursor: submitting ? "default" : "pointer", fontFamily: "inherit",
          background: T.gold, color: "#fff", fontWeight: 800, fontSize: 13, opacity: (cart.length === 0 && courseNums.length === 0) ? 0.55 : 1,
        }}>
          <span style={{ fontSize: 18 }}>✓</span>{submitting ? "שולח..." : "שחרר מנה"}
        </button>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "left", padding: "0 22px", borderRight: `1px solid ${T.barLine}` }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>סה״כ לתשלום</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: T.gold, fontVariantNumeric: "tabular-nums" }}>₪{total.toFixed(1)}</div>
        </div>
      </div>

      {/* ══ Modifier picker — dark glass theme (matches the waiter NEW screen) ══ */}
      {modifierItem && (
        <div onClick={() => setModifierItem(null)} style={{ position: "fixed", inset: 0, zIndex: 600, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "rgba(15,14,22,0.97)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 18, padding: 20, width: "min(96vw,420px)", maxHeight: "85vh", overflowY: "auto", direction: "rtl", display: "flex", flexDirection: "column", gap: 14, color: "#fff", fontFamily: "'Heebo', sans-serif", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `2px solid ${T.gold}`, paddingBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{modifierItem.name}</div>
              <button onClick={() => setModifierItem(null)} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, width: 32, height: 32, fontSize: 17, cursor: "pointer", color: "#fff" }}>✕</button>
            </div>
            {modifierItem.modifierGroups.map(g => (
              <div key={g.id}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: "rgba(255,255,255,0.85)" }}>{g.name} {g.required && <span style={{ color: "#fca5a5", fontSize: 10 }}>חובה</span>}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {g.options.map(opt => {
                    const active = (modifierSel[g.id] ?? []).includes(opt.id);
                    return <button key={opt.id} onClick={() => toggleModOption(g.id, opt.id, g.maxSelect)} style={{ padding: "7px 14px", borderRadius: 99, border: `1.5px solid ${active ? T.gold : "rgba(255,255,255,0.15)"}`, background: active ? "rgba(200,161,58,0.22)" : "rgba(255,255,255,0.06)", color: active ? "#f0d488" : "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{opt.label}{opt.priceAdd > 0 && <span style={{ opacity: .7, fontSize: 10 }}> +₪{opt.priceAdd}</span>}</button>;
                  })}
                </div>
              </div>
            ))}
            <button onClick={confirmModifiers} style={{ padding: 13, borderRadius: 12, border: "none", background: T.gold, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>הוסף להזמנה</button>
          </div>
        </div>
      )}

      {/* ══ Covers stepper ══ */}
      {coversOpen && (
        <Popup onClose={() => setCoversOpen(false)} title="כמות סועדים" width={380}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22, padding: "10px 0" }}>
            <button onClick={() => setCovers(c => Math.max(1, c - 1))} style={stepBtn}>−</button>
            <span style={{ fontSize: 40, fontWeight: 900, minWidth: 60, textAlign: "center", color: "#1a1612" }}>{covers}</span>
            <button onClick={() => setCovers(c => c + 1)} style={stepBtn}>+</button>
          </div>
        </Popup>
      )}

      {/* ══ Allergens editor ══ */}
      {allergensOpen && (
        <Popup onClose={() => setAllergensOpen(false)} title="אלרגיות בשולחן" width={640}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
            <button onClick={() => setAllergens([])} style={chip(allergens.length === 0)}>ללא</button>
            {ALLERGEN_LIST.map(a => <button key={a.key} onClick={() => toggleAllergen(a.key)} style={chip(allergens.includes(a.key))}>{a.label}</button>)}
          </div>
        </Popup>
      )}

      {/* ══ Course release (final approval) ══ */}
      {releaseOpen && order && (
        <Popup onClose={() => { setReleaseOpen(false); onSuccess(order.id); }} title="שחרור קורסים — אישור הזמנה">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {courseNums.length === 0 ? <div style={{ color: "#9b8f82", fontSize: 13 }}>אין קורסים בהזמנה</div> : courseNums.map(c => {
              const items = (order.items ?? []).filter(i => i.course === c && !i.voidedAt && i.itemStatus !== "CANCELLED");
              const held = items.length > 0 && items.some(i => i.heldUntilFired && !i.firedAt);
              return (
                <div key={c} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#faf8f5", border: "1px solid #e8e2da", borderRadius: 12, padding: "10px 14px" }}>
                  <div><div style={{ fontWeight: 800 }}>קורס {courseLetter(c)} · {items.length} פריטים</div><div style={{ fontSize: 11, color: "#9b8f82" }}>{held ? "ממתין לשחרור" : "נשלח למטבח"}</div></div>
                  {held && <button onClick={() => fireCourse(c)} disabled={firingCourse === c} style={{ padding: "7px 16px", borderRadius: 10, border: "none", background: T.goldGrad, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{firingCourse === c ? "…" : "🔥 שחרר"}</button>}
                </div>
              );
            })}
            <button onClick={() => { setReleaseOpen(false); onSuccess(order.id); }} style={{ marginTop: 6, padding: 14, borderRadius: 12, border: "none", background: "#1a1612", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>✓ אישור וסיום</button>
          </div>
        </Popup>
      )}

      {/* ══ Manager PIN for voiding a sent item ══ */}
      {voidItem && (
        <ManagerPinModal restaurantId={restaurantId} title="אישור ביטול מנה" description={voidItem.name} onApproved={doVoid} onCancel={() => setVoidItem(null)} />
      )}
      {actionLoading && <div style={{ position: "fixed", inset: 0, zIndex: 700, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700 }}>מבצע...</div>}

      {/* ══ Receipt print ══ */}
      {printOpen && order && (
        <Receipt order={order} tableNum={tableNum} restaurantName={restaurantName ?? "המסעדה"} waiterName={waiterName ?? ""} autoPrint onClose={() => setPrintOpen(false)} />
      )}
    </div>
  );
}

// ── Bottom-bar flat cell (uniform strip, square, divider on the left) ──
function BCell({ icon, label, onClick, active, disabled }: { icon: string; label: string; onClick: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, padding: "0 22px",
      border: "none", borderLeft: "1px solid rgba(255,255,255,0.08)", cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit",
      background: active ? "rgba(200,161,58,0.16)" : "transparent",
      color: active ? "#d4a017" : "#e6e6e6", fontWeight: 600, fontSize: 12, opacity: disabled ? 0.4 : 1,
    }}>
      <span style={{ fontSize: 18 }}>{icon}</span>{label}
    </button>
  );
}

// ── Order rows ──
function ExistingRow({ item, allergens, isMobile, onVoid }: { item: OrderItemDetail; allergens: string[]; isMobile: boolean; onVoid: () => void }) {
  const warn = item.itemAllergens.some(a => allergens.includes(a));
  const statusHe: Record<string, string> = { PENDING: "ממתין", PREPARING: "מכין 🍳", DONE: "מוכן ✓", SERVED: "הוגש", CANCELLED: "בוטל" };
  const badge = isMobile ? 24 : 28;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 7 : 10, padding: isMobile ? "3px 10px" : "4px 14px", borderBottom: "1px solid #f0ebe4", background: item.isComped ? "#f7f7f5" : undefined }}>
      <div style={{ width: badge, height: badge, borderRadius: "50% 0 50% 0", border: "1.5px solid #cbcbcb", background: "#fff", color: "#7a7a7a", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: isMobile ? 12 : 15, flexShrink: 0 }}>{courseLetter(item.course)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: isMobile ? 13 : 15, fontWeight: 500, color: "#1a1612", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.itemName} {item.quantity > 1 && <span style={{ color: "#9b8f82" }}>× {item.quantity}</span>}</div>
        <div style={{ fontSize: 11, color: warn ? "#c0392b" : "#9b8f82", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{warn ? "⚠️ אלרגן" : (statusHe[item.itemStatus] ?? "")}{item.heldUntilFired ? " · ממתין לשחרור" : ""}</div>
      </div>
      <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 500, color: "#1a1612", minWidth: isMobile ? 34 : 48, textAlign: "left", flexShrink: 0 }}>{(item.price * item.quantity).toFixed(0)}</div>
      <button onClick={onVoid} title="ביטול (דרוש אישור מנהל)" style={{ width: badge, height: badge, borderRadius: 8, border: "none", background: "#f4f1ed", color: "#b91c1c", cursor: "pointer", fontSize: 13, flexShrink: 0 }}>🔒</button>
    </div>
  );
}

function CartRow({ item, warn, isMobile, onQty, onNotes }: { item: CartItem; warn: boolean; isMobile: boolean; onQty: (q: number) => void; onNotes: (n: string) => void }) {
  const [notesOpen, setNotesOpen] = useState(!!item.notes);
  const badge = isMobile ? 24 : 28;
  const controls = (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
      <button onClick={() => setNotesOpen(o => !o)} title="הערה" style={{ width: badge, height: badge, borderRadius: 8, border: "1px solid #e3ded5", background: "#fff", cursor: "pointer", fontSize: 13, color: "#6b6258", flexShrink: 0 }}>✎</button>
      <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0, border: "1px solid #e0e0e0", borderRadius: 99 }}>
        <button onClick={() => onQty(item.quantity - 1)} style={qBtn}>−</button>
        <span style={{ fontSize: 14, fontWeight: 800, minWidth: 18, textAlign: "center", color: "#1a1612" }}>{item.quantity}</span>
        <button onClick={() => onQty(item.quantity + 1)} style={qBtn}>+</button>
      </div>
      {/* price sits between the quantity and the X, with spacing */}
      <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 500, color: "#1a1612", minWidth: isMobile ? 34 : 48, textAlign: "center", margin: "0 8px", flexShrink: 0 }}>{(item.price * item.quantity).toFixed(0)}</div>
      <button onClick={() => onQty(0)} title="הסר" style={{ width: badge, height: badge, borderRadius: 8, border: "none", background: "#fdecea", color: "#e53e3e", cursor: "pointer", fontSize: 14, fontWeight: 900, flexShrink: 0 }}>✕</button>
    </div>
  );
  return (
    <div style={{ padding: isMobile ? "3px 10px" : "4px 14px", borderBottom: "1px solid #ede7df", background: "rgba(212,160,23,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 7 : 10 }}>
        <div style={{ width: badge, height: badge, borderRadius: "50% 0 50% 0", border: "1.5px solid #d8c48a", background: "rgba(200,161,58,0.12)", color: "#9c7a12", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: isMobile ? 12 : 15, flexShrink: 0 }}>{courseLetter(item.course)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: isMobile ? 13 : 15, fontWeight: 500, color: "#1a1612", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name} {warn && <span style={{ fontSize: 10, color: "#c0392b" }}>⚠️</span>}</div>
          {item.modifiers.length > 0 && <div style={{ fontSize: 10, color: "#9b8f82", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.modifiers.map(m => m.label).join(" · ")}</div>}
          {item.notes && <div style={{ fontSize: 10, color: "#9c7a12", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📝 {item.notes}</div>}
        </div>
        {!isMobile && controls}
      </div>
      {isMobile && <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>{controls}</div>}
      {notesOpen && <input autoFocus value={item.notes} onChange={e => onNotes(e.target.value)} placeholder="הערה למטבח..." style={{ marginTop: 8, width: "100%", background: "#fff", border: "1px solid #e3ded5", borderRadius: 8, fontSize: 12, padding: "7px 10px", outline: "none", fontFamily: "inherit", boxSizing: "border-box", color: "#1a1612" }} />}
    </div>
  );
}

// ── Generic centered popup ──
function Popup({ title, children, onClose, width = 460 }: { title: string; children: React.ReactNode; onClose: () => void; width?: number }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 620, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} dir="rtl" style={{ background: "#fff", color: "#1a1612", borderRadius: 18, padding: 22, width: `min(96vw, ${width}px)`, maxHeight: "85vh", overflowY: "auto", fontFamily: "'Heebo', sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, borderBottom: "2px solid #c8a13a", paddingBottom: 12 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#1a1612" }}>{title}</div>
          <button onClick={onClose} style={{ background: "#f0ede8", border: "none", borderRadius: 8, width: 34, height: 34, fontSize: 18, cursor: "pointer", color: "#555" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const stepBtn: React.CSSProperties = { width: 56, height: 56, borderRadius: 99, border: "none", background: "#1a1612", color: "#fff", fontSize: 26, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
const qBtn: React.CSSProperties = { width: 28, height: 28, borderRadius: 8, border: "1px solid #e3ded5", background: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" };
const chip = (active: boolean): React.CSSProperties => ({ padding: "9px 16px", borderRadius: 99, border: `1.5px solid ${active ? "#e07060" : "#e8e2da"}`, background: active ? "#fdf2f0" : "#faf8f5", color: active ? "#8b2e22" : "#4a4540", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" });
