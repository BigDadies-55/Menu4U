"use client";

import { useState, useEffect } from "react";
import "./menu.css";
import { buildPaletteStyle } from "@/lib/menuPalettes";

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
};

type Category = {
  id: string;
  name: string;
  image: string | null;
  items: Item[];
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
  menus: { id: string; categories: Category[] }[];
};

type CartItem = {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  person?: number;
};

function getItemBadges(item: Item): string[] {
  const badges: string[] = [];
  if (item.isVegetarian) badges.push("🌿 צמחוני");
  if (item.isVegan) badges.push("🌱 טבעוני");
  if (item.isGlutenFree) badges.push("ללא גלוטן");
  return [...badges, ...item.tags];
}

export default function MenuPublicClient({
  restaurant,
  tableNumber,
}: {
  restaurant: Restaurant;
  tableNumber?: string | null;
}) {
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
      else if (view === "category") goHome();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [zoomSrc, modalItem, view, cartOpen]);

  useEffect(() => {
    document.body.style.overflow = (modalItem || cartOpen) ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [modalItem, cartOpen]);

  function addToCart(item: Item) {
    setCart(prev => {
      const existing = prev.find(c => c.itemId === item.id);
      if (existing) {
        return prev.map(c => c.itemId === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { itemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  }

  function updateQty(itemId: string, delta: number) {
    setCart(prev => {
      const updated = prev.map(c => c.itemId === itemId ? { ...c, quantity: c.quantity + delta } : c);
      return updated.filter(c => c.quantity > 0);
    });
  }

  function removeFromCart(itemId: string) {
    setCart(prev => prev.filter(c => c.itemId !== itemId));
  }

  function updateNotes(itemId: string, notes: string) {
    setCart(prev => prev.map(c => c.itemId === itemId ? { ...c, notes } : c));
  }

  function updatePerson(itemId: string, person: number | undefined) {
    setCart(prev => prev.map(c => c.itemId === itemId ? { ...c, person } : c));
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
          items: cart.map(c => ({ itemId: c.itemId, quantity: c.quantity, notes: c.notes || null })),
          customerName: "",
          notes: "",
        }),
      });
      if (!res.ok) throw new Error("שגיאה בשליחת ההזמנה");
      setCart([]);
      setCartOpen(false);
      setOrderSuccess(true);
    } catch (err: unknown) {
      setOrderError(err instanceof Error ? err.message : "שגיאה בשליחת ההזמנה");
    } finally {
      setOrderLoading(false);
    }
  }

  return (
    <div className={`menu-root menu-theme-${restaurant.menuTheme ?? 'luxury'}`} style={paletteStyle as React.CSSProperties}>
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
                        <h2 className="menu-tile-name">{cat.name}</h2>
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
                        <h2 className="menu-tile-name">{cat.name}</h2>
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
                        <h2 className="menu-tile-name">{cat.name}</h2>
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
            <button className="menu-back-btn" onClick={goHome}>→ חזרה לתפריט</button>
            <div className="menu-page-header">
              <h2 className="menu-page-title">{selectedCat.name}</h2>
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
                          {getItemBadges(item).map(b => <span key={b} className="menu-type-tag">{b}</span>)}
                        </div>
                        <h3 className="menu-card-name">{item.name}</h3>
                        <p className="menu-card-desc">{item.description ?? ""}</p>
                        <div className="menu-price">
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
                          הוסף לסל
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
          <a href={`tel:${restaurant.phone}`} className="menu-action-btn menu-btn-phone">📞 התקשרו</a>
        )}
        {restaurant.locationUrl && (
          <a href={restaurant.locationUrl} target="_blank" rel="noopener noreferrer" className="menu-action-btn menu-btn-map">📍 נווט</a>
        )}
        {restaurant.website && (
          <a href={restaurant.website} target="_blank" rel="noopener noreferrer" className="menu-action-btn menu-btn-order">🌐 אתר</a>
        )}
      </div>

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
              <span style={{ color: "var(--gold)", fontWeight: 700, fontSize: 18 }}>סל הזמנות</span>
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

            {/* Table number indicator */}
            {tableNumber && (
              <div
                style={{
                  padding: "8px 20px",
                  borderBottom: "1px solid var(--border)",
                  fontSize: 13,
                  color: "var(--text)",
                  opacity: 0.7,
                }}
              >
                שולחן: <strong style={{ color: "var(--gold)" }}>{tableNumber}</strong>
              </div>
            )}

            {/* Items list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
              {cart.length === 0 ? (
                <div style={{ textAlign: "center", opacity: 0.4, marginTop: 40, color: "var(--text)" }}>
                  הסל ריק
                </div>
              ) : (
                <>
                  {cart.map(c => (
                    <div
                      key={c.itemId}
                      style={{
                        padding: "10px 0",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      {/* Item row */}
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: "var(--text)", fontSize: 14, fontWeight: 600 }}>{c.name}</div>
                          <div style={{ color: "var(--gold)", fontSize: 13, marginTop: 2 }}>₪{c.price}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <button
                            onClick={() => updateQty(c.itemId, -1)}
                            style={{
                              width: 28, height: 28, borderRadius: "50%",
                              border: "1px solid var(--border)", background: "none",
                              color: "var(--text)", cursor: "pointer", fontSize: 16,
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                          >−</button>
                          <span style={{ color: "var(--text)", fontSize: 14, minWidth: 20, textAlign: "center" }}>
                            {c.quantity}
                          </span>
                          <button
                            onClick={() => updateQty(c.itemId, 1)}
                            style={{
                              width: 28, height: 28, borderRadius: "50%",
                              border: "1px solid var(--gold)", background: "none",
                              color: "var(--gold)", cursor: "pointer", fontSize: 16,
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                          >+</button>
                        </div>
                        <div style={{ color: "var(--text)", fontSize: 13, minWidth: 48, textAlign: "left" }}>
                          ₪{c.price * c.quantity}
                        </div>
                      </div>

                      {/* Person selector */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10, color: "var(--text)", opacity: 0.45, marginLeft: 2 }}>שייך ל:</span>
                        {/* "none" button */}
                        <button
                          onClick={() => updatePerson(c.itemId, undefined)}
                          style={{
                            padding: "2px 8px", borderRadius: 20, fontSize: 11, cursor: "pointer",
                            border: c.person === undefined ? "1.5px solid var(--gold)" : "1px solid var(--border)",
                            background: c.person === undefined ? "var(--gold)" : "transparent",
                            color: c.person === undefined ? "var(--bg)" : "var(--text)",
                            opacity: c.person === undefined ? 1 : 0.5,
                            fontWeight: c.person === undefined ? 700 : 400,
                            transition: "all 0.15s",
                          }}
                        >ללא</button>
                        {[1, 2, 3, 4, 5].map(p => (
                          <button
                            key={p}
                            onClick={() => updatePerson(c.itemId, c.person === p ? undefined : p)}
                            style={{
                              width: 26, height: 26, borderRadius: "50%", fontSize: 12,
                              cursor: "pointer", fontWeight: 700,
                              border: c.person === p ? "1.5px solid var(--gold)" : "1px solid var(--border)",
                              background: c.person === p ? "var(--gold)" : "transparent",
                              color: c.person === p ? "var(--bg)" : "var(--text)",
                              opacity: c.person === p ? 1 : 0.45,
                              transition: "all 0.15s",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                          >{p}</button>
                        ))}
                      </div>

                      {/* Notes */}
                      <input
                        type="text"
                        placeholder="הערה למנה (אופציונלי)"
                        value={c.notes ?? ""}
                        onChange={e => updateNotes(c.itemId, e.target.value)}
                        style={{
                          marginTop: 5, width: "100%", padding: "5px 10px", fontSize: 12,
                          background: "transparent", border: "1px solid var(--border)",
                          borderRadius: 6, color: "var(--text)", outline: "none", boxSizing: "border-box",
                        }}
                      />
                    </div>
                  ))}

                  {/* Per-person breakdown — only shown when at least one item is assigned */}
                  {cart.some(c => c.person !== undefined) && (
                    <div style={{
                      marginTop: 14, padding: "12px 14px",
                      background: "rgba(255,255,255,0.04)", borderRadius: 10,
                      border: "1px solid var(--border)",
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gold)", marginBottom: 8, letterSpacing: 0.5, textTransform: "uppercase" }}>
                        פירוט לפי אדם
                      </div>
                      {[1, 2, 3, 4, 5].map(p => {
                        const pItems = cart.filter(c => c.person === p);
                        if (pItems.length === 0) return null;
                        const pTotal = pItems.reduce((s, c) => s + c.price * c.quantity, 0);
                        return (
                          <div key={p} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                              <span style={{
                                width: 20, height: 20, borderRadius: "50%", fontSize: 11, fontWeight: 700,
                                background: "var(--gold)", color: "var(--bg)",
                                display: "inline-flex", alignItems: "center", justifyContent: "center", shrink: 0,
                              }}>{p}</span>
                              <span style={{ fontSize: 12, color: "var(--text)", opacity: 0.75, lineHeight: "20px" }}>
                                {pItems.map(c => `${c.name}${c.quantity > 1 ? ` ×${c.quantity}` : ""}`).join(", ")}
                              </span>
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--gold)", whiteSpace: "nowrap", marginRight: 8 }}>
                              ₪{pTotal}
                            </span>
                          </div>
                        );
                      })}
                      {cart.some(c => c.person === undefined) && (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 4, paddingTop: 6, borderTop: "1px solid var(--border)" }}>
                          <span style={{ fontSize: 12, color: "var(--text)", opacity: 0.45 }}>ללא שיוך</span>
                          <span style={{ fontSize: 13, color: "var(--text)", opacity: 0.45 }}>
                            ₪{cart.filter(c => c.person === undefined).reduce((s, c) => s + c.price * c.quantity, 0)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
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
                {orderLoading ? "שולח..." : "שלח הזמנה"}
              </button>
            </div>
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
            ההזמנה התקבלה!
          </div>
          {tableNumber && (
            <div style={{ color: "var(--text)", fontSize: 18, opacity: 0.8 }}>
              שולחן {tableNumber}
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
            סגור
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
                {getItemBadges(modalItem).map(b => <span key={b} className="menu-modal-type-tag">{b}</span>)}
              </div>
              <h2 className="menu-modal-name">{modalItem.name}</h2>
              <div className="menu-modal-divider"><span>◆</span></div>
              {modalItem.description && <p className="menu-modal-desc">{modalItem.description}</p>}
              <div className="menu-modal-meta">
                <div className="menu-modal-price-box">
                  <div className="menu-modal-price-label">מחיר</div>
                  <div className="menu-modal-price">₪{modalItem.price}</div>
                </div>
                {modalItem.prepTime != null && (
                  <div className="menu-modal-price-box">
                    <div className="menu-modal-price-label">זמן הכנה</div>
                    <div className="menu-modal-price" style={{ fontSize: "1.8rem" }}>⏱ {modalItem.prepTime}&apos;</div>
                  </div>
                )}
              </div>
              {restaurant.ordersEnabled && (
                <button
                  onClick={() => { addToCart(modalItem); setModalItem(null); }}
                  style={{
                    marginTop: 16,
                    width: "100%",
                    padding: "12px 0",
                    background: "var(--gold)",
                    color: "var(--bg)",
                    border: "none",
                    borderRadius: 10,
                    fontWeight: 700,
                    fontSize: 16,
                    cursor: "pointer",
                  }}
                >
                  הוסף לסל
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
    </div>
  );
}
