"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResetPasswordClient({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("הסיסמה חייבת להכיל לפחות 8 תווים"); return; }
    if (password !== confirm) { setError("הסיסמאות אינן תואמות"); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "שגיאה, נסה שנית"); return; }
      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch {
      setError("שגיאת רשת, נסה שנית");
    } finally {
      setLoading(false);
    }
  }

  const inp: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.09)", color: "white",
    borderRadius: 12, padding: "13px 16px", fontSize: 14,
    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
    transition: ".2s",
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;600;700;900&display=swap');
        .rp-root {
          font-family: 'Heebo', sans-serif;
          min-height: 100vh; background: #09080a;
          display: flex; align-items: center; justify-content: center;
          padding: 24px; direction: rtl; position: relative; overflow: hidden;
        }
        .rp-glow {
          position: fixed; top: 50%; left: -10%; transform: translateY(-50%);
          width: 600px; height: 600px; border-radius: 50%;
          background: radial-gradient(circle, rgba(201,164,82,0.055) 0%, transparent 65%);
          pointer-events: none; z-index: 0;
        }
        .rp-wrapper { position: relative; z-index: 1; width: 100%; max-width: 420px; }
        .rp-brand { text-align: center; margin-bottom: 36px; }
        .rp-wordmark {
          font-family: Georgia, serif; font-size: 28px; font-weight: 700;
          color: white; letter-spacing: 5px;
        }
        .rp-wordmark span { color: #C9A452; }
        .rp-card {
          background: rgba(255,255,255,0.035);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px; padding: 36px 32px;
          backdrop-filter: blur(24px);
          box-shadow: 0 40px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06);
          position: relative; overflow: hidden;
        }
        .rp-card::before {
          content: ''; position: absolute; top: 0; left: 15%; right: 15%; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(201,164,82,0.5), transparent);
        }
        .rp-inp-focused { border-color: rgba(201,164,82,0.4) !important; background: rgba(201,164,82,0.04) !important; box-shadow: 0 0 0 3px rgba(201,164,82,0.08) !important; }
        .rp-btn {
          width: 100%; padding: 14px; border: none; border-radius: 13px;
          background: linear-gradient(135deg, #6b470d, #C9A452);
          color: white; font-family: 'Heebo', sans-serif;
          font-size: 15px; font-weight: 700; cursor: pointer;
          margin-top: 8px; box-shadow: 0 8px 28px rgba(201,164,82,0.22);
          transition: .22s;
        }
        .rp-btn:hover:not(:disabled) { box-shadow: 0 12px 36px rgba(201,164,82,0.35); transform: translateY(-1px); }
        .rp-btn:disabled { opacity: .6; cursor: not-allowed; }
      `}</style>

      <div className="rp-root">
        <div className="rp-glow" />
        <div className="rp-wrapper">
          <div className="rp-brand">
            <div className="rp-wordmark">TECH4<span>BITES</span></div>
            <div style={{ fontSize: 12, color: "#6b6070", marginTop: 6 }}>איפוס סיסמה</div>
          </div>

          <div className="rp-card">
            {done ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#C9A452", marginBottom: 8 }}>הסיסמה עודכנה בהצלחה!</div>
                <div style={{ fontSize: 13, color: "#6b6070" }}>מועבר לדף הכניסה...</div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 16, fontWeight: 700, color: "white", marginBottom: 6 }}>הגדרת סיסמה חדשה</div>
                <p style={{ fontSize: 13, color: "#6b6070", marginBottom: 24, lineHeight: 1.6 }}>
                  עבור:{" "}
                  <span style={{ color: "#C9A452", fontFamily: "monospace", fontSize: 13 }} dir="ltr">{email}</span>
                </p>

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: "#6b6070", letterSpacing: 1.2, textTransform: "uppercase", display: "block", marginBottom: 8 }}>
                      סיסמה חדשה
                    </label>
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
                    <label style={{ fontSize: 10, fontWeight: 700, color: "#6b6070", letterSpacing: 1.2, textTransform: "uppercase", display: "block", marginBottom: 8 }}>
                      אימות סיסמה
                    </label>
                    <input
                      type="password"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      required
                      placeholder="הזן שוב את הסיסמה"
                      style={inp}
                    />
                  </div>

                  {password.length > 0 && (
                    <div style={{ display: "flex", gap: 4 }}>
                      {[
                        { label: "8+ תווים", ok: password.length >= 8 },
                        { label: "אות גדולה", ok: /[A-Z]/.test(password) },
                        { label: "ספרה", ok: /\d/.test(password) },
                      ].map(h => (
                        <div key={h.label} style={{
                          flex: 1, padding: "4px 6px", borderRadius: 6, textAlign: "center",
                          fontSize: 10, fontWeight: 700,
                          background: h.ok ? "rgba(81,207,102,0.12)" : "rgba(255,255,255,0.05)",
                          color: h.ok ? "#51cf66" : "#555",
                          border: `1px solid ${h.ok ? "rgba(81,207,102,0.3)" : "rgba(255,255,255,0.07)"}`,
                        }}>
                          {h.ok ? "✓" : "○"} {h.label}
                        </div>
                      ))}
                    </div>
                  )}

                  {error && (
                    <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", padding: "12px 16px", borderRadius: 12, fontSize: 13 }}>
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="rp-btn"
                    disabled={loading || password.length < 8 || password !== confirm}
                  >
                    {loading ? "שומר..." : "עדכן סיסמה ←"}
                  </button>
                </form>
              </>
            )}
          </div>

          <a href="/login" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 22, fontSize: 12, color: "#6b6070", textDecoration: "none" }}>
            → חזרה לדף הכניסה
          </a>
        </div>
      </div>
    </>
  );
}
