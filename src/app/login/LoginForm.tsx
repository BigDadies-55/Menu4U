"use client";

import { useState, useEffect } from "react";
import { loginAction } from "./actions";

interface Props {
  loginImage: string | null;
  brightness?: number;
  logo: string | null;
  siteName: string;
}

export default function LoginForm({ loginImage, brightness = 100, logo, siteName }: Props) {
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

        .lg-root {
          font-family: 'Heebo', sans-serif;
          min-height: 100vh;
          display: flex; align-items: center; justify-content: flex-start;
          padding: 24px 6vw; direction: rtl; position: relative; overflow: hidden;
          background: #e9e6df;
        }
        @media (max-width: 560px) {
          .lg-root { justify-content: center; padding: 24px; }
        }
        .lg-bg {
          position: absolute; inset: -40px; z-index: 0;
          background-size: cover; background-position: center;
        }
        .lg-bg::after {
          content: ''; position: absolute; inset: 0;
          background: rgba(255,255,255,0.28);
        }
        .lg-card {
          position: relative; z-index: 1;
          width: 100%; max-width: 380px;
          background: rgba(255,255,255,0.55);
          backdrop-filter: blur(22px); -webkit-backdrop-filter: blur(22px);
          border: 1px solid rgba(255,255,255,0.55);
          border-radius: 24px;
          padding: 36px 30px 30px;
          box-shadow: 0 24px 70px rgba(0,0,0,0.30), 0 4px 14px rgba(0,0,0,0.12);
          text-align: center;
        }
        .lg-logo {
          width: 76px; height: 76px; border-radius: 50%;
          margin: 0 auto 14px;
          background: linear-gradient(135deg, #C9A452, #6b470d);
          display: flex; align-items: center; justify-content: center;
          overflow: hidden; box-shadow: 0 6px 18px rgba(201,164,82,0.35);
        }
        .lg-logo img { width: 100%; height: 100%; object-fit: cover; }
        .lg-logo span { font-size: 34px; line-height: 1; }
        .lg-brand {
          font-size: 23px; font-weight: 800; letter-spacing: 1px;
          color: #3f3f3a; margin: 0;
        }
        .lg-tagline { font-size: 11.5px; color: #9a988c; margin: 4px 0 0; }
        .lg-welcome {
          font-size: 24px; font-weight: 800; color: #2f2f2b;
          margin: 26px 0 22px;
        }
        .lg-field { position: relative; margin-bottom: 14px; }
        .lg-field .lg-ico {
          position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
          width: 18px; height: 18px; color: #b8995a; pointer-events: none;
        }
        .lg-field input {
          width: 100%; box-sizing: border-box;
          padding: 14px 44px 14px 16px;
          border: 1px solid #e2e0d8; border-radius: 12px;
          background: #fcfcfa; font-size: 14px; color: #2f2f2b;
          font-family: 'Heebo', sans-serif; outline: none; transition: .15s;
          text-align: right;
        }
        .lg-field input::placeholder { color: #b3b1a6; }
        .lg-field input:focus {
          border-color: #C9A452; background: #fff;
          box-shadow: 0 0 0 3px rgba(201,164,82,0.2);
        }
        .lg-error {
          background: rgba(220,38,38,0.08); border: 1px solid rgba(220,38,38,0.25);
          color: #b91c1c; padding: 10px 14px; border-radius: 10px;
          font-size: 13px; margin-bottom: 14px; text-align: center;
        }
        .lg-btn {
          width: 100%; padding: 14px; margin-top: 6px;
          border: none; border-radius: 12px;
          background: linear-gradient(135deg, #6b470d, #C9A452);
          color: #fff; font-family: 'Heebo', sans-serif;
          font-size: 15px; font-weight: 700; cursor: pointer;
          box-shadow: 0 8px 22px rgba(201,164,82,0.35); transition: .18s;
        }
        .lg-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 12px 28px rgba(201,164,82,0.45); }
        .lg-btn:disabled { opacity: .6; cursor: not-allowed; }
        .lg-link { font-size: 13px; color: #8a887e; margin-top: 16px; }
        .lg-link a { color: #8a6d1a; font-weight: 700; text-decoration: underline; }
        .lg-link.forgot { margin-top: 18px; }
        .lg-link.forgot a { color: #8a887e; font-weight: 500; text-decoration: none; }
        .lg-link.forgot a:hover { color: #8a6d1a; }
      `}</style>

      <div className="lg-root">
        {/* Full-screen blurred background image */}
        <div
          className="lg-bg"
          style={{
            backgroundImage: loginImage
              ? `url('${loginImage}')`
              : "linear-gradient(135deg,#1c1205,#3d2b00,#6b470d)",
            filter: `blur(7px) brightness(${brightness}%)`,
          }}
        />

        {process.env.NEXT_PUBLIC_APP_ENV === "development" && (
          <div className="fixed top-0 left-0 right-0 z-50 text-center text-xs font-bold py-1.5 tracking-widest uppercase"
            style={{ background: "#f59e0b", color: "#000" }}>
            ⚠️ סביבת פיתוח — DEV
          </div>
        )}

        <div className="lg-card">
          {/* Logo */}
          <div className="lg-logo">
            {logo ? <img src={logo} alt={siteName} /> : <span>🍽️</span>}
          </div>
          <h1 className="lg-brand">{siteName}</h1>
          <p className="lg-tagline">ניהול חכם למסעדות ועסקי מזון</p>

          <div className="lg-welcome">ברוכים הבאים חזרה!</div>

          <form onSubmit={handleSubmit}>
            <div className="lg-field">
              <svg className="lg-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" />
              </svg>
              <input
                type="text" value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                required placeholder="דואר אלקטרוני או שם משתמש" autoComplete="username"
              />
            </div>

            <div className="lg-field">
              <svg className="lg-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              <input
                type="password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                required placeholder="סיסמה" autoComplete="current-password"
              />
            </div>

            {error && <div className="lg-error">{error}</div>}

            <button type="submit" className="lg-btn" disabled={loading}>
              {loading ? "מתחבר..." : "התחברות"}
            </button>

            <div className="lg-link forgot"><a href="/forgot-password">שכחת סיסמה?</a></div>
          </form>
        </div>
      </div>
    </>
  );
}
