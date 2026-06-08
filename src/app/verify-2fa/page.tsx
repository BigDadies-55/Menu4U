"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { T } from "@/lib/ui";

export default function TwoFactorVerifyPage() {
  const [code,    setCode]    = useState("");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/totp-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setError(data.error ?? "שגיאה"); return; }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("שגיאה בחיבור לשרת");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100dvh",
      background: "var(--c-bg, #0d0f18)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "inherit",
      direction: "rtl",
    }}>
      <div style={{
        background: T.panel,
        border: `1px solid ${T.border}`,
        borderRadius: 20,
        padding: "40px 36px",
        width: "100%",
        maxWidth: 400,
        boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🔐</div>
          <h1 style={{ color: T.text, fontSize: 22, fontWeight: 700, margin: 0 }}>
            אימות דו-שלבי
          </h1>
          <p style={{ color: T.sub, fontSize: 14, margin: "8px 0 0" }}>
            הזן את הקוד מאפליקציית Google Authenticator
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            style={{
              background: T.overlay,
              border: `1px solid ${error ? T.red : T.border}`,
              color: T.text,
              borderRadius: 10,
              padding: "14px 18px",
              fontSize: 28,
              fontWeight: 700,
              textAlign: "center",
              letterSpacing: 8,
              width: "100%",
              outline: "none",
              fontFamily: "monospace",
            }}
          />

          {error && (
            <div style={{
              background: "rgba(255,107,107,0.12)",
              border: "1px solid rgba(255,107,107,0.3)",
              color: T.red,
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
              textAlign: "center",
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            style={{
              background: code.length === 6 ? "linear-gradient(135deg,#6c47ff,#a78bfa)" : T.overlay,
              color: code.length === 6 ? "#fff" : T.muted,
              border: "none",
              borderRadius: 10,
              padding: "14px",
              fontSize: 15,
              fontWeight: 700,
              cursor: code.length === 6 && !loading ? "pointer" : "not-allowed",
              transition: "all .2s",
            }}
          >
            {loading ? "מאמת..." : "אמת קוד"}
          </button>
        </form>

        <p style={{ color: T.muted, fontSize: 12, textAlign: "center", marginTop: 24, lineHeight: 1.6 }}>
          אין לך גישה לאפליקציה? פנה למנהל המערכת.
        </p>
      </div>
    </div>
  );
}
