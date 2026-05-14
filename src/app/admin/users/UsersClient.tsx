"use client";

import { useState } from "react";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import type { Role } from "@/generated/prisma/client";

type UserWithRestaurants = {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  createdAt: Date;
  restaurantUsers: {
    restaurantId: string;
    role: Role;
    restaurant: { id: string; name: string };
  }[];
};

interface Props {
  users: UserWithRestaurants[];
  restaurants: { id: string; name: string }[];
  currentUserRole: Role;
}

const ALL_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "EDITOR", "VIEWER"];

export default function UsersClient({ users: initial, restaurants, currentUserRole }: Props) {
  const [users, setUsers] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "VIEWER" as Role });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const filtered = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "שגיאה ביצירת המשתמש");
      setLoading(false);
      return;
    }
    const created = await res.json();
    setUsers([{ ...created, restaurantUsers: [] }, ...users]);
    setShowForm(false);
    setForm({ name: "", email: "", password: "", role: "VIEWER" });
    setLoading(false);
  }

  async function handleRoleChange(userId: string, role: Role) {
    await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setUsers(users.map((u) => (u.id === userId ? { ...u, role } : u)));
  }

  async function handleDelete(userId: string) {
    if (!confirm("האם אתה בטוח שברצונך למחוק את המשתמש?")) return;
    await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    setUsers(users.filter((u) => u.id !== userId));
  }

  const availableRoles = currentUserRole === "SUPER_ADMIN"
    ? ALL_ROLES
    : ALL_ROLES.filter((r) => r !== "SUPER_ADMIN");

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ניהול משתמשים</h1>
          <p className="text-gray-500 mt-1">{users.length} משתמשים רשומים</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
        >
          + הוסף משתמש
        </button>
      </div>

      <div className="mb-4">
        <input
          type="search"
          placeholder="חיפוש לפי שם או אימייל..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">משתמש חדש</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">שם מלא</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">אימייל *</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">סיסמה *</label>
                <input
                  required
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">הרשאה</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {availableRoles.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white py-2.5 rounded-lg font-medium transition-colors"
                >
                  {loading ? "יוצר..." : "צור משתמש"}
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
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">משתמש</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">הרשאה גלובלית</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">מסעדות</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">נרשם</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                  לא נמצאו משתמשים
                </td>
              </tr>
            ) : (
              filtered.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center text-sm font-bold text-gray-600">
                        {(user.name ?? user.email)[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{user.name ?? "—"}</div>
                        <div className="text-xs text-gray-400" dir="ltr">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
                      disabled={!availableRoles.includes(user.role) && currentUserRole !== "SUPER_ADMIN"}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium border-0 cursor-pointer ${ROLE_COLORS[user.role]}`}
                    >
                      {availableRoles.map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {user.restaurantUsers.length === 0 ? (
                      <span className="text-gray-400">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {user.restaurantUsers.map((ru) => (
                          <span key={ru.restaurantId} className="bg-orange-50 text-orange-700 text-xs px-2 py-0.5 rounded">
                            {ru.restaurant.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(user.createdAt)}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      מחק
                    </button>
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
