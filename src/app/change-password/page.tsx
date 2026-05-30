"use client";

import { useState } from "react";
import { changePasswordAction } from "./actions";

export default function ChangePasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await changePasswordAction(newPassword, confirm);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');
        .cp-root{font-family:'Heebo',sans-serif;min-height:100vh;background:#09080a;display:flex;align-items:center;justify-content:center;padding:24px;direction:rtl;}
        .cp-grain{position:fixed;inset:0;z-index:0;pointer-events:none;opacity:.025;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");}
        .cp-glow{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,rgba(201,164,82,0.05) 0%,transparent 65%);pointer-events:none;z-index:0;}
        .cp-wrapper{position:relative;z-index:1;width:100%;max-width:420px;}
        .cp-brand{text-align:center;margin-bottom:32px;}
        .cp-wordmark{font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:700;color:white;letter-spacing:5px;}
        .cp-wordmark span{color:#C9A452;}
        .cp-divider-row{display:flex;align-items:center;gap:9px;margin-top:10px;}
        .cp-line{flex:1;height:.8px;background:rgba(201,164,82,.35);}
        .cp-sub{font-size:9px;letter-spacing:3px;text-transform:uppercase;color:rgba(201,164,82,.6);font-weight:600;}
        .cp-card{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07);border-radius:20px;padding:36px 32px;backdrop-filter:blur(24px);box-shadow:0 40px 80px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.06);position:relative;overflow:hidden;}
        .cp-card::before{content:'';position:absolute;top:0;left:15%;right:15%;height:1px;background:linear-gradient(90deg,transparent,rgba(201,164,82,.5),transparent);}
        .cp-alert{background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.25);border-radius:12px;padding:14px 16px;margin-bottom:24px;font-size:13px;color:#fbbf24;line-height:1.6;}
        .cp-title{font-size:16px;font-weight:700;color:white;margin-bottom:24px;display:flex;align-items:center;gap:8px;}
        .cp-title::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.07);}
        .cp-field{margin-bottom:16px;}
        .cp-field label{display:block;font-size:10px;font-weight:700;color:#6b6070;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:7px;}
        .cp-field input{width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:12px;padding:13px 16px;font-size:14px;font-family:'Heebo',sans-serif;color:white;outline:none;transition:.2s;direction:ltr;}
        .cp-field input:focus{border-color:rgba(201,164,82,.4);background:rgba(201,164,82,.04);box-shadow:0 0 0 3px rgba(201,164,82,.08);}
        .cp-error{background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.25);color:#fca5a5;padding:12px 16px;border-radius:12px;font-size:13px;margin-bottom:16px;}
        .cp-btn{width:100%;padding:14px;border:none;border-radius:13px;background:linear-gradient(135deg,#6b470d,#C9A452);color:white;font-family:'Heebo',sans-serif;font-size:15px;font-weight:700;cursor:pointer;letter-spacing:.3px;margin-top:8px;box-shadow:0 8px 28px rgba(201,164,82,.22);transition:.22s;}
        .cp-btn:hover:not(:disabled){box-shadow:0 12px 36px rgba(201,164,82,.35);transform:translateY(-1px);}
        .cp-btn:disabled{opacity:.6;cursor:not-allowed;}
      `}</style>

      <div className="cp-root">
        <div className="cp-grain" />
        <div className="cp-glow" />

        <div className="cp-wrapper">
          <div className="cp-brand">
            <div className="cp-wordmark">TECH4<span>BITES</span></div>
            <div className="cp-divider-row">
              <div className="cp-line" />
              <div className="cp-sub">פורטל ניהול</div>
              <div className="cp-line" />
            </div>
          </div>

          <div className="cp-card">
            <div className="cp-alert">
              🔐 נדרש לקבוע סיסמה אישית לפני הכניסה למערכת.
              הסיסמה הזמנית שקיבלת אינה תקפה עוד לאחר שלב זה.
            </div>

            <div className="cp-title">בחירת סיסמה חדשה</div>

            <form onSubmit={handleSubmit}>
              <div className="cp-field">
                <label>סיסמה חדשה</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="לפחות 8 תווים"
                  autoComplete="new-password"
                />
              </div>
              <div className="cp-field">
                <label>אימות סיסמה</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  placeholder="חזור על הסיסמה"
                  autoComplete="new-password"
                />
              </div>

              {error && <div className="cp-error">{error}</div>}

              <button type="submit" className="cp-btn" disabled={loading}>
                {loading ? "שומר..." : "שמירה וכניסה למערכת"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
