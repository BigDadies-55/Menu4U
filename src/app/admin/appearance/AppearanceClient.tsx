"use client";
import { useState } from "react";
import { T, card, btn, ADMIN_PALETTES, ADMIN_PALETTE_LABELS } from "@/lib/ui";

interface Restaurant {
  id: string;
  name: string;
  adminPalette: string;
}

interface Props {
  restaurants: Restaurant[];
  canSave?: boolean;
}

const PALETTE_PREVIEWS: Record<string, {
  bg: string; surface: string; sidebar: string; accent: string; text: string;
}> = {
  dark: {
    bg:      "#0c0c0c",
    surface: "#161616",
    sidebar: "linear-gradient(180deg,#050505 0%,#161616 55%,#26200e 100%)",
    accent:  "#c9890a",
    text:    "#f0ece6",
  },
  "warm-light": {
    bg:      "#eeeae2",
    surface: "#f8f5ef",
    sidebar: "linear-gradient(180deg,#c8c0b2 0%,#d4ccc0 55%,#e0dace 100%)",
    accent:  "#4a7c8c",
    text:    "#1c1710",
  },
  earthy: {
    bg:      "#f5ede0",
    surface: "#fdf8f0",
    sidebar: "linear-gradient(180deg,#1a0a06 0%,#2d1010 55%,#4a1020 100%)",
    accent:  "#65011b",
    text:    "#1e0e08",
  },
};

