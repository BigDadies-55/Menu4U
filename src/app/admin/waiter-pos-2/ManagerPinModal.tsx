"use client";
import React, { useState, useRef, useEffect } from "react";

type Props = {
  restaurantId: string;
  title: string;
  description?: string;
  onApproved: (token: string, managerName: string) => void;
  onCancel: () => void;
};

export function ManagerPinModal({ restaurantId, title, description, onApproved, onCancel }: Props) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  useEffect(() => { refs[0].current?.focus(); }, []);

  function handleDigit(i: number, val: string) {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    setError("");
    if (val && i < 3) refs[i + 1].current?.focus();
    if (val && i === 3) {
      const pin = [...next.slice(0, 3), val].join("");
      if (pin.length === 4) submit(pin);
    }
  }

  function handleKey(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      refs[i - 1].current?.focus();
    }
  }

  async function submit(pin: string) {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/admin/auth/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, pin }),
      });
      const d = await r.json();
      if (!r.ok) {
        const a = attempts + 1;
        setAttempts(a);
        setError(a >= 3 ? "יותר מדי נסיונות — פנה למנהל" : d.error ?? "PIN שגוי");
        setDigits(["", "", "", ""]);
        setTimeout(() => refs[0].current?.focus(), 50);
      } else {
        onApproved(d.token, d.managerName);
      }
    } finally {
      setLoading(false);
    }
  }

  const locked = attempts >= 3;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 600, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={{ background: "#fff", borderRadius: 24, padding: "28px 32px", width: 320, textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,.25)", direction: "rtl" }}>
        {/* Lock icon */}
        <div style={{ fontSize: 36, marginBottom: 8 }}>🔐</div>
        <div style={{ fontSize: 16, fontWeight: 900, color: "#1a1612", marginBottom: 6 }}>{title}</div>
        {description && <div style={{ fontSize: 12, color: "#8a8480", marginBottom: 18, lineHeight: 1.5 }}>{description}</div>}
        <div style={{ fontSize: 12, color: "#8a8480", marginBottom: 16 }}>הכנס PIN מנהל לאישור</div>

        {/* 4-digit input */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 16 }}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={refs[i]}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={d}
              disabled={locked || loading}
              onChange={e => handleDigit(i, e.target.value)}
              onKeyDown={e => handleKey(i, e)}
              style={{
                width: 52, height: 56, textAlign: "center", fontSize: 22, fontWeight: 800,
                border: `2px solid ${error ? "#e53e3e" : d ? "#1a1612" : "#e8e2da"}`,
                borderRadius: 12, outline: "none", background: "#fafafa",
                color: "#1a1612", fontFamily: "inherit",
                transition: "border-color .15s",
              }}
            />
          ))}
        </div>

        {loading && <div style={{ fontSize: 12, color: "#8a8480", marginBottom: 10 }}>מאמת...</div>}
        {error && <div style={{ fontSize: 12, color: "#e53e3e", fontWeight: 700, marginBottom: 10 }}>⚠️ {error}</div>}

        <button onClick={onCancel} style={{ marginTop: 4, background: "none", border: "none", color: "#8a8480", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
          ביטול
        </button>
      </div>
    </div>
  );
}
