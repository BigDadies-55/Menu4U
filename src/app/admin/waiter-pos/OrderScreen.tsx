"use client";

import React, { useState, useEffect, useCallback } from "react";
import { OrderPanel, CartItem } from "./OrderPanel";
import type { OrderDetail, OrderItemDetail } from "./TableOverlay";
import { ALLERGEN_LIST } from "@/lib/allergens";

type MenuItem = {
  id: string; name: string; description: string | null;
  price: number; image: string | null; allergens: string[];
  isVegetarian: boolean; isVegan: boolean; isGlutenFree: boolean;
};
type MenuCategory = { id: string; name: string; items: MenuItem[] };

type Props = {
  tableNum: string;
  orderId: string | null;         // null = new order (free table)
  guestCount: number;
  tableAllergens: string[];
  restaurantId: string;
  existingOrder: OrderDetail | null;
  onClose: () => void;
  onSuccess: (newOrderId?: string) => void;
};

export function OrderScreen({ tableNum, orderId, guestCount, tableAllergens, restaurantId, existingOrder, onClose, onSuccess }: Props) {
  const [categories, setCategories]     = useState<MenuCategory[]>([]);
  const [loadingMenu, setLoadingMenu]   = useState(true);
  const [menuError, setMenuError]       = useState<string | null>(null);
  const [activeCat, setActiveCat]       = useState<string>("");
  const [search, setSearch]             = useState("");
  const [activeCourse, setActiveCourse] = useState(1);
  const [cart, setCart]                 = useState<CartItem[]>([]);
  const [submitting, setSubmitting]     = useState(false);
  const [order, setOrder]               = useState<OrderDetail | null>(existingOrder);
  const [firingItem, setFiringItem]     = useState<string | null>(null);
  const [isMobile, setIsMobile]         = useState(false);
  const [cartOpen, setCartOpen]         = useState(false);

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 640); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Load menu
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
      })
      .catch(e => setMenuError(String(e)))
      .finally(() => setLoadingMenu(false));
  }, [restaurantId]);

  // Refresh order after fire actions
  const refreshOrder = useCallback(async () => {
    if (!orderId) return;
    const r = await fetch(`/api/admin/orders/${orderId}`);
    if (r.ok) setOrder(await r.json());
  }, [orderId]);

  // Derived: max course in existing order
  const maxCourse = Math.max(1, ...(order?.items ?? []).map(i => i.course), activeCourse);

  // Cart helpers
  function addItem(item: MenuItem) {
    const key = `${item.id}-c${activeCourse}-${Date.now()}`;
    setCart(p => [...p, { key, itemId: item.id, name: item.name, price: item.price, quantity: 1, course: activeCourse, notes: "", allergens: item.allergens }]);
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

  // Filter items by search + allergy
  const activeCategory = categories.find(c => c.id === activeCat);
  const filteredItems = (activeCategory?.items ?? []).filter(item => {
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
            items: cart.map(i => ({ itemId: i.itemId, quantity: i.quantity, course: i.course, notes: i.notes || null })),
            tableAllergens,
          }),
        });
        onSuccess();
      } else {
        // Create new order
        const r = await fetch("/api/admin/orders/waiter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            restaurantId,
            tableNumber: tableNum,
            coversCount: guestCount,
            tableAllergens,
            items: cart.map(i => ({ itemId: i.itemId, quantity: i.quantity, course: i.course, notes: i.notes || null })),
          }),
        });
        const newOrder = await r.json();
        onSuccess(newOrder?.id);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const hasAllergy = (item: MenuItem) => item.allergens.some(a => tableAllergens.includes(a));
  const allergyLabel = (item: MenuItem) =>
    item.allergens.filter(a => tableAllergens.includes(a)).map(k => ALLERGEN_LIST.find(a => a.key === k)?.label ?? k).join(", ");

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "#f4f1ed", display: "flex", flexDirection: "column" }}>

      {/* Top bar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e8e2da", height: 56, padding: "0 14px", flexShrink: 0, display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 6px rgba(26,22,18,.06)" }}>
        <button onClick={onClose} style={{ background: "#f4f1ed", border: "1.5px solid #e8e2da", borderRadius: 99, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#1a1612", fontFamily: "inherit" }}>← חזור</button>
        <span style={{ fontSize: 15, fontWeight: 900, flex: 1 }}>שולחן {tableNum}{orderId ? ` · הזמנה #${order?.orderNumber}` : " · הזמנה חדשה"}</span>
        {tableAllergens.length > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 99, background: "#fdf2f0", border: "1.5px solid #f5c4bc", color: "#8b2e22", display: "flex", alignItems: "center", gap: 3 }}>
            ⚠️ {tableAllergens.map(k => ALLERGEN_LIST.find(a => a.key === k)?.label ?? k).join(", ")}
          </span>
        )}
      </div>

      {/* Category bar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e8e2da", padding: "8px 14px", flexShrink: 0, display: "flex", alignItems: "center", gap: 7, overflowX: "auto" }}>
        {categories.map(c => (
          <button key={c.id} onClick={() => setActiveCat(c.id)} style={{ padding: "6px 16px", borderRadius: 99, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, fontFamily: "inherit", background: activeCat === c.id ? "#1a1612" : "#f4f1ed", color: activeCat === c.id ? "#fff" : "#4a4540", transition: "all .12s" }}>
            {c.name}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Menu column */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Search + course selector */}
          <div style={{ padding: "9px 12px", borderBottom: "1px solid #e8e2da", background: "#fff", flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 חיפוש מנה..." style={{ width: "60%", flexShrink: 0, background: "#f4f1ed", border: "1.5px solid #e8e2da", borderRadius: 99, padding: "8px 14px", fontSize: 12, outline: "none", fontFamily: "inherit", color: "#1a1612" }} />
            {/* Course selector */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#8a8480" }}>קורס:</span>
              {Array.from({ length: maxCourse }, (_, i) => i + 1).map(c => (
                <button key={c} onClick={() => setActiveCourse(c)} style={{ width: 28, height: 28, borderRadius: 8, border: "1.5px solid", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: activeCourse === c ? "#1a1612" : "#f4f1ed", color: activeCourse === c ? "#fff" : "#4a4540", borderColor: activeCourse === c ? "#1a1612" : "#e8e2da", transition: "all .12s" }}>
                  {c}
                </button>
              ))}
              <button onClick={() => setActiveCourse(maxCourse + 1)} style={{ width: 28, height: 28, borderRadius: 8, border: "1.5px dashed #e8e2da", fontSize: 14, fontWeight: 700, cursor: "pointer", background: "transparent", color: "#8a8480", fontFamily: "inherit" }}>+</button>
            </div>
          </div>

          {/* Items grid */}
          <div style={{ flex: 1, overflowY: "auto", padding: 10, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px,1fr))", gap: 9, alignContent: "start" }}>
            {loadingMenu ? (
              <div style={{ gridColumn: "1/-1", textAlign: "center", color: "#888", padding: 30, fontSize: 13 }}>טוען תפריט...</div>
            ) : menuError ? (
              <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 30 }}>
                <div style={{ fontSize: 13, color: "#b91c1c", fontWeight: 700, marginBottom: 8 }}>⚠️ {menuError}</div>
                <div style={{ fontSize: 11, color: "#888" }}>restaurantId: {restaurantId}</div>
              </div>
            ) : filteredItems.map(item => {
              const qty     = cartQtyForItem(item.id);
              const warn    = hasAllergy(item);
              const wLabel  = allergyLabel(item);
              return (
                <div key={item.id} onClick={() => addItem(item)} style={{ background: "#fff", border: `1.5px solid ${qty > 0 ? "#1a1612" : "#e8e2da"}`, borderRadius: 16, overflow: "hidden", cursor: "pointer", position: "relative", transition: "transform .1s, box-shadow .1s", boxShadow: qty > 0 ? "0 2px 10px rgba(26,22,18,.1)" : "0 1px 4px rgba(26,22,18,.05)" }}>
                  {qty > 0 && (
                    <div style={{ position: "absolute", top: 6, left: 6, background: "#1a1612", color: "#fff", borderRadius: 99, minWidth: 20, height: 20, padding: "0 4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, zIndex: 1 }}>×{qty}</div>
                  )}
                  <div style={{ height: 68, background: "#f4f1ed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, position: "relative" }}>
                    {item.image ? <img src={item.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🍽️"}
                    {warn && <span style={{ position: "absolute", top: 4, right: 4, fontSize: 13 }}>⚠️</span>}
                  </div>
                  <div style={{ padding: "7px 9px 9px" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#1a1612", marginBottom: 2, lineHeight: 1.3 }}>{item.name}</div>
                    {item.description && <div style={{ fontSize: 9, color: "#8a8480", marginBottom: 4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{item.description}</div>}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#1a1612" }}>₪{item.price.toFixed(0)}</span>
                      {warn && <span style={{ fontSize: 9, fontWeight: 800, color: "#8b2e22", background: "#fdf2f0", borderRadius: 5, padding: "1px 5px" }}>{wLabel}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order panel — desktop: side column | mobile: hidden (bottom sheet) */}
        {!isMobile && (
          <div style={{ display: "flex", flexShrink: 0, flexDirection: "column" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <OrderPanel
                existingItems={order?.items ?? []}
                cartItems={cart}
                tableAllergens={tableAllergens}
                orderNumber={order?.orderNumber}
                onQtyChange={changeQty}
                onNotesChange={changeNotes}
                onFireItem={fireItem}
                onFireCourse={fireCourse}
              />
            </div>
            <div style={{ padding: "12px 14px 14px", background: "#fff", borderTop: "1px solid #e8e2da" }}>
              <button onClick={handleSubmit} disabled={cart.length === 0 || submitting} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: cart.length === 0 ? "#e8e2da" : "#1a1612", color: cart.length === 0 ? "#8a8480" : "#fff", fontSize: 14, fontWeight: 900, cursor: cart.length === 0 ? "default" : "pointer", fontFamily: "inherit", transition: "all .12s" }}>
                {submitting ? "שולח..." : orderId ? `📤 הוסף להזמנה #${order?.orderNumber}` : "📤 צור הזמנה"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Mobile: floating cart button ── */}
      {isMobile && (
        <>
          {/* FAB */}
          <button onClick={() => setCartOpen(true)} style={{
            position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
            zIndex: 510, background: "#1a1612", color: "#fff",
            border: "none", borderRadius: 99, padding: "14px 28px",
            fontSize: 15, fontWeight: 900, cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: 10,
            boxShadow: "0 4px 20px rgba(26,22,18,.35)",
            minWidth: 220, justifyContent: "center",
          }}>
            🛒 סל
            {cart.length > 0 && (
              <span style={{ background: "#e07060", borderRadius: 99, minWidth: 22, height: 22, padding: "0 6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>
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
              <div onClick={() => setCartOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(26,22,18,.45)" }} />
              {/* Sheet */}
              <div style={{ position: "relative", background: "#fff", borderRadius: "20px 20px 0 0", maxHeight: "80dvh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* Handle */}
                <div style={{ padding: "12px 0 4px", display: "flex", justifyContent: "center", flexShrink: 0 }}>
                  <div style={{ width: 40, height: 4, borderRadius: 99, background: "#e8e2da" }} />
                </div>
                <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                  <OrderPanel
                    existingItems={order?.items ?? []}
                    cartItems={cart}
                    tableAllergens={tableAllergens}
                    orderNumber={order?.orderNumber}
                    onQtyChange={changeQty}
                    onNotesChange={changeNotes}
                    onFireItem={fireItem}
                    onFireCourse={fireCourse}
                  />
                </div>
                <div style={{ padding: "12px 16px 28px", borderTop: "1px solid #e8e2da", flexShrink: 0 }}>
                  <button onClick={() => { setCartOpen(false); handleSubmit(); }} disabled={cart.length === 0 || submitting} style={{ width: "100%", padding: 16, borderRadius: 12, border: "none", background: cart.length === 0 ? "#e8e2da" : "#1a1612", color: cart.length === 0 ? "#8a8480" : "#fff", fontSize: 15, fontWeight: 900, cursor: cart.length === 0 ? "default" : "pointer", fontFamily: "inherit" }}>
                    {submitting ? "שולח..." : orderId ? `📤 הוסף להזמנה #${order?.orderNumber}` : "📤 צור הזמנה"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