export default function AppearanceClient({ restaurants, canSave }: Props) {
  const [selectedRestaurant, setSelectedRestaurant] = useState(restaurants[0]);
  const [currentPalette, setCurrentPalette] = useState(selectedRestaurant.adminPalette || "dark");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function selectRestaurant(r: Restaurant) {
    setSelectedRestaurant(r);
    setCurrentPalette(r.adminPalette || "dark");
    setSaved(false);
    setError("");
  }

  async function savePalette() {
    if (!canSave) return;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch("/api/admin/restaurant/palette", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: selectedRestaurant.id, palette: currentPalette }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "שגיאה בשמירה");
      } else {
        setSaved(true);
        selectedRestaurant.adminPalette = currentPalette;
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      setError("שגיאת רשת");
    } finally {
      setSaving(false);
    }
  }

  const palettes = Object.keys(ADMIN_PALETTES);

  return (
    <div dir="rtl" style={{ padding: "24px 28px", color: T.text, fontFamily: T.fontSans }}>
      <h1 style={{ fontSize: T.f2xl, fontWeight: 800, color: T.gold, marginBottom: 6 }}>
        מראה וצבעים 🎨
      </h1>
      <p style={{ color: T.sub, fontSize: T.fmd, marginBottom: 28 }}>
        בחר פלטת צבעים לממשק הניהול של כל מסעדה
      </p>

      {/* Restaurant selector */}
      {restaurants.length > 1 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: T.fsm, color: T.muted, fontWeight: 600, marginBottom: 8, letterSpacing: "0.04em" }}>
            מסעדה
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {restaurants.map(r => (
              <button
                key={r.id}
                onClick={() => selectRestaurant(r)}
                style={{
                  padding: "6px 16px",
                  borderRadius: 8,
                  fontSize: T.fmd,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: selectedRestaurant.id === r.id ? T.gold : "transparent",
                  color: selectedRestaurant.id === r.id ? "#fff" : T.sub,
                  border: `1px solid ${selectedRestaurant.id === r.id ? T.gold : T.border}`,
                  transition: "all 0.15s",
                }}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Palette grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16, marginBottom: 28 }}>
        {palettes.map(p => {
          const prev = PALETTE_PREVIEWS[p];
          const isActive = currentPalette === p;
          return (
            <button
              key={p}
              onClick={() => canSave && setCurrentPalette(p)}
              style={{
                ...card(),
                padding: 0,
                cursor: canSave ? "pointer" : "default",
                border: isActive ? `2px solid ${T.gold}` : `1px solid ${T.border}`,
                borderRadius: 12,
                overflow: "hidden",
                textAlign: "right",
                transition: "border-color 0.15s, box-shadow 0.15s",
                boxShadow: isActive ? `0 0 0 3px color-mix(in srgb, var(--c-gold) 25%, transparent)` : "none",
                background: "transparent",
                opacity: !canSave && !isActive ? 0.6 : 1,
              }}
            >
              {/* Mini preview */}
              <div style={{ display: "flex", height: 100, overflow: "hidden" }}>
                <div style={{
                  width: 32, background: prev?.sidebar ?? "#111", flexShrink: 0,
                  display: "flex", flexDirection: "column", alignItems: "center",
                  paddingTop: 8, gap: 6,
                }}>
                  {[...Array(4)].map((_, i) => (
                    <div key={i} style={{
                      width: 18, height: 3, borderRadius: 2,
                      background: i === 0 ? prev?.accent ?? "#c9890a" : "rgba(255,255,255,0.2)",
                    }} />
                  ))}
                </div>
                <div style={{
                  flex: 1, background: prev?.bg ?? "#0c0c0c",
                  padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6,
                }}>
                  <div style={{
                    height: 16, background: prev?.surface ?? "#161616", borderRadius: 4,
                    display: "flex", alignItems: "center", padding: "0 6px", gap: 4,
                  }}>
                    <div style={{ width: 30, height: 4, borderRadius: 2, background: prev?.accent ?? "#c9890a" }} />
                  </div>
                  <div style={{ display: "flex", gap: 5 }}>
                    {[...Array(3)].map((_, i) => (
                      <div key={i} style={{
                        flex: 1, height: 36,
                        background: i === 0 ? (prev?.accent ?? "#c9890a") + "22" : prev?.surface ?? "#161616",
                        border: `1px solid ${i === 0 ? (prev?.accent ?? "#c9890a") + "44" : "rgba(128,128,128,0.15)"}`,
                        borderRadius: 4,
                      }} />
                    ))}
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: prev?.text ?? "#f0ece6", opacity: 0.4, width: "60%" }} />
                  <div style={{ height: 3, borderRadius: 2, background: prev?.text ?? "#f0ece6", opacity: 0.2, width: "40%" }} />
                </div>
              </div>

              <div style={{
                padding: "10px 12px",
                background: isActive ? (prev?.accent ?? "#c9890a") + "10" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{ fontSize: T.fmd, fontWeight: 700, color: T.text }}>
                  {ADMIN_PALETTE_LABELS[p] ?? p}
                </span>
                {isActive && (
                  <span style={{
                    fontSize: T.fxs, fontWeight: 700, color: T.gold,
                    background: "color-mix(in srgb, var(--c-gold) 15%, transparent)",
                    padding: "2px 8px", borderRadius: 99,
                    border: "1px solid color-mix(in srgb, var(--c-gold) 35%, transparent)",
                  }}>
                    פעיל ✓
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {canSave ? (
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            onClick={savePalette}
            disabled={saving || currentPalette === selectedRestaurant.adminPalette}
            style={{
              ...btn("primary"),
              opacity: (saving || currentPalette === selectedRestaurant.adminPalette) ? 0.5 : 1,
            }}
          >
            {saving ? "שומר..." : "שמור שינויים"}
          </button>
          {saved  && <span style={{ color: T.green, fontSize: T.fmd, fontWeight: 600 }}>✓ נשמר — ייכנס לתוקף בכניסה הבאה</span>}
          {error  && <span style={{ color: T.red,   fontSize: T.fmd }}>{error}</span>}
        </div>
      ) : (
        <p style={{ color: T.muted, fontSize: T.fsm }}>אין לך הרשאה לשנות את הפלטה</p>
      )}

      <p style={{ color: T.muted, fontSize: T.fsm, marginTop: 12 }}>
        השינוי ייכנס לתוקף בפעם הבאה שתיכנס לממשק הניהול
      </p>
    </div>
  );
}
