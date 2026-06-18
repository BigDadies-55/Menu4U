"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Step = "username" | "otp" | "password";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("username");

  // Step 1 — username
  const [username, setUsername] = useState("");
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [userId, setUserId] = useState("");

  // Step 2 — OTP
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [otpCooldown, setOtpCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Step 3 — new password
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (otpCooldown <= 0) return;
    const t = setTimeout(() => setOtpCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCooldown]);

  async function handleUsername(e: React.FormEvent) {
    e.preventDefault();
    setUsernameLoading(true);
    setUsernameError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });
      if (res.status === 429) {
        const d = await res.json();
        setUsernameError(d.error ?? "יותר מדי בקשות");
        return;
      }
      const data = await res.json();
      // If userId returned, phone was found and OTP sent
      if (data.userId) {
        setMaskedPhone(data.maskedPhone ?? "");
        setUserId(data.userId);
        setStep("otp");
        setOtpCooldown(180);
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
      } else {
        // Generic message — user not found or no phone
        setUsernameError("אם הפרטים נכונים, ישלח קוד לטלפון הרשום");
      }
    } catch {
      setUsernameError("שגיאת רשת, נסה שנית");
    } finally {
      setUsernameLoading(false);
    }
  }

  function handleDigit(index: number, value: string) {
    const char = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    setOtpError("");
    if (char && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(""));
      inputRefs.current[5]?.focus();
    }
  }

  async function handleOtp(e: React.FormEvent) {
    e.preventDefault();
    const otp = digits.join("");
    if (otp.length < 6) return;
    setOtpLoading(true);
    setOtpError("");
    try {
      const res = await fetch("/api/auth/forgot-password/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.error ?? "קוד שגוי");
        setDigits(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        return;
      }
      setResetToken(data.resetToken);
      setStep("password");
    } catch {
      setOtpError("שגיאת רשת, נסה שנית");
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleResendOtp() {
    if (otpCooldown > 0) return;
    setOtpLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });
      if (res.ok) {
        setDigits(["", "", "", "", "", ""]);
        setOtpError("");
        setOtpCooldown(180);
        inputRefs.current[0]?.focus();
      }
    } finally {
      setOtpLoading(false);
    }
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8 || password !== confirm) return;
    setPwLoading(true);
    setPwError("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwError(data.error ?? "שגיאה, נסה שנית");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch {
      setPwError("שגיאת רשת, נסה שנית");
    } finally {
      setPwLoading(false);
    }
  }

  const inp: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 12, padding: "13px 16px", fontSize: 14, fontFamily: "Heebo, sans-serif",
    color: "white", outline: "none", boxSizing: "border-box",
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');
        .fp-root { font-family:'Heebo',sans-serif; min-height:100vh; background:#09080a;
          display:flex; align-items:center; justify-content:center;
          padding:24px; direction:rtl; position:relative; overflow:hidden; }
        .fp-glow { position:fixed; top:50%; left:-10%; transform:translateY(-50%);
          width:600px; height:600px; border-radius:50%;
          background:radial-gradient(circle,rgba(201,164,82,0.055) 0%,transparent 65%);
          pointer-events:none; z-index:0; }
        .fp-wrapper { position:relative; z-index:1; width:100%; max-width:420px; }
        .fp-brand { text-align:center; margin-bottom:36px; }
        .fp-wordmark { font-family:Georgia,serif; font-size:28px; font-weight:700; color:white; letter-spacing:5px; }
        .fp-wordmark span { color:#C9A452; }
        .fp-subtitle { font-size:12px; color:#6b6070; margin-top:6px; }
        .fp-card { background:rgba(255,255,255,0.035); border:1px solid rgba(255,255,255,0.07);
          border-radius:20px; padding:36px 32px; backdrop-filter:blur(24px);
          box-shadow:0 40px 80px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,255,255,0.06);
          position:relative; overflow:hidden; }
        .fp-card::before { content:''; position:absolute; top:0; left:15%; right:15%; height:1px;
          background:linear-gradient(90deg,transparent,rgba(201,164,82,0.5),transparent); }
        .fp-btn { width:100%; padding:14px; border:none; border-radius:13px;
          background:linear-gradient(135deg,#6b470d,#C9A452); color:white;
          font-family:'Heebo',sans-serif; font-size:15px; font-weight:700; cursor:pointer;
          margin-top:8px; transition:.22s; }
        .fp-btn:disabled { opacity:.6; cursor:not-allowed; }
        .fp-error { background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.25);
          color:#fca5a5; padding:12px 16px; border-radius:12px; font-size:13px; margin-bottom:16px; }
        .fp-back { display:flex; align-items:center; justify-content:center; gap:6px;
          margin-top:22px; font-size:12px; color:#6b6070; text-decoration:none; transition:.2s; }
        .fp-back:hover { color:#dfc07e; }
      `}</style>

      <div className="fp-root">
        <div className="fp-glow" />
        <div className="fp-wrapper">
          <div className="fp-brand">
            <div className="fp-wordmark">TECH4<span>BITES</span></div>
            <div className="fp-subtitle">
              {step === "username" && "שכחתי סיסמה"}
              {step === "otp" && "אימות זהות"}
              {step === "password" && "סיסמה חדשה"}
            </div>
          </div>

          <div className="fp-card">

            {/* ── Step 1: Username ── */}
            {step === "username" && (
              <>
                <div style={{ fontSize: 16, fontWeight: 700, color: "white", marginBottom: 8 }}>הזן שם משתמש</div>
                <p style={{ fontSize: 13, color: "#6b6070", marginBottom: 24, lineHeight: 1.6 }}>
                  נשלח קוד אימות לטלפון הרשום בחשבונך.
                </p>
                <form onSubmit={handleUsername} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: "#6b6070", letterSpacing: 1.2, textTransform: "uppercase", display: "block", marginBottom: 8 }}>שם משתמש</label>
                    <input
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      required
                      autoFocus
                      placeholder="my_username"
                      style={{ ...inp, direction: "ltr" }}
                    />
                  </div>
                  {usernameError && <div className="fp-error">{usernameError}</div>}
                  <button type="submit" className="fp-btn" disabled={usernameLoading || !username.trim()}>
                    {usernameLoading ? "שולח..." : "שלח קוד →"}
                  </button>
                </form>
              </>
            )}

            {/* ── Step 2: OTP ── */}
            {step === "otp" && (
              <>
                <div style={{ fontSize: 16, fontWeight: 700, color: "white", marginBottom: 8 }}>הזן את הקוד</div>
                <p style={{ fontSize: 13, color: "#6b6070", marginBottom: 6, lineHeight: 1.6 }}>
                  שלחנו קוד בן 6 ספרות לטלפון:
                </p>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#C9A452", marginBottom: 20, direction: "ltr" }}>
                  {maskedPhone}
                </div>
                <form onSubmit={handleOtp} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center" }} onPaste={handlePaste} dir="ltr">
                    {digits.map((d, i) => (
                      <input
                        key={i}
                        ref={el => { inputRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={d}
                        onChange={e => handleDigit(i, e.target.value)}
                        onKeyDown={e => handleKeyDown(i, e)}
                        style={{ width: 44, height: 52, textAlign: "center", fontSize: 20, fontWeight: 700, background: "rgba(255,255,255,0.06)", border: `2px solid ${d ? "#C9A452" : "rgba(255,255,255,0.12)"}`, borderRadius: 10, color: "white", outline: "none" }}
                      />
                    ))}
                  </div>
                  {otpError && <div className="fp-error">{otpError}</div>}
                  <button type="submit" className="fp-btn" disabled={otpLoading || digits.some(d => !d)}>
                    {otpLoading ? "מאמת..." : "אמת קוד →"}
                  </button>
                </form>
                <div style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: "#6b6070" }}>
                  {otpCooldown > 0
                    ? `ניתן לשלוח קוד חדש בעוד ${otpCooldown} שניות`
                    : <button onClick={handleResendOtp} disabled={otpLoading} style={{ color: "#C9A452", background: "none", border: "none", cursor: "pointer", fontSize: 12, fontFamily: "Heebo, sans-serif" }}>שלח קוד חדש</button>
                  }
                </div>
              </>
            )}

            {/* ── Step 3: New password ── */}
            {step === "password" && !done && (
              <>
                <div style={{ fontSize: 16, fontWeight: 700, color: "white", marginBottom: 8 }}>הגדר סיסמה חדשה</div>
                <p style={{ fontSize: 13, color: "#6b6070", marginBottom: 24, lineHeight: 1.6 }}>
                  כל הסשנים הפעילים ינותקו לאחר השינוי.
                </p>
                <form onSubmit={handlePassword} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: "#6b6070", letterSpacing: 1.2, textTransform: "uppercase", display: "block", marginBottom: 8 }}>סיסמה חדשה</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} placeholder="לפחות 8 תווים" style={inp} autoFocus />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: "#6b6070", letterSpacing: 1.2, textTransform: "uppercase", display: "block", marginBottom: 8 }}>אימות סיסמה</label>
                    <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required placeholder="הזן שוב" style={inp} />
                  </div>
                  {confirm && password !== confirm && (
                    <div style={{ fontSize: 12, color: "#ff6b6b" }}>הסיסמאות אינן תואמות</div>
                  )}
                  {pwError && <div className="fp-error">{pwError}</div>}
                  <button type="submit" className="fp-btn" disabled={pwLoading || password.length < 8 || password !== confirm}>
                    {pwLoading ? "שומר..." : "שמור סיסמה →"}
                  </button>
                </form>
              </>
            )}

            {done && (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#C9A452", marginBottom: 8 }}>הסיסמה עודכנה בהצלחה!</div>
                <div style={{ fontSize: 13, color: "#6b6070" }}>מועבר לדף הכניסה...</div>
              </div>
            )}
          </div>

          <Link href="/login" className="fp-back">→ חזרה לדף הכניסה</Link>
        </div>
      </div>
    </>
  );
}
