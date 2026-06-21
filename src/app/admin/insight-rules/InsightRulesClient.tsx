"use client";
import React, { useState, useEffect, useCallback } from "react";
import { T } from "@/lib/ui";
import type { CustomRule, Condition, InsightType, BuiltinRuleOverride, BuiltinRuleOverrides } from "@/lib/waiter-insights";
import { BUILTIN_RULE_META } from "@/lib/waiter-insights";

// ─── design tokens (glass) ───────────────────────────────────────────────────
// צבעים מהפלטה המרכזית (var(--c-*) מוזרק ע"י admin/layout.tsx). רקע שקוף — יורש מה-Shell.
const BG_PAGE    = "transparent";
const G_ROW      = "var(--c-panel)";
const G_BORDER   = "var(--c-border)";
const G_BORDER_B = "var(--c-border)";
const G_MUTED    = "var(--c-muted)";
const G_TEXT     = "var(--c-text)";

// ─── fields / operators ──────────────────────────────────────────────────────
const ALL_FIELDS: { value: Condition["field"]; label: string }[] = [
  { value: "minutesSitting",           label: "דקות ישיבה" },
  { value: "orderStatus",              label: "סטטוס הזמנה" },
  { value: "availStatus",              label: "סטטוס שולחן" },
  { value: "guests",                   label: "מספר סועדים" },
  { value: "seats",                    label: "קיבולת שולחן" },
  { value: "totalAmount",              label: "סכום חשבון (₪)" },
  { value: "orderCount",               label: "מספר הזמנות" },
  { value: "minutesSinceLastOrder",    label: "דקות מאז עדכון הזמנה" },
  { value: "billRequested",            label: "חשבון התבקש" },
  { value: "minutesSinceBillRequested",label: "דקות מאז בקשת חשבון" },
  { value: "hasAllergen",              label: "יש אלרגיה" },
  { value: "isLoyaltyMember",          label: "לקוח נאמן" },
  { value: "voidsCount",               label: "מספר ביטולים/זיכויים" },
  { value: "spendPerSeat",             label: "הוצאה לסועד (₪)" },
];
const FIELDS: { value: Condition["field"]; label: string }[] = [
  { value: "minutesSitting",        label: "דקות ישיבה" },
  { value: "orderStatus",           label: "סטטוס הזמנה" },
  { value: "availStatus",           label: "סטטוס שולחן" },
  { value: "guests",                label: "מספר סועדים" },
  { value: "seats",                 label: "קיבולת שולחן" },
  { value: "totalAmount",           label: "סכום חשבון (₪)" },
  { value: "orderCount",            label: "מספר הזמנות" },
  { value: "minutesSinceLastOrder", label: "דקות מאז עדכון הזמנה" },
];
const OPERATORS: { value: Condition["operator"]; label: string }[] = [
  { value: "gt",  label: "גדול מ-" },
  { value: "gte", label: "גדול/שווה ל-" },
  { value: "lt",  label: "קטן מ-" },
  { value: "lte", label: "קטן/שווה ל-" },
  { value: "eq",  label: "שווה ל-" },
  { value: "neq", label: "שונה מ-" },
];

const TYPE_COLOR: Record<InsightType, string> = { alert: T.red, tip: T.orange, info: T.blue };
const TYPE_LABEL: Record<InsightType, string> = { alert: "התראה", tip: "עצה", info: "מידע" };

const EMPTY_RULE: Omit<CustomRule, "id"> = {
  label: "", enabled: true,
  conditions: [{ field: "minutesSitting", operator: "gt", value: 60 }],
  type: "tip", text: "שולחן {tableNum} — ", priority: 60,
};
const GLOBAL_ID = "GLOBAL";

// ─── shared input ─────────────────────────────────────────────────────────────
const INP: React.CSSProperties = {
  background: "rgba(255,255,255,0.07)",
  border: `1px solid ${G_BORDER_B}`,
  borderRadius: 8,
  color: G_TEXT,
  fontSize: 13,
  padding: "7px 11px",
  outline: "none",
  direction: "rtl",
  width: "100%",
};

// ─── toggle component ────────────────────────────────────────────────────────
function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width: 36, height: 20, borderRadius: 9999, border: "none", cursor: "pointer", flexShrink: 0,
      background: on ? "#22c55e" : "rgba(255,255,255,0.15)",
      position: "relative", transition: "background 0.2s",
    }}>
      <span style={{
        position: "absolute", top: 3, width: 14, height: 14, borderRadius: "50%",
        background: "#fff", transition: "left 0.2s", left: on ? 19 : 3,
      }} />
    </button>
  );
}

