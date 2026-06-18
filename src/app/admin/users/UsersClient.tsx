"use client";

import { useState, useRef, useEffect } from "react";
import { ROLE_LABELS } from "@/lib/permissions";
import { AssistantWidget } from "@/components/admin/AssistantWidget";
import { formatDate } from "@/lib/utils";
import type { Role } from "@/generated/prisma/client";
import { T, btn, inp } from "@/lib/ui";
import PageShell from "@/components/admin/PageShell";

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
  phone: string | null;
  emailVerified: Date | null;
  mustChangePassword: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  restaurantUsers: RestaurantUser[];
};

interface Props {
  users: UserWithRestaurants[];
  restaurants: { id: string; name: string }[];
  currentUserRole: Role;
}

const ALL_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "OWNER", "SHIFT_MANAGER", "EDITOR", "WAITER", "VIEWER", "DISPLAY"];

// ── Light theme tokens ──────────────────────────────────────────────────────
const L = {
  bg:      "#f4f6f9",
  card:    "#fff",
  border:  "#f0f0f0",
  border2: "#e5e7eb",
  text:    "#1a1a2e",
  sub:     "#374151",
  muted:   "#6b7280",
  primary: "#4f46e5",
  orange:  "#f97316",
  green:   "#10b981",
  red:     "#ef4444",
  gold:    "#b07d00",
};

const ROLE_BADGE: Record<string, React.CSSProperties> = {
  SUPER_ADMIN:   { background: "rgba(255,107,107,0.12)", color: "#c92a2a" },
  ADMIN:         { background: "rgba(51,154,240,0.12)",  color: "#1971c2" },
  OWNER:         { background: "rgba(252,196,25,0.14)",  color: "#b07d00" },
  SHIFT_MANAGER: { background: "rgba(255,146,43,0.12)",  color: "#e8590c" },
  EDITOR:        { background: "rgba(190,75,219,0.12)",  color: "#6741d9" },
  WAITER:        { background: "rgba(81,207,102,0.12)",  color: "#2f9e44" },
  VIEWER:        { background: "rgba(108,117,125,0.12)", color: "#6b7280" },
  DISPLAY:       { background: "rgba(34,184,207,0.12)",  color: "#0c8599" },
};

// kept for modals (dark)
const DARK_INPUT: React.CSSProperties = {
  background: T.overlay, border: `1px solid ${T.border}`,
  color: T.text, borderRadius: 10, padding: "10px 14px",
  fontSize: 14, width: "100%", outline: "none",
};
const DARK_SELECT: React.CSSProperties = { ...DARK_INPUT, cursor: "pointer" };

