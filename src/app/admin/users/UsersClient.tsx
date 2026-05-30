"use client";

import { useState } from "react";
import { ROLE_LABELS } from "@/lib/permissions";
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
  mustChangePassword: boolean;
  createdAt: Date;
  restaurantUsers: RestaurantUser[];
};

interface Props {
  users: UserWithRestaurants[];
  restaurants: { id: string; name: string }[];
  currentUserRole: Role;
}

const ALL_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "OWNER", "VIEWER"];

// ── Dark palette ──────────────────────────────────────────────────────────────
const C = {
  pageBg: "#1a1d23", cardBg: "#212529", border: "#2d3239",
  inputBg: "#2d3239", inputBorder: "#3a3f47",
  text: "#e9ecef", sub: "#adb5bd", muted: "#6c757d",
  amber: "#fcc419", green: "#51cf66", red: "#ff6b6b",
  blue: "#339af0", purple: "#be4bdb", orange: "#ff922b",
} as const;

const DARK_ROLE_STYLE: Record<string, React.CSSProperties> = {
  SUPER_ADMIN: { background: "rgba(255,107,107,0.15)", color: "#ff6b6b" },
  ADMIN:       { background: "rgba(51,154,240,0.15)",  color: "#339af0" },
  OWNER:       { background: "rgba(252,196,25,0.15)",  color: "#fcc419" },
  EDITOR:      { background: "rgba(190,75,219,0.15)",  color: "#be4bdb" },
  VIEWER:      { background: "rgba(108,117,125,0.15)", color: "#6c757d" },
};

const AVATAR_GRADIENT: Record<string, string> = {
  SUPER_ADMIN: "linear-gradient(135deg,#c92a2a,#ff6b6b)",
  ADMIN:       "linear-gradient(135deg,#1971c2,#339af0)",
  OWNER:       "linear-gradient(135deg,#2f9e44,#51cf66)",
  EDITOR:      "linear-gradient(135deg,#6741d9,#9775fa)",
  VIEWER:      "linear-gradient(135deg,#495057,#868e96)",
};

const DARK_INPUT: React.CSSProperties = {
  background: C.inputBg, border: `1px solid ${C.inputBorder}`,
  color: C.text, borderRadius: 10, padding: "10px 14px",
  fontSize: 14, width: "100%", outline: "none",
};

const DARK_SELECT: React.CSSProperties = {
  ...DARK_INPUT, cursor: "pointer",
};

