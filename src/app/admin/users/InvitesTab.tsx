"use client";

import { useState, useEffect, useCallback } from "react";
import type { Role } from "@/generated/prisma/client";

type Invite = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  role: Role;
  status: "PENDING" | "COMPLETED" | "EXPIRED" | "CANCELLED";
  expiresAt: string;
  reminderSentAt: string | null;
  createdAt: string;
  invitedBy: { name: string | null; username: string };
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "סופר אדמין", ADMIN: "אדמין", OWNER: "בעל עסק",
  SHIFT_MANAGER: "מנהל משמרת", EDITOR: "עורך", VIEWER: "צופה",
  WAITER: "מלצר", DISPLAY: "תצוגה",
};

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:   { label: "ממתין",   color: "#facc15", bg: "rgba(250,204,21,0.12)" },
  COMPLETED: { label: "הושלם",  color: "#34d399", bg: "rgba(52,211,153,0.12)" },
  EXPIRED:   { label: "פג",     color: "#f87171", bg: "rgba(248,113,113,0.12)" },
  CANCELLED: { label: "בוטל",   color: "#9ca3af", bg: "rgba(156,163,175,0.12)" },
};

const DARK_INPUT: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 9,
  border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)",
  color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
};

const INVITABLE_ROLES: Role[] = ["OWNER","SHIFT_MANAGER","EDITOR","VIEWER","WAITER","DISPLAY"];

interface Props {
  currentUserRole: Role;
  restaurants: { id: string; name: string }[];
}

