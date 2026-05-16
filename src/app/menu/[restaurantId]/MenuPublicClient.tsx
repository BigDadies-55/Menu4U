"use client";

import { useState, useEffect } from "react";
import "./menu.css";

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
};

type Category = {
  id: string;
  name: string;
  image: string | null;
  items: Item[];
};

type Restaurant = {
  name: string;
  logo: string | null;
  address: string | null;
  phone: string | null;
  orderPhone: string | null;
  website: string | null;
  locationUrl: string | null;
  menus: { id: string; categories: Category[] }[];
};

function getItemBadges(item: Item): string[] {
  const badges: string[] = [];
  if (item.isVegetarian) badges.push("🌿 צמחוני");
  if (item.isVegan) badges.push("🌱 טבעוני");
  if (item.isGlutenFree) badges.push("ללא גלוטן");
  return [...badges, ...item.tags];
}

export default function MenuPublicClient({ restaurant }: { restaurant: Restaurant }) {
  const [view, setView] = useState<"home" | "category">("home");
  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  const [modalItem, setModalItem] = useState<Item | null>(null);
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);

  const categories = restaurant.menus.flatMap(m => m.categories);

  function openCategory(cat: Category) {
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
      else if (view === "category") goHome();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [zoomSrc, modalItem, view]);

  useEffect(() => {
    document.body.style.overflow = modalItem ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [modalItem]);

  return (
    <div className="menu-root">
      {/* Header */}
      <header className="menu-header">
        <div className="menu-header-content">
          <div className="menu-header-text">
            <h1 className="menu-main-title">{restaurant.name}</h1>
          </div>
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
              {categories.map(cat => {
                const img = cat.image || cat.items[0]?.image || null;
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
                  <div key={item.id} className="menu-card" onClick={() => setModalItem(item)}>
                    <div className="menu-img-box">
                      {item.image
                        ? <img src={item.image} alt={item.name} loading="lazy" />
                        : <div className="menu-img-placeholder" />}
                    </div>
                    <div className="menu-card-content">
                      <div className="menu-type-labels">
                        {getItemBadges(item).map(b => <span key={b} className="menu-type-tag">{b}</span>)}
                      </div>
                      <h3 className="menu-card-name">{item.name}</h3>
                      <p className="menu-card-desc">{item.description ?? ""}</p>
                      <div className="menu-price">₪{item.price}</div>
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
              <div className="menu-modal-price-box">
                <div className="menu-modal-price-label">מחיר</div>
                <div className="menu-modal-price">₪{modalItem.price}</div>
              </div>
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
