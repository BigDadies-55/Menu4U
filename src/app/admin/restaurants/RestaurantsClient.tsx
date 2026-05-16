"use client";

import { useState } from "react";
import { formatDate } from "@/lib/utils";

type Restaurant = {
  id: string;
  name: string;
  description: string | null;
  logo: string | null;
  email: string | null;
  phone: string | null;
  phone2: string | null;
  orderPhone: string | null;
  address: string | null;
  website: string | null;
  isActive: boolean;
  createdAt: Date;
  _count: { menus: number; orders: number; restaurantUsers: number };
};

const emptyForm = {
  name: "", description: "", logo: "", email: "", phone: "",
  phone2: "", orderPhone: "", address: "", website: "",
};

export default function RestaurantsClient({ restaurants: initial }: { restaurants: Restaurant[] }) {
  const [restaurants, setRestaurants] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Restaurant | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function openCreate() {
    setEditTarget(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(r: Restaurant) {
    setEditTarget(r);
    setForm({
      name: r.name, description: r.description ?? "", logo: r.logo ?? "",
      email: r.email ?? "", phone: r.phone ?? "", phone2: r.phone2 ?? "",
      orderPhone: r.orderPhone ?? "", address: r.address ?? "", website: r.website ?? "",
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const body = {
      name: form.name,
      description: form.description || null,
      logo: form.logo || null,
      email: form.email || null,
      phone: form.phone || null,
      phone2: form.phone2 || null,
      orderPhone: form.orderPhone || null,
      address: form.address || null,
      website: form.website || null,
    };

    if (editTarget) {
      const res = await fetch(`/api/admin/restaurants/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated = await res.json();
        setRestaurants(restaurants.map(r => r.id === editTarget.id ? { ...r, ...updated } : r));
      }
    } else {
      const res = await fetch("/api/admin/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { setError("שגיאה ביצירת המסעדה"); setLoading(false); return; }
      const created = await res.json();
      setRestaurants([{ ...created, _count: { menus: 0, orders: 0, restaurantUsers: 0 } }, ...restaurants]);
    }

    setShowForm(false);
    setLoading(false);
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch(`/api/admin/restaurants/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    setRestaurants(restaurants.map(r => r.id === id ? { ...r, isActive: !isActive } : r));
  }

  async function handleDelete(id: string) {
    if (!confirm("האם אתה בטוח שברצונך למחוק את המסעדה? פעולה זו תמחק גם את כל התפריטים והפריטים!")) return;
    await fetch(`/api/admin/restaurants/${id}`, { method: "DELETE" });
    setRestaurants(restaurants.filter(r => r.id !== id));
  }

  const field = (label: string, key: keyof typeof form, opts?: { type?: string; dir?: string }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={opts?.type ?? "text"}
        value={form[key]}
        onChange={e => setForm({ ...form, [key]: e.target.value })}
        dir={opts?.dir}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
    </div>
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ניהול מסעדות</h1>
          <p className="text-gray-500 mt-1">{restaurants.length} מסעדות במערכת</p>
        </div>
        <button onClick={openCreate} className="bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2.5 rounded-lg font-medium transition-colors">
          + הוסף מסעדה
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 my-4">
            <h2 className="text-xl font-bold mb-4">{editTarget ? "עריכת מסעדה" : "מסעדה חדשה"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {field("שם המסעדה *", "name")}
                {field("כתובת", "address")}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">לוגו (URL תמונה)</label>
                <input
                  type="url"
                  value={form.logo}
                  onChange={e => setForm({ ...form, logo: e.target.value })}
                  placeholder="https://..."
                  dir="ltr"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {form.logo && (
                  <img src={form.logo} alt="preview" className="mt-2 h-16 w-16 object-cover rounded-lg border" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {field("אימייל", "email", { type: "email", dir: "ltr" })}
                {field("אתר אינטרנט", "website", { dir: "ltr" })}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {field("טלפון ראשי", "phone", { dir: "ltr" })}
                {field("טלפון נוסף", "phone2", { dir: "ltr" })}
                {field("טלפון הזמנות", "orderPhone", { dir: "ltr" })}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">תיאור</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={loading}
                  className="flex-1 bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-400 text-white py-2.5 rounded-lg font-medium">
                  {loading ? "שומר..." : editTarget ? "שמור שינויים" : "צור מסעדה"}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium">
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
                  אין מסעדות עדיין.
                </td>
              </tr>
            ) : (
              restaurants.map(r => (
                <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {r.logo ? (
                        <img src={r.logo} alt={r.name} className="w-10 h-10 rounded-xl object-cover border" />
                      ) : (
                        <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-700 font-bold">
                          {r.name[0]}
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-gray-900">{r.name}</div>
                        {r.address && <div className="text-xs text-gray-400">{r.address}</div>}
                        {r.website && <div className="text-xs text-blue-400 dir-ltr" dir="ltr">{r.website}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 space-y-0.5">
                    {r.email && <div dir="ltr">{r.email}</div>}
                    {r.phone && <div dir="ltr">📞 {r.phone}</div>}
                    {r.phone2 && <div dir="ltr">📞 {r.phone2}</div>}
                    {r.orderPhone && <div dir="ltr">🛒 {r.orderPhone}</div>}
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
                    <div className="flex items-center gap-3">
                      <button onClick={() => openEdit(r)} className="text-xs text-blue-600 hover:underline">ערוך</button>
                      <button onClick={() => toggleActive(r.id, r.isActive)} className="text-xs text-gray-500 hover:underline">
                        {r.isActive ? "השבת" : "הפעל"}
                      </button>
                      <button onClick={() => handleDelete(r.id)} className="text-xs text-red-500 hover:underline">מחק</button>
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