// ─── type badge ──────────────────────────────────────────────────────────────
function TypeBadge({ type }: { type: InsightType }) {
  const color = TYPE_COLOR[type];
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6,
      background: color + "22", color, border: `1px solid ${color}55`,
      flexShrink: 0, minWidth: 56, textAlign: "center",
    }}>
      {TYPE_LABEL[type]}
    </span>
  );
}

// ─── priority badge ───────────────────────────────────────────────────────────
function PrioBadge({ priority, highlight }: { priority: number; highlight?: boolean }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 400, padding: "3px 10px", borderRadius: 6,
      background: "transparent",
      color: T.amber,
      border: "none",
      flexShrink: 0, whiteSpace: "nowrap", textAlign: "right",
    }}>
      עדיפות {priority}
    </span>
  );
}

// ─── ghost button ─────────────────────────────────────────────────────────────
function GBtn({ children, onClick, color = G_MUTED, title }: { children: React.ReactNode; onClick: () => void; color?: string; title?: string }) {
  return (
    <button onClick={onClick} title={title} style={{
      background: "rgba(255,255,255,0.07)", border: `1px solid ${G_BORDER}`,
      borderRadius: 7, color, fontSize: 12, fontWeight: 600,
      padding: "5px 12px", cursor: "pointer", flexShrink: 0,
      transition: "background 0.15s",
    }}>
      {children}
    </button>
  );
}

