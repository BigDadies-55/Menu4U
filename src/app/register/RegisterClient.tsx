"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

type InviteInfo = {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  role: string;
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "סופר אדמין", ADMIN: "אדמין", OWNER: "בעל עסק",
  SHIFT_MANAGER: "מנהל משמרת", EDITOR: "עורך", VIEWER: "צופה",
  WAITER: "מלצר", DISPLAY: "תצוגה",
};

export default function RegisterClient() {
  const params    = useSearchParams();
  const router    = useRouter();
  const token     = params.get("token") ?? "";

  const [invite,   setInvite]   = useState<InviteInfo | null>(null);
  const [invalid,  setInvalid]  = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [usernameOk, setUsernameOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (!token) { setInvalid(true); return; }
    fetch(`/api/auth/register?token=${token}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setInvite)
      .catch(() => setInvalid(true));
  }, [token]);

  useEffect(() => {
    if (!username || username.length < 3) { setUsernameOk(null); return; }
    const t = setTimeout(() => {
      fetch(`/api/auth/check-username?username=${encodeURIComponent(username)}`)
        .then(r => r.json())
        .then(d => setUsernameOk(!d.taken));
    }, 350);
    return () => clearTimeout(t);
  }, [username]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("הסיסמאות אינן תואמות"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, username, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "שגיאה"); return; }
      // auto login
      const login = await signIn("credentials", { username, password, redirect: false });
      if (login?.ok) router.push("/admin");
      else router.push("/login");
    } finally { setLoading(false); }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)",
    color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
  };

  if (!token || invalid) return (
    <Center>
      <Card>
        <h2 style={{ color: "#F87171", marginBottom: 8 }}>הזמנה לא תקפה</h2>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
          הלינק פג תוקף או אינו תקין. פנה למנהל המערכת.
        </p>
      </Card>
    </Center>
  );

  if (!invite) return (
    <Center><div style={{ color: "rgba(255,255,255,0.5)" }}>טוען...</div></Center>
  );

  return (
    <Center>
      <Card>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>👋</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: 0 }}>
            ברוך הבא, {invite.firstName}!
          </h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, margin: "6px 0 0" }}>
            הוזמנת כ-{ROLE_LABELS[invite.role] ?? invite.role}
          </p>
        </div>

        {/* Pre-filled info */}
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "12px 14px", marginBottom: 20, fontSize: 13, color: "rgba(255,255,255,0.6)", display: "flex", flexDirection: "column", gap: 4 }}>
          <span>👤 {invite.firstName} {invite.lastName}</span>
          {invite.email && <span>📧 {invite.email}</span>}
          {invite.phone && <span>📱 {invite.phone}</span>}
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Username */}
          <div>
            <label style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 5 }}>שם משתמש</label>
            <div style={{ position: "relative" }}>
              <input
                style={{ ...inputStyle, paddingLeft: 36 }}
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase())}
                placeholder="לדוגמה: david_cohen"
                autoFocus
                required
                dir="ltr"
              />
              {usernameOk !== null && (
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 16 }}>
                  {usernameOk ? "✅" : "❌"}
                </span>
              )}
            </div>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "4px 0 0" }}>
              3-30 תווים, אותיות לטיניות קטנות, ספרות, . _ -
            </p>
          </div>

          {/* Password */}
          <div>
            <label style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 5 }}>סיסמה</label>
            <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} required dir="ltr" />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 5 }}>אימות סיסמה</label>
            <input style={inputStyle} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required dir="ltr" />
          </div>

          {error && (
            <div style={{ background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 8, padding: "10px 14px", color: "#F87171", fontSize: 13 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || usernameOk === false}
            style={{ padding: "12px 0", borderRadius: 10, border: "none", background: "#6366f1", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit", opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "רושם..." : "השלם רישום"}
          </button>
        </form>
      </Card>
    </Center>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#0f0f1e 0%,#1a1a2e 100%)", padding: 20 }}>
      {children}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 18, padding: 32, width: 400, maxWidth: "100%", direction: "rtl", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
      {children}
    </div>
  );
}
