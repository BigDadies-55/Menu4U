"use client";
import React, { useState, useEffect, useCallback } from "react";
import { T, btn, btnGhost, inp, card, badge, heading, label as labelStyle, backdrop, modal } from "@/lib/ui";
import type { CustomRule, Condition, InsightType, BuiltinRuleOverride, BuiltinRuleOverrides } from "@/lib/waiter-insights";
import { BUILTIN_RULE_META } from "@/lib/waiter-insights";

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

// ─── shared input style — design-system inp token + RTL ─────────────────────
const INP: React.CSSProperties = { ...inp, direction: "rtl" };

// ─── section label ───────────────────────────────────────────────────────────
const sectionLabel: React.CSSProperties = {
  fontSize:      T.fxs,
  fontWeight:    800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color:         T.muted,
  marginBottom:  10,
};

const GLOBAL_ID = "GLOBAL";

export default function InsightRulesClient({ restaurants, isSuperAdmin }: { restaurants: { id: string; name: string }[]; isSuperAdmin?: boolean }) {
  const [rid, setRid]                   = useState(isSuperAdmin ? GLOBAL_ID : (restaurants[0]?.id ?? ""));
  const [rules, setRules]               = useState<CustomRule[]>([]);
  const [builtinOverrides, setBuiltinOverrides] = useState<BuiltinRuleOverrides>({});
  const [globalOverrides, setGlobalOverrides]   = useState<BuiltinRuleOverrides>({});
  const isGlobal = rid === GLOBAL_ID;
  const [loading, setLoading]           = useState(false);
  const [saving, setSaving]             = useState(false);
  const [editId, setEditId]             = useState<string | "new" | null>(null);
  const [form, setForm]                 = useState<Omit<CustomRule, "id">>(EMPTY_RULE);
  const [editBuiltinId, setEditBuiltinId] = useState<string | null>(null);
  const [builtinForm, setBuiltinForm]   = useState<{ text: string; priority: number; type: InsightType; conditions: Condition[] }>({ text: "", priority: 0, type: "alert", conditions: [] });
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
    setBuiltinForm({
      text:       ov?.text ?? "",
      priority:   ov?.priority ?? meta.priority,
      type:       ov?.type ?? meta.type,
      conditions: ov?.conditions ? [...ov.conditions] : [...meta.defaultConditions],
    });
    setEditBuiltinId(ruleId);
  }

  function updateBuiltinCond(i: number, patch: Partial<Condition>) {
    setBuiltinForm(f => ({ ...f, conditions: f.conditions.map((c, ci) => ci === i ? { ...c, ...patch } : c) }));
  }
  function addBuiltinCond() {
    setBuiltinForm(f => ({ ...f, conditions: [...f.conditions, { field: "minutesSitting", operator: "gte", value: 30 }] }));
  }
  function removeBuiltinCond(i: number) {
    setBuiltinForm(f => ({ ...f, conditions: f.conditions.filter((_, ci) => ci !== i) }));
  }

  async function saveBuiltin() {
    if (!editBuiltinId) return;
    const meta = BUILTIN_RULE_META.find(r => r.id === editBuiltinId)!;
    const cur = builtinOverrides[editBuiltinId];
    const condsChanged = JSON.stringify(builtinForm.conditions) !== JSON.stringify(meta.defaultConditions);
    await patchBuiltin(editBuiltinId, {
      enabled:    cur?.enabled ?? true,
      text:       builtinForm.text.trim() || undefined,
      priority:   builtinForm.priority,
      type:       builtinForm.type !== meta.type ? builtinForm.type : undefined,
      conditions: condsChanged ? builtinForm.conditions : undefined,
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
    setForm({ label: rule.label, enabled: rule.enabled, conditions: rule.conditions, type: rule.type, text: rule.text, priority: rule.priority, stopAfterMinutes: rule.stopAfterMinutes, stopTrigger: rule.stopTrigger, fireOnce: rule.fireOnce });
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
          background: T.green, color: "#fff", borderRadius: T.rMd,
          padding: "10px 22px", fontSize: T.fmd, fontWeight: 700,
          zIndex: 9999, boxShadow: "0 4px 18px rgba(0,0,0,0.3)",
        }}>{toast}</div>
      )}

      {/* Page header */}
      <div style={{
        display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 32,
        paddingBottom: 24, borderBottom: `1px solid ${T.border}`,
      }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ ...heading, margin: 0 }}>כללי תובנות AI</h1>
          <p style={{ fontSize: T.fmd, color: T.muted, marginTop: 4, marginBottom: 0 }}>
            הגדר כללים מותאמים שיופיעו בנוסף לכללים המובנים בכל מסך שירות
          </p>
        </div>
        <select value={rid} onChange={e => setRid(e.target.value)} style={{ ...INP, width: "auto", minWidth: 170 }}>
          {isSuperAdmin && <option value={GLOBAL_ID}>🌐 גלובלי — כל המסעדות</option>}
          {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <button onClick={startNew} disabled={isGlobal} style={{ ...btn("primary"), opacity: isGlobal ? 0.4 : 1 }}>
          + כלל חדש
        </button>
      </div>

      {/* Built-in rules */}
      <section style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <div style={sectionLabel}>כללים מובנים — ניתן להשבית, לשנות טקסט ועדיפות</div>
          {isGlobal && (
            <span style={{ ...badge(T.blue), fontSize: T.fxs }}>
              🌐 שינויים יחולו על כל המסעדות
            </span>
          )}
          {!isGlobal && (
            <span style={{ fontSize: T.fxs, color: T.muted }}>
              שינויים למסעדה זו בלבד · override גלובלי מסומן 🌐
            </span>
          )}
        </div>
        <div style={{ ...card(), overflow: "hidden" }}>
          {BUILTIN_RULE_META.map((r, i) => {
            const ov = builtinOverrides[r.id];
            const globalOv = !isGlobal ? globalOverrides[r.id] : undefined;
            const isEnabled = ov ? ov.enabled !== false : (globalOv ? globalOv.enabled !== false : true);
            const hasOverride = ov && (ov.text || (ov.priority !== undefined && ov.priority !== r.priority));
            const hasGlobalOv = !isGlobal && globalOv && (globalOv.text || (globalOv.priority !== undefined && globalOv.priority !== r.priority) || globalOv.enabled === false);
            return (
              <div key={r.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: `${T.p3}px ${T.p4}px`,
                borderBottom: i < BUILTIN_RULE_META.length - 1 ? `1px solid ${T.borderSub}` : "none",
                opacity: isEnabled ? 1 : 0.45,
                transition: "opacity 0.2s",
              }}>
                <button onClick={() => toggleBuiltin(r.id)} title={isEnabled ? "השבת" : "הפעל"} style={{
                  width: 32, height: 18, borderRadius: T.rFull, border: "none", cursor: "pointer",
                  background: isEnabled ? T.green : T.border,
                  flexShrink: 0, position: "relative", transition: "background 0.2s",
                }}>
                  <span style={{
                    position: "absolute", top: 2, width: 14, height: 14, borderRadius: "50%",
                    background: "#fff", transition: "left 0.2s", left: isEnabled ? 16 : 2,
                  }} />
                </button>

                <span style={{ ...badge(TYPE_COLOR[r.type]), minWidth: 68, textAlign: "center", flexShrink: 0 }}>
                  {TYPE_LABEL[r.type]}
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: T.fmd, color: T.text }}>
                    {ov?.text
                      ? <><span style={{ color: T.gold }}>✎ </span>{ov.text}</>
                      : globalOv?.text
                        ? <><span style={{ color: T.blue }}>🌐 </span>{globalOv.text}</>
                        : r.defaultText
                    }
                  </div>
                  {hasGlobalOv && !ov && (
                    <div style={{ fontSize: T.fsm, color: T.blue, marginTop: 2 }}>מושפע מהגדרה גלובלית</div>
                  )}
                </div>

                <span style={{ fontSize: T.fsm, color: hasOverride ? T.gold : hasGlobalOv ? T.blue : T.muted, flexShrink: 0 }}>
                  עדיפות {ov?.priority ?? globalOv?.priority ?? r.priority}{hasOverride ? " *" : hasGlobalOv && !ov ? " 🌐" : ""}
                </span>

                <button onClick={() => startEditBuiltin(r.id)} style={btnGhost(T.gold, "sm")}>
                  עריכה
                </button>
                {hasOverride && (
                  <button onClick={() => resetBuiltin(r.id)} title="אפס לברירת מחדל" style={{
                    background: "transparent", border: "none", color: T.muted, fontSize: T.fmd,
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
          <div style={backdrop}>
            <div style={{ ...modal(580), maxHeight: "92vh", overflowY: "auto" }}>
              <h2 style={{ ...heading, fontSize: T.fxl, marginTop: 0, marginBottom: 4 }}>עריכת כלל מובנה</h2>
              <p style={{ fontSize: T.fsm, color: T.muted, marginTop: 0, marginBottom: 20 }}>{meta.defaultText}</p>

              <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ ...labelStyle, display: "block", marginBottom: 4 }}>סוג</label>
                  <select value={builtinForm.type} onChange={e => setBuiltinForm(f => ({ ...f, type: e.target.value as InsightType }))} style={{ ...INP }}>
                    <option value="alert">🔴 התראה (alert)</option>
                    <option value="tip">🟡 עצה (tip)</option>
                    <option value="info">🔵 מידע (info)</option>
                  </select>
                </div>
                <div style={{ width: 110 }}>
                  <label style={{ ...labelStyle, display: "block", marginBottom: 4 }}>עדיפות</label>
                  <input type="number" min={1} max={200} value={builtinForm.priority}
                    onChange={e => setBuiltinForm(f => ({ ...f, priority: Number(e.target.value) }))}
                    style={{ ...INP, boxSizing: "border-box" }} />
                </div>
              </div>

              <div style={{ fontSize: T.fsm, color: T.muted, marginBottom: 8, fontWeight: 600 }}>
                תנאים (כולם חייבים להתקיים)
                <span style={{ fontWeight: 400, fontSize: T.fxs, marginRight: 6 }}>· שינוי תנאים מחליף את הלוגיקה המובנית</span>
              </div>
              {builtinForm.conditions.map((c, i) => (
                <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
                  <select value={c.field} onChange={e => updateBuiltinCond(i, { field: e.target.value as Condition["field"] })} style={{ ...INP, flex: 1 }}>
                    {ALL_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                  <select value={c.operator} onChange={e => updateBuiltinCond(i, { operator: e.target.value as Condition["operator"] })} style={{ ...INP, flex: 1 }}>
                    {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <input value={c.value} onChange={e => updateBuiltinCond(i, { value: e.target.value })}
                    style={{ ...INP, width: 80 }} placeholder="ערך" />
                  {builtinForm.conditions.length > 1 && (
                    <button onClick={() => removeBuiltinCond(i)} style={btnGhost(T.red, "sm")}>✕</button>
                  )}
                </div>
              ))}
              <button onClick={addBuiltinCond} style={{ ...btnGhost(T.muted, "sm"), marginBottom: 16 }}>
                + הוסף תנאי
              </button>

              <label style={{ ...labelStyle, display: "block", marginBottom: 4 }}>
                טקסט מותאם <span style={{ fontWeight: 400, fontSize: T.fxs }}>(ריק = ברירת מחדל)</span>
              </label>
              <input value={builtinForm.text}
                onChange={e => setBuiltinForm(f => ({ ...f, text: e.target.value }))}
                placeholder={meta.defaultText}
                style={{ ...INP, marginBottom: 6, boxSizing: "border-box" }} />
              <div style={{ fontSize: T.fxs, color: T.muted, marginBottom: 24 }}>
                משתנים: {"{tableNum}"} {"{minutesSitting}"} {"{guests}"} {"{orderStatus}"} {"{totalAmount}"} {"{minutesSinceLastOrder}"} {"{minutesSinceBillRequested}"}
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={saveBuiltin} style={btn("primary")}>שמור</button>
                <button onClick={() => setEditBuiltinId(null)} style={btn("ghost")}>ביטול</button>
                <button onClick={() => { resetBuiltin(editBuiltinId); setEditBuiltinId(null); }} style={{ ...btn("ghost"), marginRight: "auto" }}>
                  ↺ אפס לברירת מחדל
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Custom rules */}
      <section style={{ marginBottom: 32 }}>
        <div style={sectionLabel}>כללים מותאמים אישית</div>
        {loading ? (
          <div style={{ color: T.muted, fontSize: T.fmd, padding: `${T.p3}px 0` }}>טוען...</div>
        ) : rules.length === 0 ? (
          <div style={{
            ...card(),
            border: `1px dashed ${T.border}`,
            padding: `${T.p5}px ${T.p4}px`,
            textAlign: "center",
            color: T.muted,
            fontSize: T.fmd,
          }}>
            אין כללים מותאמים עדיין — לחץ &quot;+ כלל חדש&quot; להוסיף
          </div>
        ) : (
          <div style={{ ...card(), overflow: "hidden" }}>
            {rules.map((rule, i) => (
              <div key={rule.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: `${T.p3}px ${T.p4}px`,
                borderBottom: i < rules.length - 1 ? `1px solid ${T.borderSub}` : "none",
                opacity: rule.enabled ? 1 : 0.5,
                transition: "opacity 0.2s",
              }}>
                <button onClick={() => toggleEnabled(rule)} title={rule.enabled ? "השבת" : "הפעל"} style={{
                  width: 32, height: 18, borderRadius: T.rFull, border: "none", cursor: "pointer",
                  background: rule.enabled ? T.green : T.border,
                  flexShrink: 0, position: "relative", transition: "background 0.2s",
                }}>
                  <span style={{
                    position: "absolute", top: 2, width: 14, height: 14, borderRadius: "50%",
                    background: "#fff", transition: "left 0.2s",
                    left: rule.enabled ? 16 : 2,
                  }} />
                </button>

                <span style={{ ...badge(TYPE_COLOR[rule.type]), minWidth: 68, textAlign: "center", flexShrink: 0 }}>
                  {TYPE_LABEL[rule.type]}
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: T.fmd, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {rule.label || rule.text}
                  </div>
                  <div style={{ fontSize: T.fsm, color: T.muted, marginTop: 2 }}>
                    {rule.conditions.map((c, ci) => (
                      <span key={ci}>{ci > 0 ? " ו-" : ""}{c.field} {c.operator} {c.value}</span>
                    ))}
                    {" · "} עדיפות {rule.priority}
                  </div>
                </div>

                <button onClick={() => startEdit(rule)} style={btnGhost(T.gold, "sm")}>
                  עריכה
                </button>
                <button onClick={() => deleteRule(rule.id)} style={btnGhost(T.red, "sm")}>
                  מחיקה
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add / Edit modal */}
      {editId !== null && (
        <div style={backdrop}>
          <div style={{ ...modal(560), maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ ...heading, fontSize: T.fxl, marginTop: 0, marginBottom: 20 }}>
              {editId === "new" ? "כלל חדש" : "עריכת כלל"}
            </h2>

            <label style={{ ...labelStyle, display: "block", marginBottom: 4 }}>שם הכלל</label>
            <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="תיאור קצר של הכלל..."
              style={{ ...INP, marginBottom: 16, boxSizing: "border-box" }} />

            <div style={{ fontSize: T.fsm, color: T.muted, marginBottom: 8, fontWeight: 600 }}>
              תנאים (כולם חייבים להתקיים)
            </div>
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
                  <button onClick={() => removeCond(i)} style={btnGhost(T.red, "sm")}>✕</button>
                )}
              </div>
            ))}
            <button onClick={addCond} style={{ ...btnGhost(T.muted, "sm"), marginBottom: 16 }}>
              + הוסף תנאי
            </button>

            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ ...labelStyle, display: "block", marginBottom: 4 }}>סוג</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as InsightType }))}
                  style={{ ...INP }}>
                  <option value="alert">🔴 התראה (alert)</option>
                  <option value="tip">🟡 עצה (tip)</option>
                  <option value="info">🔵 מידע (info)</option>
                </select>
              </div>
              <div style={{ width: 110 }}>
                <label style={{ ...labelStyle, display: "block", marginBottom: 4 }}>עדיפות (1–100)</label>
                <input type="number" min={1} max={100} value={form.priority}
                  onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))}
                  style={{ ...INP, boxSizing: "border-box" }} />
              </div>
            </div>

            <label style={{ ...labelStyle, display: "block", marginBottom: 4 }}>טקסט התובנה</label>
            <div style={{ fontSize: T.fxs, color: T.muted, marginBottom: 6 }}>
              משתנים: {"{tableNum}"} {"{minutesSitting}"} {"{guests}"} {"{seats}"} {"{orderStatus}"} {"{totalAmount}"} {"{orderCount}"} {"{minutesSinceLastOrder}"}
            </div>
            <input value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
              placeholder="שולחן {tableNum} — ..."
              style={{ ...INP, marginBottom: 16, boxSizing: "border-box" }} />

            <div style={{ marginBottom: 16 }}>
              <label style={{ ...labelStyle, display: "block", marginBottom: 4 }}>
                עצור לאחר X דקות ישיבה <span style={{ fontWeight: 400, fontSize: T.fxs }}>(אופציונלי)</span>
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="number" min={1} placeholder="למשל 120"
                  value={form.stopAfterMinutes ?? ""}
                  onChange={e => setForm(f => ({ ...f, stopAfterMinutes: e.target.value ? Number(e.target.value) : undefined }))}
                  style={{ ...INP, width: 120 }}
                />
                <span style={{ fontSize: T.fsm, color: T.muted }}>
                  התובנה לא תופיע לאחר שהשולחן ישב יותר מ-X דקות
                </span>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ ...labelStyle, display: "block", marginBottom: 4 }}>
                עצור כאשר <span style={{ fontWeight: 400, fontSize: T.fxs }}>(אופציונלי)</span>
              </label>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <select
                  value={form.stopTrigger?.field ?? ""}
                  onChange={e => setForm(f => ({ ...f, stopTrigger: e.target.value ? { field: e.target.value as Condition["field"], operator: f.stopTrigger?.operator ?? "eq", value: f.stopTrigger?.value ?? "" } : undefined }))}
                  style={{ ...INP, minWidth: 160 }}
                >
                  <option value="">-- ללא --</option>
                  {FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                {form.stopTrigger && (
                  <>
                    <select
                      value={form.stopTrigger.operator}
                      onChange={e => setForm(f => ({ ...f, stopTrigger: f.stopTrigger ? { ...f.stopTrigger, operator: e.target.value as Condition["operator"] } : undefined }))}
                      style={{ ...INP, minWidth: 120 }}
                    >
                      {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <input
                      value={form.stopTrigger.value}
                      onChange={e => setForm(f => ({ ...f, stopTrigger: f.stopTrigger ? { ...f.stopTrigger, value: e.target.value } : undefined }))}
                      style={{ ...INP, width: 90 }} placeholder="ערך"
                    />
                  </>
                )}
              </div>
              <div style={{ fontSize: T.fxs, color: T.muted, marginTop: 4 }}>
                התובנה לא תופיע כאשר תנאי זה מתקיים (למשל: סטטוס שולחן = free)
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={form.fireOnce ?? false}
                  onChange={e => setForm(f => ({ ...f, fireOnce: e.target.checked || undefined }))}
                />
                <span style={{ fontSize: T.fmd, color: T.text }}>הצג פעם אחת בלבד לכל ישיבה</span>
                <span style={{ fontSize: T.fsm, color: T.muted }}>(מתאפס כשהשולחן מתפנה ולקוחות חדשים מגיעים)</span>
              </label>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={save} disabled={saving || !form.text.trim()}
                style={{ ...btn("primary"), opacity: saving || !form.text.trim() ? 0.5 : 1 }}>
                {saving ? "שומר..." : "שמור"}
              </button>
              <button onClick={() => setEditId(null)} style={btn("ghost")}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
