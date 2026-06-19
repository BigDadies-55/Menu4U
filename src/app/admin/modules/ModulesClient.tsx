"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MODULES, ModuleKey } from "@/lib/modules";
import { T } from "@/lib/ui";

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

/* ─── Palette — single source of truth via T ────────────────── */
const GREEN = T.emerald;
const RED   = T.red;

const DATE_INPUT: React.CSSProperties = {
  width: "100%", padding: "5px 8px", borderRadius: T.rMd,
  border: `1px solid ${T.border}`,
  background: T.surface, color: T.text,
  fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
};

function isoToDate(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function isExpired(enabledTo: string): boolean {
  return !!enabledTo && new Date(enabledTo) < new Date();
}

/* ─── Toggle ─────────────────────────────────────────────────── */
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        position: "relative", width: 40, height: 22, borderRadius: 11,
        border: "none", cursor: "pointer", flexShrink: 0,
        background: on ? GREEN : T.raised,
        transition: "background 0.2s",
      }}
    >
      <span style={{
        position: "absolute", top: 3,
        right: on ? 3 : "auto", left: on ? "auto" : 3,
        width: 16, height: 16, borderRadius: "50%", background: T.panel,
        transition: "left 0.2s, right 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
      }} />
    </button>
  );
}

/* ─── Module table row ───────────────────────────────────────── */
function ModuleTableRow({
  mod, state, onChange, onSave,
}: {
  mod: { key: ModuleKey; label: string; icon: string; description: string };
  state: ModuleState;
  onChange: (patch: Partial<ModuleState>) => void;
  onSave: () => void;
}) {
  const expired = isExpired(state.enabledTo);
  const effective = state.isEnabled && !expired;

  function handleBlur() {
    if (state.dirty) onSave();
  }

  return (
    <tr style={{
      background: expired
        ? T.redSub
        : effective ? T.emeraldSub : "transparent",
      borderBottom: `1px solid ${T.borderSub}`,
      transition: "background 0.2s",
    }}>
      {/* Status toggle */}
      <td style={{ padding: "5px 12px", textAlign: "center", verticalAlign: "middle" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <Toggle
            on={effective}
            onChange={v => { onChange({ isEnabled: v, dirty: true }); setTimeout(onSave, 0); }}
          />
          <span style={{
            fontSize: 10, fontWeight: 600,
            color: effective ? GREEN : expired ? RED : T.muted,
          }}>
            {expired ? "פג תוקף" : effective ? "פעיל" : "כבוי"}
          </span>
        </div>
      </td>

      {/* Icon */}
      <td style={{ padding: "5px 8px", textAlign: "center", verticalAlign: "middle" }}>
        <span style={{ fontSize: 22 }}>{mod.icon}</span>
      </td>

      {/* Name + description */}
      <td style={{ padding: "5px 12px", verticalAlign: "middle", minWidth: 150 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{mod.label}</div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{mod.description}</div>
      </td>

      {/* 30-day trial button */}
      <td style={{ padding: "5px 6px", verticalAlign: "middle", textAlign: "center" }}>
        <button
          onClick={() => {
            const t = new Date(); const e = new Date(t); e.setDate(e.getDate() + 30);
            onChange({ enabledFrom: t.toISOString(), enabledTo: e.toISOString(), dirty: true });
            setTimeout(onSave, 0);
          }}
          title="30 ימי ניסיון"
          style={{ padding: "4px 8px", borderRadius: 7, border: `1px solid ${T.gold}`, background: "transparent", color: T.gold, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
          🎁 30י׳
        </button>
      </td>

      {/* From date */}
      <td style={{ padding: "5px 5px", verticalAlign: "middle", minWidth: 118 }}>
        <input
          type="date"
          value={isoToDate(state.enabledFrom)}
          onChange={e => onChange({ enabledFrom: e.target.value ? new Date(e.target.value).toISOString() : "", dirty: true })}
          onBlur={handleBlur}
          style={{ ...DATE_INPUT, fontSize: 11, padding: "4px 6px" }}
        />
      </td>

      {/* To date */}
      <td style={{ padding: "5px 5px", verticalAlign: "middle", minWidth: 118 }}>
        <input
          type="date"
          value={isoToDate(state.enabledTo)}
          onChange={e => onChange({ enabledTo: e.target.value ? new Date(e.target.value).toISOString() : "", dirty: true })}
          onBlur={handleBlur}
          style={{ ...DATE_INPUT, fontSize: 11, padding: "4px 6px", borderColor: expired ? `${T.red}66` : T.border, color: expired ? RED : T.text }}
        />
      </td>

      {/* Clear dates */}
      <td style={{ padding: "5px 5px", verticalAlign: "middle", textAlign: "center" }}>
        <button
          onClick={() => { onChange({ enabledFrom: "", enabledTo: "", dirty: true }); setTimeout(onSave, 0); }}
          title="נקה תאריכים"
          style={{ padding: "4px 8px", borderRadius: 7, border: `1px solid ${T.border}`, background: "transparent", color: T.muted, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
          נקה
        </button>
      </td>

      {/* Note */}
      <td style={{ padding: "5px 8px", verticalAlign: "middle" }}>
        <input
          type="text"
          value={state.note}
          onChange={e => onChange({ note: e.target.value, dirty: true })}
          onBlur={handleBlur}
          placeholder="הערה..."
          style={{ ...DATE_INPUT, minWidth: 120 }}
        />
      </td>

      {/* Save indicator */}
      <td style={{ padding: "5px 8px", verticalAlign: "middle", width: 60, textAlign: "center" }}>
        {state.saving && <span style={{ fontSize: 11, color: T.gold }}>שומר...</span>}
        {!state.saving && state.dirty && (
          <button onClick={onSave} style={{
            fontSize: 11, padding: "4px 10px", borderRadius: 7, border: "none",
            background: `linear-gradient(110deg,${T.gold}99,${T.gold})`,
            color: T.bg, cursor: "pointer", fontFamily: "inherit", fontWeight: 700,
          }}>שמור</button>
        )}
      </td>
    </tr>
  );
}

/* ─── Main ───────────────────────────────────────────────────── */
interface Props { restaurants: Restaurant[] }

export default function ModulesClient({ restaurants }: Props) {
  const [selectedRestaurant, setSelectedRestaurant] = useState(restaurants[0]?.id ?? "");
  const [moduleStates, setModuleStates] = useState<Record<ModuleKey, ModuleState>>(() =>
    Object.fromEntries(
      MODULES.map(m => [m.key, { dbId: null, isEnabled: true, enabledFrom: "", enabledTo: "", note: "", dirty: false, saving: false }])
    ) as Record<ModuleKey, ModuleState>
  );
  const [loading, setLoading]     = useState(false);
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null);
  const [subFrom, setSubFrom]     = useState("");
  const [subTo, setSubTo]         = useState("");
  const [subSaving, setSubSaving] = useState(false);

  const selectedRest = restaurants.find(r => r.id === selectedRestaurant);
  const autoSaveRef = useRef<Record<ModuleKey, boolean>>({} as Record<ModuleKey, boolean>);

  useEffect(() => {
    const r = restaurants.find(r => r.id === selectedRestaurant);
    setSubFrom(r?.subscriptionFrom ? r.subscriptionFrom.slice(0, 10) : "");
    setSubTo(r?.subscriptionTo   ? r.subscriptionTo.slice(0, 10)   : "");
  }, [selectedRestaurant, restaurants]);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  };

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

  const saveModule = useCallback(async (key: ModuleKey, overrideState?: Partial<ModuleState>) => {
    setModuleStates(prev => {
      const state = { ...prev[key], ...overrideState };
      const expired = isExpired(state.enabledTo);
      const effectiveEnabled = state.isEnabled && !expired;

      (async () => {
        try {
          const res = await fetch("/api/admin/modules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              restaurantId: selectedRestaurant,
              moduleKey: key,
              isEnabled: effectiveEnabled,
              enabledFrom: state.enabledFrom || null,
              enabledTo: state.enabledTo || null,
              note: state.note || null,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "שגיאה");
          setModuleStates(p => ({ ...p, [key]: { ...p[key], dbId: data.id ?? p[key].dbId, dirty: false, saving: false } }));
          showToast("נשמר", true);
        } catch (e) {
          setModuleStates(p => ({ ...p, [key]: { ...p[key], saving: false } }));
          showToast(String(e), false);
        }
      })();

      return { ...prev, [key]: { ...prev[key], ...overrideState, saving: true, dirty: false } };
    });
  }, [selectedRestaurant]);

  const loadModules = useCallback(async (restaurantId: string) => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/modules?restaurantId=${restaurantId}`);
      const data = await res.json();
      const rows: ModuleRow[] = data.rows ?? [];
      const now = new Date();

      const next: Record<ModuleKey, ModuleState> = Object.fromEntries(
        MODULES.map(m => [m.key, { dbId: null, isEnabled: true, enabledFrom: "", enabledTo: "", note: "", dirty: false, saving: false }])
      ) as Record<ModuleKey, ModuleState>;

      for (const row of rows) {
        const key = row.moduleKey as ModuleKey;
        if (!MODULES.some(m => m.key === key)) continue;
        const enabledTo = isoToDate(row.enabledTo);
        const expired = enabledTo && new Date(row.enabledTo!) < now;
        next[key] = {
          dbId: row.id,
          isEnabled: expired ? false : row.isEnabled,
          enabledFrom: isoToDate(row.enabledFrom),
          enabledTo,
          note: row.note ?? "",
          dirty: false,
          saving: false,
        };
        // auto-save expired modules that were still marked active
        if (expired && row.isEnabled) {
          autoSaveRef.current[key] = true;
        }
      }

      setModuleStates(next);
    } catch {
      showToast("שגיאה בטעינת המודולים", false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedRestaurant) loadModules(selectedRestaurant);
  }, [selectedRestaurant, loadModules]);

  // Auto-save expired modules after state settles
  useEffect(() => {
    const keys = Object.keys(autoSaveRef.current) as ModuleKey[];
    if (keys.length === 0) return;
    autoSaveRef.current = {} as Record<ModuleKey, boolean>;
    keys.forEach(k => saveModule(k));
  }, [moduleStates, saveModule]);

  function handleChange(key: ModuleKey, patch: Partial<ModuleState>) {
    setModuleStates(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", padding: "24px 20px", direction: "rtl", fontFamily: "inherit" }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: T.gold, margin: 0, letterSpacing: -0.5 }}>⚙️ ניהול מודולים</h1>
        <p style={{ fontSize: 13, color: T.muted, marginTop: 6 }}>הפעלה וכיבוי של מודולים לכל מסעדה</p>
      </div>

      {/* Top bar: selector + subscription */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 24 }}>

        {/* Restaurant selector */}
        <div style={{ minWidth: 220, maxWidth: 300, flex: "0 0 auto" }}>
          <label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 6, fontWeight: 600 }}>בחר מסעדה</label>
          <select
            value={selectedRestaurant}
            onChange={e => setSelectedRestaurant(e.target.value)}
            style={{ width: "100%", padding: "5px 12px", borderRadius: 10, fontSize: 14, background: T.surface, border: `1px solid ${T.border}`, color: T.text, outline: "none", cursor: "pointer", fontFamily: "inherit", direction: "rtl" }}
          >
            {restaurants.map(r => (
              <option key={r.id} value={r.id} style={{ background: T.bg, color: T.text }}>{r.name}</option>
            ))}
          </select>
        </div>

        {/* Subscription */}
        {selectedRestaurant && (
          <div style={{ flex: 1, minWidth: 300, padding: "14px 18px", borderRadius: 14, border: `1px solid ${T.goldSub}`, background: T.goldSub }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.gold }}>📅 תוקף מנוי</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { const t = new Date(); const e = new Date(t); e.setDate(e.getDate() + 30); setSubFrom(t.toISOString().slice(0, 10)); setSubTo(e.toISOString().slice(0, 10)); }}
                  style={{ padding: "4px 11px", borderRadius: 8, border: `1px solid ${T.gold}`, background: "transparent", color: T.gold, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                  🎁 30 ימי ניסיון
                </button>
                <button onClick={() => { setSubFrom(""); setSubTo(""); }}
                  style={{ padding: "4px 11px", borderRadius: 8, border: `1px solid ${T.red}66`, background: "transparent", color: RED, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                  ✕ לא פעיל
                </button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 130 }}>
                <label style={{ display: "block", fontSize: 11, color: T.muted, marginBottom: 3 }}>מתאריך</label>
                <input type="date" value={subFrom} onChange={e => setSubFrom(e.target.value)}
                  style={{ width: "100%", padding: "7px 9px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
              </div>
              <div style={{ flex: 1, minWidth: 130 }}>
                <label style={{ display: "block", fontSize: 11, color: T.muted, marginBottom: 3 }}>עד תאריך</label>
                <input type="date" value={subTo} onChange={e => setSubTo(e.target.value)}
                  style={{ width: "100%", padding: "7px 9px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
              </div>
              <button onClick={saveSub} disabled={subSaving}
                style={{ padding: "7px 16px", borderRadius: 9, border: "none", background: `linear-gradient(110deg,${T.gold}99 0%,${T.gold} 50%,${T.gold}dd 100%)`, color: T.bg, fontSize: 13, fontWeight: 700, cursor: subSaving ? "default" : "pointer", opacity: subSaving ? 0.6 : 1, fontFamily: "inherit", whiteSpace: "nowrap" }}>
                {subSaving ? "שומר..." : "שמור מנוי"}
              </button>
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: (!subFrom && !subTo) ? RED : T.sub }}>
              {(!subFrom && !subTo) ? "⛔ לא פעיל — אין מנוי" : !subTo ? "✓ פעיל ללא הגבלת תוקף" :
               new Date() > new Date(subTo) ? `⚠️ פג תוקף: ${new Date(subTo).toLocaleDateString("he-IL")}` :
               `✓ פעיל עד ${new Date(subTo).toLocaleDateString("he-IL")}`}
            </div>
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && <div style={{ color: T.muted, fontSize: 14, marginBottom: 20 }}>טוען...</div>}

      {/* Modules table */}
      {!loading && selectedRestaurant && (
        <div style={{ borderRadius: 16, overflow: "hidden", border: `1px solid ${T.border}` }}>
          <table style={{ width: "100%", borderCollapse: "collapse", direction: "rtl" }}>
            <thead>
              <tr style={{ background: T.goldSub }}>
                {["סטטוס", "אייקון", "שם מודול", "", "מתאריך", "עד תאריך", "נקה", "הערות", ""].map(h => (
                  <th key={h} style={{
                    padding: "11px 14px", fontSize: 12, fontWeight: 700,
                    color: T.gold, textAlign: "right", borderBottom: `1px solid ${T.border}`,
                    whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULES.map(mod => (
                <ModuleTableRow
                  key={mod.key}
                  mod={mod}
                  state={moduleStates[mod.key]}
                  onChange={patch => handleChange(mod.key, patch)}
                  onSave={() => saveModule(mod.key)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && restaurants.length === 0 && (
        <div style={{ color: T.muted, fontSize: 14 }}>לא נמצאו מסעדות פעילות.</div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          zIndex: 9999, padding: "12px 24px", borderRadius: 12,
          background: toast.ok ? T.emeraldSub : T.redSub,
          border: `1px solid ${toast.ok ? `${T.emerald}66` : `${T.red}66`}`,
          color: toast.ok ? GREEN : RED, fontSize: 13, fontWeight: 600, direction: "rtl",
          backdropFilter: "blur(12px)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}>
          {toast.ok ? "✓" : "✗"} {toast.msg}
        </div>
      )}
    </div>
  );
}