export default function InsightRulesClient({ restaurants, isSuperAdmin }: { restaurants: { id: string; name: string }[]; isSuperAdmin?: boolean }) {
  const [rid, setRid]               = useState(isSuperAdmin ? GLOBAL_ID : (restaurants[0]?.id ?? ""));
  const [rules, setRules]           = useState<CustomRule[]>([]);
  const [builtinOverrides, setBuiltinOverrides] = useState<BuiltinRuleOverrides>({});
  const [globalOverrides, setGlobalOverrides]   = useState<BuiltinRuleOverrides>({});
  const isGlobal = rid === GLOBAL_ID;
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [editId, setEditId]         = useState<string | "new" | null>(null);
  const [form, setForm]             = useState<Omit<CustomRule, "id">>(EMPTY_RULE);
  const [editBuiltinId, setEditBuiltinId] = useState<string | null>(null);
  const [builtinForm, setBuiltinForm] = useState<{ text: string; priority: number; type: InsightType; conditions: Condition[]; fireOnce: boolean }>({ text: "", priority: 0, type: "alert", conditions: [], fireOnce: false });
  const [toast, setToast]           = useState<string | null>(null);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2500); }

  const load = useCallback(async () => {
    if (!rid) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/insight-rules?restaurantId=${rid}`);
      const d = await r.json();
      setRules(d.rules ?? []);
      setBuiltinOverrides(d.builtinOverrides ?? {});
      setGlobalOverrides(d.globalOverrides ?? {});
    } finally { setLoading(false); }
  }, [rid]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true);
    try {
      if (editId === "new") {
        const r = await fetch("/api/admin/insight-rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId: rid, rule: form }) });
        const d = await r.json();
        setRules(prev => [...prev, d.rule]);
        showToast("כלל נוסף בהצלחה");
      } else {
        const r = await fetch("/api/admin/insight-rules", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId: rid, rule: { ...form, id: editId } }) });
        const d = await r.json();
        setRules(prev => prev.map(x => x.id === editId ? d.rule : x));
        showToast("כלל עודכן");
      }
      setEditId(null);
    } finally { setSaving(false); }
  }

  async function deleteRule(id: string) {
    await fetch(`/api/admin/insight-rules?restaurantId=${rid}&id=${id}`, { method: "DELETE" });
    setRules(prev => prev.filter(r => r.id !== id));
    showToast("כלל נמחק");
  }

  async function patchBuiltin(ruleId: string, override: BuiltinRuleOverride | null) {
    const r = await fetch("/api/admin/insight-rules", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId: rid, ruleId, override }) });
    const d = await r.json();
    setBuiltinOverrides(d.builtinOverrides ?? {});
  }

  async function toggleBuiltin(ruleId: string) {
    const cur = builtinOverrides[ruleId];
    const nowEnabled = cur ? !cur.enabled : false;
    await patchBuiltin(ruleId, { ...cur, enabled: nowEnabled });
    showToast(nowEnabled ? "כלל הופעל" : "כלל הושבת");
  }

  async function resetBuiltin(ruleId: string) {
    await patchBuiltin(ruleId, null);
    showToast("כלל אופס לברירת המחדל");
  }

  function startEditBuiltin(ruleId: string) {
    const meta = BUILTIN_RULE_META.find(r => r.id === ruleId)!;
    const ov = builtinOverrides[ruleId];
    setBuiltinForm({ text: ov?.text ?? "", priority: ov?.priority ?? meta.priority, type: ov?.type ?? meta.type, conditions: ov?.conditions ? [...ov.conditions] : [...meta.defaultConditions], fireOnce: ov?.fireOnce ?? false });
    setEditBuiltinId(ruleId);
  }

  function updateBuiltinCond(i: number, patch: Partial<Condition>) {
    setBuiltinForm(f => ({ ...f, conditions: f.conditions.map((c, ci) => ci === i ? { ...c, ...patch } : c) }));
  }
  function addBuiltinCond() { setBuiltinForm(f => ({ ...f, conditions: [...f.conditions, { field: "minutesSitting", operator: "gte", value: 30 }] })); }
  function removeBuiltinCond(i: number) { setBuiltinForm(f => ({ ...f, conditions: f.conditions.filter((_, ci) => ci !== i) })); }

  async function saveBuiltin() {
    if (!editBuiltinId) return;
    const meta = BUILTIN_RULE_META.find(r => r.id === editBuiltinId)!;
    const cur = builtinOverrides[editBuiltinId];
    const condsChanged = JSON.stringify(builtinForm.conditions) !== JSON.stringify(meta.defaultConditions);
    await patchBuiltin(editBuiltinId, { enabled: cur?.enabled ?? true, text: builtinForm.text.trim() || undefined, priority: builtinForm.priority, type: builtinForm.type !== meta.type ? builtinForm.type : undefined, conditions: condsChanged ? builtinForm.conditions : undefined, fireOnce: builtinForm.fireOnce || undefined });
    setEditBuiltinId(null);
    showToast("כלל עודכן");
  }

  async function toggleEnabled(rule: CustomRule) {
    const updated = { ...rule, enabled: !rule.enabled };
    await fetch("/api/admin/insight-rules", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId: rid, rule: updated }) });
    setRules(prev => prev.map(r => r.id === rule.id ? updated : r));
  }

  function startEdit(rule: CustomRule) {
    setForm({ label: rule.label, enabled: rule.enabled, conditions: rule.conditions, type: rule.type, text: rule.text, priority: rule.priority, stopAfterMinutes: rule.stopAfterMinutes, stopTrigger: rule.stopTrigger, fireOnce: rule.fireOnce });
    setEditId(rule.id);
  }
  function startNew() { setForm(EMPTY_RULE); setEditId("new"); }
  function updateCond(i: number, patch: Partial<Condition>) { setForm(f => ({ ...f, conditions: f.conditions.map((c, ci) => ci === i ? { ...c, ...patch } : c) })); }
  function addCond() { setForm(f => ({ ...f, conditions: [...f.conditions, { field: "minutesSitting", operator: "gt", value: 30 }] })); }
  function removeCond(i: number) { setForm(f => ({ ...f, conditions: f.conditions.filter((_, ci) => ci !== i) })); }

  return (
    <div style={{ direction: "rtl", fontFamily: "'Rubik', 'Segoe UI', sans-serif", minHeight: "100vh", background: BG_PAGE, color: G_TEXT, padding: "clamp(14px, 2.5vw, 28px) clamp(16px, 3vw, 40px)" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;800&display=swap');`}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          background: "#22c55e", color: "var(--c-text)", borderRadius: 10,
          padding: "10px 24px", fontSize: 13, fontWeight: 700,
          zIndex: 9999, boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
        }}>{toast}</div>
      )}

      <div style={{ maxWidth: "100%" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 32, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: G_TEXT, lineHeight: 1.3 }}>
              כללי תובנות AI
              <span style={{ color: T.blue, marginRight: 8, fontWeight: 700 }}>— כללים מובנים</span>
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: G_MUTED }}>
              הגדר כללים מותאמים שיופיעו בנוסף לכללים המובנים בכל מסך שירות ומטבח
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {/* Restaurant selector — always visible */}
            {!isGlobal && (
              <select value={rid} onChange={e => setRid(e.target.value)} style={{
                background: "rgba(255,255,255,0.07)",
                border: `1px solid ${G_BORDER_B}`,
                borderRadius: 8, color: G_TEXT, fontSize: 13, fontWeight: 600,
                padding: "7px 14px", outline: "none", cursor: "pointer",
                direction: "rtl", minWidth: 160, appearance: "none",
                WebkitAppearance: "none",
              }}>
                {restaurants.map(r => <option key={r.id} value={r.id} style={{ background: "var(--c-surface)", color: "var(--c-text)" }}>{r.name}</option>)}
              </select>
            )}
            {/* Global toggle for super-admin */}
            {isSuperAdmin && (
              <button
                onClick={() => setRid(isGlobal ? (restaurants[0]?.id ?? "") : GLOBAL_ID)}
                style={{
                  background: isGlobal ? "rgba(59,130,246,0.18)" : "rgba(255,255,255,0.07)",
                  border: `1px solid ${isGlobal ? "rgba(59,130,246,0.5)" : G_BORDER}`,
                  borderRadius: 8, color: isGlobal ? T.blue : G_MUTED,
                  fontSize: 13, fontWeight: 600, padding: "7px 14px", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <span>⊞</span> גלובלי — כל המסעדות
              </button>
            )}
            {/* Info badge when in global mode */}
            {isGlobal && (
              <span style={{
                color: T.blue, fontSize: 12, fontWeight: 500,
                padding: "7px 4px", display: "flex", alignItems: "center", gap: 5,
              }}>
                🌐 שינויים יחולו על כל המסעדות
              </span>
            )}
            <button
              onClick={startNew}
              style={{
                background: "rgba(251,191,36,0.9)",
                border: "none", borderRadius: 8,
                color: "#000",
                fontSize: 13, fontWeight: 700, padding: "8px 18px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              + כלל חדש
            </button>
          </div>
        </div>

        {/* Built-in rules section */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: G_MUTED }}>
              כללים מובנים
            </span>
            {!isGlobal && (
              <span style={{ fontSize: 11, color: G_MUTED }}>· שינויים למסעדה זו בלבד · override גלובלי מסומן 🌐</span>
            )}
          </div>
          <div style={{ borderRadius: 14, overflow: "hidden", border: `1px solid ${G_BORDER}`, display: "flex", flexDirection: "column", gap: 6 }}>
            {BUILTIN_RULE_META.map((r, i) => {
              const ov = builtinOverrides[r.id];
              const globalOv = !isGlobal ? globalOverrides[r.id] : undefined;
              const isEnabled = ov ? ov.enabled !== false : (globalOv ? globalOv.enabled !== false : true);
              const hasOverride = ov && (ov.text || (ov.priority !== undefined && ov.priority !== r.priority));
              const hasGlobalOv = !isGlobal && globalOv && (globalOv.text || (globalOv.priority !== undefined && globalOv.priority !== r.priority) || globalOv.enabled === false);
              const effectivePriority = ov?.priority ?? globalOv?.priority ?? r.priority;
              return (
                <div key={r.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 16px",
                  background: G_ROW,
                  borderBottom: i < BUILTIN_RULE_META.length - 1 ? `1px solid ${G_BORDER}` : "none",
                  opacity: isEnabled ? 1 : 0.4,
                  transition: "opacity 0.2s",
                }}>
                  <Toggle on={isEnabled} onClick={() => toggleBuiltin(r.id)} />
                  <TypeBadge type={ov?.type ?? r.type} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: G_TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ov?.text ? <><span style={{ color: T.amber }}>✎ </span>{ov.text}</> : globalOv?.text ? <><span style={{ color: T.blue }}>🌐 </span>{globalOv.text}</> : r.defaultText}
                    </div>
                    {hasGlobalOv && !ov && (
                      <div style={{ fontSize: 11, color: T.blue, marginTop: 2 }}>מושפע מהגדרה גלובלית</div>
                    )}
                  </div>
                  <PrioBadge priority={effectivePriority} highlight={!!hasOverride || !!hasGlobalOv} />
                  <GBtn onClick={() => startEditBuiltin(r.id)} title="עריכה">✏️</GBtn>
                  {hasOverride && (
                    <button onClick={() => resetBuiltin(r.id)} title="אפס לברירת מחדל" style={{
                      background: "transparent", border: "none", color: G_MUTED,
                      fontSize: 16, cursor: "pointer", padding: "2px 4px", flexShrink: 0,
                    }}>↺</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Custom rules section */}
        <div style={{ marginTop: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: G_MUTED, marginBottom: 10 }}>
            כללים מותאמים אישית
          </div>
          {loading ? (
            <div style={{ color: G_MUTED, fontSize: 13, padding: "16px 0" }}>טוען...</div>
          ) : rules.length === 0 ? (
            <div style={{
              borderRadius: 14, border: `1px dashed ${G_BORDER}`,
              padding: "32px 24px", textAlign: "center", color: G_MUTED, fontSize: 13,
            }}>
              אין כללים מותאמים עדיין — לחץ &quot;+ כלל חדש&quot; להוסיף
            </div>
          ) : (
            <div style={{ borderRadius: 14, overflow: "hidden", border: `1px solid ${G_BORDER}`, display: "flex", flexDirection: "column", gap: 6 }}>
              {rules.map((rule, i) => (
                <div key={rule.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 16px",
                  background: G_ROW,
                  borderBottom: i < rules.length - 1 ? `1px solid ${G_BORDER}` : "none",
                  opacity: rule.enabled ? 1 : 0.4,
                  transition: "opacity 0.2s",
                }}>
                  <Toggle on={rule.enabled} onClick={() => toggleEnabled(rule)} />
                  <TypeBadge type={rule.type} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: G_TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {rule.label || rule.text}
                    </div>
                    <div style={{ fontSize: 11, color: G_MUTED, marginTop: 2 }}>
                      {rule.conditions.map((c, ci) => (
                        <span key={ci}>{ci > 0 ? " ו-" : ""}{c.field} {c.operator} {c.value}</span>
                      ))}
                      {rule.stopAfterMinutes ? ` · עוצר אחרי ${rule.stopAfterMinutes}ד'` : ""}
                      {rule.fireOnce ? " · פעם אחת בלבד" : ""}
                    </div>
                  </div>
                  <PrioBadge priority={rule.priority} highlight />
                  <GBtn onClick={() => startEdit(rule)} title="עריכה">✏️</GBtn>
                  <GBtn onClick={() => deleteRule(rule.id)} color={T.red}>מחיקה</GBtn>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Builtin edit modal ─────────────────────────────────────────────── */}
      {editBuiltinId && (() => {
        const meta = BUILTIN_RULE_META.find(r => r.id === editBuiltinId)!;
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
            <div style={{ background: "rgba(18,18,30,0.97)", border: `1px solid ${G_BORDER_B}`, borderRadius: 16, padding: 28, width: "100%", maxWidth: 580, maxHeight: "92vh", overflowY: "auto", direction: "rtl" }}>
              <h2 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 800, color: G_TEXT }}>עריכת כלל מובנה</h2>
              <p style={{ margin: "0 0 20px", fontSize: 12, color: G_MUTED }}>{meta.defaultText}</p>

              <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: G_MUTED, marginBottom: 4 }}>סוג</label>
                  <select value={builtinForm.type} onChange={e => setBuiltinForm(f => ({ ...f, type: e.target.value as InsightType }))} style={{ ...INP }}>
                    <option value="alert">🔴 התראה</option>
                    <option value="tip">🟡 עצה</option>
                    <option value="info">🔵 מידע</option>
                  </select>
                </div>
                <div style={{ width: 110 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: G_MUTED, marginBottom: 4 }}>עדיפות</label>
                  <input type="number" min={1} max={200} value={builtinForm.priority} onChange={e => setBuiltinForm(f => ({ ...f, priority: Number(e.target.value) }))} style={{ ...INP, boxSizing: "border-box" }} />
                </div>
              </div>

              <div style={{ fontSize: 12, color: G_MUTED, marginBottom: 8, fontWeight: 600 }}>
                תנאים <span style={{ fontWeight: 400, fontSize: 11 }}>· שינוי מחליף את הלוגיקה המובנית</span>
              </div>
              {builtinForm.conditions.map((c, i) => (
                <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
                  <select value={c.field} onChange={e => updateBuiltinCond(i, { field: e.target.value as Condition["field"] })} style={{ ...INP, flex: 1 }}>
                    {ALL_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                  <select value={c.operator} onChange={e => updateBuiltinCond(i, { operator: e.target.value as Condition["operator"] })} style={{ ...INP, flex: 1 }}>
                    {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <input value={c.value} onChange={e => updateBuiltinCond(i, { value: e.target.value })} style={{ ...INP, width: 80 }} placeholder="ערך" />
                  {builtinForm.conditions.length > 1 && (
                    <button onClick={() => removeBuiltinCond(i)} style={{ background: "none", border: "none", color: T.red, fontSize: 14, cursor: "pointer", padding: "4px 6px" }}>✕</button>
                  )}
                </div>
              ))}
              <button onClick={addBuiltinCond} style={{ ...INP, width: "auto", fontSize: 12, marginBottom: 16, cursor: "pointer", padding: "6px 14px" }}>+ הוסף תנאי</button>

              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: G_MUTED, marginBottom: 4 }}>
                טקסט מותאם <span style={{ fontWeight: 400 }}>(ריק = ברירת מחדל)</span>
              </label>
              <input value={builtinForm.text} onChange={e => setBuiltinForm(f => ({ ...f, text: e.target.value }))} placeholder={meta.defaultText} style={{ ...INP, marginBottom: 6, boxSizing: "border-box" }} />
              <div style={{ fontSize: 11, color: G_MUTED, marginBottom: 24 }}>
                משתנים: {"{tableNum}"} {"{minutesSitting}"} {"{guests}"} {"{orderStatus}"} {"{totalAmount}"} {"{minutesSinceLastOrder}"} {"{minutesSinceBillRequested}"}
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={builtinForm.fireOnce} onChange={e => setBuiltinForm(f => ({ ...f, fireOnce: e.target.checked }))} style={{ width: 15, height: 15, cursor: "pointer" }} />
                  <span style={{ fontSize: 13, color: G_TEXT, fontWeight: 600 }}>הצג פעם אחת בלבד לכל ישיבה</span>
                  <span style={{ fontSize: 11, color: G_MUTED }}>(מתאפס כשהשולחן מתפנה)</span>
                </label>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={saveBuiltin} style={{ background: T.amber, border: "none", borderRadius: 8, color: "#000", fontSize: 13, fontWeight: 700, padding: "8px 20px", cursor: "pointer" }}>שמור</button>
                <button onClick={() => setEditBuiltinId(null)} style={{ ...INP, width: "auto", fontSize: 13, cursor: "pointer", padding: "8px 16px" }}>ביטול</button>
                <button onClick={() => { resetBuiltin(editBuiltinId); setEditBuiltinId(null); }} style={{ background: "transparent", border: "none", color: G_MUTED, fontSize: 13, cursor: "pointer", marginRight: "auto", padding: "8px 0" }}>
                  ↺ אפס לברירת מחדל
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── Custom rule add/edit modal ─────────────────────────────────────── */}
      {editId !== null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: "rgba(18,18,30,0.97)", border: `1px solid ${G_BORDER_B}`, borderRadius: 16, padding: 28, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", direction: "rtl" }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 17, fontWeight: 800, color: G_TEXT }}>
              {editId === "new" ? "כלל חדש" : "עריכת כלל"}
            </h2>

            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: G_MUTED, marginBottom: 4 }}>שם הכלל</label>
            <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="תיאור קצר של הכלל..." style={{ ...INP, marginBottom: 16, boxSizing: "border-box" }} />

            <div style={{ fontSize: 12, color: G_MUTED, marginBottom: 8, fontWeight: 600 }}>תנאים (כולם חייבים להתקיים)</div>
            {form.conditions.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
                <select value={c.field} onChange={e => updateCond(i, { field: e.target.value as Condition["field"] })} style={{ ...INP, flex: 1 }}>
                  {FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                <select value={c.operator} onChange={e => updateCond(i, { operator: e.target.value as Condition["operator"] })} style={{ ...INP, flex: 1 }}>
                  {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input value={c.value} onChange={e => updateCond(i, { value: e.target.value })} style={{ ...INP, width: 80 }} placeholder="ערך" />
                {form.conditions.length > 1 && (
                  <button onClick={() => removeCond(i)} style={{ background: "none", border: "none", color: T.red, fontSize: 14, cursor: "pointer", padding: "4px 6px" }}>✕</button>
                )}
              </div>
            ))}
            <button onClick={addCond} style={{ ...INP, width: "auto", fontSize: 12, marginBottom: 16, cursor: "pointer", padding: "6px 14px" }}>+ הוסף תנאי</button>

            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: G_MUTED, marginBottom: 4 }}>סוג</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as InsightType }))} style={{ ...INP }}>
                  <option value="alert">🔴 התראה</option>
                  <option value="tip">🟡 עצה</option>
                  <option value="info">🔵 מידע</option>
                </select>
              </div>
              <div style={{ width: 110 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: G_MUTED, marginBottom: 4 }}>עדיפות (1–100)</label>
                <input type="number" min={1} max={100} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))} style={{ ...INP, boxSizing: "border-box" }} />
              </div>
            </div>

            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: G_MUTED, marginBottom: 4 }}>טקסט התובנה</label>
            <div style={{ fontSize: 11, color: G_MUTED, marginBottom: 6 }}>
              משתנים: {"{tableNum}"} {"{minutesSitting}"} {"{guests}"} {"{seats}"} {"{orderStatus}"} {"{totalAmount}"} {"{orderCount}"} {"{minutesSinceLastOrder}"}
            </div>
            <input value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))} placeholder="שולחן {tableNum} — ..." style={{ ...INP, marginBottom: 16, boxSizing: "border-box" }} />

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: G_MUTED, marginBottom: 4 }}>
                עצור לאחר X דקות ישיבה <span style={{ fontWeight: 400 }}>(אופציונלי)</span>
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="number" min={1} placeholder="למשל 120" value={form.stopAfterMinutes ?? ""} onChange={e => setForm(f => ({ ...f, stopAfterMinutes: e.target.value ? Number(e.target.value) : undefined }))} style={{ ...INP, width: 120 }} />
                <span style={{ fontSize: 12, color: G_MUTED }}>התובנה לא תופיע לאחר X דקות</span>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: G_MUTED, marginBottom: 4 }}>
                עצור כאשר <span style={{ fontWeight: 400 }}>(אופציונלי)</span>
              </label>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <select value={form.stopTrigger?.field ?? ""} onChange={e => setForm(f => ({ ...f, stopTrigger: e.target.value ? { field: e.target.value as Condition["field"], operator: f.stopTrigger?.operator ?? "eq", value: f.stopTrigger?.value ?? "" } : undefined }))} style={{ ...INP, minWidth: 160 }}>
                  <option value="">-- ללא --</option>
                  {FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                {form.stopTrigger && (
                  <>
                    <select value={form.stopTrigger.operator} onChange={e => setForm(f => ({ ...f, stopTrigger: f.stopTrigger ? { ...f.stopTrigger, operator: e.target.value as Condition["operator"] } : undefined }))} style={{ ...INP, minWidth: 120 }}>
                      {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <input value={form.stopTrigger.value} onChange={e => setForm(f => ({ ...f, stopTrigger: f.stopTrigger ? { ...f.stopTrigger, value: e.target.value } : undefined }))} style={{ ...INP, width: 90 }} placeholder="ערך" />
                  </>
                )}
              </div>
              <div style={{ fontSize: 11, color: G_MUTED, marginTop: 4 }}>
                התובנה לא תופיע כאשר תנאי זה מתקיים (למשל: סטטוס שולחן = free)
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={form.fireOnce ?? false} onChange={e => setForm(f => ({ ...f, fireOnce: e.target.checked || undefined }))} style={{ width: 15, height: 15, cursor: "pointer" }} />
                <span style={{ fontSize: 13, color: G_TEXT, fontWeight: 600 }}>הצג פעם אחת בלבד לכל ישיבה</span>
                <span style={{ fontSize: 11, color: G_MUTED }}>(מתאפס כשהשולחן מתפנה ולקוחות חדשים מגיעים)</span>
              </label>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={save} disabled={saving || !form.text.trim()} style={{ background: T.amber, border: "none", borderRadius: 8, color: "#000", fontSize: 13, fontWeight: 700, padding: "9px 22px", cursor: "pointer", opacity: saving || !form.text.trim() ? 0.5 : 1 }}>
                {saving ? "שומר..." : "שמור"}
              </button>
              <button onClick={() => setEditId(null)} style={{ ...INP, width: "auto", fontSize: 13, cursor: "pointer", padding: "9px 18px" }}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
