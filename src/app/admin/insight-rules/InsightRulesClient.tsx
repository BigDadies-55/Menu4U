"use client";
import React, { useState, useEffect, useCallback } from "react";
import { T } from "@/lib/ui";
import type { CustomRule, Condition, InsightType, BuiltinRuleOverride, BuiltinRuleOverrides } from "@/lib/waiter-insights";
import { BUILTIN_RULE_META } from "@/lib/waiter-insights";

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
const TYPE_COLOR: Record<InsightType, string> = {
  alert: T.red,
  tip:   T.orange ?? "#f97316",
  info:  T.blue,
};
const TYPE_LABEL: Record<InsightType, string> = { alert: "🔴 התראה", tip: "🟡 עצה", info: "🔵 מידע" };

const EMPTY_RULE: Omit<CustomRule, "id"> = {
  label: "",
  enabled: true,
  conditions: [{ field: "minutesSitting", operator: "gt", value: 60 }],
  type: "tip",
  text: "שולחן {tableNum} — ",
  priority: 60,
};

const INP: React.CSSProperties = {
  background: T.panel, border: `1px solid ${T.border}`, borderRadius: 7,
  color: T.text, fontSize: 13, padding: "6px 10px", outline: "none", direction: "rtl",
};

const GLOBAL_ID = "GLOBAL";

