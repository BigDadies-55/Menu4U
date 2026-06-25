"use client";
import { useEffect, useState } from "react";

export default function InstallPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferredPrompt(null);
  };

  const S = {
    page: {
      minHeight: "100svh", background: "#1a1a2e", display: "flex",
      flexDirection: "column" as const, alignItems: "center",
      justifyContent: "center", padding: 24, fontFamily: "sans-serif",
      direction: "rtl" as const,
    },
    card: {
      background: "#252540", borderRadius: 20, padding: 32,
      maxWidth: 380, width: "100%", textAlign: "center" as const,
      boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
    },
    icon: { fontSize: 72, marginBottom: 16 },
    title: { color: "#f59e0b", fontSize: 26, fontWeight: 700, marginBottom: 8 },
    sub: { color: "rgba(255,255,255,0.6)", fontSize: 15, marginBottom: 28, lineHeight: 1.5 },
    btn: {
      background: "#f59e0b", color: "#1a1a2e", border: "none",
      borderRadius: 12, padding: "14px 28px", fontSize: 17,
      fontWeight: 700, cursor: "pointer", width: "100%", marginBottom: 12,
    },
    link: {
      display: "block", color: "rgba(255,255,255,0.45)", fontSize: 13,
      textDecoration: "none", marginTop: 8,
    },
    step: {
      background: "rgba(255,255,255,0.06)", borderRadius: 12,
      padding: "12px 16px", marginBottom: 10, color: "rgba(255,255,255,0.75)",
      fontSize: 14, textAlign: "right" as const, display: "flex", gap: 10, alignItems: "flex-start",
    },
    num: { color: "#f59e0b", fontWeight: 700, minWidth: 20 },
    success: { color: "#34d399", fontSize: 18, fontWeight: 600, marginBottom: 12 },
  };

  if (isStandalone) {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <div style={S.icon}>✅</div>
          <div style={S.title}>האפליקציה מותקנת</div>
          <div style={S.sub}>מלצר חכם פועל במצב אפליקציה מלאה</div>
          <a href="/admin/waiter-pos" style={{ ...S.btn, display: "block", textDecoration: "none" } as any}>
            פתח מסך מלצר
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.icon}>📲</div>
        <div style={S.title}>התקן את אפליקציית המלצר</div>
        <div style={S.sub}>
          התקן את האפליקציה על הטאבלט לחוויה מהירה ומלאה — ללא דפדפן, ללא עדכונים ידניים
        </div>

        {installed ? (
          <div style={S.success}>✓ הותקן בהצלחה!</div>
        ) : deferredPrompt ? (
          <button style={S.btn} onClick={handleInstall}>
            התקן עכשיו
          </button>
        ) : (
          <>
            <a
              href="/downloads/waiter.apk"
              download="waiter.apk"
              style={{ ...S.btn, display: "block", textDecoration: "none", marginBottom: 16, background: "#22c55e", color: "#fff" }}
            >
              ⬇️ הורד APK ישירות
            </a>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 16 }}>
              או התקנה דרך Chrome:
            </div>
            {[
              { n: "1", t: 'פתח את הכתובת הזו ב-Chrome' },
              { n: "2", t: 'לחץ על שלוש הנקודות ⋮ בפינה הימנית העליונה' },
              { n: "3", t: 'בחר "הוסף לדף הבית" / "Install app"' },
              { n: "4", t: 'לחץ "הוסף" — האפליקציה תופיע על המסך' },
            ].map(s => (
              <div key={s.n} style={S.step}>
                <span style={S.num}>{s.n}</span>
                <span>{s.t}</span>
              </div>
            ))}
          </>
        )}

        <a href="/admin/waiter-pos" style={S.link}>
          המשך בדפדפן בלי להתקין ←
        </a>
      </div>
    </div>
  );
}
