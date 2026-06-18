"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingUsernamePage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isValid = /^[a-z0-9_]{3,30}$/.test(username.toLowerCase());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/set-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "שגיאה, נסה שנית");
        setLoading(false);
        return;
      }
      router.push("/onboarding/profile");
    } catch {
      setError("שגיאת רשת, נסה שנית");
      setLoading(false);
    }
  }

  const inp: React.CSSProperties = {
    width: "100%", background: "#1e1a14", border: "1px solid rgba(201,164,82,0.25)",
    color: "#e9e0d0", borderRadius: 10, padding: "12px 14px",
    fontSize: 15, outline: "none", fontFamily: "inherit", boxSizing: "border-box",
    direction: "ltr",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0d0b0e", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "Arial, sans-serif", direction: "rtl" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>

        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontFamily: "Georgia,serif", fontSize: 28, fontWeight: 700, color: "#fff", letterSpacing: 5 }}>
            TECH4<span style={{ color: "#C9A452" }}>BITES</span>
          </div>
          <div style={{ fontSize: 12, color: "rgba(201,164,82,0.5)", marginTop: 5, letterSpacing: 2 }}>הגדרת חשבון — שלב 1 מתוך 2</div>
        </div>

        <div style={{ background: "#110f12", border: "1px solid rgba(201,164,82,0.2)", borderRadius: 18, padding: "32px 28px", boxShadow: "0 8px 40px rgba(0,0,0,0.6)" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#e9e0d0", margin: "0 0 8px" }}>בחר שם משתמש</h1>
          <p style={{ fontSize: 13, color: "#6b6070", margin: "0 0 24px", lineHeight: 1.6 }}>
            שם המשתמש ישמש לזיהוי ייחודי במערכת. ניתן להשתמש באותיות אנגליות, מספרים וקו תחתי.
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#6b6070", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>
                שם משתמש *
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                autoFocus
                required
                minLength={3}
                maxLength={30}
                placeholder="my_username"
                style={inp}
              />
              {username.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 12, color: isValid ? "#51cf66" : "#ff6b6b" }}>
                  {isValid ? "✓ שם משתמש תקין" : "3–30 תווים: אותיות אנגליות קטנות, מספרים או _"}
                </div>
              )}
            </div>

            {error && (
              <div style={{ background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.25)", color: "#ff6b6b", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !isValid}
              style={{ width: "100%", padding: "13px 0", borderRadius: 12, background: "linear-gradient(135deg,#6b470d,#C9A452)", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: loading ? "wait" : "pointer", opacity: (loading || !isValid) ? 0.5 : 1, marginTop: 4 }}
            >
              {loading ? "שומר..." : "המשך →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
