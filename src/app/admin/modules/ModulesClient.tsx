"use client";

import { useState, useEffect, useCallback } from "react";
import { MODULES, ModuleKey } from "@/lib/modules";

/* ─── Types ──────────────────────────────────────────────────── */
interface Restaurant {
  id: string;
  name: string;
  subscriptionFrom: string | null;
  subscriptionTo: string | null;
}

interface ModuleRow {
  id: string;
  restaurantId: string | null;
  moduleKey: string;
  isEnabled: boolean;
  enabledFrom: string | null;
  enabledTo: string | null;
  note: string | null;
}

interface ModuleState {
  dbId: string | null;
  isEnabled: boolean;
  enabledFrom: string;
  enabledTo: string;
  note: string;
  dirty: boolean;
  saving: boolean;
}

/* ─── Styles ─────────────────────────────────────────────────── */
const GLASS_BG     = "rgba(15,15,30,0.85)";
const CARD_BG      = "rgba(255,255,255,0.05)";
const CARD_BORDER  = "rgba(255,255,255,0.12)";
const GOLD         = "#D97706";
const GOLD_MUT     = "rgba(217,119,6,0.18)";
const GOLD_TEXT    = "#f59e0b";
const TEXT_MAIN    = "#ffffff";
const TEXT_MUTED   = "rgba(255,255,255,0.5)";
const TEXT_SUB     = "rgba(255,255,255,0.35)";
const GREEN        = "#34D399";
const RED          = "#F87171";

function isoToDateInput(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 16); // "YYYY-MM-DDTHH:mm"
}

