"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { T, btn } from "@/lib/ui";

export default function Verify2FAPage() {
  const router = useRouter();
  const [code,    setCode]    = useState("");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) { setError("יש להזין 6 ספרות"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/totp-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        router.push("/admin");
        router.refresh();
      } else {
        const d = await res.json();
        setError(d.error ?? "קוד שגוי");
      }
    } catch {
      setError("שגיאת רשת");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", background: T.bg, display: "flex",
      alignItems: "center", justifyContent: "center",
      fontFamily: T.fontSans, direction: "rtl",
    }}>
      <div style={{
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: T.rXl, padding: 36, width: 360, maxWidth: "90vw",
      }}>
        <h1 style={{ fontSize: T.fxl, fontWeight: 800, color: T.gold, margin: "0 0 8px" }}>
          אימות דו-שלבי
        </h1>
        <p style={{ fontSize: T.fmd, color: T.muted, margin: "0 0 24px" }}>
          הזן את הקוד מאפליקציית Google Authenticator
        </p>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            style={{
              background: T.panel, border: `1px solid ${error ? T.red : T.border}`,
              borderRadius: T.rMd, color: T.text, fontSize: 28,
              padding: "12px 16px", outline: "none", textAlign: "center",
              letterSpacing: "0.3em", fontWeight: 800,
            }}
          />

          {error && (
            <div style={{ fontSize: T.fsm, color: T.red, textAlign: "center" }}>{error}</div>
          )}

          <button type="submit" disabled={loading || code.length !== 6} style={{
            ...btn("primary"),
            justifyContent: "center",
            opacity: loading || code.length !== 6 ? 0.6 : 1,
          }}>
            {loading ? "מאמת..." : "אמת"}
          </button>
        </form>
      </div>
    </div>
  );
}
