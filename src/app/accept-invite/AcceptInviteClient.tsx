"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AcceptInviteClient({
  email,
  name,
  username,
  token,
}: {
  email: string;
  name: string | null;
  username: string;
  token: string;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const displayName = name ?? email;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("הסיסמה חייבת להכיל לפחות 8 תווים");
      return;
    }
    if (password !== confirm) {
      setError("הסיסמאות אינן תואמות");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "שגיאה, נסה שנית");
        setLoading(false);
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch {
      setError("שגיאת רשת, נסה שנית");
      setLoading(false);
    }
  }

  const inp: React.CSSProperties = {
    width: "100%", background: "#1e1a14", border: "1px solid rgba(201,164,82,0.25)",
    color: "#e9e0d0", borderRadius: 10, padding: "12px 14px",
    fontSize: 15, outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0d0b0e", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "Arial, sans-serif", direction: "rtl" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontFamily: "Georgia,serif", fontSize: 28, fontWeight: 700, color: "#fff", letterSpacing: 5 }}>
            TECH4<span style={{ color: "#C9A452" }}>BITES</span>
          </div>
          <div style={{ fontSize: 12, color: "rgba(201,164,82,0.5)", marginTop: 5, letterSpacing: 2 }}>פורטל ניהול מסעדות</div>
        </div>

        <div style={{ background: "#110f12", border: "1px solid rgba(201,164,82,0.2)", borderRadius: 18, padding: "32px 28px", boxShadow: "0 8px 40px rgba(0,0,0,0.6)" }}>

          {done ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#C9A452", marginBottom: 12 }}>הסיסמה הוגדרה בהצלחה!</div>
              <div style={{ background: "rgba(201,164,82,0.08)", border: "1px solid rgba(201,164,82,0.25)", borderRadius: 12, padding: "12px 16px", marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#6b6070", letterSpacing: 1, marginBottom: 4 }}>שם המשתמש שלך לכניסה</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: "monospace" }} dir="ltr">{username}</div>
              </div>
              <div style={{ fontSize: 13, color: "#6b6070" }}>מועבר לדף הכניסה...</div>
            </div>
          ) : (
            <>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: "#e9e0d0", margin: "0 0 6px" }}>ברוך הבא, {displayName}!</h1>
              <p style={{ fontSize: 13, color: "#6b6070", margin: "0 0 16px", lineHeight: 1.6 }}>
                הגדר סיסמה לחשבון שלך עבור:<br />
                <span style={{ color: "#C9A452", fontFamily: "monospace", fontSize: 14 }} dir="ltr">{email}</span>
              </p>

              {/* Username — so the user knows how to log in */}
              <div style={{ background: "rgba(201,164,82,0.08)", border: "1px solid rgba(201,164,82,0.25)", borderRadius: 12, padding: "12px 16px", marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#6b6070", letterSpacing: 1, marginBottom: 4 }}>🔑 שם המשתמש שלך לכניסה</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", fontFamily: "monospace" }} dir="ltr">{username}</div>
              </div>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#6b6070", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>סיסמה חדשה</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoFocus
                    required
                    minLength={8}
                    placeholder="לפחות 8 תווים"
                    style={inp}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#6b6070", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>אימות סיסמה</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    placeholder="הזן שוב את הסיסמה"
                    style={inp}
                  />
                </div>

                {/* Password strength hint */}
                {password.length > 0 && (
                  <div style={{ display: "flex", gap: 4 }}>
                    {[
                      { label: "8+ תווים", ok: password.length >= 8 },
                      { label: "אות גדולה", ok: /[A-Z]/.test(password) },
                      { label: "ספרה", ok: /\d/.test(password) },
                    ].map(h => (
                      <div key={h.label} style={{ flex: 1, padding: "4px 6px", borderRadius: 6, textAlign: "center", fontSize: 10, fontWeight: 700, background: h.ok ? "rgba(81,207,102,0.12)" : "rgba(255,255,255,0.05)", color: h.ok ? "#51cf66" : "#555", border: `1px solid ${h.ok ? "rgba(81,207,102,0.3)" : "rgba(255,255,255,0.07)"}` }}>
                        {h.ok ? "✓" : "○"} {h.label}
                      </div>
                    ))}
                  </div>
                )}

                {error && (
                  <div style={{ background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.25)", color: "#ff6b6b", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || password.length < 8 || password !== confirm}
                  style={{ width: "100%", padding: "13px 0", borderRadius: 12, background: "linear-gradient(135deg,#6b470d,#C9A452)", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: loading ? "wait" : "pointer", opacity: (loading || password.length < 8 || password !== confirm) ? 0.5 : 1, marginTop: 4 }}
                >
                  {loading ? "שומר..." : "הגדר סיסמה והיכנס ←"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
