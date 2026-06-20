"use client";

import { useState, useRef, useEffect } from "react";
import { ROLE_LABELS } from "@/lib/permissions";
import { AssistantWidget } from "@/components/admin/AssistantWidget";
import { formatDate } from "@/lib/utils";
import type { Role } from "@/generated/prisma/client";
import { T } from "@/lib/ui";
import PageShell from "@/components/admin/PageShell";
import InvitesTab from "./InvitesTab";

type RestaurantUser = {
  restaurantId: string;
  role: Role;
  restaurant: { id: string; name: string };
};

type UserWithRestaurants = {
  id: string;
  username: string;
  name: string | null;
  email: string | null;
  role: Role;
  phone: string | null;
  emailVerified: Date | null;
  mustChangePassword: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  employeeNo?: string | null;
  restaurantUsers: RestaurantUser[];
};

interface Props {
  users: UserWithRestaurants[];
  restaurants: { id: string; name: string }[];
  currentUserRole: Role;
}

const ALL_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "OWNER", "SHIFT_MANAGER", "EDITOR", "WAITER", "BARTENDER", "VIEWER", "DISPLAY"];

const ROLE_BADGE: Record<string, React.CSSProperties> = {
  SUPER_ADMIN:   { background: T.redSub,    color: T.red    },
  ADMIN:         { background: T.blueSub,   color: T.blue   },
  OWNER:         { background: T.yellowSub, color: T.yellow },
  SHIFT_MANAGER: { background: T.orangeSub, color: T.orange },
  EDITOR:        { background: T.purpleSub, color: T.purple },
  WAITER:        { background: T.greenSub,  color: T.green  },
  BARTENDER:     { background: T.purpleSub, color: T.purple },
  VIEWER:        { background: T.surface,   color: T.muted  },
  DISPLAY:       { background: T.cyanSub,   color: T.cyan   },
};

const DARK_INPUT: React.CSSProperties = {
  background: T.surface,
  border: `1px solid ${T.border}`,
  color: T.text,
  borderRadius: 12,
  padding: "10px 14px",
  fontSize: 14,
  width: "100%",
  outline: "none",
};
const DARK_SELECT: React.CSSProperties = { ...DARK_INPUT, cursor: "pointer" };

const MODAL_OVERLAY: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 50,
  background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
  display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
};
const MODAL_BOX: React.CSSProperties = {
  background: T.panel,
  border: `1px solid ${T.border}`,
  borderRadius: 20,
  backdropFilter: "blur(20px)",
  width: "100%",
  boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
};

