"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Role } from "@/generated/prisma/client";

type CsvRow = {
  firstName: string; lastName: string;
  email?: string; phone?: string;
  role: Role; restaurantId?: string;
};
type ImportResult = {
  ok: number; failed: number;
  results: { row: number; status: "ok"|"error"; name: string; error?: string }[];
};

const CSV_ALLOWED_ROLES: Role[] = ["WAITER","EDITOR","VIEWER"];
const CSV_COLUMNS = ["firstName","lastName","email","phone","role","restaurantId"];

function parseCsv(text: string): { rows: CsvRow[]; errors: string[] } {
  const lines  = text.trim().split(/\r?\n/);
  const errors: string[] = [];
  const rows:   CsvRow[] = [];

  if (lines.length < 2) { errors.push("הקובץ ריק או חסר שורת כותרת"); return { rows, errors }; }

  const header = lines[0].split(",").map(h => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name.toLowerCase());

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(",").map(c => c.trim());

    const firstName = cols[idx("firstname")] ?? "";
    const lastName  = cols[idx("lastname")]  ?? "";
    const email     = cols[idx("email")]     ?? "";
    const phone     = cols[idx("phone")]     ?? "";
    const role      = (cols[idx("role")] ?? "").toUpperCase() as Role;
    const restaurantId = cols[idx("restaurantid")] ?? "";

    if (!firstName || !lastName) { errors.push(`שורה ${i+1}: שם חסר`); continue; }
    if (!email && !phone)        { errors.push(`שורה ${i+1}: נדרש אימייל או טלפון`); continue; }
    if (!CSV_ALLOWED_ROLES.includes(role)) {
      errors.push(`שורה ${i+1}: תפקיד לא חוקי "${role}" (מותר: WAITER, EDITOR, VIEWER)`);
      continue;
    }
    rows.push({ firstName, lastName, email: email||undefined, phone: phone||undefined, role, restaurantId: restaurantId||undefined });
  }
  return { rows, errors };
}

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

