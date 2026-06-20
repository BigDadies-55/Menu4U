"use client";
import React, { useState, useEffect, useCallback } from "react";
import { GB, GM, ACCENT_GRAD } from "./attendanceShared";

interface Props {
  restaurantId: string;
  showToast: (msg: string) => void;
}

type Channel = "PUSH" | "EMAIL" | "SMS";
type RuleType = string;
type RuleConfig = { thresholdHours?: number; lateMinutes?: number; dayOfMonth?: number };
type Rule = { type: RuleType; channels: Channel[]; enabled: boolean; config: RuleConfig };
type Meta = Record<string, { label: string; desc: string; defaults: RuleConfig }>;

const CHANNELS: { key: Channel; label: string; icon: string }[] = [
  { key: "PUSH", label: "Push", icon: "🔔" },
  { key: "EMAIL", label: "Email", icon: "✉️" },
  { key: "SMS", label: "SMS", icon: "📱" },
];

// Step 7 — Notification automations. Toggle per-rule reminders, choose channels
// (Push / Email / SMS) and thresholds. Reminders are dispatched by cron; "שלח
// עכשיו" runs the evaluation immediately.
export default function AutomationsTab({ restaurantId, showToast }: Props) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [meta, setMeta] = useState<Meta>({});
  const [available, setAvailable] = useState<Record<Channel, boolean>>({ PUSH: false, EMAIL: false, SMS: false });
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/attendance/notifications?restaurantId=${restaurantId}`);
      const data = await res.json();
      setRules(data.rules ?? []);
      setMeta(data.meta ?? {});
      setAvailable(data.channels ?? { PUSH: false, EMAIL: false, SMS: false });
      setCanEdit(!!data.canEdit);
      setDirty(false);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  const update = (type: string, patch: Partial<Rule>) => {
    setRules(prev => prev.map(r => r.type === type ? { ...r, ...patch } : r));
    setDirty(true);
  };
  const toggleChannel = (type: string, ch: Channel) => {
    setRules(prev => prev.map(r => r.type === type ? { ...r, channels: r.channels.includes(ch) ? r.channels.filter(c => c !== ch) : [...r.channels, ch] } : r));
    setDirty(true);
  };

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/attendance/notifications", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, rules }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); showToast(e.error ?? "שגיאה בשמירה"); return; }
      showToast("✓ האוטומציות נשמרו"); setDirty(false);
    } finally { setSaving(false); }
  }

  async function runNow() {
    if (running) return;
    setRunning(true);
    try {
      const res = await fetch("/api/admin/attendance/notifications", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "שגיאה"); return; }
      showToast(data.sent > 0 ? `✓ נשלחו ${data.sent} התראות` : "אין התראות לשליחה כרגע");
    } finally { setRunning(false); }
  }

  const numInput: React.CSSProperties = { background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, borderRadius: 7, color: "#fff", fontSize: 12, padding: "4px 8px", width: 56, fontFamily: "inherit", outline: "none", textAlign: "center" };

  function configField(r: Rule) {
    if (r.type === "MISSING_CHECKOUT" || r.type === "LONG_SHIFT") {
      return (<span style={{ fontSize: 12, color: GM, display: "inline-flex", alignItems: "center", gap: 6 }}>סף שעות
        <input type="number" min={1} max={24} disabled={!canEdit} value={r.config.thresholdHours ?? 10} onChange={e => update(r.type, { config: { ...r.config, thresholdHours: Number(e.target.value) || 0 } })} style={numInput} /></span>);
    }
    if (r.type === "LATE_CHECKIN") {
      return (<span style={{ fontSize: 12, color: GM, display: "inline-flex", alignItems: "center", gap: 6 }}>דקות איחור
        <input type="number" min={0} max={180} disabled={!canEdit} value={r.config.lateMinutes ?? 30} onChange={e => update(r.type, { config: { ...r.config, lateMinutes: Number(e.target.value) || 0 } })} style={numInput} /></span>);
    }
    if (r.type === "MONTH_SIGNOFF") {
      return (<span style={{ fontSize: 12, color: GM, display: "inline-flex", alignItems: "center", gap: 6 }}>ביום בחודש
        <input type="number" min={1} max={28} disabled={!canEdit} value={r.config.dayOfMonth ?? 1} onChange={e => update(r.type, { config: { ...r.config, dayOfMonth: Number(e.target.value) || 1 } })} style={numInput} /></span>);
    }
    return null;
  }

  const unavailable = (Object.keys(available) as Channel[]).filter(c => !available[c]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>🔔 אוטומציות התראה</div>
        {loading && <span style={{ fontSize: 11, color: GM }}>טוען...</span>}
        <div style={{ marginRight: "auto", display: "flex", gap: 8 }}>
          <button onClick={runNow} disabled={running} style={{ padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", borderRadius: 9, background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, color: "#fff", fontFamily: "inherit", opacity: running ? 0.6 : 1 }}>{running ? "מריץ..." : "▶️ שלח עכשיו"}</button>
          {canEdit && <button onClick={save} disabled={!dirty || saving} style={{ padding: "7px 16px", fontSize: 13, fontWeight: 800, cursor: dirty ? "pointer" : "not-allowed", borderRadius: 9, background: dirty ? ACCENT_GRAD : "rgba(255,255,255,0.06)", border: "none", color: "#fff", fontFamily: "inherit", opacity: !dirty || saving ? 0.5 : 1 }}>{saving ? "שומר..." : "💾 שמור"}</button>}
        </div>
      </div>

      {unavailable.length > 0 && (
        <div style={{ fontSize: 11, color: "#FBBF24", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 10, padding: "8px 12px", marginBottom: 14 }}>
          ⚠️ ערוצים שאינם מוגדרים בשרת (לא יישלחו): {unavailable.map(c => CHANNELS.find(x => x.key === c)?.label).join(", ")}
        </div>
      )}
      {!canEdit && <div style={{ fontSize: 11, color: "#FBBF24", marginBottom: 12 }}>👁️ תצוגה בלבד — אין לך הרשאה לעריכה</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rules.map(r => {
          const m = meta[r.type];
          return (
            <div key={r.type} style={{ background: r.enabled ? "rgba(245,158,11,0.06)" : "rgba(255,255,255,0.03)", border: `1px solid ${r.enabled ? "rgba(245,158,11,0.3)" : GB}`, borderRadius: 14, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                {/* Enable toggle */}
                <div onClick={() => canEdit && update(r.type, { enabled: !r.enabled })} style={{ position: "relative", width: 38, height: 21, borderRadius: 11, background: r.enabled ? "#F59E0B" : "rgba(255,255,255,0.15)", cursor: canEdit ? "pointer" : "default", flexShrink: 0, transition: "background 0.2s" }}>
                  <div style={{ position: "absolute", top: 2, right: r.enabled ? 2 : undefined, left: r.enabled ? undefined : 2, width: 17, height: 17, borderRadius: "50%", background: "#fff", transition: "all 0.2s" }} />
                </div>
                <div style={{ flex: "1 1 200px" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{m?.label ?? r.type}</div>
                  <div style={{ fontSize: 11, color: GM, marginTop: 2 }}>{m?.desc ?? ""}</div>
                </div>
                {configField(r)}
                {/* Channels */}
                <div style={{ display: "flex", gap: 6 }}>
                  {CHANNELS.map(ch => {
                    const on = r.channels.includes(ch.key);
                    const avail = available[ch.key];
                    return (
                      <button key={ch.key} onClick={() => canEdit && toggleChannel(r.type, ch.key)} title={avail ? ch.label : `${ch.label} — לא מוגדר בשרת`}
                        style={{ padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: canEdit ? "pointer" : "default", fontFamily: "inherit",
                          background: on ? "rgba(52,211,153,0.18)" : "rgba(255,255,255,0.05)",
                          border: `1px solid ${on ? "rgba(52,211,153,0.45)" : GB}`,
                          color: on ? "#34D399" : GM, opacity: avail ? 1 : 0.5 }}>
                        {ch.icon} {ch.label}{on && " ✓"}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 10, color: GM, marginTop: 14, lineHeight: 1.7 }}>
        התראות נשלחות אוטומטית כל 15 דקות (cron). כל תזכורת נשלחת פעם אחת לכל עובד לתקופה הרלוונטית.
        הגדרת ערוצי Email/SMS/Push נעשית במשתני הסביבה של השרת.
      </div>
    </div>
  );
}