export default function InsightRulesClient({ restaurants, isSuperAdmin }: { restaurants: { id: string; name: string }[]; isSuperAdmin?: boolean }) {
  const [rid, setRid]                   = useState(restaurants[0]?.id ?? "");
  const [rules, setRules]               = useState<CustomRule[]>([]);
  const [builtinOverrides, setBuiltinOverrides] = useState<BuiltinRuleOverrides>({});
  const [globalOverrides, setGlobalOverrides]   = useState<BuiltinRuleOverrides>({});
  const isGlobal = rid === GLOBAL_ID;
  const [loading, setLoading]           = useState(false);
  const [saving, setSaving]             = useState(false);
  const [editId, setEditId]             = useState<string | "new" | null>(null);
  const [form, setForm]                 = useState<Omit<CustomRule, "id">>(EMPTY_RULE);
  const [editBuiltinId, setEditBuiltinId] = useState<string | null>(null);
  const [builtinForm, setBuiltinForm]   = useState<{ text: string; priority: number }>({ text: "", priority: 0 });
  const [toast, setToast]               = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

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
        const r = await fetch("/api/admin/insight-rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ restaurantId: rid, rule: form }),
        });
        const d = await r.json();
        setRules(prev => [...prev, d.rule]);
        showToast("כלל נוסף בהצלחה");
      } else {
        const r = await fetch("/api/admin/insight-rules", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ restaurantId: rid, rule: { ...form, id: editId } }),
        });
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
    const r = await fetch("/api/admin/insight-rules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId: rid, ruleId, override }),
    });
    const d = await r.json();
    setBuiltinOverrides(d.builtinOverrides ?? {});
  }

  async function toggleBuiltin(ruleId: string) {
    const cur = builtinOverrides[ruleId];
    const nowEnabled = cur ? !cur.enabled : false; // default=true → first toggle disables
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
    setBuiltinForm({ text: ov?.text ?? "", priority: ov?.priority ?? meta.priority });
    setEditBuiltinId(ruleId);
  }

  async function saveBuiltin() {
    if (!editBuiltinId) return;
    const cur = builtinOverrides[editBuiltinId];
    await patchBuiltin(editBuiltinId, {
      enabled: cur?.enabled ?? true,
      text: builtinForm.text.trim() || undefined,
      priority: builtinForm.priority,
    });
    setEditBuiltinId(null);
    showToast("כלל עודכן");
  }

  async function toggleEnabled(rule: CustomRule) {
    const updated = { ...rule, enabled: !rule.enabled };
    await fetch("/api/admin/insight-rules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId: rid, rule: updated }),
    });
    setRules(prev => prev.map(r => r.id === rule.id ? updated : r));
  }

  function startEdit(rule: CustomRule) {
    setForm({ label: rule.label, enabled: rule.enabled, conditions: rule.conditions, type: rule.type, text: rule.text, priority: rule.priority });
    setEditId(rule.id);
  }

  function startNew() {
    setForm(EMPTY_RULE);
    setEditId("new");
  }

  function updateCond(i: number, patch: Partial<Condition>) {
    setForm(f => ({ ...f, conditions: f.conditions.map((c, ci) => ci === i ? { ...c, ...patch } : c) }));
  }
  function addCond() {
    setForm(f => ({ ...f, conditions: [...f.conditions, { field: "minutesSitting", operator: "gt", value: 30 }] }));
  }
  function removeCond(i: number) {
    setForm(f => ({ ...f, conditions: f.conditions.filter((_, ci) => ci !== i) }));
  }

  return (
    <div style={{ direction: "rtl", fontFamily: T.fontSans, color: T.text, maxWidth: 860, margin: "0 auto", padding: "32px 24px" }}>
      {toast && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          background: T.green, color: "#fff", borderRadius: 10, padding: "10px 22px",
          fontSize: 14, fontWeight: 700, zIndex: 9999, boxShadow: "0 4px 18px rgba(0,0,0,0.3)",
        }}>{toast}</div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>כללי תובנות AI</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 3 }}>
            הגדר כללים מותאמים שיופיעו בנוסף לכללים המובנים בכל מסך שירות
          </div>
        </div>
        <span style={{ flex: 1 }} />
        <select value={rid} onChange={e => setRid(e.target.value)} style={{ ...INP, width: "auto" }}>
          {isSuperAdmin && <option value={GLOBAL_ID}>🌐 גלובלי — כל המסעדות</option>}
          {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <button onClick={startNew} disabled={isGlobal} style={{
          background: T.gold, border: "none", borderRadius: 8,
          color: "#fff", fontWeight: 700, fontSize: 13, padding: "8px 16px", cursor: "pointer",
        }}>
          + כלל חדש
        </button>
      </div>

      {/* Built-in rules — now editable */}
      <section style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted }}>
            כללים מובנים — ניתן להשבית, לשנות טקסט ועדיפות
          </div>
          {isGlobal && (
            <span style={{ fontSize: 11, background: "#3b82f622", color: "#60a5fa", borderRadius: 6, padding: "2px 8px" }}>
              🌐 שינויים יחולו על כל המסעדות
            </span>
          )}
          {!isGlobal && (
            <span style={{ fontSize: 11, color: T.muted }}>
              שינויים למסעדה זו בלבד · override גלובלי מסומן 🌐
            </span>
          )}
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
          {BUILTIN_RULE_META.map((r, i) => {
            const ov = builtinOverrides[r.id];
            const globalOv = !isGlobal ? globalOverrides[r.id] : undefined;
            const isEnabled = ov ? ov.enabled !== false : (globalOv ? globalOv.enabled !== false : true);
            const hasOverride = ov && (ov.text || (ov.priority !== undefined && ov.priority !== r.priority));
            const hasGlobalOv = !isGlobal && globalOv && (globalOv.text || (globalOv.priority !== undefined && globalOv.priority !== r.priority) || globalOv.enabled === false);
            return (
              <div key={r.id} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
                borderBottom: i < BUILTIN_RULE_META.length - 1 ? `1px solid ${T.borderSub}` : "none",
                opacity: isEnabled ? 1 : 0.45,
              }}>
                {/* Toggle */}
                <button onClick={() => toggleBuiltin(r.id)} title={isEnabled ? "השבת" : "הפעל"} style={{
                  width: 32, height: 18, borderRadius: 9, border: "none", cursor: "pointer",
                  background: isEnabled ? T.green : T.border, flexShrink: 0, position: "relative", transition: "background 0.2s",
                }}>
                  <span style={{
                    position: "absolute", top: 2, width: 14, height: 14, borderRadius: "50%",
                    background: "#fff", transition: "left 0.2s", left: isEnabled ? 16 : 2,
                  }} />
                </button>

                <span style={{ fontSize: 11, fontWeight: 700, color: TYPE_COLOR[r.type], minWidth: 56, flexShrink: 0 }}>
                  {TYPE_LABEL[r.type]}
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: T.text }}>
                    {ov?.text
                      ? <><span style={{ color: T.gold }}>✎ </span>{ov.text}</>
                      : globalOv?.text
                        ? <><span style={{ color: "#60a5fa" }}>🌐 </span>{globalOv.text}</>
                        : r.defaultText
                    }
                  </div>
                  {hasGlobalOv && !ov && (
                    <div style={{ fontSize: 11, color: "#60a5fa", marginTop: 2 }}>מושפע מהגדרה גלובלית</div>
                  )}
                </div>

                <span style={{ fontSize: 11, color: hasOverride ? T.gold : hasGlobalOv ? "#60a5fa" : T.muted, flexShrink: 0 }}>
                  עדיפות {ov?.priority ?? globalOv?.priority ?? r.priority}{hasOverride ? " *" : hasGlobalOv && !ov ? " 🌐" : ""}
                </span>

                <button onClick={() => startEditBuiltin(r.id)} style={{
                  background: T.panel, border: `1px solid ${T.border}`, borderRadius: 6,
                  color: T.sub, fontSize: 12, padding: "3px 8px", cursor: "pointer", flexShrink: 0,
                }}>
                  עריכה
                </button>
                {hasOverride && (
                  <button onClick={() => resetBuiltin(r.id)} title="אפס לברירת מחדל" style={{
                    background: "transparent", border: "none", color: T.muted, fontSize: 13,
                    cursor: "pointer", padding: "3px 4px", flexShrink: 0,
                  }}>↺</button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Builtin edit modal */}
      {editBuiltinId && (() => {
        const meta = BUILTIN_RULE_META.find(r => r.id === editBuiltinId)!;
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)" }}>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 28, width: "min(500px,94vw)", direction: "rtl" }}>
              <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>עריכת כלל מובנה</div>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 20 }}>{meta.defaultText}</div>

              <label style={{ display: "block", fontSize: 12, color: T.muted, marginBottom: 4 }}>
                טקסט מותאם <span style={{ color: T.muted }}>(ריק = ברירת מחדל)</span>
              </label>
              <input value={builtinForm.text}
                onChange={e => setBuiltinForm(f => ({ ...f, text: e.target.value }))}
                placeholder={meta.defaultText}
                style={{ ...INP, width: "100%", marginBottom: 16, boxSizing: "border-box" }} />
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 16 }}>
                משתנים: {"{tableNum}"} {"{minutesSitting}"} {"{guests}"} {"{minutesSinceLastOrder}"} {"{minutesSinceBillRequested}"}
              </div>

              <label style={{ display: "block", fontSize: 12, color: T.muted, marginBottom: 4 }}>עדיפות</label>
              <input type="number" min={1} max={200} value={builtinForm.priority}
                onChange={e => setBuiltinForm(f => ({ ...f, priority: Number(e.target.value) }))}
                style={{ ...INP, width: 100, marginBottom: 20 }} />

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={saveBuiltin} style={{
                  background: T.gold, border: "none", borderRadius: 8,
                  color: "#fff", fontWeight: 700, fontSize: 13, padding: "9px 20px", cursor: "pointer",
                }}>שמור</button>
                <button onClick={() => setEditBuiltinId(null)} style={{
                  background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8,
                  color: T.sub, fontSize: 13, padding: "9px 16px", cursor: "pointer",
                }}>ביטול</button>
                <button onClick={() => { resetBuiltin(editBuiltinId); setEditBuiltinId(null); }} style={{
                  background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8,
                  color: T.muted, fontSize: 13, padding: "9px 16px", cursor: "pointer", marginRight: "auto",
                }}>↺ אפס לברירת מחדל</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Custom rules */}
      <section style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted, marginBottom: 10 }}>
          כללים מותאמים אישית
        </div>
        {loading ? (
          <div style={{ color: T.muted, fontSize: 13 }}>טוען...</div>
        ) : rules.length === 0 ? (
          <div style={{ background: T.surface, border: `1px dashed ${T.border}`, borderRadius: 12, padding: "24px 20px", textAlign: "center", color: T.muted, fontSize: 13 }}>
            אין כללים מותאמים עדיין — לחץ "+ כלל חדש" להוסיף
          </div>
        ) : (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
            {rules.map((rule, i) => (
              <div key={rule.id} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                borderBottom: i < rules.length - 1 ? `1px solid ${T.borderSub}` : "none",
                opacity: rule.enabled ? 1 : 0.5,
              }}>
                {/* Toggle */}
                <button onClick={() => toggleEnabled(rule)} style={{
                  width: 32, height: 18, borderRadius: 9, border: "none", cursor: "pointer",
                  background: rule.enabled ? T.green : T.border,
                  flexShrink: 0, position: "relative", transition: "background 0.2s",
                }}>
                  <span style={{
                    position: "absolute", top: 2, width: 14, height: 14, borderRadius: "50%",
                    background: "#fff", transition: "left 0.2s",
                    left: rule.enabled ? 16 : 2,
                  }} />
                </button>

                <span style={{ fontSize: 11, fontWeight: 700, color: TYPE_COLOR[rule.type], minWidth: 60 }}>
                  {TYPE_LABEL[rule.type]}
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{rule.label || rule.text}</div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                    {rule.conditions.map((c, ci) => (
                      <span key={ci}>{ci > 0 ? " ו-" : ""}{c.field} {c.operator} {c.value}</span>
                    ))}
                    {" · "} עדיפות {rule.priority}
                  </div>
                </div>

                <button onClick={() => startEdit(rule)} style={{
                  background: T.panel, border: `1px solid ${T.border}`, borderRadius: 6,
                  color: T.sub, fontSize: 12, padding: "4px 10px", cursor: "pointer",
                }}>
                  עריכה
                </button>
                <button onClick={() => deleteRule(rule.id)} style={{
                  background: T.redSub, border: `1px solid ${T.red}44`, borderRadius: 6,
                  color: T.red, fontSize: 12, padding: "4px 10px", cursor: "pointer",
                }}>
                  מחיקה
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add / Edit form */}
      {editId !== null && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 500,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.6)",
        }}>
          <div style={{
            background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16,
            padding: 28, width: "min(560px,94vw)", maxHeight: "90vh", overflowY: "auto",
            direction: "rtl",
          }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 20 }}>
              {editId === "new" ? "כלל חדש" : "עריכת כלל"}
            </div>

            {/* Label */}
            <label style={{ display: "block", fontSize: 12, color: T.muted, marginBottom: 4 }}>שם הכלל</label>
            <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="תיאור קצר של הכלל..."
              style={{ ...INP, width: "100%", marginBottom: 16, boxSizing: "border-box" }} />

            {/* Conditions */}
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>תנאים (כולם חייבים להתקיים)</div>
            {form.conditions.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
                <select value={c.field} onChange={e => updateCond(i, { field: e.target.value as Condition["field"] })}
                  style={{ ...INP, flex: 1 }}>
                  {FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                <select value={c.operator} onChange={e => updateCond(i, { operator: e.target.value as Condition["operator"] })}
                  style={{ ...INP, flex: 1 }}>
                  {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input value={c.value} onChange={e => updateCond(i, { value: e.target.value })}
                  style={{ ...INP, width: 80 }} placeholder="ערך" />
                {form.conditions.length > 1 && (
                  <button onClick={() => removeCond(i)} style={{
                    background: T.redSub, border: `1px solid ${T.red}44`, borderRadius: 6,
                    color: T.red, fontSize: 13, padding: "5px 9px", cursor: "pointer", flexShrink: 0,
                  }}>✕</button>
                )}
              </div>
            ))}
            <button onClick={addCond} style={{
              background: T.panel, border: `1px solid ${T.border}`, borderRadius: 7,
              color: T.sub, fontSize: 12, padding: "5px 12px", cursor: "pointer", marginBottom: 16,
            }}>
              + הוסף תנאי
            </button>

            {/* Type + Priority row */}
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: T.muted, marginBottom: 4 }}>סוג</div>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as InsightType }))}
                  style={{ ...INP, width: "100%" }}>
                  <option value="alert">🔴 התראה (alert)</option>
                  <option value="tip">🟡 עצה (tip)</option>
                  <option value="info">🔵 מידע (info)</option>
                </select>
              </div>
              <div style={{ width: 100 }}>
                <div style={{ fontSize: 12, color: T.muted, marginBottom: 4 }}>עדיפות (1–100)</div>
                <input type="number" min={1} max={100} value={form.priority}
                  onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))}
                  style={{ ...INP, width: "100%", boxSizing: "border-box" }} />
              </div>
            </div>

            {/* Text template */}
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 4 }}>
              טקסט התובנה
              <span style={{ color: T.muted, marginRight: 8, fontSize: 11 }}>
                משתנים: {"{tableNum}"} {"{minutesSitting}"} {"{guests}"} {"{seats}"} {"{orderStatus}"} {"{totalAmount}"} {"{orderCount}"} {"{minutesSinceLastOrder}"}
              </span>
            </div>
            <input value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
              placeholder="שולחן {tableNum} — ..."
              style={{ ...INP, width: "100%", marginBottom: 20, boxSizing: "border-box" }} />

            {/* Buttons */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-start" }}>
              <button onClick={save} disabled={saving || !form.text.trim()} style={{
                background: T.gold, border: "none", borderRadius: 8,
                color: "#fff", fontWeight: 700, fontSize: 13, padding: "9px 20px", cursor: "pointer",
                opacity: saving || !form.text.trim() ? 0.5 : 1,
              }}>
                {saving ? "שומר..." : "שמור"}
              </button>
              <button onClick={() => setEditId(null)} style={{
                background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8,
                color: T.sub, fontSize: 13, padding: "9px 16px", cursor: "pointer",
              }}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
