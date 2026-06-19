"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

type InviteInfo = {
  firstName: string;
  lastName:  string;
  email?:    string | null;
  phone?:    string | null;
  role:      string;
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "סופר אדמין", ADMIN: "אדמין", OWNER: "בעל עסק",
  SHIFT_MANAGER: "מנהל משמרת", EDITOR: "עורך", VIEWER: "צופה",
  WAITER: "מלצר", BARTENDER: "ברמן", DISPLAY: "תצוגה",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)",
  color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
};

export default function RegisterClient() {
  const params  = useSearchParams();
  const router  = useRouter();
  const token   = params.get("token") ?? "";

  const [invite,      setInvite]      = useState<InviteInfo | null>(null);
  const [invalid,     setInvalid]     = useState(false);
  const [step,        setStep]        = useState<"form" | "otp">("form");
  const [maskedEmail, setMaskedEmail] = useState("");

  // Form fields
  const [username,  setUsername]  = useState("");
  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [usernameOk, setUsernameOk] = useState<boolean | null>(null);

  // OTP fields
  const [otp,       setOtp]       = useState(["","","","","",""]);
  const otpRefs     = useRef<(HTMLInputElement | null)[]>([]);

  const [error,     setError]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [resendMsg, setResendMsg] = useState("");

  useEffect(() => {
    if (!token) { setInvalid(true); return; }
    fetch(`/api/auth/register?token=${token}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setInvite)
      .catch(() => setInvalid(true));
  }, [token]);

  // Live username check
  useEffect(() => {
    if (!username || username.length < 3) { setUsernameOk(null); return; }
    const t = setTimeout(() => {
      fetch(`/api/auth/check-username?username=${encodeURIComponent(username)}`)
        .then(r => r.json())
        .then(d => setUsernameOk(!d.taken));
    }, 350);
    return () => clearTimeout(t);
  }, [username]);

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("הסיסמאות אינן תואמות"); return; }
    if (usernameOk === false)  { setError("שם המשתמש תפוס"); return; }
    setLoading(true);
    try {
      const res  = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, username, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "שגיאה"); return; }
      setMaskedEmail(data.maskedEmail);
      setStep("otp");
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } finally { setLoading(false); }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const code = otp.join("");
    if (code.length < 6) { setError("יש להזין קוד בן 6 ספרות"); return; }
    setLoading(true);
    try {
      const res  = await fetch("/api/auth/register", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, username, password, otp: code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "שגיאה"); return; }
      // auto-login
      const login = await signIn("credentials", { username, password, redirect: false });
      if (login?.ok) router.push("/admin");
      else router.push("/login");
    } finally { setLoading(false); }
  }

  async function resendOtp() {
    setResendMsg("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, username, password }),
      });
      if (res.ok) setResendMsg("קוד חדש נשלח ✓");
      else setResendMsg("שגיאה בשליחה");
    } finally { setLoading(false); }
  }

  function handleOtpKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  }

  function handleOtpChange(i: number, val: string) {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next  = [...otp];
    next[i]     = digit;
    setOtp(next);
    if (digit && i < 5) otpRefs.current[i + 1]?.focus();
  }

  if (!token || invalid) return (
    <Center><Card>
      <h2 style={{ color: "#f87171", marginBottom: 8 }}>הזמנה לא תקפה</h2>
      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>הלינק פג תוקף או אינו תקין. פנה למנהל המערכת.</p>
    </Card></Center>
  );

  if (!invite) return <Center><div style={{ color: "rgba(255,255,255,0.5)" }}>טוען...</div></Center>;

  return (
    <Center>
      <Card>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>{step === "otp" ? "📧" : "👋"}</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: 0 }}>
            {step === "otp" ? "אימות מייל" : `ברוך הבא, ${invite.firstName}!`}
          </h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, margin: "6px 0 0" }}>
            {step === "otp"
              ? `שלחנו קוד אימות בן 6 ספרות ל-${maskedEmail}`
              : `הוזמנת כ-${ROLE_LABELS[invite.role] ?? invite.role}`}
          </p>
        </div>

        {/* Step 1 — form */}
        {step === "form" && (
          <>
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "rgba(255,255,255,0.55)", display: "flex", flexDirection: "column", gap: 3 }}>
              <span>👤 {invite.firstName} {invite.lastName}</span>
              {invite.email && <span>📧 {invite.email}</span>}
              {invite.phone && <span>📱 {invite.phone}</span>}
            </div>

            <form onSubmit={handleFormSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 5 }}>שם משתמש *</label>
                <div style={{ position: "relative" }}>
                  <input style={{ ...inputStyle, paddingLeft: 34 }} value={username}
                    onChange={e => setUsername(e.target.value.toLowerCase())}
                    placeholder="לדוגמה: david_cohen" autoFocus required dir="ltr" />
                  {usernameOk !== null && (
                    <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}>
                      {usernameOk ? "✅" : "❌"}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: "3px 0 0" }}>
                  3-30 תווים · a-z 0-9 . _ -
                </p>
              </div>

              <div>
                <label style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 5 }}>סיסמה *</label>
                <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} required dir="ltr" />
              </div>

              <div>
                <label style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 5 }}>אימות סיסמה *</label>
                <input style={inputStyle} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required dir="ltr" />
              </div>

              {error && <ErrorBox>{error}</ErrorBox>}

              <button type="submit" disabled={loading || usernameOk === false}
                style={{ padding: "12px 0", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#6366f1,#818cf8)", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit", opacity: loading ? 0.7 : 1 }}>
                {loading ? "שולח קוד אימות..." : "המשך ←"}
              </button>
            </form>
          </>
        )}

        {/* Step 2 — OTP */}
        {step === "otp" && (
          <form onSubmit={handleOtpSubmit} style={{ display: "flex", flexDirection: "column", gap: 20, alignItems: "center" }}>
            {/* 6 digit boxes */}
            <div style={{ display: "flex", gap: 10, direction: "ltr" }}>
              {otp.map((d, i) => (
                <input
                  key={i}
                  ref={el => { otpRefs.current[i] = el; }}
                  value={d}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKey(i, e)}
                  maxLength={1}
                  style={{
                    width: 46, height: 54, textAlign: "center", fontSize: 22, fontWeight: 700,
                    borderRadius: 10, border: `1.5px solid ${d ? "rgba(99,102,241,0.8)" : "rgba(255,255,255,0.2)"}`,
                    background: d ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.05)",
                    color: "#fff", outline: "none", fontFamily: "inherit",
                  }}
                  inputMode="numeric"
                />
              ))}
            </div>

            {error && <ErrorBox>{error}</ErrorBox>}

            <button type="submit" disabled={loading || otp.join("").length < 6}
              style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#6366f1,#818cf8)", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit", opacity: (loading || otp.join("").length < 6) ? 0.6 : 1 }}>
              {loading ? "מאמת..." : "אמת מייל וסיים רישום"}
            </button>

            <div style={{ textAlign: "center" }}>
              <button type="button" onClick={resendOtp} disabled={loading}
                style={{ background: "none", border: "none", color: "#818cf8", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                שלח קוד חדש
              </button>
              {resendMsg && <p style={{ fontSize: 12, color: "#34d399", margin: "4px 0 0" }}>{resendMsg}</p>}
            </div>

            <button type="button" onClick={() => { setStep("form"); setOtp(["","","","","",""]); setError(""); }}
              style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              ← חזור לעריכת פרטים
            </button>
          </form>
        )}
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
    <div style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 18, padding: 32, width: 420, maxWidth: "100%", direction: "rtl", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
      {children}
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 8, padding: "10px 14px", color: "#f87171", fontSize: 13, width: "100%", boxSizing: "border-box" }}>
      ❌ {children}
    </div>
  );
}
