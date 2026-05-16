"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/utils";
import ImageUpload from "@/components/admin/ImageUpload";

type Item = {
  id: string; name: string; description: string | null; price: number;
  image: string | null; isActive: boolean; isVegetarian: boolean;
  isVegan: boolean; isGlutenFree: boolean; tags: string[]; sortOrder: number;
};

type Category = {
  id: string; name: string; image: string | null;
  items: Item[]; isActive: boolean; sortOrder: number;
};

type Menu = {
  id: string; name: string; isActive: boolean; isPrimary: boolean;
  scheduleDays: string[]; scheduleFrom: string | null; scheduleTo: string | null;
  categories: Category[];
};
type Restaurant = { id: string; name: string; menus: Menu[] };

const DAYS_HE = ["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"];
const emptyScheduleForm = { isPrimary: false, scheduleDays: [] as string[], scheduleFrom: "", scheduleTo: "" };

const emptyItemForm = { name: "", description: "", price: "", image: "", isVegetarian: false, isVegan: false, isGlutenFree: false, tags: [] as string[] };
const emptyCategoryForm = { name: "", description: "", image: "" };

export default function MenusClient({ restaurants, canEdit }: { restaurants: Restaurant[]; canEdit: boolean }) {
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(restaurants[0] ?? null);
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(restaurants[0]?.menus[0] ?? null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  const [showMenuForm, setShowMenuForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [scheduleMenu, setScheduleMenu] = useState<Menu | null>(null);
  const [scheduleForm, setScheduleForm] = useState(emptyScheduleForm);

  const [menuForm, setMenuForm] = useState({ name: "", description: "" });
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [tagInput, setTagInput] = useState("");
  const [loading, setLoading] = useState(false);

  // ── helpers ──────────────────────────────────────────────────────────────
  function updateMenu(updater: (m: Menu) => Menu) {
    if (!selectedMenu) return;
    const updated = updater(selectedMenu);
    setSelectedMenu(updated);
    if (selectedRestaurant) {
      setSelectedRestaurant({
        ...selectedRestaurant,
        menus: selectedRestaurant.menus.map(m => m.id === updated.id ? updated : m),
      });
    }
  }

  function addTag() {
    const t = tagInput.trim();
    if (t && !itemForm.tags.includes(t)) {
      setItemForm({ ...itemForm, tags: [...itemForm.tags, t] });
    }
    setTagInput("");
  }

  function removeTag(tag: string) {
    setItemForm({ ...itemForm, tags: itemForm.tags.filter(t => t !== tag) });
  }

  // ── Menu CRUD ─────────────────────────────────────────────────────────────
  async function createMenu(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRestaurant) return;
    setLoading(true);
    const res = await fetch("/api/admin/menus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...menuForm, restaurantId: selectedRestaurant.id }),
    });
    if (res.ok) {
      const newMenu: Menu = { ...(await res.json()), categories: [] };
      const updated = { ...selectedRestaurant, menus: [...selectedRestaurant.menus, newMenu] };
      setSelectedRestaurant(updated);
      setSelectedMenu(newMenu);
      setShowMenuForm(false);
      setMenuForm({ name: "", description: "" });
    }
    setLoading(false);
  }

  async function deleteMenu(menuId: string) {
    if (!confirm("למחוק את התפריט? כל הקטגוריות והפריטים שלו יימחקו.")) return;
    await fetch(`/api/admin/menus/${menuId}`, { method: "DELETE" });
    if (selectedRestaurant) {
      const updated = { ...selectedRestaurant, menus: selectedRestaurant.menus.filter(m => m.id !== menuId) };
      setSelectedRestaurant(updated);
      setSelectedMenu(updated.menus[0] ?? null);
    }
  }

  // ── Menu schedule / primary ───────────────────────────────────────────────
  function openSchedule(menu: Menu) {
    setScheduleMenu(menu);
    setScheduleForm({
      isPrimary: menu.isPrimary,
      scheduleDays: menu.scheduleDays ?? [],
      scheduleFrom: menu.scheduleFrom ?? "",
      scheduleTo: menu.scheduleTo ?? "",
    });
  }

  async function saveSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduleMenu) return;
    setLoading(true);
    const body = {
      isPrimary: scheduleForm.isPrimary,
      scheduleDays: scheduleForm.scheduleDays,
      scheduleFrom: scheduleForm.scheduleFrom || null,
      scheduleTo: scheduleForm.scheduleTo || null,
    };
    const res = await fetch(`/api/admin/menus/${scheduleMenu.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok && selectedRestaurant) {
      const updated = await res.json();
      const updatedMenus = selectedRestaurant.menus.map(m =>
        m.id === scheduleMenu.id
          ? { ...m, ...updated }
          : scheduleForm.isPrimary ? { ...m, isPrimary: false } : m
      );
      const updatedRestaurant = { ...selectedRestaurant, menus: updatedMenus };
      setSelectedRestaurant(updatedRestaurant);
      if (selectedMenu?.id === scheduleMenu.id) setSelectedMenu({ ...selectedMenu, ...updated });
      setScheduleMenu(null);
    }
    setLoading(false);
  }

  // ── Category CRUD ─────────────────────────────────────────────────────────
  async function createCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMenu) return;
    setLoading(true);
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...categoryForm, menuId: selectedMenu.id, sortOrder: selectedMenu.categories.length }),
    });
    if (res.ok) {
      const newCat: Category = { ...(await res.json()), items: [] };
      updateMenu(m => ({ ...m, categories: [...m.categories, newCat] }));
      setShowCategoryForm(false);
      setCategoryForm(emptyCategoryForm);
    }
    setLoading(false);
  }

  async function deleteCategory(catId: string) {
    if (!confirm("למחוק את הקטגוריה? כל הפריטים שלה יימחקו.")) return;
    await fetch(`/api/admin/categories/${catId}`, { method: "DELETE" });
    updateMenu(m => ({ ...m, categories: m.categories.filter(c => c.id !== catId) }));
  }

  async function moveCategoryOrder(catId: string, direction: "up" | "down") {
    if (!selectedMenu) return;
    const cats = [...selectedMenu.categories].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = cats.findIndex(c => c.id === catId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= cats.length) return;

    // assign new sequential sort orders based on array positions
    const reordered = [...cats];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    const newOrder = reordered.map((c, i) => ({ ...c, sortOrder: i }));

    await Promise.all([
      fetch(`/api/admin/categories/${newOrder[idx].id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: newOrder[idx].sortOrder }) }),
      fetch(`/api/admin/categories/${newOrder[swapIdx].id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: newOrder[swapIdx].sortOrder }) }),
    ]);
    updateMenu(m => ({ ...m, categories: newOrder }));
  }

  // ── Item CRUD ─────────────────────────────────────────────────────────────

  async function deleteItem(catId: string, itemId: string) {
    if (!confirm("למחוק את הפריט?")) return;
    await fetch(`/api/admin/items/${itemId}`, { method: "DELETE" });
    updateMenu(m => ({
      ...m,
      categories: m.categories.map(c =>
        c.id === catId ? { ...c, items: c.items.filter(i => i.id !== itemId) } : c
      ),
    }));
  }

  async function toggleItem(catId: string, itemId: string, isActive: boolean) {
    await fetch(`/api/admin/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    updateMenu(m => ({
      ...m,
      categories: m.categories.map(c =>
        c.id === catId ? { ...c, items: c.items.map(i => i.id === itemId ? { ...i, isActive: !isActive } : i) } : c
      ),
    }));
  }

  function openEditItem(cat: Category, item: Item) {
    setSelectedCategory(cat);
    setEditItem(item);
    setItemForm({
      name: item.name,
      description: item.description ?? "",
      price: String(item.price),
      image: item.image ?? "",
      isVegetarian: item.isVegetarian,
      isVegan: item.isVegan,
      isGlutenFree: item.isGlutenFree,
      tags: item.tags ?? [],
    });
    setTagInput("");
    setShowItemForm(true);
  }

  async function handleItemSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCategory) return;
    setLoading(true);
    const body = { ...itemForm, price: parseFloat(itemForm.price) };

    if (editItem) {
      const res = await fetch(`/api/admin/items/${editItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated = await res.json();
        updateMenu(m => ({
          ...m,
          categories: m.categories.map(c =>
            c.id === selectedCategory.id
              ? { ...c, items: c.items.map(i => i.id === editItem.id ? { ...i, ...updated } : i) }
              : c
          ),
        }));
      }
    } else {
      const res = await fetch("/api/admin/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, categoryId: selectedCategory.id }),
      });
      if (res.ok) {
        const newItem = await res.json();
        updateMenu(m => ({
          ...m,
          categories: m.categories.map(c =>
            c.id === selectedCategory.id ? { ...c, items: [...c.items, newItem] } : c
          ),
        }));
      }
    }

    setShowItemForm(false);
    setEditItem(null);
    setItemForm(emptyItemForm);
    setTagInput("");
    setLoading(false);
  }

  const sortedCategories = selectedMenu
    ? [...selectedMenu.categories].sort((a, b) => a.sortOrder - b.sortOrder)
    : [];

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">ניהול תפריטים</h1>
      </div>

      {restaurants.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center text-gray-400 shadow-sm border border-gray-100">אין מסעדות זמינות</div>
      ) : (
        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          {/* Sidebar */}
          <div className="w-full md:w-64 md:shrink-0 space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 font-semibold text-sm text-gray-700">מסעדות</div>
              {restaurants.map(rest => (
                <button key={rest.id} onClick={() => { setSelectedRestaurant(rest); setSelectedMenu(rest.menus[0] ?? null); }}
                  className={`w-full text-right px-4 py-3 text-sm transition-colors ${selectedRestaurant?.id === rest.id ? "bg-amber-50 text-amber-700 font-medium" : "text-gray-600 hover:bg-gray-50"}`}>
                  {rest.name}
                </button>
              ))}
            </div>

            {selectedRestaurant && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                  <span className="font-semibold text-sm text-gray-700">תפריטים</span>
                  {canEdit && (
                    <button onClick={() => setShowMenuForm(true)} className="text-xs text-amber-600 hover:text-amber-700 font-medium">+ חדש</button>
                  )}
                </div>
                {selectedRestaurant.menus.map(menu => (
                  <div key={menu.id} className={`flex items-center justify-between pr-4 pl-2 py-2.5 transition-colors ${selectedMenu?.id === menu.id ? "bg-amber-50" : "hover:bg-gray-50"}`}>
                    <button onClick={() => setSelectedMenu(menu)} className={`flex-1 text-right text-sm ${selectedMenu?.id === menu.id ? "text-amber-700 font-medium" : "text-gray-600"}`}>
                      <span className="flex items-center gap-1.5">
                        {menu.isPrimary && <span title="תפריט ראשי" className="text-amber-500 text-xs">★</span>}
                        {menu.scheduleDays?.length > 0 && <span title="עם תזמון" className="text-blue-400 text-xs">⏰</span>}
                        {menu.name}
                      </span>
                    </button>
                    {canEdit && (
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => openSchedule(menu)} className="text-gray-300 hover:text-amber-500 text-xs px-1" title="הגדרות תזמון">🕐</button>
                        <button onClick={() => deleteMenu(menu.id)} className="text-gray-300 hover:text-red-500 text-xs px-1">✕</button>
                      </div>
                    )}
                  </div>
                ))}
                {selectedRestaurant.menus.length === 0 && <p className="p-4 text-xs text-gray-400">אין תפריטים</p>}
              </div>
            )}
          </div>

          {/* Main */}
          <div className="flex-1">
            {!selectedMenu ? (
              <div className="bg-white rounded-xl p-12 text-center text-gray-400 shadow-sm border border-gray-100">בחר תפריט או צור חדש</div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">{selectedMenu.name}</h2>
                  {canEdit && (
                    <button onClick={() => setShowCategoryForm(true)}
                      className="text-white px-4 py-2 rounded-lg text-sm font-medium"
                      style={{ background: "linear-gradient(135deg,#8B6914,#C9A84C)" }}>
                      + קטגוריה חדשה
                    </button>
                  )}
                </div>

                {sortedCategories.length === 0 ? (
                  <div className="bg-white rounded-xl p-12 text-center text-gray-400 shadow-sm border border-gray-100">
                    אין קטגוריות. לחץ על &quot;קטגוריה חדשה&quot;.
                  </div>
                ) : (
                  sortedCategories.map((cat, idx) => (
                    <div key={cat.id} className="bg-white rounded-xl shadow-sm border border-gray-100">
                      <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                        {cat.image && <img src={cat.image} alt={cat.name} className="w-10 h-10 rounded-lg object-cover" />}
                        <h3 className="font-semibold text-gray-900 flex-1">{cat.name}</h3>
                        {canEdit && (
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col gap-0.5">
                              <button onClick={() => moveCategoryOrder(cat.id, "up")} disabled={idx === 0}
                                className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30 leading-none">▲</button>
                              <button onClick={() => moveCategoryOrder(cat.id, "down")} disabled={idx === sortedCategories.length - 1}
                                className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30 leading-none">▼</button>
                            </div>
                            <button onClick={() => { setSelectedCategory(cat); setEditItem(null); setItemForm(emptyItemForm); setTagInput(""); setShowItemForm(true); }}
                              className="text-sm text-amber-600 hover:text-amber-700 font-medium">+ פריט</button>
                            <button onClick={() => deleteCategory(cat.id)} className="text-sm text-red-400 hover:text-red-600">מחק</button>
                          </div>
                        )}
                      </div>
                      <div className="divide-y divide-gray-50">
                        {cat.items.length === 0 ? (
                          <p className="p-4 text-sm text-gray-400">אין פריטים בקטגוריה זו</p>
                        ) : (
                          cat.items.map(item => (
                            <div key={item.id} className="p-3 md:p-4 flex items-start md:items-center gap-3 md:gap-4 flex-wrap md:flex-nowrap">
                              {item.image && <img src={item.image} alt={item.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />}
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`font-medium ${!item.isActive ? "text-gray-400 line-through" : "text-gray-900"}`}>{item.name}</span>
                                  {item.isVegetarian && <span title="צמחוני" className="text-green-500 text-xs">🌿</span>}
                                  {item.isVegan && <span title="טבעוני" className="text-green-600 text-xs">🌱</span>}
                                  {item.isGlutenFree && <span title="ללא גלוטן" className="text-yellow-500 text-xs font-bold">GF</span>}
                                  {item.tags?.map(tag => (
                                    <span key={tag} className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">{tag}</span>
                                  ))}
                                </div>
                                {item.description && <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>}
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="font-semibold text-gray-900">{formatPrice(item.price)}</span>
                                {canEdit && (
                                  <>
                                    <button onClick={() => openEditItem(cat, item)} className="text-xs text-blue-500 hover:text-blue-700">ערוך</button>
                                    <button onClick={() => toggleItem(cat.id, item.id, item.isActive)}
                                      className={`text-xs ${item.isActive ? "text-gray-400 hover:text-amber-600" : "text-green-500 hover:text-green-600"}`}>
                                      {item.isActive ? "השבת" : "הפעל"}
                                    </button>
                                    <button onClick={() => deleteItem(cat.id, item.id)} className="text-xs text-red-400 hover:text-red-600">מחק</button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Menu Form Modal */}
      {showMenuForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">תפריט חדש</h2>
            <form onSubmit={createMenu} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">שם התפריט *</label>
                <input required value={menuForm.name} onChange={e => setMenuForm({ ...menuForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={loading} className="flex-1 text-white py-2.5 rounded-lg font-medium disabled:opacity-50" style={{ background: "linear-gradient(135deg,#8B6914,#C9A84C)" }}>
                  {loading ? "יוצר..." : "צור"}
                </button>
                <button type="button" onClick={() => setShowMenuForm(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium">ביטול</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Form Modal */}
      {showCategoryForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">קטגוריה חדשה</h2>
            <form onSubmit={createCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">שם הקטגוריה *</label>
                <input required value={categoryForm.name} onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <ImageUpload
                label="תמונת קטגוריה"
                value={categoryForm.image}
                onChange={url => setCategoryForm({ ...categoryForm, image: url })}
              />
              <div className="flex gap-3">
                <button type="submit" disabled={loading} className="flex-1 text-white py-2.5 rounded-lg font-medium disabled:opacity-50" style={{ background: "linear-gradient(135deg,#8B6914,#C9A84C)" }}>
                  {loading ? "יוצר..." : "צור"}
                </button>
                <button type="button" onClick={() => setShowCategoryForm(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium">ביטול</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Item Form Modal */}
      {showItemForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{editItem ? `ערוך פריט — ${editItem.name}` : `פריט חדש — ${selectedCategory?.name}`}</h2>
            <form onSubmit={handleItemSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">שם הפריט *</label>
                <input required value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">תיאור</label>
                <textarea value={itemForm.description} onChange={e => setItemForm({ ...itemForm, description: e.target.value })}
                  rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">מחיר (₪) *</label>
                <input required type="number" min="0" step="0.5" value={itemForm.price}
                  onChange={e => setItemForm({ ...itemForm, price: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400" dir="ltr" />
              </div>
              <ImageUpload
                label="תמונת פריט"
                value={itemForm.image}
                onChange={url => setItemForm({ ...itemForm, image: url })}
              />
              <div className="flex gap-4 flex-wrap">
                {[{ key: "isVegetarian", label: "צמחוני 🌿" }, { key: "isVegan", label: "טבעוני 🌱" }, { key: "isGlutenFree", label: "ללא גלוטן" }].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={itemForm[key as keyof typeof itemForm] as boolean}
                      onChange={e => setItemForm({ ...itemForm, [key]: e.target.checked })} className="rounded" />
                    {label}
                  </label>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">תגיות נוספות</label>
                <div className="flex gap-2 mb-2">
                  <input
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                    placeholder="הוסף תגית..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <button type="button" onClick={addTag}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium">הוסף</button>
                </div>
                {itemForm.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {itemForm.tags.map(tag => (
                      <span key={tag} className="flex items-center gap-1 bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-full">
                        {tag}
                        <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-600 font-bold leading-none">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={loading} className="flex-1 text-white py-2.5 rounded-lg font-medium disabled:opacity-50" style={{ background: "linear-gradient(135deg,#8B6914,#C9A84C)" }}>
                  {loading ? "שומר..." : editItem ? "שמור שינויים" : "הוסף פריט"}
                </button>
                <button type="button" onClick={() => { setShowItemForm(false); setEditItem(null); setTagInput(""); }} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium">ביטול</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule / Primary Modal */}
      {scheduleMenu && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-5">הגדרות תפריט — {scheduleMenu.name}</h2>
            <form onSubmit={saveSchedule} className="space-y-5">

              {/* Primary toggle */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={scheduleForm.isPrimary}
                    onChange={e => setScheduleForm({ ...scheduleForm, isPrimary: e.target.checked })} />
                  <div className={`w-11 h-6 rounded-full transition-colors ${scheduleForm.isPrimary ? "bg-amber-400" : "bg-gray-200"}`} />
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${scheduleForm.isPrimary ? "translate-x-5 right-0.5" : "right-5"}`} />
                </div>
                <div>
                  <div className="font-medium text-gray-900">תפריט ראשי ★</div>
                  <div className="text-xs text-gray-400">רק תפריט ראשי מוצג בדף הציבורי</div>
                </div>
              </label>

              {/* Days */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ימי הצגה <span className="text-gray-400 font-normal">(ריק = כל הימים)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_HE.map((day, i) => {
                    const val = String(i);
                    const checked = scheduleForm.scheduleDays.includes(val);
                    return (
                      <button key={i} type="button"
                        onClick={() => setScheduleForm({
                          ...scheduleForm,
                          scheduleDays: checked
                            ? scheduleForm.scheduleDays.filter(d => d !== val)
                            : [...scheduleForm.scheduleDays, val],
                        })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          checked ? "border-amber-400 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-500 hover:border-gray-300"
                        }`}>
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  שעות הצגה <span className="text-gray-400 font-normal">(ריק = כל שעות)</span>
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">משעה</label>
                    <input type="time" value={scheduleForm.scheduleFrom}
                      onChange={e => setScheduleForm({ ...scheduleForm, scheduleFrom: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm" dir="ltr" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">עד שעה</label>
                    <input type="time" value={scheduleForm.scheduleTo}
                      onChange={e => setScheduleForm({ ...scheduleForm, scheduleTo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm" dir="ltr" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={loading}
                  className="flex-1 text-white py-2.5 rounded-lg font-medium disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#8B6914,#C9A84C)" }}>
                  {loading ? "שומר..." : "שמור"}
                </button>
                <button type="button" onClick={() => setScheduleMenu(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium">
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