export default function UsersClient({ users: initial, restaurants, currentUserRole }: Props) {
  const [users, setUsers]   = useState(initial);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "ADMIN" | "WAITER" | "unverified">("all");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos]       = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  // close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const [showForm, setShowForm]         = useState(false);
  const [form, setForm]                 = useState({ name: "", email: "", phone: "", role: "VIEWER" as Role });
  const [formRestaurantIds, setFormRestaurantIds] = useState<string[]>([]);
  const [pendingInviteLink, setPendingInviteLink] = useState<{ email: string; link: string } | null>(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");

  const [managingUser, setManagingUser] = useState<UserWithRestaurants | null>(null);
  const [addRestaurantId, setAddRestaurantId] = useState("");
  const [restLoading, setRestLoading]   = useState(false);

  const [resetTarget, setResetTarget]   = useState<UserWithRestaurants | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError]     = useState("");

  const [resendingId, setResendingId]   = useState<string | null>(null);
  const [resentId, setResentId]         = useState<string | null>(null);
  const [forcingId, setForcingId]       = useState<string | null>(null);

  const [editTarget, setEditTarget]     = useState<UserWithRestaurants | null>(null);
  const [editForm, setEditForm]         = useState({ name: "", email: "", role: "VIEWER" as Role, phone: "" });
  const [editLoading, setEditLoading]   = useState(false);
  const [editError, setEditError]       = useState("");
  const [pinInput, setPinInput]         = useState("");
  const [pinSaving, setPinSaving]       = useState(false);
  const [pinMsg, setPinMsg]             = useState("");
  const [hasPin, setHasPin]             = useState(false);

  async function loadPinStatus(userId: string) {
    try {
      const r = await fetch(`/api/admin/users/${userId}/manager-pin`);
      if (r.ok) { const d = await r.json(); setHasPin(!!d.hasPin); }
    } catch { /* ignore */ }
  }

  async function savePin() {
    if (!editTarget || !pinInput.match(/^\d{4,8}$/)) { setPinMsg("PIN חייב להיות 4–8 ספרות"); return; }
    setPinSaving(true); setPinMsg("");
    try {
      const r = await fetch(`/api/admin/users/${editTarget.id}/manager-pin`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinInput }),
      });
      if (r.ok) { setHasPin(true); setPinInput(""); setPinMsg("✓ PIN נשמר"); }
      else { const d = await r.json(); setPinMsg(d.error ?? "שגיאה"); }
    } finally { setPinSaving(false); }
  }

  async function deletePin() {
    if (!editTarget) return;
    setPinSaving(true); setPinMsg("");
    try {
      const r = await fetch(`/api/admin/users/${editTarget.id}/manager-pin`, { method: "DELETE" });
      if (r.ok) { setHasPin(false); setPinMsg("✓ PIN נמחק"); }
    } finally { setPinSaving(false); }
  }

  const ROLE_ORDER: Record<string, number> = { SUPER_ADMIN: 0, ADMIN: 1, OWNER: 2, SHIFT_MANAGER: 3, EDITOR: 4, WAITER: 5, VIEWER: 6, DISPLAY: 7 };

  const filtered = users
    .filter(u => {
      const matchSearch = (u.name?.toLowerCase().includes(search.toLowerCase()) ?? false) || u.email.toLowerCase().includes(search.toLowerCase());
      if (!matchSearch) return false;
      if (roleFilter === "ADMIN")      return u.role === "ADMIN" || u.role === "SUPER_ADMIN";
      if (roleFilter === "WAITER")     return u.role === "WAITER";
      if (roleFilter === "unverified") return !u.emailVerified;
      return true;
    })
    .sort((a, b) => (ROLE_ORDER[a.role] ?? 5) - (ROLE_ORDER[b.role] ?? 5));

  const availableRoles = currentUserRole === "SUPER_ADMIN" ? ALL_ROLES : ALL_ROLES.filter(r => r !== "SUPER_ADMIN");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const res = await fetch("/api/admin/users", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, restaurantIds: formRestaurantIds }),
    });
    if (!res.ok) {
      try { const data = await res.json(); setError(data.error ?? "שגיאה ביצירת המשתמש"); }
      catch { setError("שגיאת שרת, נסה שנית"); }
      setLoading(false); return;
    }
    const created = await res.json();
    setUsers([{ ...created, emailVerified: null, restaurantUsers: [], mustChangePassword: false }, ...users]);
    setShowForm(false); setForm({ name: "", email: "", phone: "", role: "VIEWER" }); setFormRestaurantIds([]);
    setLoading(false);
    if (!created.emailSent && created.inviteLink) setPendingInviteLink({ email: created.email, link: created.inviteLink });
  }

  async function handleForcePasswordChange(userId: string, currentValue: boolean) {
    setForcingId(userId);
    await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mustChangePassword: !currentValue }),
    });
    setUsers(users.map(u => u.id === userId ? { ...u, mustChangePassword: !currentValue } : u));
    setForcingId(null);
  }

  async function handleDelete(userId: string) {
    if (!confirm("האם אתה בטוח שברצונך למחוק את המשתמש?")) return;
    await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    setUsers(users.filter(u => u.id !== userId));
  }

  async function handleAddRestaurant() {
    if (!managingUser || !addRestaurantId) return;
    setRestLoading(true);
    const res = await fetch(`/api/admin/users/${managingUser.id}/restaurants`, {
      method: "POST", headers: { "Content-Type": "application/json" },
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
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId }),
    });
    const updated = { ...managingUser, restaurantUsers: managingUser.restaurantUsers.filter(r => r.restaurantId !== restaurantId) };
    setManagingUser(updated); setUsers(users.map(u => u.id === managingUser.id ? updated : u));
    setRestLoading(false);
  }

  function openEdit(user: UserWithRestaurants) {
    setEditTarget(user);
    setEditForm({ name: user.name ?? "", email: user.email, role: user.role, phone: user.phone ?? "" });
    setEditError(""); setPinInput(""); setPinMsg(""); setHasPin(false);
    loadPinStatus(user.id);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setEditLoading(true); setEditError("");
    const res = await fetch(`/api/admin/users/${editTarget.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editForm.name, email: editForm.email, role: editForm.role, phone: editForm.phone || null }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUsers(users.map(u => u.id === editTarget.id ? { ...u, ...updated } : u));
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
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setResendingId(null); setResentId(userId);
    setTimeout(() => setResentId(null), 3000);
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    setResetLoading(true); setResetError("");
    const res = await fetch(`/api/admin/users/${resetTarget.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: resetPassword }),
    });
    if (res.ok) { setResetTarget(null); setResetPassword(""); }
    else { const data = await res.json(); setResetError(data.error ?? "שגיאה באיפוס הסיסמה"); }
    setResetLoading(false);
  }

  const unassignedRestaurants = managingUser
    ? restaurants.filter(r => !managingUser.restaurantUsers.some(ru => ru.restaurantId === r.id))
    : [];

  const Label = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 6 }}>
      {children}
    </div>
  );

  // ── status text ─────────────────────────────────────────────────────────────
  function statusText(u: UserWithRestaurants) {
    if (!u.emailVerified)      return { label: "ממתין לאימות",      color: L.muted };
    if (u.mustChangePassword)  return { label: "נדרש שינוי סיסמא", color: L.gold  };
    return                            { label: "מאומת ✓",           color: L.green };
  }

  // ── short uid (last 6 chars) ─────────────────────────────────────────────
  function shortId(id: string) { return "#" + id.slice(-6).toUpperCase(); }

  return (
    <PageShell>
      <div style={{ fontFamily: "'Rubik', sans-serif", minHeight: "100vh" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: L.text }}>ניהול משתמשים</div>
          <button onClick={() => setShowForm(true)} style={{ ...btn("warning"), fontFamily: "inherit" }}>
            + הוסף משתמש
          </button>
        </div>

        {/* Filter bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", background: T.overlay, borderRadius: T.rFull, padding: 3, gap: 2 }}>
            {([
              { key: "all",        label: "כל המשתמשים" },
              { key: "ADMIN",      label: "ADMIN" },
              { key: "WAITER",     label: "WAITER" },
              { key: "unverified", label: "ממתין לאימות" },
            ] as const).map(tab => (
              <button key={tab.key} onClick={() => setRoleFilter(tab.key)}
                style={{ padding: "5px 14px", borderRadius: T.rFull, fontSize: 12, fontWeight: 500, cursor: "pointer", border: "none", fontFamily: "inherit", transition: "all 0.15s",
                  background: roleFilter === tab.key ? T.orange : "transparent",
                  color:      roleFilter === tab.key ? "#fff"   : T.muted,
                }}>
                {tab.label}
              </button>
            ))}
          </div>
          <div style={{ position: "relative" }}>
            <input
              type="search" placeholder="חיפוש לפי שם / מייל…"
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ ...inp, borderRadius: T.rMd, padding: "8px 14px", fontSize: 13, width: 220, fontFamily: "inherit" }}
            />
          </div>
        </div>

        {/* Table card */}
        <div style={{ background: T.bg, borderRadius: T.rLg, border: `1px solid ${T.border}`, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: T.bg, borderBottom: `1px solid ${T.border}` }}>
                  {["מזהה", "תאריך הצטרפות", "משתמש", "תפקיד", "מסעדות", "טלפון", "סטטוס", ""].map(h => (
                    <th key={h} style={{ padding: "8px 16px", textAlign: "right", fontSize: 12, fontWeight: 700, color: L.text, whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: "60px 24px", textAlign: "center", color: L.muted, fontSize: 14 }}>לא נמצאו משתמשים</td>
                  </tr>
                ) : (
                  filtered.map(user => {
                    const status = statusText(user);
                    const initials = (user.name ?? user.email).slice(0, 2).toUpperCase();
                    return (
                      <tr key={user.id}
                        style={{ borderBottom: `1px solid ${T.border}` }}
                        onMouseEnter={e => (e.currentTarget.style.background = T.surface)}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        {/* ID */}
                        <td style={{ padding: "2px 12px", fontSize: 12, color: L.muted, fontWeight: 500, whiteSpace: "nowrap" }}>
                          {shortId(user.id)}
                        </td>
                        {/* Date */}
                        <td style={{ padding: "2px 12px", fontSize: 12, color: L.muted, whiteSpace: "nowrap" }}>
                          {formatDate(user.createdAt)}
                        </td>
                        {/* User */}
                        <td style={{ padding: "2px 12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#f0f2f5", border: `1px solid ${L.border2}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: L.muted, flexShrink: 0 }}>
                              {initials}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 14, color: L.text }}>{user.name ?? "—"}</div>
                              <div style={{ fontSize: 12, color: L.muted }} dir="ltr">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        {/* Role */}
                        <td style={{ padding: "2px 12px" }}>
                          <span style={{ ...ROLE_BADGE[user.role], borderRadius: T.rFull, padding: "2px 8px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", display: "inline-block" }}>
                            {ROLE_LABELS[user.role] ?? user.role}
                          </span>
                        </td>
                        {/* Restaurants */}
                        <td style={{ padding: "2px 12px" }}>
                          {user.restaurantUsers.length === 0 ? (
                            <span style={{ fontSize: 12, color: L.muted }}>ללא שיוך</span>
                          ) : (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {user.restaurantUsers.map(ru => (
                                <span key={ru.restaurantId} style={{ background: T.overlay, color: T.muted, borderRadius: T.rSm, padding: "2px 8px", fontSize: 12, fontWeight: 500, border: `1px solid ${T.border}` }}>
                                  {ru.restaurant.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        {/* Phone */}
                        <td style={{ padding: "2px 12px", fontSize: 12, color: L.muted, whiteSpace: "nowrap" }}>
                          {user.phone ?? "—"}
                        </td>
                        {/* Status */}
                        <td style={{ padding: "2px 12px", fontSize: 12, fontWeight: 600, color: status.color, whiteSpace: "nowrap" }}>
                          {status.label}
                        </td>
                        {/* 3-dot menu */}
                        <td style={{ padding: "2px 8px" }}>
                          <button
                            onClick={e => {
                              const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                              const menuW = 200;
                              const left  = rect.right + menuW > window.innerWidth
                                ? rect.left - menuW          // not enough room to the right → open left
                                : rect.left;                 // open to the right of the button
                              setMenuPos({ top: rect.bottom + 6, left: Math.max(8, left) });
                              setOpenMenuId(openMenuId === user.id ? null : user.id);
                            }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, fontSize: 20, padding: "2px 6px", borderRadius: T.rSm, lineHeight: 1, fontFamily: "inherit" }}
                            onMouseEnter={e => (e.currentTarget.style.background = T.overlay)}
                            onMouseLeave={e => (e.currentTarget.style.background = "none")}
                          >⋮</button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination stub */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderTop: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 12, color: L.muted }}>מציג {filtered.length} מתוך {users.length} משתמשים</span>
          </div>
        </div>

      </div>

      {/* ── Create User Modal ─────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, width: "100%", maxWidth: 480, padding: 28, maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 24 }}>הוסף משתמש חדש</h2>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div><Label>שם מלא</Label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={DARK_INPUT} autoFocus /></div>
              <div><Label>אימייל *</Label>
                <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={DARK_INPUT} dir="ltr" /></div>
              <div><Label>טלפון *</Label>
                <input required type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={DARK_INPUT} dir="ltr" placeholder="050-0000000" /></div>
              <div style={{ background: "rgba(51,154,240,0.07)", border: "1px solid rgba(51,154,240,0.2)", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#74c0fc" }}>
                📧 קישור הזמנה יישלח לאימייל — קוד OTP יישלח לטלפון לאימות
              </div>
              <div><Label>הרשאה</Label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as Role })} style={DARK_SELECT}>
                  {availableRoles.map(r => <option key={r} value={r} style={{ background: T.surface }}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              {restaurants.length > 0 && (
                <div>
                  <Label>מסעדות משויכות</Label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto", padding: "2px 0" }}>
                    {restaurants.map(r => {
                      const checked = formRestaurantIds.includes(r.id);
                      return (
                        <label key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, cursor: "pointer", background: checked ? "rgba(252,196,25,0.08)" : T.overlay, border: `1px solid ${checked ? "rgba(252,196,25,0.3)" : T.border}` }}>
                          <input type="checkbox" checked={checked}
                            onChange={() => setFormRestaurantIds(prev => checked ? prev.filter(id => id !== r.id) : [...prev, r.id])}
                            style={{ accentColor: T.gold, width: 15, height: 15, cursor: "pointer" }} />
                          <span style={{ fontSize: 13, color: checked ? T.gold : T.text, fontWeight: checked ? 600 : 400 }}>{r.name}</span>
                        </label>
                      );
                    })}
                  </div>
                  {formRestaurantIds.length > 0 && <div style={{ fontSize: 11, color: T.muted, marginTop: 5 }}>{formRestaurantIds.length} מסעדות נבחרו</div>}
                </div>
              )}
              {error && <p style={{ color: T.red, fontSize: 13, background: "rgba(255,107,107,0.1)", padding: "8px 12px", borderRadius: 8 }}>{error}</p>}
              <div className="flex gap-3" style={{ marginTop: 4 }}>
                <button type="submit" disabled={loading} style={{ flex: 1, background: T.gold, color: "#fff", border: "none", padding: 11, borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
                  {loading ? "יוצר..." : "✉️ צור משתמש ושלח הזמנה"}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setForm({ name: "", email: "", phone: "", role: "VIEWER" }); setFormRestaurantIds([]); }}
                  style={{ flex: 1, background: T.overlay, color: T.sub, border: `1px solid ${T.border}`, padding: 11, borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
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
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, width: "100%", maxWidth: 460, padding: 28 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text }}>מסעדות משויכות</h2>
                <p style={{ fontSize: 13, color: T.muted, marginTop: 2 }}>{managingUser.name ?? managingUser.email}</p>
              </div>
              <button onClick={() => setManagingUser(null)} style={{ color: T.muted, background: "none", border: "none", fontSize: 22, cursor: "pointer" }}>×</button>
            </div>
            <div style={{ marginBottom: 20, minHeight: 60, display: "flex", flexDirection: "column", gap: 8 }}>
              {managingUser.restaurantUsers.length === 0 ? (
                <p style={{ fontSize: 13, color: T.muted, textAlign: "center", padding: "16px 0" }}>אין מסעדות משויכות</p>
              ) : (
                managingUser.restaurantUsers.map(ru => (
                  <div key={ru.restaurantId} className="flex items-center justify-between" style={{ background: "rgba(252,196,25,0.08)", border: "1px solid rgba(252,196,25,0.2)", borderRadius: 10, padding: "10px 14px" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{ru.restaurant.name}</span>
                    <button onClick={() => handleRemoveRestaurant(ru.restaurantId)} disabled={restLoading}
                      style={{ color: T.red, fontSize: 12, fontWeight: 700, background: "none", border: "none", cursor: "pointer", opacity: restLoading ? 0.4 : 1 }}>הסר</button>
                  </div>
                ))
              )}
            </div>
            {unassignedRestaurants.length > 0 && (
              <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 20, marginBottom: 16 }}>
                <Label>הוסף מסעדה</Label>
                <div className="flex gap-2">
                  <select value={addRestaurantId} onChange={e => setAddRestaurantId(e.target.value)} style={{ ...DARK_SELECT, flex: 1 }}>
                    <option value="" style={{ background: T.surface }}>בחר מסעדה...</option>
                    {unassignedRestaurants.map(r => <option key={r.id} value={r.id} style={{ background: T.surface }}>{r.name}</option>)}
                  </select>
                  <button onClick={handleAddRestaurant} disabled={!addRestaurantId || restLoading}
                    style={{ background: T.gold, color: "#fff", border: "none", padding: "0 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: (!addRestaurantId || restLoading) ? 0.4 : 1 }}>
                    הוסף
                  </button>
                </div>
              </div>
            )}
            <button onClick={() => setManagingUser(null)} style={{ width: "100%", background: T.overlay, color: T.sub, border: `1px solid ${T.border}`, padding: 11, borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              סגור
            </button>
          </div>
        </div>
      )}

      {/* ── Invite Link Fallback Modal ───────────────────────────────────── */}
      {pendingInviteLink && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, width: "100%", maxWidth: 440, padding: 28, textAlign: "center" }}>
            <div style={{ width: 52, height: 52, background: "rgba(255,146,43,0.15)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 24 }}>⚠️</div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 8 }}>האימייל לא נשלח</h2>
            <p style={{ fontSize: 13, color: T.muted, marginBottom: 16 }}>שלח למשתמש את קישור ההזמנה הבא ידנית:</p>
            <div style={{ background: "rgba(201,164,82,0.08)", border: "1px solid rgba(201,164,82,0.3)", borderRadius: 12, padding: "14px 16px", marginBottom: 8, textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#6b6070", letterSpacing: 1, marginBottom: 6 }}>אימייל</div>
              <div style={{ fontSize: 13, color: T.sub, marginBottom: 14 }} dir="ltr">{pendingInviteLink.email}</div>
              <div style={{ fontSize: 11, color: "#6b6070", letterSpacing: 1, marginBottom: 6 }}>קישור הזמנה</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ flex: 1, fontSize: 11, color: T.gold, fontFamily: "monospace", wordBreak: "break-all", background: "rgba(0,0,0,0.3)", borderRadius: 6, padding: "8px 10px" }} dir="ltr">
                  {pendingInviteLink.link}
                </div>
                <button onClick={() => navigator.clipboard.writeText(pendingInviteLink!.link)}
                  style={{ flexShrink: 0, background: "rgba(201,164,82,0.15)", border: "1px solid rgba(201,164,82,0.3)", color: T.gold, borderRadius: 8, padding: "2px 8px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  📋 העתק
                </button>
              </div>
            </div>
            <p style={{ fontSize: 11, color: T.muted, marginBottom: 20, textAlign: "right" }}>⏱ הקישור תקף ל-72 שעות.</p>
            <button onClick={() => setPendingInviteLink(null)} style={{ width: "100%", background: T.gold, color: "#fff", border: "none", padding: 11, borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              הבנתי
            </button>
          </div>
        </div>
      )}

      {/* ── Edit User Modal ───────────────────────────────────────────────── */}
      {editTarget && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, width: "100%", maxWidth: 460, padding: 28 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 4 }}>עריכת משתמש</h2>
            <p style={{ fontSize: 13, color: T.muted, marginBottom: 24 }} dir="ltr">{editTarget.email}</p>
            <form onSubmit={handleEdit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div><Label>שם מלא</Label>
                <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={DARK_INPUT} /></div>
              <div><Label>טלפון נייד</Label>
                <input type="tel" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} placeholder="05X-XXXXXXX" style={DARK_INPUT} dir="ltr" /></div>
              <div><Label>אימייל *</Label>
                <input required type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} style={DARK_INPUT} dir="ltr" /></div>
              <div><Label>הרשאה</Label>
                <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value as Role })} style={DARK_SELECT}>
                  {ALL_ROLES.map(r => <option key={r} value={r} style={{ background: T.surface }}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              {["ADMIN","OWNER","SHIFT_MANAGER"].includes(editForm.role) && (
                <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
                  <Label>🔐 PIN מנהל {hasPin ? <span style={{ color: T.green, fontSize: 11 }}>(מוגדר ✓)</span> : <span style={{ color: T.muted, fontSize: 11 }}>(לא מוגדר)</span>}</Label>
                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                    <input type="password" inputMode="numeric" maxLength={8}
                      value={pinInput} onChange={e => setPinInput(e.target.value.replace(/\D/g,""))}
                      placeholder="4–8 ספרות"
                      style={{ ...DARK_INPUT, flex: 1, letterSpacing: 4, textAlign: "center" }} />
                    <button type="button" onClick={savePin} disabled={pinSaving || !pinInput}
                      style={{ padding: "0 14px", background: T.gold, color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: (!pinInput || pinSaving) ? 0.5 : 1 }}>
                      שמור
                    </button>
                    {hasPin && (
                      <button type="button" onClick={deletePin} disabled={pinSaving}
                        style={{ padding: "0 12px", background: "transparent", color: T.red, border: `1px solid ${T.red}55`, borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                        מחק
                      </button>
                    )}
                  </div>
                  {pinMsg && <p style={{ fontSize: 12, color: pinMsg.startsWith("✓") ? T.green : T.red, marginTop: 6 }}>{pinMsg}</p>}
                </div>
              )}
              {editError && <p style={{ color: T.red, fontSize: 13, background: "rgba(255,107,107,0.1)", padding: "8px 12px", borderRadius: 8 }}>{editError}</p>}
              <div className="flex gap-3" style={{ marginTop: 4 }}>
                <button type="submit" disabled={editLoading} style={{ flex: 1, background: T.blue, color: "#fff", border: "none", padding: 11, borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: editLoading ? 0.6 : 1 }}>
                  {editLoading ? "שומר..." : "שמור שינויים"}
                </button>
                <button type="button" onClick={() => setEditTarget(null)}
                  style={{ flex: 1, background: T.overlay, color: T.sub, border: `1px solid ${T.border}`, padding: 11, borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
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
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, width: "100%", maxWidth: 380, padding: 28 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 4 }}>איפוס סיסמה</h2>
            <p style={{ fontSize: 13, color: T.muted, marginBottom: 24 }}>{resetTarget.name ?? resetTarget.email}</p>
            <form onSubmit={handleResetPassword} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div><Label>סיסמה חדשה *</Label>
                <input required type="password" minLength={6} value={resetPassword} onChange={e => setResetPassword(e.target.value)} style={DARK_INPUT} placeholder="מינימום 6 תווים" /></div>
              {resetError && <p style={{ color: T.red, fontSize: 13, background: "rgba(255,107,107,0.1)", padding: "8px 12px", borderRadius: 8 }}>{resetError}</p>}
              <div className="flex gap-3" style={{ marginTop: 4 }}>
                <button type="submit" disabled={resetLoading} style={{ flex: 1, background: T.gold, color: "#fff", border: "none", padding: 11, borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: resetLoading ? 0.6 : 1 }}>
                  {resetLoading ? "מאפס..." : "אפס סיסמה"}
                </button>
                <button type="button" onClick={() => setResetTarget(null)}
                  style={{ flex: 1, background: T.overlay, color: T.sub, border: `1px solid ${T.border}`, padding: 11, borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Fixed dropdown (outside table overflow) ──────────────────────── */}
      {openMenuId && (() => {
        const user = filtered.find(u => u.id === openMenuId);
        if (!user) return null;
        return (
          <div ref={menuRef} style={{ position: "fixed", top: menuPos.top, left: menuPos.left, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.rLg, boxShadow: "0 4px 20px rgba(0,0,0,0.14)", width: 200, zIndex: 9999, overflow: "hidden" }}>
            {currentUserRole === "SUPER_ADMIN" && (
              <MenuAction icon="✎" label="ערוך פרטים" onClick={() => { openEdit(user); setOpenMenuId(null); }} />
            )}
            <MenuAction icon="🏪" label="ניהול מסעדות" onClick={() => { setManagingUser(user); setAddRestaurantId(""); setOpenMenuId(null); }} />
            <MenuAction icon="🔑" label="איפוס סיסמה" onClick={() => { setResetTarget(user); setResetPassword(""); setResetError(""); setOpenMenuId(null); }} />
            <MenuAction
              icon="🔐"
              label={user.mustChangePassword ? "בטל כפיית שינוי סיסמה" : "כפה שינוי סיסמה"}
              onClick={() => { handleForcePasswordChange(user.id, user.mustChangePassword); setOpenMenuId(null); }}
              disabled={forcingId === user.id}
            />
            {!user.emailVerified && (
              <MenuAction
                icon={resentId === user.id ? "✓" : "📨"}
                label={resendingId === user.id ? "שולח..." : resentId === user.id ? "נשלח!" : "שלח הזמנה מחדש"}
                onClick={() => { handleResendVerification(user.id); setOpenMenuId(null); }}
                disabled={resendingId === user.id}
              />
            )}
            <div style={{ borderTop: `1px solid ${L.border}` }} />
            <MenuAction icon="🗑️" label="מחק משתמש" onClick={() => { handleDelete(user.id); setOpenMenuId(null); }} danger />
          </div>
        );
      })()}

      <AssistantWidget page="users" />
    </PageShell>
  );
}

// ── Dropdown menu item ────────────────────────────────────────────────────────
function MenuAction({ icon, label, onClick, danger, disabled }: { icon: string; label: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%", textAlign: "right", padding: "9px 14px", background: "none", border: "none",
        cursor: disabled ? "not-allowed" : "pointer", fontSize: 13,
        color: danger ? "#ef4444" : "#374151",
        display: "flex", alignItems: "center", gap: 8,
        opacity: disabled ? 0.5 : 1, fontFamily: "inherit",
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = danger ? "rgba(239,68,68,0.08)" : T.overlay; }}
      onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
    >
      <span style={{ fontSize: 14 }}>{icon}</span>
      {label}
    </button>
  );
}