export default function UsersClient({ users: initial, restaurants, currentUserRole }: Props) {
  const [users, setUsers] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "VIEWER" as Role });
  const [pendingTempPassword, setPendingTempPassword] = useState<{ email: string; password: string } | null>(null);
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
  const [resentId, setResentId] = useState<string | null>(null);
  const [forcingId, setForcingId] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<UserWithRestaurants | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "VIEWER" as Role });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  const ROLE_ORDER: Record<string, number> = { SUPER_ADMIN: 0, ADMIN: 1, OWNER: 2, EDITOR: 3, VIEWER: 4 };

  const filtered = users
    .filter(
      (u) =>
        u.name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => (ROLE_ORDER[a.role] ?? 5) - (ROLE_ORDER[b.role] ?? 5));

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
      try {
        const data = await res.json();
        setError(data.error ?? "שגיאה ביצירת המשתמש");
      } catch {
        setError("שגיאת שרת, נסה שנית");
      }
      setLoading(false);
      return;
    }
    const created = await res.json();
    setUsers([{ ...created, emailVerified: null, restaurantUsers: [], mustChangePassword: true }, ...users]);
    setShowForm(false);
    setForm({ name: "", email: "", role: "VIEWER" });
    setLoading(false);
    if (!created.emailSent && created.tempPassword) {
      setPendingTempPassword({ email: created.email, password: created.tempPassword });
    }
  }

  async function handleForcePasswordChange(userId: string, currentValue: boolean) {
    setForcingId(userId);
    await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mustChangePassword: !currentValue }),
    });
    setUsers(users.map((u) => u.id === userId ? { ...u, mustChangePassword: !currentValue } : u));
    setForcingId(null);
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

  function openEdit(user: UserWithRestaurants) {
    setEditTarget(user);
    setEditForm({ name: user.name ?? "", email: user.email, role: user.role });
    setEditError("");
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setEditLoading(true);
    setEditError("");
    const res = await fetch(`/api/admin/users/${editTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editForm.name, email: editForm.email, role: editForm.role }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUsers(users.map((u) => u.id === editTarget.id ? { ...u, ...updated } : u));
      setEditTarget(null);
    } else {
      const data = await res.json();
      setEditError(data.error ?? "שגיאה בעדכון המשתמש");
    }
    setEditLoading(false);
  }

  async function handleResendVerification(userId: string) {
    setResendingId(userId);
    await fetch("/api/admin/users/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setResendingId(null);
    setResentId(userId);
    setTimeout(() => setResentId(null), 3000);
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

  /* ── small helpers ── */
  const Label = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 6 }}>
      {children}
    </div>
  );

  return (
    <div className="p-4 md:p-8" style={{ background: C.pageBg, minHeight: "100vh", color: C.text }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text }}>ניהול משתמשים</h1>
          <p style={{ color: C.muted, marginTop: 3, fontSize: 13 }}>{users.length} משתמשים רשומים</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{ background: C.amber, color: "#000", border: "none", padding: "10px 20px", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
        >
          + הוסף משתמש
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="search"
          placeholder="🔍  חיפוש לפי שם או אימייל..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...DARK_INPUT, borderRadius: 10 }}
        />
      </div>

      {/* Table container */}
      <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#1a1d23" }}>
                {["משתמש","הרשאה","מסעדות משויכות","אימות","נרשם","פעולות"].map(h => (
                  <th key={h} style={{ padding: "11px 16px", textAlign: "right", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".5px", borderBottom: `1px solid ${C.border}` }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "60px 24px", textAlign: "center", color: C.muted, fontSize: 14 }}>לא נמצאו משתמשים</td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <tr key={user.id}
                    style={{ borderBottom: `1px solid ${C.border}` }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#2a2e35")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* User */}
                    <td style={{ padding: "12px 16px" }}>
                      <div className="flex items-center gap-3">
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: AVATAR_GRADIENT[user.role] ?? AVATAR_GRADIENT.VIEWER, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                          {(user.name ?? user.email)[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: C.text, fontSize: 13 }}>{user.name ?? "—"}</div>
                          <div style={{ fontSize: 11, color: C.muted }} dir="ltr">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    {/* Role */}
                    <td style={{ padding: "12px 16px" }}>
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
                        disabled={!availableRoles.includes(user.role) && currentUserRole !== "SUPER_ADMIN"}
                        style={{
                          ...DARK_ROLE_STYLE[user.role],
                          border: "none", borderRadius: 999, padding: "4px 12px",
                          fontSize: 11, fontWeight: 700, cursor: "pointer", outline: "none",
                        }}
                      >
                        {availableRoles.map((r) => (
                          <option key={r} value={r} style={{ background: C.cardBg, color: C.text }}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                    </td>
                    {/* Restaurants */}
                    <td style={{ padding: "12px 16px" }}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {user.restaurantUsers.length === 0 ? (
                          <span style={{ color: C.muted, fontSize: 12 }}>ללא שיוך</span>
                        ) : (
                          user.restaurantUsers.map((ru) => (
                            <span key={ru.restaurantId} style={{ background: C.inputBg, color: C.sub, borderRadius: 5, padding: "2px 7px", fontSize: 11 }}>
                              {ru.restaurant.name}
                            </span>
                          ))
                        )}
                        <button
                          onClick={() => { setManagingUser(user); setAddRestaurantId(""); }}
                          style={{ color: C.muted, fontSize: 13, background: "none", border: "none", cursor: "pointer" }}
                          onMouseEnter={e => (e.currentTarget.style.color = C.amber)}
                          onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
                        >✎</button>
                      </div>
                    </td>
                    {/* Verification */}
                    <td style={{ padding: "12px 16px" }}>
                      <div className="flex flex-col gap-1.5">
                        {user.mustChangePassword ? (
                          <span style={{ background: "rgba(239,68,68,0.12)", color: "#fca5a5", borderRadius: 999, padding: "3px 10px", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>
                            🔐 חייב לשנות סיסמה
                          </span>
                        ) : (
                          <span style={{ background: "rgba(81,207,102,0.15)", color: C.green, borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>
                            ✓ פעיל
                          </span>
                        )}
                      </div>
                    </td>
                    {/* Date */}
                    <td style={{ padding: "12px 16px", fontSize: 12, color: C.muted }}>{formatDate(user.createdAt)}</td>
                    {/* Actions */}
                    <td style={{ padding: "12px 16px" }}>
                      <div className="flex items-center gap-2">
                        {currentUserRole === "SUPER_ADMIN" && (
                          <button
                            onClick={() => openEdit(user)}
                            style={{ width: 30, height: 30, borderRadius: 7, border: `1px solid ${C.inputBorder}`, background: C.inputBg, color: C.sub, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}
                            title="ערוך"
                            onMouseEnter={e => (e.currentTarget.style.color = C.amber)}
                            onMouseLeave={e => (e.currentTarget.style.color = C.sub)}
                          >✎</button>
                        )}
                        <button
                          onClick={() => handleForcePasswordChange(user.id, user.mustChangePassword)}
                          disabled={forcingId === user.id}
                          style={{ width: 30, height: 30, borderRadius: 7, border: `1px solid ${user.mustChangePassword ? "rgba(252,196,25,0.3)" : C.inputBorder}`, background: user.mustChangePassword ? "rgba(252,196,25,0.1)" : C.inputBg, color: user.mustChangePassword ? C.amber : C.sub, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", opacity: forcingId === user.id ? 0.5 : 1 }}
                          title={user.mustChangePassword ? "בטל כפיית שינוי סיסמה" : "כפה שינוי סיסמה בכניסה הבאה"}
                        >🔐</button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          style={{ width: 30, height: 30, borderRadius: 7, border: `1px solid ${C.inputBorder}`, background: C.inputBg, color: C.muted, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}
                          title="מחק"
                          onMouseEnter={e => (e.currentTarget.style.color = C.red)}
                          onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
                        >🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden">
          {filtered.length === 0 ? (
            <p style={{ padding: "60px 16px", textAlign: "center", color: C.muted, fontSize: 14 }}>לא נמצאו משתמשים</p>
          ) : (
            filtered.map((user) => (
              <div key={user.id} style={{ padding: 16, borderBottom: `1px solid ${C.border}` }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                  <div className="flex items-center gap-3">
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: AVATAR_GRADIENT[user.role] ?? AVATAR_GRADIENT.VIEWER, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff" }}>
                      {(user.name ?? user.email)[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: C.text, fontSize: 13 }}>{user.name ?? "—"}</div>
                      <div style={{ fontSize: 11, color: C.muted }} dir="ltr">{user.email}</div>
                    </div>
                  </div>
                  <select value={user.role} onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
                    style={{ ...DARK_ROLE_STYLE[user.role], border: "none", borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", outline: "none" }}>
                    {availableRoles.map((r) => <option key={r} value={r} style={{ background: C.cardBg, color: C.text }}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </div>
                {user.restaurantUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5" style={{ marginBottom: 10 }}>
                    {user.restaurantUsers.map((ru) => (
                      <span key={ru.restaurantId} style={{ background: C.inputBg, color: C.sub, borderRadius: 5, padding: "2px 7px", fontSize: 11 }}>
                        {ru.restaurant.name}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  {currentUserRole === "SUPER_ADMIN" && (
                    <button onClick={() => openEdit(user)} style={{ color: C.muted, fontSize: 12, background: "none", border: "none", cursor: "pointer" }}>✎ ערוך</button>
                  )}
                  <button onClick={() => { setManagingUser(user); setAddRestaurantId(""); }} style={{ color: C.muted, fontSize: 12, background: "none", border: "none", cursor: "pointer" }}>✎ מסעדות</button>
                  <button onClick={() => { setResetTarget(user); setResetPassword(""); setResetError(""); }} style={{ color: C.muted, fontSize: 12, background: "none", border: "none", cursor: "pointer" }}>🔑 סיסמה</button>
                  <button onClick={() => handleDelete(user.id)} style={{ color: C.red, fontSize: 12, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>מחק</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Create User Modal ─────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 16, width: "100%", maxWidth: 460, padding: 28 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 24 }}>משתמש חדש</h2>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div><Label>שם מלא</Label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={DARK_INPUT} /></div>
              <div><Label>אימייל *</Label>
                <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={DARK_INPUT} dir="ltr" /></div>
              <div style={{ background: "rgba(201,164,82,0.07)", border: "1px solid rgba(201,164,82,0.18)", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#dfc07e" }}>
                🔐 סיסמה זמנית תיווצר אוטומטית ותישלח לאימייל של המשתמש
              </div>
              <div><Label>הרשאה</Label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} style={DARK_SELECT}>
                  {availableRoles.map((r) => <option key={r} value={r} style={{ background: C.cardBg }}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              {error && <p style={{ color: C.red, fontSize: 13, background: "rgba(255,107,107,0.1)", padding: "8px 12px", borderRadius: 8 }}>{error}</p>}
              <div className="flex gap-3" style={{ marginTop: 4 }}>
                <button type="submit" disabled={loading} style={{ flex: 1, background: C.amber, color: "#000", border: "none", padding: "11px", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
                  {loading ? "יוצר..." : "צור משתמש ושלח אימייל"}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setForm({ name: "", email: "", role: "VIEWER" }); }} style={{ flex: 1, background: C.inputBg, color: C.sub, border: `1px solid ${C.inputBorder}`, padding: "11px", borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Manage Restaurants Modal ─────────────────────────────────────── */}
      {managingUser && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 16, width: "100%", maxWidth: 460, padding: 28 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text }}>מסעדות משויכות</h2>
                <p style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{managingUser.name ?? managingUser.email}</p>
              </div>
              <button onClick={() => setManagingUser(null)} style={{ color: C.muted, background: "none", border: "none", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>

            <div style={{ marginBottom: 20, minHeight: 60, display: "flex", flexDirection: "column", gap: 8 }}>
              {managingUser.restaurantUsers.length === 0 ? (
                <p style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: "16px 0" }}>אין מסעדות משויכות</p>
              ) : (
                managingUser.restaurantUsers.map((ru) => (
                  <div key={ru.restaurantId} className="flex items-center justify-between" style={{ background: "rgba(252,196,25,0.08)", border: "1px solid rgba(252,196,25,0.2)", borderRadius: 10, padding: "10px 14px" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{ru.restaurant.name}</span>
                    <button
                      onClick={() => handleRemoveRestaurant(ru.restaurantId)}
                      disabled={restLoading}
                      style={{ color: C.red, fontSize: 12, fontWeight: 700, background: "none", border: "none", cursor: "pointer", opacity: restLoading ? 0.4 : 1 }}
                    >הסר</button>
                  </div>
                ))
              )}
            </div>

            {unassignedRestaurants.length > 0 && (
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20, marginBottom: 16 }}>
                <Label>הוסף מסעדה</Label>
                <div className="flex gap-2">
                  <select value={addRestaurantId} onChange={(e) => setAddRestaurantId(e.target.value)} style={{ ...DARK_SELECT, flex: 1 }}>
                    <option value="" style={{ background: C.cardBg }}>בחר מסעדה...</option>
                    {unassignedRestaurants.map((r) => <option key={r.id} value={r.id} style={{ background: C.cardBg }}>{r.name}</option>)}
                  </select>
                  <button onClick={handleAddRestaurant} disabled={!addRestaurantId || restLoading}
                    style={{ background: C.amber, color: "#000", border: "none", padding: "0 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: (!addRestaurantId || restLoading) ? 0.4 : 1 }}>
                    הוסף
                  </button>
                </div>
              </div>
            )}

            <button onClick={() => setManagingUser(null)} style={{ width: "100%", background: C.inputBg, color: C.sub, border: `1px solid ${C.inputBorder}`, padding: 11, borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              סגור
            </button>
          </div>
        </div>
      )}

      {/* ── Temp Password Fallback Modal ──────────────────────────────────── */}
      {pendingTempPassword && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 16, width: "100%", maxWidth: 400, padding: 28, textAlign: "center" }}>
            <div style={{ width: 52, height: 52, background: "rgba(255,146,43,0.15)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 24 }}>⚠️</div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 8 }}>האימייל לא נשלח</h2>
            <p style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>שתף את הסיסמה הזמנית הבאה עם המשתמש ידנית:</p>
            <div style={{ background: "rgba(201,164,82,0.08)", border: "1px solid rgba(201,164,82,0.3)", borderRadius: 12, padding: "16px 24px", marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "#6b6070", letterSpacing: 1, marginBottom: 6 }}>אימייל</div>
              <div style={{ fontSize: 13, color: C.sub, marginBottom: 14 }} dir="ltr">{pendingTempPassword.email}</div>
              <div style={{ fontSize: 11, color: "#6b6070", letterSpacing: 1, marginBottom: 6 }}>סיסמה זמנית</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.amber, fontFamily: "monospace", letterSpacing: 3 }} dir="ltr">{pendingTempPassword.password}</div>
            </div>
            <p style={{ fontSize: 11, color: C.muted, marginBottom: 20 }}>
              המשתמש יתבקש לשנות סיסמה בכניסה הראשונה.
            </p>
            <button onClick={() => setPendingTempPassword(null)} style={{ width: "100%", background: C.amber, color: "#000", border: "none", padding: 11, borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              הבנתי
            </button>
          </div>
        </div>
      )}

      {/* ── Edit User Modal ───────────────────────────────────────────────── */}
      {editTarget && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 16, width: "100%", maxWidth: 460, padding: 28 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>עריכת משתמש</h2>
            <p style={{ fontSize: 13, color: C.muted, marginBottom: 24 }} dir="ltr">{editTarget.email}</p>
            <form onSubmit={handleEdit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div><Label>שם מלא</Label>
                <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} style={DARK_INPUT} /></div>
              <div><Label>אימייל *</Label>
                <input required type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} style={DARK_INPUT} dir="ltr" /></div>
              <div><Label>הרשאה</Label>
                <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value as Role })} style={DARK_SELECT}>
                  {ALL_ROLES.map((r) => <option key={r} value={r} style={{ background: C.cardBg }}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              {editError && <p style={{ color: C.red, fontSize: 13, background: "rgba(255,107,107,0.1)", padding: "8px 12px", borderRadius: 8 }}>{editError}</p>}
              <div className="flex gap-3" style={{ marginTop: 4 }}>
                <button type="submit" disabled={editLoading} style={{ flex: 1, background: C.blue, color: "#fff", border: "none", padding: 11, borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: editLoading ? 0.6 : 1 }}>
                  {editLoading ? "שומר..." : "שמור שינויים"}
                </button>
                <button type="button" onClick={() => setEditTarget(null)} style={{ flex: 1, background: C.inputBg, color: C.sub, border: `1px solid ${C.inputBorder}`, padding: 11, borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Password Reset Modal ──────────────────────────────────────────── */}
      {resetTarget && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 16, width: "100%", maxWidth: 380, padding: 28 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>איפוס סיסמה</h2>
            <p style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>{resetTarget.name ?? resetTarget.email}</p>
            <form onSubmit={handleResetPassword} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div><Label>סיסמה חדשה *</Label>
                <input required type="password" minLength={6} value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} style={DARK_INPUT} placeholder="מינימום 6 תווים" /></div>
              {resetError && <p style={{ color: C.red, fontSize: 13, background: "rgba(255,107,107,0.1)", padding: "8px 12px", borderRadius: 8 }}>{resetError}</p>}
              <div className="flex gap-3" style={{ marginTop: 4 }}>
                <button type="submit" disabled={resetLoading} style={{ flex: 1, background: C.amber, color: "#000", border: "none", padding: 11, borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: resetLoading ? 0.6 : 1 }}>
                  {resetLoading ? "מאפס..." : "אפס סיסמה"}
                </button>
                <button type="button" onClick={() => setResetTarget(null)} style={{ flex: 1, background: C.inputBg, color: C.sub, border: `1px solid ${C.inputBorder}`, padding: 11, borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
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
