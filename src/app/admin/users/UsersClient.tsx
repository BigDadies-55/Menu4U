"use client";

import { useState } from "react";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import type { Role } from "@/generated/prisma/client";

type RestaurantUser = {
  restaurantId: string;
  role: Role;
  restaurant: { id: string; name: string };
};

type UserWithRestaurants = {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  emailVerified: Date | null;
  createdAt: Date;
  restaurantUsers: RestaurantUser[];
};

interface Props {
  users: UserWithRestaurants[];
  restaurants: { id: string; name: string }[];
  currentUserRole: Role;
}

const ALL_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "OWNER", "VIEWER"];

export default function UsersClient({ users: initial, restaurants, currentUserRole }: Props) {
  const [users, setUsers] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "VIEWER" as Role });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [managingUser, setManagingUser] = useState<UserWithRestaurants | null>(null);
  const [addRestaurantId, setAddRestaurantId] = useState("");
  const [restLoading, setRestLoading] = useState(false);

  const [resetTarget, setResetTarget] = useState<UserWithRestaurants | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");

  const [resendingId, setResendingId] = useState<string | null>(null);

  const filtered = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const availableRoles = currentUserRole === "SUPER_ADMIN"
    ? ALL_ROLES
    : ALL_ROLES.filter((r) => r !== "SUPER_ADMIN");

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

  async function handleAddRestaurant() {
    if (!managingUser || !addRestaurantId) return;
    setRestLoading(true);
    const res = await fetch(`/api/admin/users/${managingUser.id}/restaurants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId: addRestaurantId }),
    });
    if (res.ok) {
      const ru: RestaurantUser = await res.json();
      const updated = { ...managingUser, restaurantUsers: [...managingUser.restaurantUsers.filter(r => r.restaurantId !== ru.restaurantId), ru] };
      setManagingUser(updated);
      setUsers(users.map(u => u.id === managingUser.id ? updated : u));
      setAddRestaurantId("");
    }
    setRestLoading(false);
  }

  async function handleRemoveRestaurant(restaurantId: string) {
    if (!managingUser) return;
    setRestLoading(true);
    await fetch(`/api/admin/users/${managingUser.id}/restaurants`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId }),
    });
    const updated = { ...managingUser, restaurantUsers: managingUser.restaurantUsers.filter(r => r.restaurantId !== restaurantId) };
    setManagingUser(updated);
    setUsers(users.map(u => u.id === managingUser.id ? updated : u));
    setRestLoading(false);
  }

  async function handleResendVerification(userId: string) {
    setResendingId(userId);
    await fetch("/api/admin/users/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setResendingId(null);
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    setResetLoading(true);
    setResetError("");
    const res = await fetch(`/api/admin/users/${resetTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: resetPassword }),
    });
    if (res.ok) {
      setResetTarget(null);
      setResetPassword("");
    } else {
      const data = await res.json();
      setResetError(data.error ?? "שגיאה באיפוס הסיסמה");
    }
    setResetLoading(false);
  }

  const unassignedRestaurants = managingUser
    ? restaurants.filter(r => !managingUser.restaurantUsers.some(ru => ru.restaurantId === r.id))
    : [];

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ניהול משתמשים</h1>
          <p className="text-gray-400 mt-1 text-sm">{users.length} משתמשים רשומים</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white shadow-md transition-all hover:shadow-lg active:scale-95"
          style={{ background: "linear-gradient(135deg, #8B6914, #C9A84C)" }}
        >
          + הוסף משתמש
        </button>
      </div>

      {/* Search */}
      <div className="mb-5">
        <input
          type="search"
          placeholder="חיפוש לפי שם או אימייל..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white shadow-sm"
        />
      </div>

      {/* Table container */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Desktop Table - hidden on mobile */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">משתמש</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">הרשאה</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">מסעדות משויכות</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">אימות</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">נרשם</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-gray-400 text-sm">לא נמצאו משתמשים</td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <tr key={user.id} className="hover:bg-amber-50/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                          style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}
                        >
                          {(user.name ?? user.email)[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 text-sm">{user.name ?? "—"}</div>
                          <div className="text-xs text-gray-400" dir="ltr">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
                        disabled={!availableRoles.includes(user.role) && currentUserRole !== "SUPER_ADMIN"}
                        className={`text-xs px-2.5 py-1 rounded-full font-semibold border-0 cursor-pointer ${ROLE_COLORS[user.role]}`}
                      >
                        {availableRoles.map((r) => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {user.restaurantUsers.length === 0 ? (
                          <span className="text-gray-300 text-xs">ללא שיוך</span>
                        ) : (
                          user.restaurantUsers.map((ru) => (
                            <span key={ru.restaurantId} className="bg-amber-50 text-amber-700 border border-amber-200 text-xs px-2 py-0.5 rounded-full font-medium">
                              {ru.restaurant.name}
                            </span>
                          ))
                        )}
                        <button
                          onClick={() => { setManagingUser(user); setAddRestaurantId(""); }}
                          className="text-xs text-amber-500 hover:text-amber-700 font-medium transition-colors"
                        >
                          ✎ ערוך
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {user.emailVerified ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-full font-medium">
                          ✓ מאומת
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-xs bg-orange-50 text-orange-600 border border-orange-200 px-2.5 py-1 rounded-full font-medium">
                            ממתין
                          </span>
                          <button
                            onClick={() => handleResendVerification(user.id)}
                            disabled={resendingId === user.id}
                            className="text-xs text-amber-600 hover:text-amber-800 font-medium transition-colors disabled:opacity-40"
                            title="שלח קוד אימות מחדש"
                          >
                            {resendingId === user.id ? "שולח..." : "↩ שלח"}
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-400">{formatDate(user.createdAt)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => { setResetTarget(user); setResetPassword(""); setResetError(""); }}
                          className="text-xs text-amber-600 hover:text-amber-800 font-medium transition-colors"
                        >
                          🔑 סיסמה
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors"
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

        {/* Mobile cards - visible only on small screens */}
        <div className="md:hidden divide-y divide-gray-100">
          {filtered.length === 0 ? (
            <p className="px-4 py-16 text-center text-gray-400 text-sm">לא נמצאו משתמשים</p>
          ) : (
            filtered.map((user) => (
              <div key={user.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                      style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>
                      {(user.name ?? user.email)[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">{user.name ?? "—"}</div>
                      <div className="text-xs text-gray-400" dir="ltr">{user.email}</div>
                    </div>
                  </div>
                  <select value={user.role} onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
                    className={`text-xs px-2 py-1 rounded-full font-semibold border-0 cursor-pointer ${ROLE_COLORS[user.role]}`}>
                    {availableRoles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </div>
                {user.restaurantUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {user.restaurantUsers.map((ru) => (
                      <span key={ru.restaurantId} className="bg-amber-50 text-amber-700 border border-amber-200 text-xs px-2 py-0.5 rounded-full">
                        {ru.restaurant.name}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-3 pt-1">
                  <button onClick={() => { setManagingUser(user); setAddRestaurantId(""); }}
                    className="text-xs text-amber-600 font-medium">✎ מסעדות</button>
                  <button onClick={() => { setResetTarget(user); setResetPassword(""); setResetError(""); }}
                    className="text-xs text-amber-600 font-medium">🔑 סיסמה</button>
                  <button onClick={() => handleDelete(user.id)}
                    className="text-xs text-red-400 font-medium">מחק</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create User Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-7">
            <h2 className="text-xl font-bold text-gray-900 mb-6">משתמש חדש</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">שם מלא</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">אימייל *</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">סיסמה *</label>
                <input
                  required
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">הרשאה</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                >
                  {availableRoles.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              {error && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 text-white py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #8B6914, #C9A84C)" }}
                >
                  {loading ? "יוצר..." : "צור משתמש"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl font-semibold text-sm transition-colors"
                >
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Restaurants Modal */}
      {managingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-7">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">מסעדות משויכות</h2>
                <p className="text-sm text-gray-400 mt-0.5">{managingUser.name ?? managingUser.email}</p>
              </div>
              <button onClick={() => setManagingUser(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            {/* Current restaurants */}
            <div className="mb-5 space-y-2 min-h-[60px]">
              {managingUser.restaurantUsers.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">אין מסעדות משויכות</p>
              ) : (
                managingUser.restaurantUsers.map((ru) => (
                  <div key={ru.restaurantId} className="flex items-center justify-between px-4 py-2.5 bg-amber-50 border border-amber-100 rounded-xl">
                    <span className="text-sm font-medium text-gray-800">{ru.restaurant.name}</span>
                    <button
                      onClick={() => handleRemoveRestaurant(ru.restaurantId)}
                      disabled={restLoading}
                      className="text-red-400 hover:text-red-600 text-sm font-bold transition-colors disabled:opacity-40"
                    >
                      הסר
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add restaurant */}
            {unassignedRestaurants.length > 0 && (
              <div className="border-t border-gray-100 pt-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">הוסף מסעדה</p>
                <div className="flex gap-2">
                  <select
                    value={addRestaurantId}
                    onChange={(e) => setAddRestaurantId(e.target.value)}
                    className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                  >
                    <option value="">בחר מסעדה...</option>
                    {unassignedRestaurants.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddRestaurant}
                    disabled={!addRestaurantId || restLoading}
                    className="px-4 py-2.5 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                    style={{ background: "linear-gradient(135deg, #8B6914, #C9A84C)" }}
                  >
                    הוסף
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => setManagingUser(null)}
              className="mt-4 w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl font-semibold text-sm transition-colors"
            >
              סגור
            </button>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-7">
            <h2 className="text-xl font-bold text-gray-900 mb-1">איפוס סיסמה</h2>
            <p className="text-sm text-gray-400 mb-6">{resetTarget.name ?? resetTarget.email}</p>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">סיסמה חדשה *</label>
                <input
                  required
                  type="password"
                  minLength={6}
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="מינימום 6 תווים"
                />
              </div>
              {resetError && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{resetError}</p>}
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={resetLoading}
                  className="flex-1 text-white py-2.5 rounded-xl font-semibold text-sm disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg,#8B6914,#C9A84C)" }}>
                  {resetLoading ? "מאפס..." : "אפס סיסמה"}
                </button>
                <button type="button" onClick={() => setResetTarget(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl font-semibold text-sm">
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
