"use client";

import React, { useState, useEffect, useCallback } from "react";
import { OrderPanel, CartItem, CartItemModifier } from "./OrderPanel";
import type { OrderDetail, OrderItemDetail } from "./TableOverlay";
import { ALLERGEN_LIST } from "@/lib/allergens";
import { idbSet, idbGet } from "@/lib/waiter-db";

type ModifierOption = { id: string; label: string; priceAdd: number };
type ModifierGroup  = { id: string; name: string; required: boolean; maxSelect: number; options: ModifierOption[] };

type MenuItem = {
  id: string; name: string; description: string | null;
  price: number; image: string | null; allergens: string[];
  isVegetarian: boolean; isVegan: boolean; isGlutenFree: boolean;
  modifierGroups: ModifierGroup[];
};
type MenuCategory = { id: string; name: string; items: MenuItem[] };

type Props = {
  tableNum: string;
  orderId: string | null;         // null = new order (free table)
  guestCount: number;
  tableAllergens: string[];
  restaurantId: string;
  existingOrder: OrderDetail | null;
  isOffline?: boolean;
  enqueueOffline?: (payload: object) => string;
  onClose: () => void;
  onSuccess: (newOrderId?: string) => void;
  onQueued?: () => void;
};

export function OrderScreen({ tableNum, orderId, guestCount, tableAllergens, restaurantId, existingOrder, isOffline = false, enqueueOffline, onClose, onSuccess, onQueued }: Props) {
  const [categories, setCategories]     = useState<MenuCategory[]>([]);
  const [loadingMenu, setLoadingMenu]   = useState(true);
  const [menuError, setMenuError]       = useState<string | null>(null);
  const [activeCat, setActiveCat]       = useState<string>("");
  const [search, setSearch]             = useState("");
  const [activeCourse, setActiveCourse] = useState(1);
  const [minCourse] = useState(3);
  const [cart, setCart]                 = useState<CartItem[]>([]);
  const [submitting, setSubmitting]     = useState(false);
  const [order, setOrder]               = useState<OrderDetail | null>(existingOrder);
  const [firingItem, setFiringItem]     = useState<string | null>(null);
  const [isMobile, setIsMobile]         = useState(false);
  const [cartOpen, setCartOpen]         = useState(false);
  const [modifierItem, setModifierItem] = useState<MenuItem | null>(null);
  const [modifierSel, setModifierSel]   = useState<Record<string, string[]>>({});

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 640); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const POPULAR_CAT_ID = "__popular__";

  // Load popular items + inject as first category
  useEffect(() => {
    fetch(`/api/admin/waiter-pos/popular?restaurantId=${restaurantId}`)
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => {
        if ((d.items ?? []).length > 0) {
          setCategories(prev => {
            const alreadyHas = prev.some(c => c.id === POPULAR_CAT_ID);
            if (alreadyHas) return prev;
            const popularCat: MenuCategory = { id: POPULAR_CAT_ID, name: "⭐ פופולרי", items: d.items };
            return [popularCat, ...prev];
          });
        }
      });
  }, [restaurantId]);

  // Load menu (with IDB fallback for offline)
  useEffect(() => {
    fetch(`/api/admin/waiter-pos/menu?restaurantId=${restaurantId}`)
      .then(async r => {
        const text = await r.text();
        let d: Record<string, unknown>;
        try { d = JSON.parse(text); } catch { setMenuError(`שגיאה ${r.status} (לא JSON) — בדוק console`); console.error("[menu fetch]", r.status, text.slice(0, 300)); return; }
        if (!r.ok) { setMenuError(`שגיאה ${r.status}: ${String(d?.error ?? "לא ידוע")}`); return; }
        const cats: MenuCategory[] = (d.categories as MenuCategory[]) ?? [];
        setCategories(cats);
        if (cats.length > 0) setActiveCat(cats[0].id);
        else setMenuError("אין קטגוריות פעילות בתפריט");
        // Persist to IDB
        idbSet("menu", restaurantId, cats).catch(() => {});
      })
      .catch(async () => {
        // Offline fallback
        const cached = await idbGet<MenuCategory[]>("menu", restaurantId).catch(() => undefined);
        if (cached?.length) {
          setCategories(cached);
          setActiveCat(cached[0].id);
          setMenuError("");
        } else {
          setMenuError("אין חיבור לאינטרנט ואין תפריט שמור");
        }
      })
      .finally(() => setLoadingMenu(false));
  }, [restaurantId]);

  // Refresh order after fire actions
  const refreshOrder = useCallback(async () => {
    if (!orderId) return;
    const r = await fetch(`/api/admin/orders/${orderId}`);
    if (r.ok) setOrder(await r.json());
  }, [orderId]);

  // Derived: max course in existing order
  const maxCourse = Math.max(minCourse, ...(order?.items ?? []).map(i => i.course), activeCourse);
  const toRoman = (n: number) => (["I","II","III","IV","V","VI","VII","VIII","IX","X"][n-1] ?? String(n));

  // Cart helpers
  function addItem(item: MenuItem) {
    if (item.modifierGroups?.length > 0) {
      setModifierItem(item);
      setModifierSel({});
      return;
    }
    pushToCart(item, []);
  }

  function pushToCart(item: MenuItem, modifiers: CartItemModifier[]) {
    const extraPrice = modifiers.reduce((s, m) => s + m.priceAdd, 0);
    const key = `${item.id}-c${activeCourse}-${Date.now()}`;
    setCart(p => [...p, { key, itemId: item.id, name: item.name, price: Number(item.price) + extraPrice, quantity: 1, course: activeCourse, notes: "", allergens: item.allergens ?? [], modifiers }]);
  }

  function confirmModifiers() {
    if (!modifierItem) return;
    const mods: CartItemModifier[] = [];
    for (const group of modifierItem.modifierGroups) {
      const selected = modifierSel[group.id] ?? [];
      for (const optId of selected) {
        const opt = group.options.find(o => o.id === optId);
        if (opt) mods.push({ groupName: group.name, label: opt.label, priceAdd: opt.priceAdd });
      }
    }
    // Validate required groups
    for (const group of modifierItem.modifierGroups) {
      if (group.required && (modifierSel[group.id] ?? []).length === 0) return;
    }
    pushToCart(modifierItem, mods);
    setModifierItem(null);
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

  function changeNotes(key: string, notes: string) {
    setCart(p => p.map(i => i.key === key ? { ...i, notes } : i));
  }

  function cartQtyForItem(itemId: string) {
    return cart.filter(i => i.itemId === itemId).reduce((s, i) => s + i.quantity, 0);
  }

  // Items added to a different course — hide them from the grid
  const itemIdsInOtherCourse = new Set(
    cart.filter(i => i.course !== activeCourse).map(i => i.itemId)
  );

  // Filter items by search + allergy
  const activeCategory = categories.find(c => c.id === activeCat);
  const filteredItems = (activeCategory?.items ?? []).filter(item => {
    if (itemIdsInOtherCourse.has(item.id)) return false;
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Fire individual item
  async function fireItem(orderItemId: string) {
    if (!orderId) return;
    setFiringItem(orderItemId);
    await fetch(`/api/admin/orders/${orderId}/items/${orderItemId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "advance" }),
    });
    await refreshOrder();
    setFiringItem(null);
  }

  // Fire course
  async function fireCourse(course: number) {
    if (!orderId) return;
    await fetch(`/api/admin/orders/${orderId}/fire-course`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course }),
    });
    await refreshOrder();
  }

  // Submit
  async function handleSubmit() {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      if (orderId) {
        // Add to existing order
        await fetch(`/api/admin/orders/${orderId}/add-items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: cart.map(i => ({ itemId: i.itemId, quantity: i.quantity, course: i.course, notes: i.notes || null, modifiers: i.modifiers })),
            tableAllergens,
          }),
        });
        onSuccess();
      } else {
        // Create new order
        const payload = {
          restaurantId,
          tableNumber: tableNum,
          coversCount: guestCount,
          tableAllergens,
          items: cart.map(i => ({ itemId: i.itemId, quantity: i.quantity, course: i.course, notes: i.notes || null, modifiers: i.modifiers })),
        };
        // Offline → queue for later sync instead of failing the request.
        if (isOffline && enqueueOffline) {
          enqueueOffline(payload);
          onQueued?.();
          return;
        }
        const r = await fetch("/api/admin/orders/waiter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const newOrder = await r.json();
        onSuccess(newOrder?.id);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const hasAllergy = (item: MenuItem) => (item.allergens ?? []).some(a => tableAllergens.includes(a));
  const allergyLabel = (item: MenuItem) =>
    (item.allergens ?? []).filter(a => tableAllergens.includes(a)).map(k => ALLERGEN_LIST.find(a => a.key === k)?.label ?? k).join(", ");

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(10,10,18,0.98)", display: "flex", flexDirection: "column" }}>

      {/* Top bar */}
      <div style={{ background: "rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.1)", height: 56, padding: "0 14px", flexShrink: 0, display: "flex", alignItems: "center", gap: 12, backdropFilter: "blur(12px)" }}>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 99, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#fff", fontFamily: "inherit" }}>← חזור</button>
        <span style={{ fontSize: 15, fontWeight: 900, flex: 1, color: "#ffffff" }}>שולחן {tableNum}{orderId ? ` · הזמנה #${order?.orderNumber}` : " · הזמנה חדשה"}</span>
        {tableAllergens.length > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 99, background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)", color: "#FCA5A5", display: "flex", alignItems: "center", gap: 3 }}>
            ⚠️ {tableAllergens.map(k => ALLERGEN_LIST.find(a => a.key === k)?.label ?? k).join(", ")}
          </span>
        )}
      </div>

      {/* Category bar */}
      <div style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "8px 14px", flexShrink: 0, display: "flex", alignItems: "center", gap: 7, overflowX: "auto", backdropFilter: "blur(8px)" }}>
        {categories.map(c => (
          <button key={c.id} onClick={() => setActiveCat(c.id)} style={{ padding: "6px 16px", borderRadius: 99, border: activeCat === c.id ? "none" : "1px solid rgba(255,255,255,0.12)", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, fontFamily: "inherit", background: activeCat === c.id ? "linear-gradient(135deg,#D97706,#F59E0B)" : "rgba(255,255,255,0.07)", color: activeCat === c.id ? "#fff" : "rgba(255,255,255,0.7)", transition: "all .12s" }}>
            {c.name}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Menu column */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Search + course selector */}
          <div style={{ padding: "9px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 חיפוש מנה..." style={{ width: "60%", flexShrink: 0, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 99, padding: "8px 14px", fontSize: 12, outline: "none", fontFamily: "inherit", color: "#fff" }} />
            {/* Course selector */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.38)" }}>קורס:</span>
              {Array.from({ length: maxCourse }, (_, i) => i + 1).map(c => (
                <button key={c} onClick={() => setActiveCourse(c)} style={{ minWidth: 28, height: 28, padding: "0 7px", borderRadius: 8, border: "1.5px solid", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: activeCourse === c ? "linear-gradient(135deg,#D97706,#F59E0B)" : "rgba(255,255,255,0.07)", color: activeCourse === c ? "#fff" : "rgba(255,255,255,0.65)", borderColor: activeCourse === c ? "transparent" : "rgba(255,255,255,0.1)", transition: "all .12s" }}>
                  {toRoman(c)}
                </button>
              ))}
              <button onClick={() => setActiveCourse(maxCourse + 1)} style={{ width: 28, height: 28, borderRadius: 8, border: "1.5px dashed rgba(255,255,255,0.2)", fontSize: 14, fontWeight: 700, cursor: "pointer", background: "transparent", color: "rgba(255,255,255,0.38)", fontFamily: "inherit" }}>+</button>
            </div>
          </div>

          {/* Items grid */}
          <div style={{ flex: 1, overflowY: "auto", padding: 10, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px,1fr))", gap: 9, alignContent: "start" }}>
            {loadingMenu ? (
              <div style={{ gridColumn: "1/-1", textAlign: "center", color: "rgba(255,255,255,0.38)", padding: 30, fontSize: 13 }}>טוען תפריט...</div>
            ) : menuError ? (
              <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 30 }}>
                <div style={{ fontSize: 13, color: "#F87171", fontWeight: 700, marginBottom: 8 }}>⚠️ {menuError}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)" }}>restaurantId: {restaurantId}</div>
              </div>
            ) : filteredItems.map(item => {
              const qty    = cartQtyForItem(item.id);
              const warn   = hasAllergy(item);
              const wLabel = allergyLabel(item);
              const safe   = tableAllergens.length > 0 && !warn;
              // find the last cart entry for this item (to remove one at a time)
              const lastKey = [...cart].reverse().find(i => i.itemId === item.id)?.key;
              return (
                <div key={item.id} onClick={() => addItem(item)} style={{ background: "rgba(255,255,255,0.06)", border: `1.5px solid ${qty > 0 ? "#D97706" : "rgba(255,255,255,0.1)"}`, borderRadius: 16, cursor: "pointer", position: "relative", transition: "transform .1s, box-shadow .1s", boxShadow: qty > 0 ? "0 0 0 1px rgba(217,119,6,0.3), 0 4px 16px rgba(0,0,0,0.3)" : "none" }}>
                  {/* quantity badge (left) */}
                  {qty > 0 && (
                    <div style={{ position: "absolute", top: 6, left: 6, background: "#D97706", color: "#fff", borderRadius: 99, minWidth: 20, height: 20, padding: "0 4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, zIndex: 2 }}>×{qty}</div>
                  )}
                  {/* remove one — red X (right) */}
                  {qty > 0 && lastKey && (
                    <div onClick={e => { e.stopPropagation(); changeQty(lastKey, cart.find(i => i.key === lastKey)!.quantity - 1); }} style={{ position: "absolute", top: 6, right: 6, background: "#e53e3e", color: "#fff", borderRadius: 99, width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, zIndex: 2, cursor: "pointer", lineHeight: 1 }}>✕</div>
                  )}
                  <div style={{ height: 90, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, position: "relative", borderRadius: "14px 14px 0 0", overflow: "hidden", flexShrink: 0 }}>
                    {item.image ? <img src={item.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🍽️"}
                    {warn && !qty && <span style={{ position: "absolute", top: 4, right: 4, fontSize: 13 }}>⚠️</span>}
                    {safe && !qty && <span style={{ position: "absolute", top: 3, right: 4, fontSize: 18, color: "#16a34a", textShadow: "0 0 4px #fff", lineHeight: 1 }}>★</span>}
                  </div>
                  <div style={{ padding: "7px 9px 9px" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#ffffff", marginBottom: 2, lineHeight: 1.3 }}>{item.name}</div>
                    {item.description && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.38)", marginBottom: 4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>{item.description}</div>}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#ffffff" }}>₪{Number(item.price).toFixed(0)}</span>
                      {warn && <span style={{ fontSize: 9, fontWeight: 800, color: "#FCA5A5", background: "rgba(248,113,113,0.15)", borderRadius: 5, padding: "1px 5px" }}>{wLabel}</span>}
                      {safe && <span style={{ fontSize: 9, fontWeight: 800, color: "#34D399", background: "rgba(52,211,153,0.12)", borderRadius: 5, padding: "1px 5px" }}>★ מותר</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* ── Floating cart button (all screen sizes) ── */}
      {true && (
        <>
          {/* FAB */}
          <button onClick={() => setCartOpen(true)} style={{
            position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
            zIndex: 510, background: "linear-gradient(135deg,#D97706,#F59E0B)", color: "#fff",
            border: "none", borderRadius: 99, padding: "14px 28px",
            fontSize: 15, fontWeight: 900, cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: 10,
            boxShadow: "0 4px 20px rgba(217,119,6,0.4)",
            minWidth: 220, justifyContent: "center",
          }}>
            🛒 סל
            {cart.length > 0 && (
              <span style={{ background: "rgba(248,113,113,0.9)", borderRadius: 99, minWidth: 22, height: 22, padding: "0 6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
            {cart.length > 0 && (
              <span style={{ fontSize: 13, opacity: .85 }}>
                · ₪{cart.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(0)}
              </span>
            )}
          </button>

          {/* Bottom sheet */}
          {cartOpen && (
            <div style={{ position: "fixed", inset: 0, zIndex: 520, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
              {/* Backdrop */}
              <div onClick={() => setCartOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} />
              {/* Sheet */}
              <div style={{ position: "relative", background: "rgba(15,15,24,0.97)", borderRadius: "20px 20px 0 0", maxHeight: "80dvh", display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
                {/* Handle */}
                <div style={{ padding: "12px 0 4px", display: "flex", justifyContent: "center", flexShrink: 0 }}>
                  <div style={{ width: 40, height: 4, borderRadius: 99, background: "rgba(255,255,255,0.2)" }} />
                </div>
                <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", width: "100%" }}>
                  <OrderPanel
                    orderId={orderId}
                    restaurantId={restaurantId}
                    existingItems={order?.items ?? []}
                    cartItems={cart}
                    tableAllergens={tableAllergens}
                    orderNumber={order?.orderNumber}
                    onQtyChange={changeQty}
                    onNotesChange={changeNotes}
                    onFireItem={fireItem}
                    onFireCourse={fireCourse}
                    onItemActioned={refreshOrder}
                  />
                </div>
                <div style={{ padding: "12px 16px 28px", borderTop: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }}>
                  <button onClick={() => { setCartOpen(false); handleSubmit(); }} disabled={cart.length === 0 || submitting} style={{ width: "100%", padding: 16, borderRadius: 12, border: "none", background: cart.length === 0 ? "rgba(255,255,255,0.08)" : "linear-gradient(135deg,#D97706,#F59E0B)", color: cart.length === 0 ? "rgba(255,255,255,0.38)" : "#fff", fontSize: 15, fontWeight: 900, cursor: cart.length === 0 ? "default" : "pointer", fontFamily: "inherit" }}>
                    {submitting ? "שולח..." : orderId ? `📤 הוסף להזמנה #${order?.orderNumber}` : "📤 צור הזמנה"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    {/* ── Modifier picker popup ── */}
    {modifierItem && (
      <div style={{ position: "fixed", inset: 0, zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)" }}
        onClick={() => setModifierItem(null)}>
        <div onClick={e => e.stopPropagation()} style={{ background: "rgba(15,15,24,0.97)", borderRadius: 20, padding: 20, width: "min(96vw,420px)", maxHeight: "85dvh", overflowY: "auto", direction: "rtl", display: "flex", flexDirection: "column", gap: 16, border: "1px solid rgba(255,255,255,0.12)" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#ffffff" }}>{modifierItem.name}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", marginTop: 2 }}>בחר אפשרויות</div>
            </div>
            <button onClick={() => setModifierItem(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "rgba(255,255,255,0.38)", lineHeight: 1 }}>✕</button>
          </div>

          {/* Groups */}
          {modifierItem.modifierGroups.map(group => {
            const sel = modifierSel[group.id] ?? [];
            const allSatisfied = !group.required || sel.length > 0;
            return (
              <div key={group.id}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#ffffff", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  {group.name}
                  {group.required && <span style={{ fontSize: 10, color: "#F87171", fontWeight: 600 }}>חובה</span>}
                  {group.maxSelect > 1 && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.38)" }}>עד {group.maxSelect}</span>}
                  {!allSatisfied && <span style={{ fontSize: 10, color: "#F87171" }}>← נא לבחור</span>}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {group.options.map(opt => {
                    const active = sel.includes(opt.id);
                    return (
                      <button key={opt.id} onClick={() => toggleModOption(group.id, opt.id, group.maxSelect)}
                        style={{ padding: "7px 14px", borderRadius: 99, border: `1.5px solid ${active ? "#D97706" : "rgba(255,255,255,0.1)"}`, background: active ? "rgba(217,119,6,0.15)" : "rgba(255,255,255,0.06)", color: active ? "#fff" : "#ffffff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
                        {opt.label}
                        {opt.priceAdd > 0 && <span style={{ fontSize: 10, opacity: .75 }}>+₪{opt.priceAdd}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Confirm */}
          {(() => {
            const allOk = modifierItem.modifierGroups.every(g => !g.required || (modifierSel[g.id] ?? []).length > 0);
            const extraPrice = Object.entries(modifierSel).flatMap(([gId, optIds]) => {
              const g = modifierItem.modifierGroups.find(g => g.id === gId);
              return optIds.map(oId => g?.options.find(o => o.id === oId)?.priceAdd ?? 0);
            }).reduce((s, v) => s + v, 0);
            return (
              <button onClick={confirmModifiers} disabled={!allOk}
                style={{ background: allOk ? "linear-gradient(135deg,#D97706,#F59E0B)" : "rgba(255,255,255,0.1)", color: "#fff", border: "none", borderRadius: 12, padding: "13px 0", fontSize: 14, fontWeight: 800, cursor: allOk ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                הוסף לסל — ₪{(Number(modifierItem.price) + extraPrice).toFixed(0)}
              </button>
            );
          })()}
        </div>
      </div>
    )}
    </div>
  );
}
