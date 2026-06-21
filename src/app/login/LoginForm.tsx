"use client";

import { useState, useEffect } from "react";
import { loginAction } from "./actions";

export default function LoginForm({ loginImage, brightness = 100 }: { loginImage: string | null; brightness?: number }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("reason") === "timeout") {
      setError("נותקת מהמערכת עקב חוסר פעילות. התחבר מחדש.");
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await loginAction(username, password);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');

        .login-root {
          font-family: 'Heebo', sans-serif;
          min-height: 100vh;
          background: #09080a;
          display: flex;
          flex-direction: row-reverse;
          align-items: stretch;
          direction: rtl;
        }
        /* Image pane (rendered on the LEFT via row-reverse) */
        .login-photo-pane {
          flex: 0 0 60%;
          background-color: #110f12;
          background-size: 100% 100%;
          background-position: center;
          background-repeat: no-repeat;
          position: relative;
        }
        /* Right 50% — login form */
        .login-form-pane {
          flex: 0 0 40%;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: #ffffff;
        }
        @media (max-width: 900px) {
          .login-photo-pane { display: none; }
          .login-form-pane { flex: 1 1 100%; }
        }
        .login-grain {
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
          opacity: .025;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }
        .login-bg-photo {
          position: fixed; inset: 0; z-index: 0;
          background: url('https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1400&q=60') center/cover;
          opacity: .04;
        }
        .login-glow-left {
          position: fixed; top: 50%; left: -10%; transform: translateY(-50%);
          width: 600px; height: 600px; border-radius: 50%;
          background: radial-gradient(circle, rgba(201,164,82,0.055) 0%, transparent 65%);
          pointer-events: none; z-index: 0;
        }
        .login-glow-right {
          position: fixed; bottom: -15%; right: -10%;
          width: 500px; height: 500px; border-radius: 50%;
          background: radial-gradient(circle, rgba(201,164,82,0.035) 0%, transparent 65%);
          pointer-events: none; z-index: 0;
        }
        .login-wrapper {
          position: relative; z-index: 1;
          width: 100%; max-width: 420px;
        }
        .login-brand {
          text-align: center;
          margin-bottom: 36px;
        }
        .login-wordmark {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 28px; font-weight: 700; color: #1a1208;
          letter-spacing: 5px; line-height: 1;
        }
        .login-wordmark span { color: #C9A452; }
        .login-divider-row {
          display: flex; align-items: center; gap: 9px;
          margin-top: 10px;
        }
        .login-line {
          flex: 1; height: 0.8px;
          background: rgba(201,164,82,0.35);
        }
        .login-portal-label {
          font-size: 9px; letter-spacing: 3.5px; text-transform: uppercase;
          color: rgba(201,164,82,0.6); font-weight: 600; white-space: nowrap;
        }
        .login-tagline {
          font-size: 12px; color: #6b6070;
          letter-spacing: .5px; margin-top: 8px;
        }
        .login-card {
          background: #ffffff;
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 20px;
          padding: 36px 32px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.05);
          position: relative; overflow: hidden;
        }
        .login-card::before {
          content: '';
          position: absolute; top: 0; left: 15%; right: 15%; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(201,164,82,0.5), transparent);
        }
        .login-card-title {
          font-size: 16px; font-weight: 700; color: #1a1208;
          margin-bottom: 28px; letter-spacing: -.2px;
          display: flex; align-items: center; gap: 8px;
        }
        .login-card-title::after {
          content: ''; flex: 1; height: 1px;
          background: rgba(0,0,0,0.08);
        }
        .login-field { margin-bottom: 18px; }
        .login-field label {
          display: block;
          font-size: 10px; font-weight: 700; color: #6b6070;
          letter-spacing: 1.2px; text-transform: uppercase;
          margin-bottom: 8px;
        }
        .login-field input {
          width: 100%;
          background: #f5f4f2;
          border: 1px solid rgba(0,0,0,0.12);
          border-radius: 12px;
          padding: 13px 16px;
          font-size: 14px; font-family: 'Heebo', sans-serif;
          color: #1a1208;
          outline: none;
          transition: .2s;
          direction: ltr;
        }
        .login-field input::placeholder { color: rgba(0,0,0,0.3); }
        .login-field input:focus {
          border-color: rgba(201,164,82,0.7);
          background: #fffdf7;
          box-shadow: 0 0 0 3px rgba(201,164,82,0.15);
        }
        .login-error {
          background: rgba(239,68,68,0.10);
          border: 1px solid rgba(239,68,68,0.3);
          color: #b91c1c;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 13px;
          margin-bottom: 16px;
        }
        .login-btn {
          width: 100%; padding: 14px;
          border: none; border-radius: 13px;
          background: linear-gradient(135deg, #6b470d, #C9A452);
          color: white;
          font-family: 'Heebo', sans-serif;
          font-size: 15px; font-weight: 700;
          cursor: pointer; letter-spacing: .3px;
          margin-top: 8px;
          box-shadow: 0 8px 28px rgba(201,164,82,0.22);
          transition: .22s;
        }
        .login-btn:hover:not(:disabled) {
          box-shadow: 0 12px 36px rgba(201,164,82,0.35);
          transform: translateY(-1px);
        }
        .login-btn:disabled { opacity: .6; cursor: not-allowed; }
        .login-back {
          display: flex; align-items: center; justify-content: center; gap: 6px;
          margin-top: 22px;
          font-size: 12px; color: #6b6070;
          text-decoration: none; transition: .2s;
        }
        .login-back:hover { color: #dfc07e; }
      `}</style>

      <div className="login-root">
        {/* Left 50% — configurable image */}
        <div
          className="login-photo-pane"
          style={{
            backgroundImage: loginImage
              ? `url('${loginImage}')`
              : "linear-gradient(135deg,#0a0804,#1c1205,#3d2b00)",
            filter: loginImage ? `brightness(${brightness}%)` : undefined,
          }}
        >
          {!loginImage && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 40, fontWeight: 700, color: "#fff", letterSpacing: 6, opacity: 0.9 }}>
                TECH4<span style={{ color: "#C9A452" }}>BITES</span>
              </div>
            </div>
          )}
        </div>

        {/* Right 50% — login form */}
        <div className="login-form-pane">
        <div className="login-grain" />
        <div className="login-glow-left" />
        <div className="login-glow-right" />

        {process.env.NEXT_PUBLIC_APP_ENV === "development" && (
          <div
            className="fixed top-0 left-0 right-0 z-50 text-center text-xs font-bold py-1.5 tracking-widest uppercase"
            style={{ background: "#f59e0b", color: "#000" }}
          >
            ⚠️ סביבת פיתוח — DEV
          </div>
        )}

        <div className="login-wrapper">
          {/* Brand */}
          <div className="login-brand">
            <div className="login-wordmark">TECH4<span>BITES</span></div>
            <div className="login-divider-row">
              <div className="login-line" />
              <div className="login-portal-label">פורטל ניהול</div>
              <div className="login-line" />
            </div>
            <div className="login-tagline">כניסה למערכת הניהול</div>
          </div>

          {/* Card */}
          <div className="login-card">
            <div className="login-card-title">התחברות</div>

            <form onSubmit={handleSubmit}>
              <div className="login-field">
                <label>שם משתמש או אימייל</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  required
                  placeholder="username / email"
                  dir="ltr"
                  autoComplete="username"
                />
              </div>

              <div className="login-field">
                <label>סיסמה</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="login-error">{error}</div>
              )}

              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? "מתחבר..." : "כניסה למערכת"}
              </button>

              <div style={{ textAlign: "center", marginTop: 16 }}>
                <a href="/forgot-password" style={{ fontSize: 12, color: "#6b6070", textDecoration: "none", transition: ".2s" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#dfc07e")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#6b6070")}
                >
                  שכחתי סיסמה
                </a>
              </div>
            </form>
          </div>

          {/* Back to site */}
          <a href="/" className="login-back">
            ← חזרה לאתר
          </a>
        </div>
        </div>
      </div>
    </>
  );
}