/* ─── ModuleCard ─────────────────────────────────────────────── */
function ModuleCard({
  mod,
  state,
  onChange,
  onSave,
  onReset,
}: {
  mod: { key: ModuleKey; label: string; icon: string; description: string };
  state: ModuleState;
  onChange: (patch: Partial<ModuleState>) => void;
  onSave: () => void;
  onReset: () => void;
}) {
  const [showDates, setShowDates] = useState(false);

  return (
    <div
      style={{
        background: state.isEnabled ? `rgba(52,211,153,0.04)` : CARD_BG,
        border: `1px solid ${state.isEnabled ? "rgba(52,211,153,0.2)" : CARD_BORDER}`,
        borderRadius: 14,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        direction: "rtl",
        transition: "background 0.2s, border 0.2s",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ fontSize: 22 }}>{mod.icon}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: TEXT_MAIN }}>{mod.label}</div>
            <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 1 }}>{mod.description}</div>
          </div>
        </div>

        {/* Toggle */}
        <button
          onClick={() => onChange({ isEnabled: !state.isEnabled, dirty: true })}
          style={{
            position: "relative",
            width: 44,
            height: 24,
            borderRadius: 12,
            border: "none",
            cursor: "pointer",
            background: state.isEnabled ? GREEN : "rgba(255,255,255,0.12)",
            transition: "background 0.2s",
            flexShrink: 0,
          }}
          title={state.isEnabled ? "פעיל — לחץ לכיבוי" : "כבוי — לחץ להפעלה"}
        >
          <span
            style={{
              position: "absolute",
              top: 3,
              right: state.isEnabled ? 3 : "auto",
              left: state.isEnabled ? "auto" : 3,
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "#fff",
              transition: "left 0.2s, right 0.2s",
              boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
            }}
          />
        </button>
      </div>

      {/* Status chip */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20,
          background: state.isEnabled ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)",
          color: state.isEnabled ? GREEN : RED,
          border: `1px solid ${state.isEnabled ? "rgba(52,211,153,0.25)" : "rgba(248,113,113,0.25)"}`,
        }}>
          {state.isEnabled ? "פעיל" : "כבוי"}
        </span>
        <button
          onClick={() => setShowDates(p => !p)}
          style={{
            fontSize: 11, color: TEXT_MUTED, background: "none", border: "none",
            cursor: "pointer", padding: "2px 6px", borderRadius: 6,
            textDecoration: "underline",
          }}
        >
          {showDates ? "הסתר תאריכים" : "הגדר תאריכים"}
        </button>
      </div>

      {/* Date range */}
      {showDates && (
        <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, color: TEXT_SUB, display: "block", marginBottom: 3 }}>פעיל מ-</label>
              <input
                type="datetime-local"
                value={state.enabledFrom}
                onChange={e => onChange({ enabledFrom: e.target.value, dirty: true })}
                style={{
                  width: "100%", padding: "6px 8px", borderRadius: 8, fontSize: 12,
                  background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)",
                  color: TEXT_MAIN, outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, color: TEXT_SUB, display: "block", marginBottom: 3 }}>פעיל עד</label>
              <input
                type="datetime-local"
                value={state.enabledTo}
                onChange={e => onChange({ enabledTo: e.target.value, dirty: true })}
                style={{
                  width: "100%", padding: "6px 8px", borderRadius: 8, fontSize: 12,
                  background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)",
                  color: TEXT_MAIN, outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Note */}
      <input
        type="text"
        value={state.note}
        onChange={e => onChange({ note: e.target.value, dirty: true })}
        placeholder="הערה (אופציונלי)"
        style={{
          width: "100%", padding: "7px 10px", borderRadius: 8, fontSize: 12,
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
          color: TEXT_MAIN, outline: "none", boxSizing: "border-box",
          fontFamily: "inherit",
        }}
      />

      {/* Save / Reset buttons */}
      {state.dirty && (
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={onSave}
            disabled={state.saving}
            style={{
              flex: 1, padding: "8px 0", borderRadius: 9, border: "none",
              background: `linear-gradient(110deg, #7a3c04 0%, ${GOLD} 50%, #e8843a 100%)`,
              color: "#fff", fontSize: 12, fontWeight: 700, cursor: state.saving ? "default" : "pointer",
              opacity: state.saving ? 0.6 : 1, fontFamily: "inherit",
            }}
          >
            {state.saving ? "שומר..." : "שמור"}
          </button>
          <button
            onClick={onReset}
            style={{
              padding: "8px 14px", borderRadius: 9,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.06)", color: TEXT_MUTED,
              fontSize: 12, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            בטל
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Main Client ────────────────────────────────────────────── */
interface Props {
  restaurants: Restaurant[];
}

export default function ModulesClient({ restaurants }: Props) {
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>(restaurants[0]?.id ?? "");
  const [moduleStates, setModuleStates] = useState<Record<ModuleKey, ModuleState>>(() =>
    Object.fromEntries(
      MODULES.map(m => [m.key, { dbId: null, isEnabled: true, enabledFrom: "", enabledTo: "", note: "", dirty: false, saving: false }])
    ) as Record<ModuleKey, ModuleState>
  );
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const selectedRest = restaurants.find(r => r.id === selectedRestaurant);
  const [subFrom, setSubFrom] = useState("");
  const [subTo, setSubTo]     = useState("");
  const [subSaving, setSubSaving] = useState(false);

  useEffect(() => {
    const r = restaurants.find(r => r.id === selectedRestaurant);
    setSubFrom(r?.subscriptionFrom ? r.subscriptionFrom.slice(0, 10) : "");
    setSubTo(r?.subscriptionTo   ? r.subscriptionTo.slice(0, 10)   : "");
  }, [selectedRestaurant, restaurants]);

  async function saveSub() {
    setSubSaving(true);
    try {
      const res = await fetch(`/api/admin/restaurants/${selectedRestaurant}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionFrom: subFrom ? new Date(subFrom).toISOString() : null,
          subscriptionTo:   subTo   ? new Date(subTo).toISOString()   : null,
        }),
      });
      if (!res.ok) throw new Error("שגיאה");
      showToast("מנוי נשמר", true);
    } catch { showToast("שגיאה בשמירת מנוי", false); }
    finally { setSubSaving(false); }
  }

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  };

  const loadModules = useCallback(async (restaurantId: string) => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/modules?restaurantId=${restaurantId}`);
      const data = await res.json();
      const rows: ModuleRow[] = data.rows ?? [];

      setModuleStates(prev => {
        const next = { ...prev };
        // Reset all to defaults first
        for (const m of MODULES) {
          next[m.key] = { dbId: null, isEnabled: true, enabledFrom: "", enabledTo: "", note: "", dirty: false, saving: false };
        }
        // Apply DB rows
        for (const row of rows) {
          const key = row.moduleKey as ModuleKey;
          if (MODULES.some(m => m.key === key)) {
            next[key] = {
              dbId: row.id,
              isEnabled: row.isEnabled,
              enabledFrom: isoToDateInput(row.enabledFrom),
              enabledTo: isoToDateInput(row.enabledTo),
              note: row.note ?? "",
              dirty: false,
              saving: false,
            };
          }
        }
        return next;
      });
    } catch {
      showToast("שגיאה בטעינת המודולים", false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedRestaurant) loadModules(selectedRestaurant);
  }, [selectedRestaurant, loadModules]);

  function handleChange(key: ModuleKey, patch: Partial<ModuleState>) {
    setModuleStates(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  function handleReset(key: ModuleKey) {
    // Reload from DB by re-running load
    loadModules(selectedRestaurant);
  }

  async function handleSave(key: ModuleKey) {
    const state = moduleStates[key];
    setModuleStates(prev => ({ ...prev, [key]: { ...prev[key], saving: true } }));

    try {
      const res = await fetch("/api/admin/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: selectedRestaurant,
          moduleKey: key,
          isEnabled: state.isEnabled,
          enabledFrom: state.enabledFrom || null,
          enabledTo: state.enabledTo || null,
          note: state.note || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה");

      setModuleStates(prev => ({
        ...prev,
        [key]: { ...prev[key], dbId: data.id ?? prev[key].dbId, dirty: false, saving: false },
      }));
      showToast("נשמר בהצלחה", true);
    } catch (e) {
      setModuleStates(prev => ({ ...prev, [key]: { ...prev[key], saving: false } }));
      showToast(String(e), false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: GLASS_BG,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        padding: "24px 20px",
        direction: "rtl",
        fontFamily: "inherit",
      }}
    >
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: GOLD_TEXT, margin: 0, letterSpacing: -0.5 }}>
          ⚙️ ניהול מודולים
        </h1>
        <p style={{ fontSize: 13, color: TEXT_MUTED, marginTop: 6 }}>
          הפעלה וכיבוי של מודולים לכל מסעדה
        </p>
      </div>

      {/* Restaurant selector */}
      <div style={{ marginBottom: 24, maxWidth: 340 }}>
        <label style={{ fontSize: 12, color: TEXT_MUTED, display: "block", marginBottom: 6, fontWeight: 600 }}>
          בחר מסעדה
        </label>
        <select
          value={selectedRestaurant}
          onChange={e => setSelectedRestaurant(e.target.value)}
          style={{
            width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 14,
            background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.18)",
            color: TEXT_MAIN, outline: "none", cursor: "pointer", fontFamily: "inherit",
            direction: "rtl",
          }}
        >
          {restaurants.map(r => (
            <option key={r.id} value={r.id} style={{ background: "#1a1a2e", color: "#fff" }}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      {/* Subscription section */}
      {selectedRestaurant && (
        <div style={{ marginBottom: 28, padding: "16px 20px", borderRadius: 14, border: `1px solid rgba(217,119,6,0.3)`, background: "rgba(217,119,6,0.06)", maxWidth: 560 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: GOLD_TEXT }}>📅 תוקף מנוי</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => {
                  const today = new Date();
                  const end = new Date(today); end.setDate(end.getDate() + 30);
                  setSubFrom(today.toISOString().slice(0, 10));
                  setSubTo(end.toISOString().slice(0, 10));
                }}
                style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${GOLD}`, background: "transparent", color: GOLD_TEXT, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                🎁 30 ימי ניסיון
              </button>
              <button
                onClick={() => { setSubFrom(""); setSubTo(""); }}
                style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(248,113,113,0.4)", background: "transparent", color: RED, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                ✕ לא פעיל
              </button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={{ display: "block", fontSize: 11, color: TEXT_MUTED, marginBottom: 4 }}>מתאריך</label>
              <input type="date" value={subFrom} onChange={e => setSubFrom(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.07)", color: TEXT_MAIN, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={{ display: "block", fontSize: 11, color: TEXT_MUTED, marginBottom: 4 }}>עד תאריך</label>
              <input type="date" value={subTo} onChange={e => setSubTo(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.07)", color: TEXT_MAIN, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
            </div>
            <button onClick={saveSub} disabled={subSaving}
              style={{ padding: "8px 18px", borderRadius: 9, border: "none", background: `linear-gradient(110deg,#7a3c04 0%,${GOLD} 50%,#e8843a 100%)`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: subSaving ? "default" : "pointer", opacity: subSaving ? 0.6 : 1, fontFamily: "inherit", whiteSpace: "nowrap" }}>
              {subSaving ? "שומר..." : "שמור מנוי"}
            </button>
          </div>
          {selectedRest && (
            <div style={{ marginTop: 10, fontSize: 11, color: (!subFrom && !subTo) ? RED : TEXT_SUB }}>
              {(!subFrom && !subTo) ? "⛔ לא פעיל — אין מנוי" :
               !subTo ? "✓ פעיל ללא הגבלת תוקף" :
               new Date() > new Date(subTo)
                 ? `⚠️ פג תוקף: ${new Date(subTo).toLocaleDateString("he-IL")}`
                 : `✓ פעיל עד ${new Date(subTo).toLocaleDateString("he-IL")}`}
            </div>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ color: TEXT_MUTED, fontSize: 14, marginBottom: 20 }}>
          טוען...
        </div>
      )}

      {/* Module grid */}
      {!loading && selectedRestaurant && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 14,
          }}
        >
          {MODULES.map(mod => (
            <ModuleCard
              key={mod.key}
              mod={mod}
              state={moduleStates[mod.key]}
              onChange={patch => handleChange(mod.key, patch)}
              onSave={() => handleSave(mod.key)}
              onReset={() => handleReset(mod.key)}
            />
          ))}
        </div>
      )}

      {/* No restaurants */}
      {!loading && restaurants.length === 0 && (
        <div style={{ color: TEXT_MUTED, fontSize: 14 }}>
          לא נמצאו מסעדות פעילות.
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
            zIndex: 9999, padding: "12px 24px", borderRadius: 12,
            background: toast.ok ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)",
            border: `1px solid ${toast.ok ? "rgba(52,211,153,0.4)" : "rgba(248,113,113,0.4)"}`,
            color: toast.ok ? GREEN : RED,
            fontSize: 13, fontWeight: 600, direction: "rtl",
            backdropFilter: "blur(12px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}
        >
          {toast.ok ? "✓" : "✗"} {toast.msg}
        </div>
      )}
    </div>
  );
}
