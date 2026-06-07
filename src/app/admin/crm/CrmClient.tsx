"use client";

import { useState, useEffect, useCallback } from "react";
import { T } from "@/lib/ui";

type Restaurant = { id: string; name: string };

type Campaign = {
  id: string; name: string; type: string; message: string;
  scheduleConfig: Record<string, unknown>;
  isActive: boolean; lastRunAt: string | null; createdAt: string;
};

type SmsLog = {
  id: string; campaignId: string | null; campaignName: string | null;
  message: string; sentCount: number; failedCount: number; sentAt: string;
};

type RestaurantStats = {
  restaurantId: string; name: string;
  totalSent: number; totalFailed: number; sendCount: number;
};

type StatsData = {
  restaurants: RestaurantStats[];
  totals: { sent: number; failed: number; sends: number };
};

type Member = { id: string; name: string; phone: string; points: number };

const CAMPAIGN_TYPES = [
  { value: "SCHEDULED",        label: "📅 חד פעמי",           desc: "שלח פעם אחת בתאריך ושעה מוגדרים" },
  { value: "WEEKLY",           label: "🔁 שבועי",             desc: "שלח כל שבוע ביום ובשעה קבועים" },
  { value: "MONTHLY",          label: "📆 חודשי",             desc: "שלח כל חודש ביום קבוע" },
  { value: "BIRTHDAY",         label: "🎂 יום הולדת",         desc: "שלח אוטומטית ביום הולדת של כל חבר" },
  { value: "INACTIVE",         label: "💤 לא פעיל",           desc: "חברים שלא הזמינו מעל X ימים" },
  { value: "POINTS_MILESTONE", label: "⭐ צבירת נקודות",      desc: "חברים עם מעל X נקודות" },
  { value: "COUPON_EXPIRY",    label: "🎟 קופון עומד לפוג",   desc: "X ימים לפני תפוגת קופון" },
];

const DAYS_HEB = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const SMS_MAX = 70;

const D_INPUT = { background: T.overlay, border: `1px solid ${T.border}`, color: T.text, borderRadius: 8, padding: "8px 12px", fontSize: 13 };

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: T.raised, border: `1px solid ${T.border}`, borderRadius: 12, padding: "20px 24px", ...style }}>{children}</div>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>{children}</div>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...D_INPUT, width: "100%", boxSizing: "border-box", ...props.style }} />;
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{ ...D_INPUT, width: "100%", boxSizing: "border-box", ...props.style }} />;
}

function SmsTextarea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ position: "relative" }}>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value.slice(0, SMS_MAX))}
        placeholder="תוכן ההודעה... (עד 70 תווים)"
        rows={3}
        style={{
          ...D_INPUT, width: "100%", boxSizing: "border-box",
          resize: "none", fontFamily: "inherit", lineHeight: 1.5,
          paddingBottom: 26,
          border: `1px solid ${value.length === SMS_MAX ? T.red : value.length > 55 ? T.orange : T.border}`,
        }}
      />
      <span style={{
        position: "absolute", bottom: 8, left: 10, fontSize: 11, fontWeight: 700,
        color: value.length === SMS_MAX ? T.red : value.length > 55 ? T.orange : T.sub,
      }}>
        {value.length} / {SMS_MAX}
      </span>
    </div>
  );
}

/* ── Hour select: cron fires every hour on the hour, so minute precision is irrelevant ── */
function HourSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const currentHour = typeof value === "string" && value.includes(":")
    ? value.split(":")[0]
    : String(parseInt(value as string) || 10);
  return (
    <Select value={currentHour} onChange={e => onChange(`${e.target.value}:00`)} style={{ width: 100 }}>
      {Array.from({ length: 24 }, (_, i) => (
        <option key={i} value={String(i)}>{String(i).padStart(2, "0")}:00</option>
      ))}
    </Select>
  );
}

