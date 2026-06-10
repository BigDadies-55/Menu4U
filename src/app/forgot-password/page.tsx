"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.status === 429) {
        const d = await res.json();
        setError(d.error ?? "יותר מדי בקשות");
        return;
      }
      setSent(true);
    } catch {
      setError("שגיאת רשת, נסה שנית");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');
        .fp-root {
          font-family: 'Heebo', sans-serif;
          min-height: 100vh; background: #09080a;
          display: flex; align-items: center; justify-content: center;
          padding: 24px; direction: rtl; position: relative; overflow: hidden;
        }
        .fp-glow-left {
          position: fixed; top: 50%; left: -10%; transform: translateY(-50%);
          width: 600px; height: 600px; border-radius: 50%;
          background: radial-gradient(circle, rgba(201,164,82,0.055) 0%, transparent 65%);
          pointer-events: none; z-index: 0;
        }
        .fp-wrapper { position: relative; z-index: 1; width: 100%; max-width: 420px; }
        .fp-brand { text-align: center; margin-bottom: 36px; }
        .fp-wordmark {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 28px; font-weight: 700; color: white; letter-spacing: 5px;
        }
        .fp-wordmark span { color: #C9A452; }
        .fp-subtitle { font-size: 12px; color: #6b6070; margin-top: 6px; letter-spacing: 0.5px; }
        .fp-card {
          background: rgba(255,255,255,0.035);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px; padding: 36px 32px;
          backdrop-filter: blur(24px);
          box-shadow: 0 40px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06);
          position: relative; overflow: hidden;
        }
        .fp-card::before {
          content: ''; position: absolute; top: 0; left: 15%; right: 15%; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(201,164,82,0.5), transparent);
        }
        .fp-field { margin-bottom: 18px; }
        .fp-field label {
          display: block; font-size: 10px; font-weight: 700; color: #6b6070;
          letter-spacing: 1.2px; text-transform: uppercase; margin-bottom: 8px;
        }
        .fp-field input {
          width: 100%; background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 12px; padding: 13px 16px;
          font-size: 14px; font-family: 'Heebo', sans-serif; color: white;
          outline: none; transition: .2s; direction: ltr; box-sizing: border-box;
        }
        .fp-field input::placeholder { color: rgba(255,255,255,0.2); }
        .fp-field input:focus {
          border-color: rgba(201,164,82,0.4); background: rgba(201,164,82,0.04);
          box-shadow: 0 0 0 3px rgba(201,164,82,0.08);
        }
        .fp-btn {
          width: 100%; padding: 14px; border: none; border-radius: 13px;
          background: linear-gradient(135deg, #6b470d, #C9A452);
          color: white; font-family: 'Heebo', sans-serif;
          font-size: 15px; font-weight: 700; cursor: pointer;
          margin-top: 8px; box-shadow: 0 8px 28px rgba(201,164,82,0.22);
          transition: .22s;
        }
        .fp-btn:hover:not(:disabled) { box-shadow: 0 12px 36px rgba(201,164,82,0.35); transform: translateY(-1px); }
        .fp-btn:disabled { opacity: .6; cursor: not-allowed; }
        .fp-error {
          background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.25);
          color: #fca5a5; padding: 12px 16px; border-radius: 12px;
          font-size: 13px; margin-bottom: 16px;
        }
        .fp-back {
          display: flex; align-items: center; justify-content: center; gap: 6px;
          margin-top: 22px; font-size: 12px; color: #6b6070; text-decoration: none; transition: .2s;
        }
        .fp-back:hover { color: #dfc07e; }
      `}</style>

      <div className="fp-root">
        <div className="fp-glow-left" />
        <div className="fp-wrapper">
          <div className="fp-brand">
            <div className="fp-wordmark">TECH4<span>BITES</span></div>
            <div className="fp-subtitle">איפוס סיסמה</div>
          </div>

          <div className="fp-card">
            {sent ? (
              <div style={{ textAlign: "center", padding: "12px 0" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#C9A452", marginBottom: 10 }}>
                  הקישור נשלח
                </div>
                <p style={{ fontSize: 14, color: "#6b6070", lineHeight: 1.7, margin: 0 }}>
                  אם קיים חשבון עם כתובת האימייל שהזנת,
                  תקבל הודעה עם קישור לאיפוס הסיסמה.<br />
                  <span style={{ fontSize: 12, color: "#4a4050" }}>הקישור תקף לשעה אחת.</span>
                </p>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 16, fontWeight: 700, color: "white", marginBottom: 8 }}>
                  שכחתי סיסמה
                </div>
                <p style={{ fontSize: 13, color: "#6b6070", marginBottom: 24, lineHeight: 1.6 }}>
                  הזן את כתובת האימייל שלך ונשלח לך קישור לאיפוס הסיסמה.
                </p>

                <form onSubmit={handleSubmit}>
                  <div className="fp-field">
                    <label>אימייל</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      placeholder="admin@yourdomain.com"
                      autoFocus
                    />
                  </div>

                  {error && <div className="fp-error">{error}</div>}

                  <button type="submit" className="fp-btn" disabled={loading || !email.trim()}>
                    {loading ? "שולח..." : "שלח קישור לאיפוס"}
                  </button>
                </form>
              </>
            )}
          </div>

          <Link href="/login" className="fp-back">
            → חזרה לדף הכניסה
          </Link>
        </div>
      </div>
    </>
  );
}