export default function InvitesTab({ currentUserRole, restaurants }: Props) {
  const [invites,     setInvites]     = useState<Invite[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error,       setError]       = useState("");

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", role: "WAITER" as Role,
  });
  const [formRestaurantIds, setFormRestaurantIds] = useState<string[]>([]);
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/invites");
      if (res.ok) setInvites(await res.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.email && !form.phone) { setFormError("נדרש אימייל או טלפון"); return; }
    setFormLoading(true);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, restaurantIds: formRestaurantIds }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error ?? "שגיאה"); return; }
      setInvites(prev => [data, ...prev]);
      setShowForm(false);
      setForm({ firstName: "", lastName: "", email: "", phone: "", role: "WAITER" });
      setFormRestaurantIds([]);
    } finally { setFormLoading(false); }
  }

  async function doAction(inviteId: string, action: "reminder" | "cancel") {
    setActionLoading(inviteId + action);
    setError("");
    try {
      const res = await fetch(`/api/admin/invites/${inviteId}/${action}`, { method: "POST" });
      if (!res.ok) { setError("פעולה נכשלה"); return; }
      await load();
    } finally { setActionLoading(null); }
  }

  async function resend(invite: Invite) {
    // create a new invite for expired/cancelled ones by re-submitting form data
    setActionLoading(invite.id + "resend");
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: invite.firstName, lastName: invite.lastName,
          email: invite.email, phone: invite.phone,
          role: invite.role, restaurantIds: [],
        }),
      });
      if (res.ok) await load();
    } finally { setActionLoading(null); }
  }

  const canInviteRole = (role: Role) => {
    if (["SUPER_ADMIN","ADMIN"].includes(currentUserRole)) return true;
    if (currentUserRole === "OWNER") return !["SUPER_ADMIN","ADMIN","OWNER"].includes(role);
    if (currentUserRole === "SHIFT_MANAGER") return ["VIEWER","WAITER","DISPLAY"].includes(role);
    return false;
  };

  const availableRoles = INVITABLE_ROLES.filter(canInviteRole);

  const card: React.CSSProperties = { background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "16px 18px", border: "1px solid rgba(255,255,255,0.08)" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>
          {invites.filter(i => i.status === "PENDING").length} הזמנות פתוחות
        </div>
        {availableRoles.length > 0 && (
          <button
            onClick={() => setShowForm(v => !v)}
            style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: "rgba(99,102,241,0.25)", color: "#818cf8", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
          >
            {showForm ? "ביטול" : "+ הזמנה חדשה"}
          </button>
        )}
      </div>

      {/* New Invite Form */}
      {showForm && (
        <form onSubmit={handleSend} style={{ ...card, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>הזמנת משתמש חדש</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 4 }}>שם פרטי *</label>
              <input style={DARK_INPUT} value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} required />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 4 }}>שם משפחה *</label>
              <input style={DARK_INPUT} value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} required />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 4 }}>אימייל</label>
              <input style={DARK_INPUT} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} dir="ltr" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 4 }}>טלפון</label>
              <input style={DARK_INPUT} type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} dir="ltr" />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 4 }}>תפקיד *</label>
            <select style={DARK_INPUT} value={form.role} onChange={e => setForm({ ...form, role: e.target.value as Role })}>
              {availableRoles.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          {restaurants.length > 0 && (
            <div>
              <label style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 6 }}>מסעדות</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {restaurants.map(r => {
                  const sel = formRestaurantIds.includes(r.id);
                  return (
                    <button key={r.id} type="button"
                      onClick={() => setFormRestaurantIds(prev => sel ? prev.filter(x => x !== r.id) : [...prev, r.id])}
                      style={{ padding: "4px 10px", borderRadius: 20, fontSize: 12, cursor: "pointer", fontFamily: "inherit", border: "1px solid", borderColor: sel ? "#6366f1" : "rgba(255,255,255,0.15)", background: sel ? "rgba(99,102,241,0.2)" : "transparent", color: sel ? "#818cf8" : "rgba(255,255,255,0.6)" }}
                    >{r.name}</button>
                  );
                })}
              </div>
            </div>
          )}
          {formError && <div style={{ color: "#f87171", fontSize: 13 }}>{formError}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setShowForm(false)} style={{ padding: "8px 16px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.6)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>ביטול</button>
            <button type="submit" disabled={formLoading} style={{ padding: "8px 20px", borderRadius: 9, border: "none", background: "#6366f1", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              {formLoading ? "שולח..." : "שלח הזמנה"}
            </button>
          </div>
        </form>
      )}

      {error && <div style={{ color: "#f87171", fontSize: 13 }}>{error}</div>}

      {/* Invites list */}
      {loading ? (
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>טוען...</div>
      ) : invites.length === 0 ? (
        <div style={{ ...card, color: "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "center" }}>אין הזמנות</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {invites.map(inv => {
            const st = STATUS_STYLE[inv.status];
            return (
              <div key={inv.id} style={{ ...card, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                {/* Status badge */}
                <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, color: st.color, background: st.bg, flexShrink: 0 }}>{st.label}</span>

                {/* Name + role */}
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{inv.firstName} {inv.lastName}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{ROLE_LABELS[inv.role]}</div>
                </div>

                {/* Contact */}
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", minWidth: 100 }}>
                  {inv.email && <div>📧 {inv.email}</div>}
                  {inv.phone && <div>📱 {inv.phone}</div>}
                </div>

                {/* Expiry */}
                {inv.status === "PENDING" && (
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                    פג: {new Date(inv.expiresAt).toLocaleString("he-IL", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {inv.status === "PENDING" && (
                    <>
                      <button
                        onClick={() => doAction(inv.id, "reminder")}
                        disabled={actionLoading === inv.id + "reminder"}
                        style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.1)", color: "#818cf8", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
                      >
                        {actionLoading === inv.id + "reminder" ? "..." : "תזכורת"}
                      </button>
                      <button
                        onClick={() => doAction(inv.id, "cancel")}
                        disabled={actionLoading === inv.id + "cancel"}
                        style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.08)", color: "#f87171", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
                      >
                        {actionLoading === inv.id + "cancel" ? "..." : "ביטול"}
                      </button>
                    </>
                  )}
                  {(inv.status === "EXPIRED" || inv.status === "CANCELLED") && (
                    <button
                      onClick={() => resend(inv)}
                      disabled={actionLoading === inv.id + "resend"}
                      style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid rgba(52,211,153,0.3)", background: "rgba(52,211,153,0.08)", color: "#34d399", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      {actionLoading === inv.id + "resend" ? "..." : "הזמן שוב"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