/* ── Schedule config fields per type ── */
function ScheduleFields({ type, config, onChange }: {
  type: string;
  config: Record<string, unknown>;
  onChange: (c: Record<string, unknown>) => void;
}) {
  const set = (k: string, v: unknown) => onChange({ ...config, [k]: v });

  if (type === "SCHEDULED") return (
    <div style={{ display: "flex", gap: 10 }}>
      <div style={{ flex: 1 }}>
        <Label>תאריך</Label>
        <Input type="date" value={(config.date as string) ?? ""} onChange={e => set("date", e.target.value)} />
      </div>
      <div style={{ width: 110 }}>
        <Label>שעה</Label>
        <HourSelect value={(config.time as string) ?? "10:00"} onChange={v => set("time", v)} />
      </div>
    </div>
  );

  if (type === "WEEKLY") return (
    <div style={{ display: "flex", gap: 10 }}>
      <div style={{ flex: 1 }}>
        <Label>יום בשבוע</Label>
        <Select value={(config.dayOfWeek as number) ?? 0} onChange={e => set("dayOfWeek", Number(e.target.value))}>
          {DAYS_HEB.map((d, i) => <option key={i} value={i}>{d}</option>)}
        </Select>
      </div>
      <div style={{ width: 110 }}>
        <Label>שעה</Label>
        <HourSelect value={(config.time as string) ?? "10:00"} onChange={v => set("time", v)} />
      </div>
    </div>
  );

  if (type === "MONTHLY") return (
    <div style={{ display: "flex", gap: 10 }}>
      <div style={{ flex: 1 }}>
        <Label>יום בחודש</Label>
        <Input type="number" min={1} max={28} value={(config.dayOfMonth as number) ?? 1}
          onChange={e => set("dayOfMonth", Number(e.target.value))} />
      </div>
      <div style={{ width: 110 }}>
        <Label>שעה</Label>
        <HourSelect value={(config.time as string) ?? "10:00"} onChange={v => set("time", v)} />
      </div>
    </div>
  );

  if (type === "BIRTHDAY") return (
    <div style={{ width: 110 }}>
      <Label>שעת שליחה</Label>
      <HourSelect value={(config.time as string) ?? "09:00"} onChange={v => set("time", v)} />
    </div>
  );

  if (type === "INACTIVE") return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
      <div style={{ flex: 1 }}>
        <Label>ימי אי-פעילות</Label>
        <Input type="number" min={7} value={(config.inactiveDays as number) ?? 30}
          onChange={e => set("inactiveDays", Number(e.target.value))} />
      </div>
      <div style={{ width: 110 }}>
        <Label>שעה</Label>
        <HourSelect value={(config.time as string) ?? "10:00"} onChange={v => set("time", v)} />
      </div>
    </div>
  );

  if (type === "POINTS_MILESTONE") return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
      <div style={{ flex: 1 }}>
        <Label>מינימום נקודות</Label>
        <Input type="number" min={1} value={(config.pointsThreshold as number) ?? 100}
          onChange={e => set("pointsThreshold", Number(e.target.value))} />
      </div>
      <div style={{ width: 110 }}>
        <Label>שעה</Label>
        <HourSelect value={(config.time as string) ?? "10:00"} onChange={v => set("time", v)} />
      </div>
    </div>
  );

  if (type === "COUPON_EXPIRY") return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
      <div style={{ flex: 1 }}>
        <Label>ימים לפני תפוגה</Label>
        <Input type="number" min={1} value={(config.daysBeforeExpiry as number) ?? 3}
          onChange={e => set("daysBeforeExpiry", Number(e.target.value))} />
      </div>
      <div style={{ width: 110 }}>
        <Label>שעה</Label>
        <HourSelect value={(config.time as string) ?? "10:00"} onChange={v => set("time", v)} />
      </div>
    </div>
  );

  return null;
}