const ROLE_BADGE: Record<string, React.CSSProperties> = {
  SUPER_ADMIN:   { background: "rgba(255,107,107,0.2)",  color: "#ff6b6b" },
  ADMIN:         { background: "rgba(51,154,240,0.2)",   color: "#74c0fc" },
  OWNER:         { background: "rgba(255,212,59,0.2)",   color: "#FFD43B" },
  SHIFT_MANAGER: { background: "rgba(132,94,247,0.2)",   color: "#b197fc" },
  EDITOR:        { background: "rgba(32,201,151,0.2)",   color: "#63e6be" },
  VIEWER:        { background: "rgba(134,142,150,0.2)",  color: "#adb5bd" },
  WAITER:        { background: "rgba(255,146,43,0.2)",   color: "#ffa94d" },
  DISPLAY:       { background: "rgba(134,142,150,0.15)", color: "#868e96" },
};

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:   { label: "ממתין",  color: "#facc15", bg: "rgba(250,204,21,0.12)" },
  COMPLETED: { label: "הושלם", color: "#34d399", bg: "rgba(52,211,153,0.12)" },
  EXPIRED:   { label: "פג",    color: "#f87171", bg: "rgba(248,113,113,0.12)" },
  CANCELLED: { label: "בוטל",  color: "#9ca3af", bg: "rgba(156,163,175,0.12)" },
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
  const [invites,       setInvites]       = useState<Invite[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [showForm,      setShowForm]      = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast,         setToast]         = useState<{ msg: string; ok: boolean } | null>(null);

  // CSV import state
  const [csvRows,      setCsvRows]      = useState<CsvRow[] | null>(null);
  const [csvErrors,    setCsvErrors]    = useState<string[]>([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResults,   setCsvResults]   = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", role: "WAITER" as Role,
  });
  const [formRestaurantIds, setFormRestaurantIds] = useState<string[]>([]);
  const [formError,   setFormError]   = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // Restaurant search
  const [restSearch,    setRestSearch]    = useState("");
  const [restDropOpen,  setRestDropOpen]  = useState(false);
  const restRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (restRef.current && !restRef.current.contains(e.target as Node)) setRestDropOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredRests = restaurants.filter(r =>
    r.name.toLowerCase().includes(restSearch.toLowerCase())
  );

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/invites");
      if (res.ok) setInvites(await res.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const { rows, errors } = parseCsv(ev.target?.result as string);
      setCsvRows(rows);
      setCsvErrors(errors);
      setCsvResults(null);
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  }

  async function handleCsvImport() {
    if (!csvRows?.length) return;
    setCsvImporting(true);
    try {
      const res  = await fetch("/api/admin/invites/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: csvRows }),
      });
      const data: ImportResult = await res.json();
      setCsvResults(data);
      setCsvRows(null);
      if (data.ok > 0) {
        await load();
        showToast(`יובאו ${data.ok} הזמנות בהצלחה${data.failed ? `, ${data.failed} נכשלו` : ""}`, true);
      }
    } finally { setCsvImporting(false); }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.firstName.trim()) { setFormError("שם פרטי חובה"); return; }
    if (!form.lastName.trim())  { setFormError("שם משפחה חובה"); return; }
    if (!form.email.trim() && !form.phone.trim()) { setFormError("נדרש אימייל או טלפון"); return; }
    setFormLoading(true);
    try {
      const payload = {
        firstName:     form.firstName.trim(),
        lastName:      form.lastName.trim(),
        email:         form.email.trim()  || undefined,
        phone:         form.phone.trim()  || undefined,
        role:          form.role,
        restaurantIds: formRestaurantIds,
      };
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      let data: Record<string, unknown> = {};
      try { data = await res.json(); } catch { /* empty body */ }
      if (!res.ok) {
        setFormError((data.error as string) ?? `שגיאה (${res.status})`);
        return;
      }
      setInvites(prev => [{ ...data, invitedBy: { name: null, username: "" } } as Invite, ...prev]);
      setShowForm(false);
      setForm({ firstName: "", lastName: "", email: "", phone: "", role: "WAITER" });
      setFormRestaurantIds([]);
      setRestSearch("");
      showToast(`ההזמנה ל-${form.firstName} ${form.lastName} נשלחה ✉️`, true);
    } catch (err) {
      setFormError("שגיאת רשת — בדוק את החיבור");
      console.error("[invite send]", err);
    } finally { setFormLoading(false); }
  }

  async function doAction(inviteId: string, action: "reminder" | "cancel") {
    setActionLoading(inviteId + action);
    try {
      const res = await fetch(`/api/admin/invites/${inviteId}/${action}`, { method: "POST" });
      if (!res.ok) { showToast("הפעולה נכשלה", false); return; }
      await load();
      showToast(action === "reminder" ? "תזכורת נשלחה" : "ההזמנה בוטלה", true);
    } finally { setActionLoading(null); }
  }

  async function resend(invite: Invite) {
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
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "שגיאה", false); return; }
      await load();
      showToast("הזמנה חדשה נשלחה", true);
    } finally { setActionLoading(null); }
  }

  const canInviteRole = (role: Role) => {
    if (["SUPER_ADMIN","ADMIN"].includes(currentUserRole)) return true;
    if (currentUserRole === "OWNER") return !["SUPER_ADMIN","ADMIN","OWNER"].includes(role);
    if (currentUserRole === "SHIFT_MANAGER") return ["VIEWER","WAITER","DISPLAY"].includes(role);
    return false;
  };

  const availableRoles = INVITABLE_ROLES.filter(canInviteRole);

  const card: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)", borderRadius: 12,
    padding: "16px 18px", border: "1px solid rgba(255,255,255,0.08)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          zIndex: 9999, padding: "10px 20px", borderRadius: 10, fontWeight: 600, fontSize: 14,
          background: toast.ok ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)",
          border: `1px solid ${toast.ok ? "rgba(52,211,153,0.4)" : "rgba(248,113,113,0.4)"}`,
          color: toast.ok ? "#34d399" : "#f87171",
          backdropFilter: "blur(12px)",
        }}>
          {toast.ok ? "✅" : "❌"} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>
          {invites.filter(i => i.status === "PENDING").length} הזמנות פתוחות
        </div>
        {availableRoles.length > 0 && (
          <div style={{ display: "flex", gap: 8 }}>
            {/* CSV import */}
            <input ref={fileInputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleCsvFile} />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ padding: "8px 14px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.7)", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
            >
              📥 ייבוא CSV
            </button>
            <a href="/invite-template.csv" download style={{ padding: "8px 14px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.45)", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit", textDecoration: "none", display: "flex", alignItems: "center" }}>
              📄 קובץ דוגמא
            </a>
            <button
              onClick={() => { setShowForm(v => !v); setFormError(""); setCsvRows(null); setCsvResults(null); }}
              style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#D97706,#F59E0B)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
            >
              {showForm ? "ביטול" : "+ הזמנה חדשה"}
            </button>
          </div>
        )}
      </div>

      {/* ── CSV Preview ── */}
      {csvRows && csvRows.length > 0 && (
        <div style={{ ...card, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
              תצוגה מקדימה — {csvRows.length} שורות
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setCsvRows(null); setCsvErrors([]); }}
                style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.6)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                ביטול
              </button>
              <button onClick={handleCsvImport} disabled={csvImporting}
                style={{ padding: "6px 16px", borderRadius: 7, border: "none", background: "linear-gradient(135deg,#D97706,#F59E0B)", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                {csvImporting ? "מייבא..." : `ייבא ${csvRows.length} משתמשים`}
              </button>
            </div>
          </div>
          {csvErrors.length > 0 && (
            <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)", borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#f87171", marginBottom: 4 }}>⚠️ שגיאות ({csvErrors.length})</div>
              {csvErrors.map((e, i) => <div key={i} style={{ fontSize: 11, color: "#fca5a5" }}>{e}</div>)}
            </div>
          )}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>{["שם פרטי","שם משפחה","אימייל","טלפון","תפקיד"].map(h => (
                  <th key={h} style={{ padding: "6px 10px", textAlign: "right", color: "rgba(255,255,255,0.5)", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {csvRows.slice(0, 10).map((r, i) => (
                  <tr key={i}>
                    {[r.firstName, r.lastName, r.email ?? "—", r.phone ?? "—", r.role].map((v, j) => (
                      <td key={j} style={{ padding: "6px 10px", color: "#fff", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{v}</td>
                    ))}
                  </tr>
                ))}
                {csvRows.length > 10 && (
                  <tr><td colSpan={5} style={{ padding: "6px 10px", color: "rgba(255,255,255,0.4)", fontSize: 11 }}>...ועוד {csvRows.length - 10} שורות</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CSV Results ── */}
      {csvResults && (
        <div style={{ ...card }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 10 }}>תוצאות ייבוא</div>
          <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
            <span style={{ color: "#34d399", fontWeight: 700 }}>✅ הצליחו: {csvResults.ok}</span>
            {csvResults.failed > 0 && <span style={{ color: "#f87171", fontWeight: 700 }}>❌ נכשלו: {csvResults.failed}</span>}
          </div>
          {csvResults.results.filter(r => r.status === "error").map((r, i) => (
            <div key={i} style={{ fontSize: 12, color: "#fca5a5", marginBottom: 2 }}>שורה {r.row} ({r.name}): {r.error}</div>
          ))}
          <button onClick={() => setCsvResults(null)} style={{ marginTop: 8, padding: "6px 14px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.6)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>סגור</button>
        </div>
      )}

      {/* ── New Invite Form ── */}
      {showForm && (
        <form onSubmit={handleSend} style={{ ...card, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>הזמנת משתמש חדש</div>

          {/* Name */}
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

          {/* Contact */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 4 }}>אימייל</label>
              <input style={DARK_INPUT} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} dir="ltr" placeholder="user@example.com" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 4 }}>טלפון</label>
              <input style={DARK_INPUT} type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} dir="ltr" placeholder="050-0000000" />
            </div>
          </div>
          <p style={{ margin: "-6px 0 0", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
            * נדרש לפחות אחד מהשניים
          </p>

          {/* Role — dropdown */}
          <div>
            <label style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 4 }}>תפקיד *</label>
            <select style={DARK_INPUT} value={form.role} onChange={e => setForm({ ...form, role: e.target.value as Role })}>
              {availableRoles.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>

          {/* Restaurants — searchable dropdown */}
          {restaurants.length > 0 && (
            <div>
              <label style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 6 }}>מסעדות</label>

              {/* Selected chips */}
              {formRestaurantIds.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
                  {formRestaurantIds.map(id => {
                    const r = restaurants.find(x => x.id === id);
                    return r ? (
                      <span key={id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.4)", color: "#818cf8", fontSize: 12 }}>
                        {r.name}
                        <button type="button" onClick={() => setFormRestaurantIds(p => p.filter(x => x !== id))}
                          style={{ background: "none", border: "none", color: "#818cf8", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}

              {/* Search input + dropdown */}
              <div ref={restRef} style={{ position: "relative" }}>
                <input
                  style={DARK_INPUT}
                  value={restSearch}
                  onChange={e => { setRestSearch(e.target.value); setRestDropOpen(true); }}
                  onFocus={() => setRestDropOpen(true)}
                  placeholder="חפש מסעדה..."
                  dir="rtl"
                />
                {restDropOpen && filteredRests.length > 0 && (
                  <div style={{ position: "absolute", top: "100%", right: 0, left: 0, zIndex: 100, background: "rgba(20,20,35,0.98)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 9, marginTop: 4, maxHeight: 200, overflowY: "auto" }}>
                    {filteredRests.map(r => {
                      const sel = formRestaurantIds.includes(r.id);
                      return (
                        <div key={r.id}
                          onClick={() => {
                            setFormRestaurantIds(p => sel ? p.filter(x => x !== r.id) : [...p, r.id]);
                            setRestSearch("");
                            setRestDropOpen(false);
                          }}
                          style={{ padding: "9px 14px", cursor: "pointer", fontSize: 13, color: sel ? "#818cf8" : "#fff", background: sel ? "rgba(99,102,241,0.12)" : "transparent", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                        >
                          {r.name}
                          {sel && <span style={{ fontSize: 16 }}>✓</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {formError && (
            <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 8, padding: "9px 14px", color: "#f87171", fontSize: 13 }}>
              ❌ {formError}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={() => { setShowForm(false); setFormError(""); }}
              style={{ padding: "8px 16px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.6)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              ביטול
            </button>
            <button type="submit" disabled={formLoading}
              style={{ padding: "8px 20px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#D97706,#F59E0B)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: formLoading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: formLoading ? 0.7 : 1 }}>
              {formLoading ? "שולח..." : "שלח הזמנה ✉️"}
            </button>
          </div>
        </form>
      )}

      {/* ── Invites list ── */}
      {loading ? (
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>טוען...</div>
      ) : invites.length === 0 ? (
        <div style={{ ...card, color: "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "center", padding: "32px 0" }}>
          אין הזמנות עדיין
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {invites.map(inv => {
            const st = STATUS_STYLE[inv.status];
            const badge = ROLE_BADGE[inv.role];
            return (
              <div key={inv.id} style={{ ...card, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                {/* Status */}
                <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, color: st.color, background: st.bg, flexShrink: 0 }}>{st.label}</span>

                {/* Name */}
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{inv.firstName} {inv.lastName}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                    <span style={{ padding: "1px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600, ...badge }}>{ROLE_LABELS[inv.role]}</span>
                  </div>
                </div>

                {/* Contact */}
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", minWidth: 120 }}>
                  {inv.email && <div>📧 {inv.email}</div>}
                  {inv.phone && <div>📱 {inv.phone}</div>}
                </div>

                {/* Expiry */}
                {inv.status === "PENDING" && (
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                    פג: {new Date(inv.expiresAt).toLocaleString("he-IL", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {inv.status === "PENDING" && (<>
                    <button onClick={() => doAction(inv.id, "reminder")} disabled={!!actionLoading}
                      style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.1)", color: "#818cf8", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                      {actionLoading === inv.id + "reminder" ? "..." : "תזכורת"}
                    </button>
                    <button onClick={() => doAction(inv.id, "cancel")} disabled={!!actionLoading}
                      style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.08)", color: "#f87171", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                      {actionLoading === inv.id + "cancel" ? "..." : "ביטול"}
                    </button>
                  </>)}
                  {(inv.status === "EXPIRED" || inv.status === "CANCELLED") && (
                    <button onClick={() => resend(inv)} disabled={!!actionLoading}
                      style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid rgba(52,211,153,0.3)", background: "rgba(52,211,153,0.08)", color: "#34d399", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
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
