"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  initialName: string;
  initialPhone: string;
  initialCity: string;
  initialAddress: string;
}

export default function OnboardingProfileForm({ initialName, initialPhone, initialCity, initialAddress }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: initialName,
    phone: initialPhone,
    city: initialCity,
    address: initialAddress,
    idNumber: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const mandatoryFilled = form.fullName && form.phone && form.city && form.address;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mandatoryFilled) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/complete-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "שגיאה, נסה שנית");
        setLoading(false);
        return;
      }
      router.push("/admin");
    } catch {
      setError("שגיאת רשת, נסה שנית");
      setLoading(false);
    }
  }

  const inp: React.CSSProperties = {
    width: "100%", background: "#1e1a14", border: "1px solid rgba(201,164,82,0.25)",
    color: "#e9e0d0", borderRadius: 10, padding: "12px 14px",
    fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#6b6070", letterSpacing: 0.5, display: "block", marginBottom: 6 };

  return (
    <div style={{ minHeight: "100vh", background: "#0d0b0e", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "Arial, sans-serif", direction: "rtl" }}>
      <div style={{ width: "100%", maxWidth: 480 }}>

        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontFamily: "Georgia,serif", fontSize: 28, fontWeight: 700, color: "#fff", letterSpacing: 5 }}>
            TECH4<span style={{ color: "#C9A452" }}>BITES</span>
          </div>
          <div style={{ fontSize: 12, color: "rgba(201,164,82,0.5)", marginTop: 5, letterSpacing: 2 }}>הגדרת חשבון — שלב 2 מתוך 2</div>
        </div>

        <div style={{ background: "#110f12", border: "1px solid rgba(201,164,82,0.2)", borderRadius: 18, padding: "32px 28px", boxShadow: "0 8px 40px rgba(0,0,0,0.6)" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#e9e0d0", margin: "0 0 6px" }}>השלמת פרטים אישיים</h1>
          <p style={{ fontSize: 13, color: "#6b6070", margin: "0 0 24px", lineHeight: 1.6 }}>
            השדות המסומנים ב-<span style={{ color: "#ff6b6b" }}>*</span> הם חובה.
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={labelStyle}>שם מלא <span style={{ color: "#ff6b6b" }}>*</span></label>
              <input value={form.fullName} onChange={set("fullName")} style={inp} placeholder="ישראל ישראלי" />
            </div>
            <div>
              <label style={labelStyle}>מספר טלפון <span style={{ color: "#ff6b6b" }}>*</span></label>
              <input value={form.phone} onChange={set("phone")} style={inp} placeholder="050-0000000" type="tel" inputMode="tel" />
            </div>
            <div>
              <label style={labelStyle}>עיר מגורים <span style={{ color: "#ff6b6b" }}>*</span></label>
              <input value={form.city} onChange={set("city")} style={inp} placeholder="תל אביב" />
            </div>
            <div>
              <label style={labelStyle}>כתובת מלאה <span style={{ color: "#ff6b6b" }}>*</span></label>
              <input value={form.address} onChange={set("address")} style={inp} placeholder="רחוב ומספר, עיר" />
            </div>
            <div>
              <label style={labelStyle}>תעודת זהות</label>
              <input value={form.idNumber} onChange={set("idNumber")} style={inp} placeholder="000000000" inputMode="numeric" maxLength={9} />
            </div>

            {error && (
              <div style={{ background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.25)", color: "#ff6b6b", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !mandatoryFilled}
              style={{ width: "100%", padding: "13px 0", borderRadius: 12, background: "linear-gradient(135deg,#6b470d,#C9A452)", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: loading ? "wait" : "pointer", opacity: (loading || !mandatoryFilled) ? 0.5 : 1, marginTop: 8 }}
            >
              {loading ? "שומר..." : "סיום והיכנס למערכת →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
