"use client";

import { useState } from "react";
import { formatDate } from "@/lib/utils";

type Restaurant = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: Date;
  _count: { menus: number; orders: number; restaurantUsers: number };
};

interface Props {
  restaurants: Restaurant[];
}

export default function RestaurantsClient({ restaurants: initial }: Props) {
  const [restaurants, setRestaurants] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", description: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/restaurants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      setError("שגיאה ביצירת המסעדה");
      setLoading(false);
      return;
    }
    const created = await res.json();
    setRestaurants([{ ...created, _count: { menus: 0, orders: 0, restaurantUsers: 0 } }, ...restaurants]);
    setShowForm(false);
    setForm({ name: "", email: "", phone: "", address: "", description: "" });
    setLoading(false);
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch(`/api/admin/restaurants/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    setRestaurants(restaurants.map((r) => r.id === id ? { ...r, isActive: !isActive } : r));
  }

  async function handleDelete(id: string) {
    if (!confirm("האם אתה בטוח שברצונך למחוק את המסעדה?")) return;
    await fetch(`/api/admin/restaurants/${id}`, { method: "DELETE" });
    setRestaurants(restaurants.filter((r) => r.id !== id));
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ניהול מסעדות</h1>
          <p className="text-gray-500 mt-1">{restaurants.length} מסעדות במערכת</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
        >
          + הוסף מסעדה
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold mb-4">מסעדה חדשה</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">שם המסעדה *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">אימייל</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">טלפון</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    dir="ltr"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">כתובת</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">תיאור</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white py-2.5 rounded-lg font-medium transition-colors"
                >
                  {loading ? "יוצר..." : "צור מסעדה"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium transition-colors"
                >
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-right">
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">מסעדה</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">פרטי קשר</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">סטטיסטיקות</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">נוצר</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">סטטוס</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {restaurants.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                  אין מסעדות עדיין. לחץ על &quot;הוסף מסעדה&quot; להתחיל.
                </td>
              </tr>
            ) : (
              restaurants.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600 font-bold">
                        {r.name[0]}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{r.name}</div>
                        {r.address && <div className="text-xs text-gray-400">{r.address}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div dir="ltr">{r.email}</div>
                    <div dir="ltr">{r.phone}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div>{r._count.menus} תפריטים</div>
                    <div>{r._count.orders} הזמנות</div>
                    <div>{r._count.restaurantUsers} משתמשים</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(r.createdAt)}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${r.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {r.isActive ? "פעיל" : "לא פעיל"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleActive(r.id, r.isActive)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {r.isActive ? "השבת" : "הפעל"}
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        מחק
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
