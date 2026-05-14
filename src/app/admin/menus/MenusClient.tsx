"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/utils";

type Item = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image: string | null;
  isActive: boolean;
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
};

type Category = {
  id: string;
  name: string;
  items: Item[];
  isActive: boolean;
};

type Menu = {
  id: string;
  name: string;
  isActive: boolean;
  categories: Category[];
};

type Restaurant = {
  id: string;
  name: string;
  menus: Menu[];
};

interface Props {
  restaurants: Restaurant[];
  canEdit: boolean;
}

export default function MenusClient({ restaurants, canEdit }: Props) {
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(
    restaurants[0] ?? null
  );
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(
    restaurants[0]?.menus[0] ?? null
  );
  const [showMenuForm, setShowMenuForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(false);

  const [menuForm, setMenuForm] = useState({ name: "", description: "" });
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "" });
  const [itemForm, setItemForm] = useState({
    name: "", description: "", price: "", isVegetarian: false, isVegan: false, isGlutenFree: false,
  });

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
      const newMenu = await res.json();
      const updatedRestaurant = {
        ...selectedRestaurant,
        menus: [...selectedRestaurant.menus, { ...newMenu, categories: [] }],
      };
      setSelectedRestaurant(updatedRestaurant);
      setSelectedMenu({ ...newMenu, categories: [] });
      setShowMenuForm(false);
      setMenuForm({ name: "", description: "" });
    }
    setLoading(false);
  }

  async function createCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMenu) return;
    setLoading(true);
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...categoryForm, menuId: selectedMenu.id }),
    });
    if (res.ok) {
      const newCat = await res.json();
      const updatedMenu = { ...selectedMenu, categories: [...selectedMenu.categories, { ...newCat, items: [] }] };
      setSelectedMenu(updatedMenu);
      setShowCategoryForm(false);
      setCategoryForm({ name: "", description: "" });
    }
    setLoading(false);
  }

  async function createItem(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCategory) return;
    setLoading(true);
    const res = await fetch("/api/admin/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...itemForm, price: parseFloat(itemForm.price), categoryId: selectedCategory.id }),
    });
    if (res.ok) {
      const newItem = await res.json();
      const updatedMenu = {
        ...selectedMenu!,
        categories: selectedMenu!.categories.map((c) =>
          c.id === selectedCategory.id ? { ...c, items: [...c.items, newItem] } : c
        ),
      };
      setSelectedMenu(updatedMenu);
      setSelectedCategory({ ...selectedCategory, items: [...selectedCategory.items, newItem] });
      setShowItemForm(false);
      setItemForm({ name: "", description: "", price: "", isVegetarian: false, isVegan: false, isGlutenFree: false });
    }
    setLoading(false);
  }

  async function toggleItem(categoryId: string, itemId: string, isActive: boolean) {
    await fetch(`/api/admin/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    const updatedMenu = {
      ...selectedMenu!,
      categories: selectedMenu!.categories.map((c) =>
        c.id === categoryId
          ? { ...c, items: c.items.map((i) => i.id === itemId ? { ...i, isActive: !isActive } : i) }
          : c
      ),
    };
    setSelectedMenu(updatedMenu);
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">ניהול תפריטים</h1>
      </div>

      {restaurants.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center text-gray-400 shadow-sm border border-gray-100">
          אין מסעדות זמינות
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Sidebar: Restaurants & Menus */}
          <div className="w-64 shrink-0 space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 font-semibold text-sm text-gray-700">מסעדות</div>
              {restaurants.map((rest) => (
                <button
                  key={rest.id}
                  onClick={() => {
                    setSelectedRestaurant(rest);
                    setSelectedMenu(rest.menus[0] ?? null);
                  }}
                  className={`w-full text-right px-4 py-3 text-sm transition-colors ${
                    selectedRestaurant?.id === rest.id
                      ? "bg-orange-50 text-orange-700 font-medium"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {rest.name}
                  <span className="text-xs text-gray-400 mr-1">({rest.menus.length})</span>
                </button>
              ))}
            </div>

            {selectedRestaurant && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                  <span className="font-semibold text-sm text-gray-700">תפריטים</span>
                  {canEdit && (
                    <button
                      onClick={() => setShowMenuForm(true)}
                      className="text-xs text-orange-500 hover:text-orange-600 font-medium"
                    >
                      + חדש
                    </button>
                  )}
                </div>
                {selectedRestaurant.menus.map((menu) => (
                  <button
                    key={menu.id}
                    onClick={() => setSelectedMenu(menu)}
                    className={`w-full text-right px-4 py-3 text-sm transition-colors ${
                      selectedMenu?.id === menu.id
                        ? "bg-orange-50 text-orange-700 font-medium"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {menu.name}
                  </button>
                ))}
                {selectedRestaurant.menus.length === 0 && (
                  <p className="p-4 text-xs text-gray-400">אין תפריטים</p>
                )}
              </div>
            )}
          </div>

          {/* Main content */}
          <div className="flex-1">
            {!selectedMenu ? (
              <div className="bg-white rounded-xl p-12 text-center text-gray-400 shadow-sm border border-gray-100">
                בחר תפריט או צור חדש
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">{selectedMenu.name}</h2>
                  {canEdit && (
                    <button
                      onClick={() => setShowCategoryForm(true)}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      + קטגוריה חדשה
                    </button>
                  )}
                </div>

                {selectedMenu.categories.length === 0 ? (
                  <div className="bg-white rounded-xl p-12 text-center text-gray-400 shadow-sm border border-gray-100">
                    אין קטגוריות. לחץ על &quot;קטגוריה חדשה&quot; להתחיל.
                  </div>
                ) : (
                  selectedMenu.categories.map((cat) => (
                    <div key={cat.id} className="bg-white rounded-xl shadow-sm border border-gray-100">
                      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">{cat.name}</h3>
                        {canEdit && (
                          <button
                            onClick={() => { setSelectedCategory(cat); setShowItemForm(true); }}
                            className="text-sm text-orange-500 hover:text-orange-600 font-medium"
                          >
                            + פריט חדש
                          </button>
                        )}
                      </div>
                      <div className="divide-y divide-gray-50">
                        {cat.items.length === 0 ? (
                          <p className="p-4 text-sm text-gray-400">אין פריטים בקטגוריה זו</p>
                        ) : (
                          cat.items.map((item) => (
                            <div key={item.id} className="p-4 flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className={`font-medium ${!item.isActive ? "text-gray-400 line-through" : "text-gray-900"}`}>
                                    {item.name}
                                  </span>
                                  {item.isVegetarian && <span title="צמחוני" className="text-green-500 text-xs">🌿</span>}
                                  {item.isVegan && <span title="טבעוני" className="text-green-600 text-xs">🌱</span>}
                                  {item.isGlutenFree && <span title="ללא גלוטן" className="text-yellow-500 text-xs">GF</span>}
                                </div>
                                {item.description && (
                                  <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="font-semibold text-gray-900">{formatPrice(item.price)}</span>
                                {canEdit && (
                                  <button
                                    onClick={() => toggleItem(cat.id, item.id, item.isActive)}
                                    className={`text-xs ${item.isActive ? "text-gray-400 hover:text-red-500" : "text-green-500 hover:text-green-600"}`}
                                  >
                                    {item.isActive ? "השבת" : "הפעל"}
                                  </button>
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
                <input required value={menuForm.name} onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">תיאור</label>
                <textarea value={menuForm.description} onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })}
                  rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={loading} className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white py-2.5 rounded-lg font-medium">
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
                <input required value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={loading} className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white py-2.5 rounded-lg font-medium">
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">פריט חדש ב{selectedCategory?.name}</h2>
            <form onSubmit={createItem} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">שם הפריט *</label>
                <input required value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">תיאור</label>
                <textarea value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">מחיר (₪) *</label>
                <input required type="number" min="0" step="0.5" value={itemForm.price}
                  onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" dir="ltr" />
              </div>
              <div className="flex gap-4">
                {[
                  { key: "isVegetarian", label: "צמחוני 🌿" },
                  { key: "isVegan", label: "טבעוני 🌱" },
                  { key: "isGlutenFree", label: "ללא גלוטן" },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={itemForm[key as keyof typeof itemForm] as boolean}
                      onChange={(e) => setItemForm({ ...itemForm, [key]: e.target.checked })}
                      className="rounded" />
                    {label}
                  </label>
                ))}
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={loading} className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white py-2.5 rounded-lg font-medium">
                  {loading ? "יוצר..." : "הוסף פריט"}
                </button>
                <button type="button" onClick={() => setShowItemForm(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium">ביטול</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