/* ══════════════════════════════════════════════════════════════ */
export default function CrmClient({ restaurants, isSuperAdmin }: { restaurants: Restaurant[]; isSuperAdmin: boolean }) {
  const [rid, setRid] = useState(restaurants[0]?.id ?? "");
  const [tab, setTab] = useState<"send" | "campaigns" | "history" | "stats">("send");

  /* ── members list (for send tab) ── */
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sendTarget, setSendTarget] = useState<"all" | "selected">("all");
  const [sendMsg, setSendMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null);
  const [search, setSearch] = useState("");

  /* ── campaigns ── */
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campLoading, setCampLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editCamp, setEditCamp] = useState<Campaign | null>(null);
  const [form, setForm] = useState({ name: "", type: "SCHEDULED", message: "", scheduleConfig: {} as Record<string, unknown> });
  const [formSaving, setFormSaving] = useState(false);

  /* ── history ── */
  const [history, setHistory] = useState<SmsLog[]>([]);
  const [histLoading, setHistLoading] = useState(false);

  /* ── stats ── */
  const [stats, setStats] = useState<StatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsFrom, setStatsFrom] = useState("");
  const [statsTo, setStatsTo] = useState("");

  /* ── fetch members ── */
  const fetchMembers = useCallback(async () => {
    if (!rid) return;
    setMembersLoading(true);
    const res = await fetch(`/api/admin/loyalty?restaurantId=${rid}`);
    if (res.ok) { const d = await res.json(); setMembers(d.members ?? []); }
    setMembersLoading(false);
  }, [rid]);

  /* ── fetch campaigns ── */
  const fetchCampaigns = useCallback(async () => {
    if (!rid) return;
    setCampLoading(true);
    const res = await fetch(`/api/admin/crm/campaigns?restaurantId=${rid}`);
    if (res.ok) setCampaigns(await res.json());
    setCampLoading(false);
  }, [rid]);

  /* ── fetch history ── */
  const fetchHistory = useCallback(async () => {
    if (!rid) return;
    setHistLoading(true);
    const res = await fetch(`/api/admin/crm/history?restaurantId=${rid}`);
    if (res.ok) setHistory(await res.json());
    setHistLoading(false);
  }, [rid]);

  /* ── fetch stats ── */
  const fetchStats = useCallback(async (from?: string, to?: string) => {
    setStatsLoading(true);
    const scope = isSuperAdmin ? "all" : rid;
    const params = new URLSearchParams({ scope });
    if (from) params.set("from", from);
    if (to)   params.set("to", to);
    const res = await fetch(`/api/admin/crm/stats?${params}`);
    if (res.ok) setStats(await res.json());
    setStatsLoading(false);
  }, [rid, isSuperAdmin]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);
  useEffect(() => { if (tab === "campaigns") fetchCampaigns(); }, [tab, fetchCampaigns]);
  useEffect(() => { if (tab === "history") fetchHistory(); }, [tab, fetchHistory]);
  useEffect(() => { if (tab === "stats") fetchStats(); }, [tab, fetchStats]);

  /* ── immediate send ── */
  async function handleSend() {
    if (!sendMsg.trim() || sendMsg.length > SMS_MAX) return;
    const targets = sendTarget === "selected" ? [...selectedIds] : null;
    const count = targets ? targets.length : members.length;
    if (count === 0) return;
    if (!confirm(`שלח SMS ל-${count} חברים?`)) return;
    setSending(true); setSendResult(null);
    const res = await fetch("/api/admin/crm/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId: rid, message: sendMsg.trim(), memberIds: targets }),
    });
    const d = await res.json();
    if (!res.ok) {
      alert(d.error ?? "שגיאה בשליחת SMS");
      setSending(false);
      return;
    }
    setSendResult({ sent: d.sent ?? 0, failed: d.failed ?? 0 });
    if (d.sent > 0) { setSendMsg(""); setSelectedIds(new Set()); setSendTarget("all"); }
    setSending(false);
  }

  /* ── save campaign ── */
  async function handleSaveCampaign() {
    if (!form.name.trim() || !form.message.trim()) return;
    setFormSaving(true);
    if (editCamp) {
      await fetch(`/api/admin/crm/campaigns/${editCamp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, message: form.message, scheduleConfig: form.scheduleConfig }),
      });
    } else {
      await fetch("/api/admin/crm/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: rid, ...form }),
      });
    }
    setFormSaving(false);
    setShowForm(false); setEditCamp(null);
    setForm({ name: "", type: "SCHEDULED", message: "", scheduleConfig: {} });
    fetchCampaigns();
  }

  async function toggleCampaign(c: Campaign) {
    await fetch(`/api/admin/crm/campaigns/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !c.isActive }),
    });
    fetchCampaigns();
  }

  async function deleteCampaign(id: string) {
    if (!confirm("למחוק קמפיין זה?")) return;
    await fetch(`/api/admin/crm/campaigns/${id}`, { method: "DELETE" });
    fetchCampaigns();
  }

  const filtered = members.filter(m =>
    !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.phone.includes(search)
  );
  const allSelected = filtered.length > 0 && filtered.every(m => selectedIds.has(m.id));

  /* ══ RENDER ══════════════════════════════════════════════════ */
  return (
    <div style={{ padding: "32px 24px", maxWidth: 900, margin: "0 auto", direction: "rtl", color: T.text }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>📱 קשרי לקוחות — SMS</h1>
          <p style={{ color: T.sub, fontSize: 13, marginTop: 4 }}>שליחה מיידית, תזמון קמפיינים, היסטוריה</p>
        </div>
        {(isSuperAdmin || restaurants.length > 1) && (
          <Select value={rid} onChange={e => setRid(e.target.value)} style={{ width: "auto", minWidth: 180 }}>
            {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        )}
      </div>

      {/* Cron hint */}
      {tab === "campaigns" && (
        <div style={{ background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.15)", borderRadius: 10, padding: "10px 16px", marginBottom: 20, fontSize: 12, color: T.gold }}>
          ⏰ כדי שהקמפיינים יופעלו אוטומטית — הגדר ב-<strong>cron-job.org</strong> שיקרא כל שעה לכתובת:
          {" "}<code style={{ background: "rgba(0,0,0,0.3)", padding: "1px 6px", borderRadius: 4 }}>
            {typeof window !== "undefined" ? window.location.origin : ""}/api/admin/crm/cron?secret=CRON_SECRET
          </code>
          {" "}(הגדר <strong>CRON_SECRET</strong> ב-Vercel env vars)
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, background: T.raised, borderRadius: 10, padding: 4, border: `1px solid ${T.border}` }}>
        {([
          { k: "send", label: "📤 שליחה מיידית" },
          { k: "campaigns", label: "⏰ קמפיינים" },
          { k: "history", label: "📋 היסטוריה" },
          { k: "stats", label: "📈 סטטיסטיקות" },
        ] as const).map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{
            flex: 1, padding: "9px 0", borderRadius: 7, border: "none", fontSize: 13, fontWeight: 600,
            cursor: "pointer",
            background: tab === t.k ? T.gold : "transparent",
            color: tab === t.k ? "#000" : T.sub,
          }}>{t.label}</button>
        ))}
      </div>

      {/* ──────── TAB: SEND ──────── */}
      {tab === "send" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>הודעה</div>
              <div style={{ display: "flex", background: T.bg, borderRadius: 8, padding: 3, gap: 2 }}>
                {(["all", "selected"] as const).map(t => (
                  <button key={t} onClick={() => setSendTarget(t)} style={{
                    padding: "5px 14px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer",
                    background: sendTarget === t ? T.gold : "transparent",
                    color: sendTarget === t ? "#000" : T.sub,
                  }}>
                    {t === "all" ? `לכולם (${members.length})` : `לנבחרים (${selectedIds.size})`}
                  </button>
                ))}
              </div>
            </div>
            {sendTarget === "selected" && selectedIds.size === 0 && (
              <div style={{ color: T.orange, fontSize: 12, marginBottom: 10 }}>⚠️ בחר חברים מהרשימה למטה</div>
            )}
            <SmsTextarea value={sendMsg} onChange={setSendMsg} />
            {/* Personalization tokens */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: T.muted }}>הוסף שדה אישי:</span>
              {[
                { token: "[#Name#]", label: "שם" },
                { token: "[#FirstName#]", label: "שם פרטי" },
                { token: "[#Points#]", label: "נקודות" },
                { token: "[#MemberNumber#]", label: "מס' חבר" },
              ].map(t => (
                <button
                  key={t.token}
                  type="button"
                  onClick={() => setSendMsg(m => (m + t.token).slice(0, SMS_MAX))}
                  style={{
                    fontSize: 11, padding: "3px 9px", borderRadius: 14, cursor: "pointer",
                    background: T.goldSub, color: T.gold, border: `1px solid ${T.border}`,
                  }}
                >
                  + {t.label}
                </button>
              ))}
            </div>
            {sendResult && (
              <div style={{
                marginTop: 10, padding: "8px 12px", borderRadius: 8, fontSize: 13,
                background: sendResult.sent > 0 ? "rgba(74,222,128,0.08)" : "rgba(239,68,68,0.08)",
                border: `1px solid ${sendResult.sent > 0 ? "rgba(74,222,128,0.2)" : "rgba(239,68,68,0.2)"}`,
                color: sendResult.sent > 0 ? T.green : T.red,
              }}>
                {sendResult.sent > 0 && `✓ נשלח ל-${sendResult.sent} חברים`}
                {sendResult.failed > 0 && ` · ${sendResult.failed} נכשלו`}
              </div>
            )}
            <button onClick={handleSend}
              disabled={sending || !sendMsg.trim() || (sendTarget === "selected" && selectedIds.size === 0)}
              style={{
                marginTop: 12, padding: "9px 24px", borderRadius: 8, border: "none",
                background: T.gold, color: "#000", fontWeight: 700, fontSize: 14, cursor: "pointer",
                opacity: (sending || !sendMsg.trim()) ? 0.5 : 1,
              }}>
              {sending ? "שולח..." : `📤 שלח ל-${sendTarget === "all" ? members.length : selectedIds.size} חברים`}
            </button>
          </Card>

          {/* Members list */}
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 10, alignItems: "center" }}>
              <input type="checkbox" checked={allSelected}
                onChange={e => {
                  const next = new Set(selectedIds);
                  filtered.forEach(m => e.target.checked ? next.add(m.id) : next.delete(m.id));
                  setSelectedIds(next);
                  if (next.size > 0) setSendTarget("selected");
                }}
                style={{ width: 15, height: 15, cursor: "pointer" }}
              />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש לפי שם / טלפון..."
                style={{ ...D_INPUT, flex: 1 }} />
              <span style={{ fontSize: 12, color: T.sub, whiteSpace: "nowrap" }}>{filtered.length} חברים</span>
            </div>
            {membersLoading ? (
              <div style={{ padding: 32, textAlign: "center", color: T.sub }}>טוען...</div>
            ) : (
              <div style={{ maxHeight: 360, overflowY: "auto" }}>
                {filtered.map((m, i) => (
                  <div key={m.id} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 18px",
                    borderBottom: `1px solid ${T.border}`,
                    background: selectedIds.has(m.id) ? "rgba(201,168,76,0.06)" : i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                    cursor: "pointer",
                  }} onClick={() => {
                    const next = new Set(selectedIds);
                    selectedIds.has(m.id) ? next.delete(m.id) : next.add(m.id);
                    setSelectedIds(next);
                    setSendTarget(next.size > 0 ? "selected" : "all");
                  }}>
                    <input type="checkbox" checked={selectedIds.has(m.id)} onChange={() => {}}
                      style={{ width: 15, height: 15, cursor: "pointer", pointerEvents: "none" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{m.name}</div>
                      <div style={{ fontSize: 12, color: T.sub, direction: "ltr", textAlign: "right" }}>{m.phone}</div>
                    </div>
                    <span style={{ fontSize: 12, color: T.gold, fontWeight: 600 }}>{m.points} ⭐</span>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <div style={{ padding: 32, textAlign: "center", color: T.sub, fontSize: 13 }}>
                    {search ? "לא נמצאו חברים" : "אין חברי מועדון עדיין"}
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ──────── TAB: CAMPAIGNS ──────── */}
      {tab === "campaigns" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <button onClick={() => { setShowForm(true); setEditCamp(null); setForm({ name: "", type: "SCHEDULED", message: "", scheduleConfig: {} }); }}
              style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: T.gold, color: "#000", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              + קמפיין חדש
            </button>
          </div>

          {/* Campaign form */}
          {showForm && (
            <Card style={{ marginBottom: 20, border: `1px solid ${T.gold}40` }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>
                {editCamp ? "✏️ עריכת קמפיין" : "➕ קמפיין חדש"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <Label>שם הקמפיין</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="לדוגמה: הנחת קיץ" />
                </div>
                {!editCamp && (
                  <div>
                    <Label>סוג</Label>
                    <Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value, scheduleConfig: {} }))}>
                      {CAMPAIGN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label} — {t.desc}</option>)}
                    </Select>
                  </div>
                )}
                <div>
                  <Label>תזמון</Label>
                  <ScheduleFields type={form.type}
                    config={form.scheduleConfig}
                    onChange={c => setForm(f => ({ ...f, scheduleConfig: c }))}
                  />
                </div>
                <div>
                  <Label>הודעה</Label>
                  <SmsTextarea value={form.message} onChange={v => setForm(f => ({ ...f, message: v }))} />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={handleSaveCampaign} disabled={formSaving || !form.name.trim() || !form.message.trim()}
                    style={{ padding: "9px 24px", borderRadius: 8, border: "none", background: T.gold, color: "#000", fontWeight: 700, cursor: "pointer", opacity: formSaving ? 0.6 : 1 }}>
                    {formSaving ? "שומר..." : "שמור"}
                  </button>
                  <button onClick={() => { setShowForm(false); setEditCamp(null); }}
                    style={{ padding: "9px 18px", borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", color: T.sub, cursor: "pointer" }}>
                    ביטול
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* Campaigns list */}
          {campLoading ? (
            <div style={{ padding: 40, textAlign: "center", color: T.sub }}>טוען...</div>
          ) : campaigns.length === 0 ? (
            <Card>
              <div style={{ textAlign: "center", color: T.sub, padding: 32 }}>אין קמפיינים עדיין</div>
            </Card>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {campaigns.map(c => {
                const typeInfo = CAMPAIGN_TYPES.find(t => t.value === c.type);
                return (
                  <Card key={c.id} style={{ padding: "14px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{c.name}</span>
                          <span style={{
                            fontSize: 11, padding: "2px 8px", borderRadius: 10, fontWeight: 600,
                            background: c.isActive ? "rgba(74,222,128,0.12)" : "rgba(255,255,255,0.05)",
                            color: c.isActive ? T.green : T.muted,
                          }}>
                            {c.isActive ? "● פעיל" : "● מושהה"}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: T.sub }}>
                          {typeInfo?.label} · {c.message.slice(0, 40)}{c.message.length > 40 ? "..." : ""}
                        </div>
                        {c.lastRunAt && (
                          <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                            הפעלה אחרונה: {new Date(c.lastRunAt).toLocaleString("he-IL")}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button onClick={() => { setEditCamp(c); setForm({ name: c.name, type: c.type, message: c.message, scheduleConfig: c.scheduleConfig }); setShowForm(true); }}
                          style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${T.border}`, background: "transparent", color: T.sub, fontSize: 12, cursor: "pointer" }}>
                          ✏️
                        </button>
                        <button onClick={() => toggleCampaign(c)}
                          style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${c.isActive ? T.gold : T.border}`, background: "transparent", color: c.isActive ? T.gold : T.sub, fontSize: 12, cursor: "pointer" }}>
                          {c.isActive ? "השהה" : "הפעל"}
                        </button>
                        <button onClick={() => deleteCampaign(c.id)}
                          style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.3)", background: "transparent", color: T.red, fontSize: 12, cursor: "pointer" }}>
                          מחק
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ──────── TAB: STATS ──────── */}
      {tab === "stats" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Date filter */}
          <Card style={{ padding: "14px 20px" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
              <div>
                <Label>מתאריך</Label>
                <Input type="date" value={statsFrom} onChange={e => setStatsFrom(e.target.value)} style={{ width: 150 }} />
              </div>
              <div>
                <Label>עד תאריך</Label>
                <Input type="date" value={statsTo} onChange={e => setStatsTo(e.target.value)} style={{ width: 150 }} />
              </div>
              <button
                onClick={() => fetchStats(statsFrom || undefined, statsTo || undefined)}
                style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: T.gold, color: "#000", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                סנן
              </button>
              {(statsFrom || statsTo) && (
                <button
                  onClick={() => { setStatsFrom(""); setStatsTo(""); fetchStats(); }}
                  style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", color: T.sub, fontSize: 13, cursor: "pointer" }}>
                  נקה
                </button>
              )}
              {(statsFrom || statsTo) && (
                <span style={{ fontSize: 12, color: T.gold, alignSelf: "center" }}>
                  {statsFrom && statsTo ? `${statsFrom} — ${statsTo}` : statsFrom ? `מ-${statsFrom}` : `עד ${statsTo}`}
                </span>
              )}
            </div>
          </Card>

          {statsLoading ? (
            <div style={{ padding: 60, textAlign: "center", color: T.sub }}>טוען...</div>
          ) : !stats ? null : (
            <>
              {/* Summary row */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {[
                  { label: "סה\"כ SMS שנשלחו", value: stats.totals.sent.toLocaleString(), color: T.green, icon: "📤" },
                  { label: "נכשלו", value: stats.totals.failed.toLocaleString(), color: stats.totals.failed > 0 ? T.red : T.sub, icon: "❌" },
                  { label: "אירועי שליחה", value: stats.totals.sends.toLocaleString(), color: T.gold, icon: "📋" },
                ].map(s => (
                  <Card key={s.label} style={{ flex: 1, minWidth: 140, padding: "18px 20px", margin: 0 }}>
                    <div style={{ fontSize: 11, color: T.sub, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
                      {s.icon} {s.label}
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
                  </Card>
                ))}
              </div>

              {/* Per-restaurant table */}
              <Card style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, fontWeight: 700, fontSize: 14 }}>
                  {isSuperAdmin ? "פירוט לפי מסעדה" : "פירוט שליחות"}
                </div>
                {stats.restaurants.length === 0 ? (
                  <div style={{ padding: 40, textAlign: "center", color: T.sub, fontSize: 13 }}>אין נתונים עדיין</div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: T.bg }}>
                        {(isSuperAdmin ? ["מסעדה", "SMS שנשלחו", "נכשלו", "אירועי שליחה"] : ["SMS שנשלחו", "נכשלו", "אירועי שליחה"]).map(h => (
                          <th key={h} style={{ padding: "10px 16px", textAlign: "right", fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: ".05em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stats.restaurants
                        .sort((a, b) => b.totalSent - a.totalSent)
                        .map((r, i) => (
                          <tr key={r.restaurantId} style={{
                            borderBottom: `1px solid ${T.border}`,
                            background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                          }}>
                            {isSuperAdmin && (
                              <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 600, color: T.text }}>{r.name}</td>
                            )}
                            <td style={{ padding: "12px 16px", fontWeight: 700, fontSize: 15, color: r.totalSent > 0 ? T.green : T.muted }}>
                              {r.totalSent.toLocaleString()}
                            </td>
                            <td style={{ padding: "12px 16px", fontWeight: r.totalFailed > 0 ? 700 : 400, color: r.totalFailed > 0 ? T.red : T.muted }}>
                              {r.totalFailed > 0 ? r.totalFailed.toLocaleString() : "—"}
                            </td>
                            <td style={{ padding: "12px 16px", color: T.sub, fontSize: 13 }}>
                              {r.sendCount.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      {/* Totals footer */}
                      {isSuperAdmin && stats.restaurants.length > 1 && (
                        <tr style={{ background: "rgba(201,168,76,0.06)", borderTop: `2px solid ${T.border}` }}>
                          <td style={{ padding: "12px 16px", fontWeight: 700, fontSize: 13, color: T.gold }}>סה&quot;כ</td>
                          <td style={{ padding: "12px 16px", fontWeight: 800, fontSize: 15, color: T.green }}>{stats.totals.sent.toLocaleString()}</td>
                          <td style={{ padding: "12px 16px", fontWeight: stats.totals.failed > 0 ? 800 : 400, color: stats.totals.failed > 0 ? T.red : T.muted }}>
                            {stats.totals.failed > 0 ? stats.totals.failed.toLocaleString() : "—"}
                          </td>
                          <td style={{ padding: "12px 16px", fontWeight: 700, color: T.sub }}>{stats.totals.sends.toLocaleString()}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </Card>
            </>
          )}
        </div>
      )}

      {/* ──────── TAB: HISTORY ──────── */}
      {tab === "history" && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, fontWeight: 700, fontSize: 14 }}>
            היסטוריית שליחות
          </div>
          {histLoading ? (
            <div style={{ padding: 40, textAlign: "center", color: T.sub }}>טוען...</div>
          ) : history.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: T.sub, fontSize: 13 }}>אין היסטוריה עדיין</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: T.bg }}>
                  {["תאריך", "קמפיין", "הודעה", "נשלח", "נכשל"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "right", fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: ".05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((l, i) => (
                  <tr key={l.id} style={{ borderBottom: `1px solid ${T.border}`, background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                    <td style={{ padding: "10px 16px", fontSize: 12, color: T.sub, whiteSpace: "nowrap" }}>
                      {new Date(l.sentAt).toLocaleString("he-IL")}
                    </td>
                    <td style={{ padding: "10px 16px", fontSize: 13, color: T.sub }}>
                      {l.campaignName ?? "מיידית"}
                    </td>
                    <td style={{ padding: "10px 16px", fontSize: 13, color: T.text, maxWidth: 240 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.message}</div>
                    </td>
                    <td style={{ padding: "10px 16px", fontWeight: 700, color: T.green }}>{l.sentCount}</td>
                    <td style={{ padding: "10px 16px", fontWeight: l.failedCount > 0 ? 700 : 400, color: l.failedCount > 0 ? T.red : T.muted }}>
                      {l.failedCount || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}
