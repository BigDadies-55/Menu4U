"use client";
import React, { useState } from "react";
import { T } from "@/lib/ui";

type Entry = { id: string; page: string; question: string; answer: string; tags: string[]; score: number; isDefault: boolean };
type Unanswered = { id: string; page: string; question: string; count: number; updatedAt: string };
type Stats = { total: number; thumbsUp: number; thumbsDown: number };

const PAGE_OPTIONS = ["shifts", "orders", "menus", "users", "settings", "dashboard", "general"];
const PAGE_LABELS: Record<string, string> = {
  shifts: "משמרות", orders: "הזמנות", menus: "תפריט",
  users: "משתמשים", settings: "הגדרות", dashboard: "דשבורד", general: "כללי",
};

const EMPTY_FORM = { page: "shifts", question: "", answer: "", tags: "", isDefault: false };

export default function AssistantAdminClient({ entries, unanswered, stats }: { entries: Entry[]; unanswered: Unanswered[]; stats: Stats }) {
  const [list, setList]         = useState<Entry[]>(entries);
  const [unans, setUnans]       = useState<Unanswered[]>(unanswered);
  const [tab, setTab]           = useState<"entries" | "unanswered">("entries");
  const [filterPage, setFilterPage] = useState("all");
  const [form, setForm]         = useState(EMPTY_FORM);
  const [editId, setEditId]     = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState("");

  const filtered = filterPage === "all" ? list : list.filter(e => e.page === filterPage);

  async function save() {
    if (!form.question.trim() || !form.answer.trim()) { setMsg("שאלה ותשובה הן שדות חובה"); return; }
    setSaving(true); setMsg("");
    const tags = form.tags.split(",").map(t => t.trim()).filter(Boolean);
    const body = { ...form, tags, id: editId ?? undefined };
    const r = await fetch("/api/admin/assistant/manage", {
      method: editId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) { setMsg(d.error ?? "שגיאה"); setSaving(false); return; }
    if (editId) {
      setList(l => l.map(e => e.id === editId ? d : e));
    } else {
      setList(l => [d, ...l]);
    }
    setForm(EMPTY_FORM); setEditId(null);
    setMsg("✓ נשמר");
    setTimeout(() => setMsg(""), 2000);
    setSaving(false);
  }

  async function remove(id: string) {
    if (!confirm("למחוק?")) return;
    await fetch("/api/admin/assistant/manage", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setList(l => l.filter(e => e.id !== id));
  }

  async function resolveUnanswered(id: string, question: string, page: string) {
    setForm({ ...EMPTY_FORM, page, question });
    setEditId(null);
    setTab("entries");
    // Mark resolved
    await fetch("/api/admin/assistant/manage", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolveUnanswered: id }),
    });
    setUnans(u => u.filter(x => x.id !== id));
  }

  function startEdit(e: Entry) {
    setForm({ page: e.page, question: e.question, answer: e.answer, tags: e.tags.join(", "), isDefault: e.isDefault });
    setEditId(e.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const inp = (style?: React.CSSProperties): React.CSSProperties => ({
    background: T.panel, border: `1px solid ${T.border}`, borderRadius: T.rMd,
    color: T.text, fontSize: T.fsm, padding: "8px 12px", fontFamily: "inherit",
    outline: "none", width: "100%", ...style,
  });

  return (
    <div style={{ padding: "clamp(14px, 2.5vw, 28px) clamp(16px, 3vw, 40px)", maxWidth: "100%", direction: "rtl" }}>
      <div style={{ fontSize: T.f2xl, fontWeight: 900, color: T.text, marginBottom: 4 }}>💬 ניהול עוזר אישי</div>
      <div style={{ fontSize: T.fsm, color: T.muted, marginBottom: 24 }}>הוסף, ערוך ומחק שאלות ותשובות. הציינים (👍/👎) משפיעים על דירוג התשובות.</div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        {[
          { label: "סה״כ פידבק", value: stats.total, color: T.blue },
          { label: "👍 מועיל", value: stats.thumbsUp, color: T.green },
          { label: "👎 לשיפור", value: stats.thumbsDown, color: T.red },
          { label: "⚠️ ללא מענה", value: unans.length, color: T.orange },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, minWidth: 100, background: T.panel, border: `1px solid ${T.border}`, borderRadius: T.rLg, padding: "12px 16px" }}>
            <div style={{ fontSize: T.f2xl, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: T.fxs, color: T.muted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Form */}
      <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: T.rLg, padding: 20, marginBottom: 24 }}>
        <div style={{ fontWeight: 700, color: T.text, marginBottom: 14 }}>{editId ? "✏️ עריכת שאלה" : "➕ הוסף שאלה חדשה"}</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ fontSize: T.fxs, color: T.muted, display: "block", marginBottom: 4 }}>דף</label>
            <select value={form.page} onChange={e => setForm(f => ({ ...f, page: e.target.value }))} style={inp()}>
              {PAGE_OPTIONS.map(p => <option key={p} value={p}>{PAGE_LABELS[p] ?? p}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, paddingBottom: 2 }}>
            <label style={{ fontSize: T.fsm, color: T.muted, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={form.isDefault} onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))} />
              הצגה כברירת מחדל
            </label>
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: T.fxs, color: T.muted, display: "block", marginBottom: 4 }}>שאלה</label>
          <input value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))} placeholder="למשל: איך מוסיפים משמרת?" style={inp()} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: T.fxs, color: T.muted, display: "block", marginBottom: 4 }}>תשובה</label>
          <textarea value={form.answer} onChange={e => setForm(f => ({ ...f, answer: e.target.value }))} rows={4} placeholder="תשובה מפורטת..." style={{ ...inp(), resize: "vertical" }} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: T.fxs, color: T.muted, display: "block", marginBottom: 4 }}>תגיות (מופרדות בפסיקים)</label>
          <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="משמרת, הוספה, עובד" style={inp()} />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={save} disabled={saving} style={{ background: T.gold, border: "none", borderRadius: T.rMd, color: "#1a1208", fontSize: T.fmd, fontWeight: 800, padding: "10px 24px", cursor: "pointer", fontFamily: "inherit" }}>
            {saving ? "שומר..." : editId ? "עדכן" : "שמור"}
          </button>
          {editId && (
            <button onClick={() => { setForm(EMPTY_FORM); setEditId(null); }} style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: T.rMd, color: T.muted, fontSize: T.fmd, padding: "10px 16px", cursor: "pointer", fontFamily: "inherit" }}>
              ביטול
            </button>
          )}
          {msg && <span style={{ fontSize: T.fsm, color: msg.startsWith("✓") ? T.green : T.red }}>{msg}</span>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["entries", "unanswered"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ background: tab === t ? T.gold : T.panel, border: `1px solid ${tab === t ? T.gold : T.border}`, borderRadius: T.rMd, color: tab === t ? "#1a1208" : T.text, fontSize: T.fsm, fontWeight: tab === t ? 700 : 400, padding: "7px 16px", cursor: "pointer", fontFamily: "inherit" }}>
            {t === "entries" ? `שאלות ותשובות (${list.length})` : `ממתין למענה (${unans.length})`}
          </button>
        ))}
        {tab === "entries" && (
          <select value={filterPage} onChange={e => setFilterPage(e.target.value)}
            style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: T.rMd, color: T.text, fontSize: T.fsm, padding: "7px 12px", fontFamily: "inherit", outline: "none", marginRight: "auto" }}>
            <option value="all">כל הדפים</option>
            {PAGE_OPTIONS.map(p => <option key={p} value={p}>{PAGE_LABELS[p]}</option>)}
          </select>
        )}
      </div>

      {/* Entries list */}
      {tab === "entries" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.length === 0 && <div style={{ color: T.muted, textAlign: "center", padding: 40 }}>אין שאלות עדיין</div>}
          {filtered.map(e => (
            <div key={e.id} style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: T.rMd, padding: "12px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                  <span style={{ background: T.gold + "30", color: T.gold, borderRadius: T.rFull, fontSize: T.fxs, fontWeight: 700, padding: "2px 8px" }}>{PAGE_LABELS[e.page] ?? e.page}</span>
                  {e.isDefault && <span style={{ background: T.blue + "20", color: T.blue, borderRadius: T.rFull, fontSize: T.fxs, padding: "2px 8px" }}>ברירת מחדל</span>}
                  <span style={{ fontSize: T.fxs, color: T.muted }}>ציון: {e.score}</span>
                </div>
                <div style={{ fontWeight: 700, color: T.text, fontSize: T.fsm, marginBottom: 4 }}>{e.question}</div>
                <div style={{ fontSize: T.fxs, color: T.muted, lineHeight: 1.5 }}>{e.answer.slice(0, 120)}{e.answer.length > 120 ? "..." : ""}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => startEdit(e)} style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: T.rMd, color: T.muted, fontSize: T.fxs, padding: "5px 10px", cursor: "pointer", fontFamily: "inherit" }}>✏️</button>
                <button onClick={() => remove(e.id)} style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: T.rMd, color: T.red, fontSize: T.fxs, padding: "5px 10px", cursor: "pointer", fontFamily: "inherit" }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Unanswered */}
      {tab === "unanswered" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {unans.length === 0 && <div style={{ color: T.muted, textAlign: "center", padding: 40 }}>🎉 אין שאלות ללא מענה!</div>}
          {unans.map(u => (
            <div key={u.id} style={{ background: T.panel, border: `1px solid ${T.orange}44`, borderRadius: T.rMd, padding: "12px 16px", display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                  <span style={{ background: T.gold + "30", color: T.gold, borderRadius: T.rFull, fontSize: T.fxs, fontWeight: 700, padding: "2px 8px" }}>{PAGE_LABELS[u.page] ?? u.page}</span>
                  <span style={{ background: T.red + "20", color: T.red, borderRadius: T.rFull, fontSize: T.fxs, padding: "2px 8px" }}>{u.count}× נשאל</span>
                </div>
                <div style={{ fontWeight: 600, color: T.text, fontSize: T.fsm }}>{u.question}</div>
              </div>
              <button onClick={() => resolveUnanswered(u.id, u.question, u.page)}
                style={{ background: T.gold, border: "none", borderRadius: T.rMd, color: "#1a1208", fontSize: T.fxs, fontWeight: 700, padding: "7px 14px", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                + הוסף תשובה
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
