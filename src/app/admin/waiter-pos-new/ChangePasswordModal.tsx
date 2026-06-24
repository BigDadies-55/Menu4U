"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";

// In-app password change for the logged-in waiter. Posts to the existing
// /api/admin/profile/password endpoint ({ currentPassword, newPassword }).

const GB = "rgba(255,255,255,0.15)";
const GM = "rgba(255,255,255,0.55)";

export default function ChangePasswordModal({
  onClose, showToast,
}: {
  onClose: () => void; showToast: (msg: string) => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (next.length < 6) { setError("הסיסמה החדשה חייבת להכיל לפחות 6 תווים"); return; }
    if (next !== confirm) { setError("הסיסמאות אינן תואמות"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "שגיאה בעדכון הסיסמה"); return; }
      showToast("הסיסמה עודכנה בהצלחה ✓");
      onClose();
    } catch { setError("שגיאת רשת — נסה שוב"); }
    finally { setSaving(false); }
  }

  const inputBox: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.07)", border: `1px solid ${GB}`, borderRadius: 9,
    color: "#fff", padding: "10px 12px", fontSize: 14, fontFamily: "inherit", outline: "none",
    boxSizing: "border-box", direction: "ltr",
  };

  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 10001, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} dir="rtl" style={{
        background: "rgba(15,14,22,0.98)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
        border: `1px solid ${GB}`, borderRadius: 18, width: "100%", maxWidth: 360,
        boxShadow: "0 20px 60px rgba(0,0,0,0.6)", fontFamily: "'Heebo', sans-serif", color: "#fff", padding: 24,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>🔐 החלפת סיסמה</div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: `1px solid ${GB}`, borderRadius: 8, width: 32, height: 32, fontSize: 17, cursor: "pointer", color: "#fff" }}>✕</button>
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: GM, marginBottom: 6 }}>סיסמה נוכחית</div>
            <input type="password" value={current} onChange={e => setCurrent(e.target.value)} required autoComplete="current-password" style={inputBox} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: GM, marginBottom: 6 }}>סיסמה חדשה</div>
            <input type="password" value={next} onChange={e => setNext(e.target.value)} required placeholder="לפחות 6 תווים" autoComplete="new-password" style={inputBox} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: GM, marginBottom: 6 }}>אימות סיסמה חדשה</div>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password" style={inputBox} />
          </div>

          {error && <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", padding: "10px 12px", borderRadius: 10, fontSize: 13 }}>{error}</div>}

          <button type="submit" disabled={saving} style={{ marginTop: 4, padding: "12px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "#fff", fontWeight: 800, fontSize: 14, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: saving ? 0.6 : 1 }}>
            {saving ? "שומר..." : "עדכן סיסמה"}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
