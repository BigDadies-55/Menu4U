"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { T } from "@/lib/ui";

type SetupData = { enabled: true } | { enabled: false; secret: string; qr: string };

const INPUT: React.CSSProperties = {
  background: T.overlay,
  border: `1px solid ${T.border}`,
  color: T.text,
  borderRadius: 10,
  padding: "12px 16px",
  fontSize: 20,
  fontWeight: 700,
  textAlign: "center",
  letterSpacing: 8,
  width: "100%",
  outline: "none",
  fontFamily: "monospace",
};

export default function TotpSetupClient() {
  const [data,       setData]       = useState<SetupData | null>(null);
  const [code,       setCode]       = useState("");
  const [disableCode,setDisableCode]= useState("");
  const [step,       setStep]       = useState<"loading"|"enabled"|"setup"|"disable">("loading");
  const [msg,        setMsg]        = useState<{ ok: boolean; text: string } | null>(null);
  const [busy,       setBusy]       = useState(false);

  useEffect(() => {
    fetch("/api/admin/totp").then(r => r.json()).then((d: SetupData) => {
      setData(d);
      setStep(d.enabled ? "enabled" : "setup");
    }).catch(() => setMsg({ ok: false, text: "שגיאה בטעינת הנתונים" }));
  }, []);

  async function enable() {
    if (code.length !== 6 || !data || data.enabled) return;
    setBusy(true); setMsg(null);
    const res = await fetch("/api/admin/totp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: (data as { enabled: false; secret: string }).secret, code }),
    });
    const r = await res.json() as { ok?: boolean; error?: string };
    if (res.ok) {
      setMsg({ ok: true, text: "✓ אימות דו-שלבי הופעל בהצלחה" });
      setStep("enabled");
      setData({ enabled: true });
    } else {
      setMsg({ ok: false, text: r.error ?? "שגיאה" });
    }
    setBusy(false);
  }

  async function disable() {
    if (disableCode.length !== 6) return;
    setBusy(true); setMsg(null);
    const res = await fetch("/api/admin/totp", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: disableCode }),
    });
    const r = await res.json() as { ok?: boolean; error?: string };
    if (res.ok) {
      setMsg({ ok: true, text: "אימות דו-שלבי בוטל" });
      // Reload to get new QR
      const fresh = await fetch("/api/admin/totp").then(x => x.json()) as SetupData;
      setData(fresh);
      setStep("setup");
      setDisableCode("");
    } else {
      setMsg({ ok: false, text: r.error ?? "שגיאה" });
    }
    setBusy(false);
  }

  const Card: React.CSSProperties = {
    background: T.panel,
    border: `1px solid ${T.border}`,
    borderRadius: 16,
    padding: "28px 28px",
    maxWidth: 480,
    margin: "0 auto",
  };

  if (step === "loading") {
    return <div style={{ color: T.muted, padding: 40, textAlign: "center" }}>טוען...</div>;
  }

  return (
    <div style={{ padding: "32px 24px", direction: "rtl" }}>
      <h1 style={{ color: T.text, fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
        🔐 אימות דו-שלבי (2FA)
      </h1>
      <p style={{ color: T.sub, fontSize: 14, marginBottom: 28 }}>
        הגן על חשבונך עם קוד חד-פעמי מ-Google Authenticator
      </p>

      {msg && (
        <div style={{
          background: msg.ok ? "rgba(81,207,102,0.1)" : "rgba(255,107,107,0.1)",
          border: `1px solid ${msg.ok ? "rgba(81,207,102,0.3)" : "rgba(255,107,107,0.3)"}`,
          color: msg.ok ? T.green : T.red,
          borderRadius: 10, padding: "10px 16px", marginBottom: 20, fontSize: 13,
        }}>
          {msg.text}
        </div>
      )}

      {/* ── ENABLED state ── */}
      {step === "enabled" && (
        <div style={Card}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: T.green,
              boxShadow: "0 0 0 3px rgba(81,207,102,0.2)" }} />
            <span style={{ color: T.green, fontWeight: 700, fontSize: 15 }}>אימות דו-שלבי פעיל</span>
          </div>
          <p style={{ color: T.sub, fontSize: 13, marginBottom: 20 }}>
            כדי לכבות, הזן קוד מהאפליקציה:
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text" inputMode="numeric" maxLength={6}
              value={disableCode}
              onChange={e => setDisableCode(e.target.value.replace(/\D/g,""))}
              placeholder="000000"
              style={{ ...INPUT, flex: 1, fontSize: 18, letterSpacing: 6, padding: "10px 14px" }}
            />
            <button
              onClick={disable} disabled={busy || disableCode.length !== 6}
              style={{
                background: "rgba(255,107,107,0.15)", color: T.red,
                border: "1px solid rgba(255,107,107,0.3)",
                borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 700,
                cursor: disableCode.length === 6 ? "pointer" : "not-allowed", flexShrink: 0,
              }}
            >
              {busy ? "..." : "בטל 2FA"}
            </button>
          </div>
        </div>
      )}

      {/* ── SETUP state ── */}
      {step === "setup" && data && !data.enabled && (
        <div style={Card}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <p style={{ color: T.text, fontWeight: 600, marginBottom: 8 }}>
                שלב 1 — סרוק עם Google Authenticator
              </p>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <Image
                  src={(data as { enabled: false; qr: string }).qr}
                  alt="TOTP QR Code"
                  width={200} height={200}
                  style={{ borderRadius: 12, border: `2px solid ${T.border}` }}
                />
              </div>
            </div>

            <div>
              <p style={{ color: T.sub, fontSize: 12, marginBottom: 6 }}>
                לא מצליח לסרוק? הזן ידנית:
              </p>
              <code style={{
                display: "block", background: T.overlay, color: T.text,
                borderRadius: 8, padding: "8px 12px", fontSize: 13,
                letterSpacing: 2, wordBreak: "break-all",
              }}>
                {(data as { enabled: false; secret: string }).secret}
              </code>
            </div>

            <div>
              <p style={{ color: T.text, fontWeight: 600, marginBottom: 8 }}>
                שלב 2 — הזן את הקוד לאישור
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text" inputMode="numeric" maxLength={6}
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g,""))}
                  placeholder="000000"
                  style={{ ...INPUT, flex: 1 }}
                />
                <button
                  onClick={enable} disabled={busy || code.length !== 6}
                  style={{
                    background: code.length === 6 ? "linear-gradient(135deg,#6c47ff,#a78bfa)" : T.overlay,
                    color: code.length === 6 ? "#fff" : T.muted,
                    border: "none", borderRadius: 10, padding: "12px 20px",
                    fontSize: 14, fontWeight: 700, flexShrink: 0,
                    cursor: code.length === 6 && !busy ? "pointer" : "not-allowed",
                  }}
                >
                  {busy ? "..." : "הפעל"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
