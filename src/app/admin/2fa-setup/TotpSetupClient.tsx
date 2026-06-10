"use client";
import { useState, useEffect } from "react";
import { T, btn, badge } from "@/lib/ui";

interface TotpData {
  enabled: boolean;
  secret?: string;
  qr?: string;
}

export default function TotpSetupClient() {
  const [data,    setData]    = useState<TotpData | null>(null);
  const [code,    setCode]    = useState("");
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState<{ text: string; ok: boolean } | null>(null);

  async function load() {
    const res = await fetch("/api/admin/totp");
    if (res.ok) setData(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function enable() {
    if (!data?.secret || code.length !== 6) { setMsg({ text: "יש להזין 6 ספרות", ok: false }); return; }
    setLoading(true); setMsg(null);
    const res = await fetch("/api/admin/totp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: data.secret, code }),
    });
    const d = await res.json();
    if (res.ok) { setMsg({ text: "אימות דו-שלבי הופעל בהצלחה ✓", ok: true }); setCode(""); load(); }
    else setMsg({ text: d.error ?? "שגיאה", ok: false });
    setLoading(false);
  }

  async function disable() {
    if (code.length !== 6) { setMsg({ text: "יש להזין קוד לאישור", ok: false }); return; }
    setLoading(true); setMsg(null);
    const res = await fetch("/api/admin/totp", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const d = await res.json();
    if (res.ok) { setMsg({ text: "אימות דו-שלבי בוטל", ok: true }); setCode(""); load(); }
    else setMsg({ text: d.error ?? "שגיאה", ok: false });
    setLoading(false);
  }

  if (!data) {
    return <div style={{ padding: 40, color: T.muted, fontFamily: T.fontSans }}>טוען...</div>;
  }

  return (
    <div style={{ direction: "rtl", padding: "32px 28px", fontFamily: T.fontSans, color: T.text, maxWidth: 520 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <h1 style={{ fontSize: T.fxl, fontWeight: 800, color: T.gold, margin: 0 }}>
          אימות דו-שלבי (2FA)
        </h1>
        <span style={badge(data.enabled ? T.green : T.muted)}>
          {data.enabled ? "פעיל" : "לא פעיל"}
        </span>
      </div>

      {!data.enabled ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <p style={{ fontSize: T.fmd, color: T.sub, margin: 0 }}>
            סרוק את קוד ה-QR עם Google Authenticator ואז הזן את הקוד שמוצג.
          </p>

          {data.qr && (
            <div style={{ textAlign: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={data.qr} alt="QR Code" style={{ width: 200, height: 200, borderRadius: T.rMd }} />
            </div>
          )}

          {data.secret && (
            <div style={{
              background: T.panel, border: `1px solid ${T.border}`,
              borderRadius: T.rMd, padding: "10px 14px",
              fontSize: T.fsm, color: T.muted, wordBreak: "break-all" as const,
            }}>
              <span style={{ color: T.sub }}>קוד ידני: </span>
              <span style={{ fontFamily: T.fontMono, color: T.text }}>{data.secret}</span>
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <input
              type="text" inputMode="numeric" maxLength={6}
              value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="קוד 6 ספרות"
              style={{
                flex: 1, background: T.panel, border: `1px solid ${T.border}`,
                borderRadius: T.rMd, color: T.text, fontSize: T.flg,
                padding: "10px 14px", outline: "none", textAlign: "center",
                letterSpacing: "0.2em", fontWeight: 700,
              }}
            />
            <button
              onClick={enable}
              disabled={loading || code.length !== 6}
              style={{ ...btn("primary"), opacity: loading || code.length !== 6 ? 0.6 : 1 }}
            >
              הפעל
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ fontSize: T.fmd, color: T.sub, margin: 0 }}>
            אימות דו-שלבי פעיל. להשבתה הזן קוד מאפליקציית Google Authenticator.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              type="text" inputMode="numeric" maxLength={6}
              value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="קוד 6 ספרות לאישור"
              style={{
                flex: 1, background: T.panel, border: `1px solid ${T.border}`,
                borderRadius: T.rMd, color: T.text, fontSize: T.flg,
                padding: "10px 14px", outline: "none", textAlign: "center",
                letterSpacing: "0.2em", fontWeight: 700,
              }}
            />
            <button
              onClick={disable}
              disabled={loading || code.length !== 6}
              style={{ ...btn("danger", "md"), opacity: loading || code.length !== 6 ? 0.6 : 1 }}
            >
              בטל 2FA
            </button>
          </div>
        </div>
      )}

      {msg && (
        <div style={{
          marginTop: 16, padding: "10px 14px", borderRadius: T.rMd,
          background: msg.ok ? T.greenSub : T.redSub,
          border: `1px solid ${msg.ok ? T.green : T.red}44`,
          fontSize: T.fmd, color: msg.ok ? T.green : T.red,
        }}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