export default function UsersClient({ users: initial, restaurants, currentUserRole }: Props) {
  const [users, setUsers]   = useState(initial);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "ADMIN" | "WAITER" | "unverified">("all");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos]       = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const [mainTab, setMainTab]           = useState<"users" | "invites">("users");
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
  const [toast, setToast]               = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  const [editTarget, setEditTarget]     = useState<UserWithRestaurants | null>(null);
  const [editForm, setEditForm]         = useState({ name: "", username: "", email: "", role: "VIEWER" as Role, phone: "" });
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
      const q = search.toLowerCase();
      const matchSearch = (u.name?.toLowerCase().includes(q) ?? false) || (u.email?.toLowerCase().includes(q) ?? false) || u.username.toLowerCase().includes(q);
      if (!matchSearch) return false;
      if (roleFilter === "ADMIN")      return u.role === "ADMIN" || u.role === "SUPER_ADMIN";
      if (roleFilter === "WAITER")     return u.role === "WAITER";
      if (roleFilter === "unverified") return !u.emailVerified;
      return true;
    })
    .sort((a, b) => (ROLE_ORDER[a.role] ?? 5) - (ROLE_ORDER[b.role] ?? 5));

  const availableRoles = currentUserRole === "SUPER_ADMIN"
    ? ALL_ROLES
    : currentUserRole === "ADMIN"
      ? ALL_ROLES.filter(r => r !== "SUPER_ADMIN")
      : ALL_ROLES.filter(r => !["SUPER_ADMIN", "ADMIN"].includes(r)); // OWNER/SHIFT_MANAGER cannot assign admin roles

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
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mustChangePassword: !currentValue }),
    });
    if (res.ok) {
      setUsers(users.map(u => u.id === userId ? { ...u, mustChangePassword: !currentValue } : u));
      showToast(!currentValue ? "כפיית שינוי סיסמה הופעלה" : "כפיית שינוי סיסמה בוטלה");
    } else {
      showToast("שגיאה בעדכון הגדרת הסיסמה", false);
    }
    setForcingId(null);
  }

  async function handleDelete(userId: string) {
    if (!confirm("האם אתה בטוח שברצונך למחוק את המשתמש?")) return;
    const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    if (res.ok) {
      setUsers(users.filter(u => u.id !== userId));
      showToast("המשתמש נמחק בהצלחה");
    } else {
      try { const d = await res.json(); showToast(d.error ?? "שגיאה במחיקת המשתמש", false); }
      catch { showToast("שגיאה במחיקת המשתמש", false); }
    }
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
    setEditForm({ name: user.name ?? "", username: user.username, email: user.email ?? "", role: user.role, phone: user.phone ?? "" });
    setEditError(""); setPinInput(""); setPinMsg(""); setHasPin(false);
    loadPinStatus(user.id);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setEditLoading(true); setEditError("");
    const res = await fetch(`/api/admin/users/${editTarget.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editForm.name, username: editForm.username, email: editForm.email, role: editForm.role, phone: editForm.phone || null }),
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
    try {
      const res = await fetch("/api/admin/users/resend-verification", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        setResentId(userId);
        setTimeout(() => setResentId(null), 3000);
        showToast("הזמנה נשלחה מחדש בהצלחה");
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(d.error ?? "שגיאה בשליחת ההזמנה", false);
      }
    } catch {
      showToast("שגיאת רשת בשליחת ההזמנה", false);
    }
    setResendingId(null);
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

  function statusText(u: UserWithRestaurants) {
    if (!u.emailVerified)      return { label: "ממתין לאימות",      color: T.muted   };
    if (u.mustChangePassword)  return { label: "נדרש שינוי סיסמא", color: T.yellow  };
    return                            { label: "מאומת ✓",           color: T.green   };
  }

  function shortId(id: string) { return "#" + id.slice(-6).toUpperCase(); }

  const FieldLabel = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
      {children}
    </div>
  );

  return (
    <PageShell>
      {/* ── Glass header ── */}
      <div style={{
        background: T.surface, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        border: `1px solid ${T.border}`, borderRadius: 20, padding: "15px 25px",
        display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: T.text }}>ניהול משתמשים</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: T.sub }}>
            {users.length} משתמשים רשומים במערכת
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{
            background: `linear-gradient(135deg,${T.gold},${T.amber})`, border: "none", color: "#000",
            padding: "10px 20px", borderRadius: 12, fontFamily: "inherit", fontSize: 14, fontWeight: 700,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
            boxShadow: `0 4px 15px ${T.amberGlow}`, transition: "all 0.2s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 6px 20px ${T.amberGlow}`; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ""; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 4px 15px ${T.amberGlow}`; }}
        >
          + הוסף משתמש
        </button>
      </div>

      {/* ── Main tabs ── */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: T.surface, borderRadius: 12, padding: 4, width: "fit-content", border: `1px solid ${T.borderSub}` }}>
        {(["users","invites"] as const).map(t => (
          <button key={t} onClick={() => setMainTab(t)} style={{ padding: "7px 18px", borderRadius: 9, border: "none", fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer", background: mainTab === t ? T.raised : "transparent", color: mainTab === t ? T.text : T.muted, transition: "all 0.15s" }}>
            {t === "users" ? "משתמשים" : "הזמנות"}
          </button>
        ))}
      </div>

      {mainTab === "invites" && (
        <InvitesTab currentUserRole={currentUserRole} restaurants={restaurants} />
      )}

      {mainTab === "users" && <>

      {/* ── Filter bar ── */}
      <div style={{
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 16, padding: "12px 16px", marginBottom: 16,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", background: T.raised, borderRadius: 40, padding: 3, gap: 2 }}>
          {([
            { key: "all",        label: "כל המשתמשים" },
            { key: "ADMIN",      label: "מנהלים" },
            { key: "WAITER",     label: "מלצרים" },
            { key: "unverified", label: "ממתין לאימות" },
          ] as const).map(tab => (
            <button key={tab.key} onClick={() => setRoleFilter(tab.key)}
              style={{
                padding: "5px 14px", borderRadius: 40, fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: "none", fontFamily: "inherit", transition: "all 0.15s",
                background: roleFilter === tab.key ? `linear-gradient(135deg,${T.gold},${T.amber})` : "transparent",
                color: roleFilter === tab.key ? "#000" : T.muted,
              }}>
              {tab.label}
            </button>
          ))}
        </div>
        <input
          type="search" placeholder="חיפוש לפי שם / שם משתמש / מייל…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{
            ...DARK_INPUT, width: 220, padding: "8px 14px", fontSize: 13,
            borderRadius: 10, fontFamily: "inherit",
          }}
        />
      </div>

      {/* ── Users list ── */}
      <style>{`
        .user-row:hover td { background: var(--c-raised) !important; }
      `}</style>
      <div style={{
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 20, overflow: "hidden",
      }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "60px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>👥</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: T.sub, marginBottom: 6 }}>לא נמצאו משתמשים</div>
            <div style={{ fontSize: 13, color: T.muted }}>נסה לשנות את הסינון</div>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: 56 }} />    {/* avatar */}
              <col style={{ width: "20%" }} /> {/* name+email */}
              <col style={{ width: "20%" }} /> {/* role — same as name */}
              <col style={{ width: "24%" }} /> {/* restaurants — slightly wider */}
              <col style={{ width: 110 }} />   {/* status */}
              <col style={{ width: 88 }} />    {/* id+date */}
              <col style={{ width: 48 }} />    {/* 3-dot */}
            </colgroup>
            <tbody>
              {filtered.map(user => {
                const status   = statusText(user);
                const initials = (user.name ?? user.email ?? "?").slice(0, 2).toUpperCase();
                const isOpen   = openMenuId === user.id;
                const tdBase: React.CSSProperties = {
                  padding: "0 14px", height: 52, verticalAlign: "middle",
                  background: T.surface,
                  borderTop: `1px solid ${T.borderSub}`,
                  transition: "background 0.15s",
                  position: isOpen ? "relative" : undefined,
                  zIndex: isOpen ? 10 : undefined,
                };
                return (
                  <tr key={user.id} className="user-row">
                    {/* Avatar */}
                    <td style={{ ...tdBase, paddingRight: 20, paddingLeft: 6 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: "50%",
                        background: T.raised, border: `1px solid ${T.border}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 700, color: T.text,
                      }}>
                        {initials}
                      </div>
                    </td>

                    {/* Name + username + email */}
                    <td style={{ ...tdBase, paddingRight: 20, paddingLeft: 20 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        <span style={{ display: "block", fontWeight: 700, fontSize: 14, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {user.name ?? "—"}
                        </span>
                        {user.email && (
                          <span style={{ display: "block", fontSize: 11, color: T.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {user.email}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Role badge */}
                    <td style={{ ...tdBase, paddingRight: 20, paddingLeft: 20 }}>
                      <span style={{ ...ROLE_BADGE[user.role], borderRadius: 40, padding: "4px 12px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", display: "inline-block" }}>
                        {ROLE_LABELS[user.role] ?? user.role}
                      </span>
                    </td>

                    {/* Restaurants */}
                    <td style={{ ...tdBase, paddingRight: 20, paddingLeft: 20 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                        {user.restaurantUsers.length === 0 ? (
                          <span style={{ fontSize: 12, color: T.muted }}>ללא שיוך</span>
                        ) : (
                          user.restaurantUsers.map(ru => (
                            <span key={ru.restaurantId} style={{ background: T.raised, color: T.sub, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 500, border: `1px solid ${T.borderSub}`, whiteSpace: "nowrap" }}>
                              {ru.restaurant.name}
                            </span>
                          ))
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td style={{ ...tdBase, fontSize: 12, fontWeight: 600, color: status.color, whiteSpace: "nowrap" }}>
                      {status.label}
                    </td>

                    {/* ID + date */}
                    <td style={tdBase}>
                      <div style={{ fontSize: 11, color: T.muted, fontFamily: "monospace", lineHeight: 1.3 }}>{shortId(user.id)}</div>
                      <div style={{ fontSize: 11, color: T.muted, marginTop: 2, lineHeight: 1.3 }}>{formatDate(user.createdAt)}</div>
                    </td>

                    {/* 3-dot menu */}
                    <td style={{ ...tdBase, paddingLeft: 12, textAlign: "center" }}>
                      <button
                        onClick={e => {
                          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                          const menuW = 210;
                          const left  = rect.right + menuW > window.innerWidth ? rect.left - menuW : rect.left;
                          setMenuPos({ top: rect.bottom + 6, left: Math.max(8, left) });
                          setOpenMenuId(openMenuId === user.id ? null : user.id);
                        }}
                        style={{ background: T.raised, border: `1px solid ${T.borderSub}`, cursor: "pointer", color: T.sub, fontSize: 18, borderRadius: 8, lineHeight: 1, fontFamily: "inherit", transition: "0.15s", width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                        onMouseEnter={e => (e.currentTarget.style.background = T.overlay)}
                        onMouseLeave={e => (e.currentTarget.style.background = T.raised)}
                      >⋮</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Footer count */}
        <div style={{ padding: "12px 20px", borderTop: `1px solid ${T.borderSub}` }}>
          <span style={{ fontSize: 12, color: T.muted }}>מציג {filtered.length} מתוך {users.length} משתמשים</span>
        </div>
      </div>

      {/* ── Create User Modal ─────────────────────────────────────────────── */}
      {showForm && (
        <div style={MODAL_OVERLAY}>
          <div style={{ ...MODAL_BOX, maxWidth: 500, maxHeight: "90vh", overflowY: "auto" }}>
            {/* Modal header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 16px", borderBottom: `1px solid ${T.borderSub}` }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.text }}>משתמש חדש</h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: T.muted }}>הזמנה תישלח לאימייל</p>
              </div>
              <button onClick={() => { setShowForm(false); setForm({ name: "", email: "", phone: "", role: "VIEWER" }); setFormRestaurantIds([]); }}
                style={{ background: T.raised, border: `1px solid ${T.border}`, color: T.sub, borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
                ✕
              </button>
            </div>
            <form onSubmit={handleCreate} style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <FieldLabel>שם מלא</FieldLabel>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={DARK_INPUT} autoFocus />
              </div>
              <div>
                <FieldLabel>אימייל *</FieldLabel>
                <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={DARK_INPUT} dir="ltr" />
              </div>
              <div>
                <FieldLabel>טלפון *</FieldLabel>
                <input required type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={DARK_INPUT} dir="ltr" placeholder="050-0000000" />
              </div>
              <div style={{ background: T.blueSub, border: `1px solid ${T.blue}44`, borderRadius: 10, padding: "10px 14px", fontSize: 12, color: T.blue }}>
                📧 קישור הזמנה יישלח לאימייל — קוד OTP יישלח לטלפון לאימות
              </div>
              <div>
                <FieldLabel>הרשאה</FieldLabel>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as Role })} style={DARK_SELECT}>
                  {availableRoles.map(r => <option key={r} value={r} style={{ background: T.bg }}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              {restaurants.length > 0 && (
                <div>
                  <FieldLabel>מסעדות משויכות</FieldLabel>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto", padding: "2px 0" }}>
                    {restaurants.map(r => {
                      const checked = formRestaurantIds.includes(r.id);
                      return (
                        <label key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, cursor: "pointer", background: checked ? T.goldSub : T.surface, border: `1px solid ${checked ? T.gold : T.border}` }}>
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
              {error && <p style={{ color: T.red, fontSize: 13, background: T.redSub, padding: "8px 12px", borderRadius: 8 }}>{error}</p>}
              <div style={{ display: "flex", gap: 10, marginTop: 4, paddingTop: 16, borderTop: `1px solid ${T.borderSub}` }}>
                <button type="submit" disabled={loading} style={{ flex: 1, background: `linear-gradient(135deg,${T.gold},${T.amber})`, color: "#000", border: "none", padding: 12, borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: loading ? 0.6 : 1, fontFamily: "inherit" }}>
                  {loading ? "יוצר..." : "✉️ צור משתמש ושלח הזמנה"}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setForm({ name: "", email: "", phone: "", role: "VIEWER" }); setFormRestaurantIds([]); }}
                  style={{ flex: 1, background: T.raised, color: T.sub, border: `1px solid ${T.border}`, padding: 12, borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Manage Restaurants Modal ─────────────────────────────────────── */}
      {managingUser && (
        <div style={MODAL_OVERLAY}>
          <div style={{ ...MODAL_BOX, maxWidth: 460 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 16px", borderBottom: `1px solid ${T.borderSub}` }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.text }}>מסעדות משויכות</h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: T.muted }}>{managingUser.name ?? managingUser.email}</p>
              </div>
              <button onClick={() => setManagingUser(null)} style={{ background: T.raised, border: `1px solid ${T.border}`, color: T.sub, borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>
            <div style={{ padding: "20px 24px" }}>
              <div style={{ marginBottom: 16, minHeight: 60, display: "flex", flexDirection: "column", gap: 8 }}>
                {managingUser.restaurantUsers.length === 0 ? (
                  <p style={{ fontSize: 13, color: T.muted, textAlign: "center", padding: "16px 0" }}>אין מסעדות משויכות</p>
                ) : (
                  managingUser.restaurantUsers.map(ru => (
                    <div key={ru.restaurantId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.goldSub, border: `1px solid ${T.gold}44`, borderRadius: 10, padding: "10px 14px" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{ru.restaurant.name}</span>
                      <button onClick={() => handleRemoveRestaurant(ru.restaurantId)} disabled={restLoading}
                        style={{ color: T.red, fontSize: 12, fontWeight: 700, background: "none", border: "none", cursor: "pointer", opacity: restLoading ? 0.4 : 1 }}>הסר</button>
                    </div>
                  ))
                )}
              </div>
              {unassignedRestaurants.length > 0 && (
                <div style={{ borderTop: `1px solid ${T.borderSub}`, paddingTop: 16, marginBottom: 16 }}>
                  <FieldLabel>הוסף מסעדה</FieldLabel>
                  <div style={{ display: "flex", gap: 8 }}>
                    <select value={addRestaurantId} onChange={e => setAddRestaurantId(e.target.value)} style={{ ...DARK_SELECT, flex: 1 }}>
                      <option value="" style={{ background: "var(--c-bg)" }}>בחר מסעדה...</option>
                      {unassignedRestaurants.map(r => <option key={r.id} value={r.id} style={{ background: "var(--c-bg)" }}>{r.name}</option>)}
                    </select>
                    <button onClick={handleAddRestaurant} disabled={!addRestaurantId || restLoading}
                      style={{ background: `linear-gradient(135deg,${T.gold},${T.amber})`, color: "#000", border: "none", padding: "0 18px", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: (!addRestaurantId || restLoading) ? 0.4 : 1 }}>
                      הוסף
                    </button>
                  </div>
                </div>
              )}
              <button onClick={() => setManagingUser(null)} style={{ width: "100%", background: T.raised, color: T.sub, border: `1px solid ${T.border}`, padding: 11, borderRadius: 12, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                סגור
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Invite Link Fallback Modal ───────────────────────────────────── */}
      {pendingInviteLink && (
        <div style={MODAL_OVERLAY}>
          <div style={{ ...MODAL_BOX, maxWidth: 440, padding: 28, textAlign: "center" }}>
            <div style={{ width: 52, height: 52, background: T.orangeSub, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 24 }}>⚠️</div>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: T.text, marginBottom: 8 }}>האימייל לא נשלח</h2>
            <p style={{ fontSize: 13, color: T.muted, marginBottom: 16 }}>שלח למשתמש את קישור ההזמנה הבא ידנית:</p>
            <div style={{ background: T.goldSub, border: `1px solid ${T.gold}44`, borderRadius: 12, padding: "14px 16px", marginBottom: 8, textAlign: "right" }}>
              <div style={{ fontSize: 11, color: T.muted, letterSpacing: 1, marginBottom: 6 }}>אימייל</div>
              <div style={{ fontSize: 13, color: T.sub, marginBottom: 14 }} dir="ltr">{pendingInviteLink.email}</div>
              <div style={{ fontSize: 11, color: T.muted, letterSpacing: 1, marginBottom: 6 }}>קישור הזמנה</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ flex: 1, fontSize: 11, color: T.gold, fontFamily: "monospace", wordBreak: "break-all", background: T.bg, borderRadius: 6, padding: "8px 10px" }} dir="ltr">
                  {pendingInviteLink.link}
                </div>
                <button onClick={() => navigator.clipboard.writeText(pendingInviteLink!.link)}
                  style={{ flexShrink: 0, background: T.goldSub, border: `1px solid ${T.gold}4d`, color: T.gold, borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  📋 העתק
                </button>
              </div>
            </div>
            <p style={{ fontSize: 11, color: T.muted, marginBottom: 20, textAlign: "right" }}>⏱ הקישור תקף ל-72 שעות.</p>
            <button onClick={() => setPendingInviteLink(null)} style={{ width: "100%", background: `linear-gradient(135deg,${T.gold},${T.amber})`, color: "#000", border: "none", padding: 12, borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
              הבנתי
            </button>
          </div>
        </div>
      )}

      {/* ── Edit User Modal ───────────────────────────────────────────────── */}
      {editTarget && (
        <div style={MODAL_OVERLAY}>
          <div style={{ ...MODAL_BOX, maxWidth: 460 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 16px", borderBottom: `1px solid ${T.borderSub}` }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.text }}>עריכת משתמש</h2>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: T.purple }} dir="ltr">@{editTarget.username}</p>
              </div>
              <button onClick={() => setEditTarget(null)} style={{ background: T.raised, border: `1px solid ${T.border}`, color: T.sub, borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>
            <form onSubmit={handleEdit} style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <FieldLabel>שם מלא</FieldLabel>
                  {editTarget.employeeNo && (
                    <span title="מספר עובד (אוטומטי)" style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: T.gold, background: "rgba(201,164,82,0.12)", border: `1px solid ${T.border}`, borderRadius: 6, padding: "2px 8px" }}>
                      מס׳ עובד: {editTarget.employeeNo}
                    </span>
                  )}
                </div>
                <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={DARK_INPUT} /></div>
              <div><FieldLabel>שם משתמש</FieldLabel>
                <input value={editForm.username} onChange={e => setEditForm({ ...editForm, username: e.target.value.toLowerCase() })} style={DARK_INPUT} dir="ltr" placeholder="username" />
                <p style={{ margin: "3px 0 0", fontSize: 11, color: T.muted }}>3-30 תווים, אותיות לטיניות קטנות, ספרות, . _ -</p>
              </div>
              <div><FieldLabel>טלפון נייד</FieldLabel>
                <input type="tel" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} placeholder="05X-XXXXXXX" style={DARK_INPUT} dir="ltr" /></div>
              <div><FieldLabel>אימייל</FieldLabel>
                <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} style={DARK_INPUT} dir="ltr" /></div>
              <div><FieldLabel>הרשאה</FieldLabel>
                <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value as Role })} style={DARK_SELECT}>
                  {availableRoles.map(r => <option key={r} value={r} style={{ background: T.bg }}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              {["ADMIN","OWNER","SHIFT_MANAGER"].includes(editForm.role) && (
                <div style={{ borderTop: `1px solid ${T.borderSub}`, paddingTop: 14 }}>
                  <FieldLabel>🔐 PIN מנהל {hasPin ? <span style={{ color: T.green, fontSize: 11 }}>(מוגדר ✓)</span> : <span style={{ color: T.muted, fontSize: 11 }}>(לא מוגדר)</span>}</FieldLabel>
                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                    <input type="password" inputMode="numeric" maxLength={8}
                      value={pinInput} onChange={e => setPinInput(e.target.value.replace(/\D/g,""))}
                      placeholder="4–8 ספרות"
                      style={{ ...DARK_INPUT, flex: 1, letterSpacing: 4, textAlign: "center" }} />
                    <button type="button" onClick={savePin} disabled={pinSaving || !pinInput}
                      style={{ padding: "0 14px", background: `linear-gradient(135deg,${T.gold},${T.amber})`, color: "#000", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: (!pinInput || pinSaving) ? 0.5 : 1 }}>
                      שמור
                    </button>
                    {hasPin && (
                      <button type="button" onClick={deletePin} disabled={pinSaving}
                        style={{ padding: "0 12px", background: "transparent", color: T.red, border: `1px solid ${T.red}55`, borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                        מחק
                      </button>
                    )}
                  </div>
                  {pinMsg && <p style={{ fontSize: 12, color: pinMsg.startsWith("✓") ? T.green : T.red, marginTop: 6 }}>{pinMsg}</p>}
                </div>
              )}
              {editError && <p style={{ color: T.red, fontSize: 13, background: T.redSub, padding: "8px 12px", borderRadius: 8 }}>{editError}</p>}
              <div style={{ display: "flex", gap: 10, marginTop: 4, paddingTop: 16, borderTop: `1px solid ${T.borderSub}` }}>
                <button type="submit" disabled={editLoading} style={{ flex: 1, background: `linear-gradient(135deg,${T.blue}cc,${T.blue})`, color: "#fff", border: "none", padding: 12, borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: editLoading ? 0.6 : 1, fontFamily: "inherit" }}>
                  {editLoading ? "שומר..." : "שמור שינויים"}
                </button>
                <button type="button" onClick={() => setEditTarget(null)}
                  style={{ flex: 1, background: T.raised, color: T.sub, border: `1px solid ${T.border}`, padding: 12, borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Password Reset Modal ──────────────────────────────────────────── */}
      {resetTarget && (
        <div style={MODAL_OVERLAY}>
          <div style={{ ...MODAL_BOX, maxWidth: 400 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 16px", borderBottom: `1px solid ${T.borderSub}` }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.text }}>איפוס סיסמה</h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: T.muted }}>{resetTarget.name ?? resetTarget.email}</p>
              </div>
              <button onClick={() => setResetTarget(null)} style={{ background: T.raised, border: `1px solid ${T.border}`, color: T.sub, borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>
            <form onSubmit={handleResetPassword} style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div><FieldLabel>סיסמה חדשה *</FieldLabel>
                <input required type="password" minLength={6} value={resetPassword} onChange={e => setResetPassword(e.target.value)} style={DARK_INPUT} placeholder="מינימום 6 תווים" /></div>
              {resetError && <p style={{ color: T.red, fontSize: 13, background: T.redSub, padding: "8px 12px", borderRadius: 8 }}>{resetError}</p>}
              <div style={{ display: "flex", gap: 10, marginTop: 4, paddingTop: 16, borderTop: `1px solid ${T.borderSub}` }}>
                <button type="submit" disabled={resetLoading} style={{ flex: 1, background: `linear-gradient(135deg,${T.gold},${T.amber})`, color: "#000", border: "none", padding: 12, borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: resetLoading ? 0.6 : 1, fontFamily: "inherit" }}>
                  {resetLoading ? "מאפס..." : "אפס סיסמה"}
                </button>
                <button type="button" onClick={() => setResetTarget(null)}
                  style={{ flex: 1, background: T.raised, color: T.sub, border: `1px solid ${T.border}`, padding: 12, borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Fixed dropdown ────────────────────────────────────────────────── */}
      {openMenuId && (() => {
        const user = filtered.find(u => u.id === openMenuId);
        if (!user) return null;
        return (
          <div ref={menuRef} style={{
            position: "fixed", top: menuPos.top, left: menuPos.left, zIndex: 9999,
            background: T.panel, border: `1px solid ${T.border}`,
            borderRadius: 16, backdropFilter: "blur(20px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)", width: 210, overflow: "hidden",
          }}>
            {["SUPER_ADMIN","ADMIN"].includes(currentUserRole) && (
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
            {!user.emailVerified && user.email && (
              <MenuAction
                icon={resentId === user.id ? "✓" : "📨"}
                label={resendingId === user.id ? "שולח..." : resentId === user.id ? "נשלח!" : "שלח הזמנה מחדש"}
                onClick={() => { handleResendVerification(user.id); setOpenMenuId(null); }}
                disabled={resendingId === user.id}
              />
            )}
            <div style={{ borderTop: `1px solid ${T.borderSub}` }} />
            <MenuAction icon="🗑️" label="מחק משתמש" onClick={() => { handleDelete(user.id); setOpenMenuId(null); }} danger />
          </div>
        );
      })()}

      <AssistantWidget page="users" />
      </> /* end mainTab === "users" */}

      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          zIndex: 10000, background: toast.ok ? T.emeraldSub : T.redSub,
          border: `1px solid ${toast.ok ? `${T.emerald}66` : `${T.red}66`}`,
          color: toast.ok ? T.emerald : T.red,
          borderRadius: 12, padding: "12px 20px", fontSize: 14, fontWeight: 600,
          backdropFilter: "blur(12px)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
          animation: "fadeInUp 0.2s ease",
        }}>
          {toast.ok ? "✓" : "✕"} {toast.msg}
        </div>
      )}
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
        color: danger ? T.red : T.text,
        display: "flex", alignItems: "center", gap: 8,
        opacity: disabled ? 0.5 : 1, fontFamily: "inherit",
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = danger ? T.redSub : T.raised; }}
      onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
    >
      <span style={{ fontSize: 14 }}>{icon}</span>
      {label}
    </button>
  );
}
