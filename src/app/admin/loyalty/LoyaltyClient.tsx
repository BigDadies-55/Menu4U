"use client";

import { T } from "@/lib/ui";
import { useState, useEffect, useCallback } from "react";

/* ─── Types ─────────────────────────────────────────────────── */
type Restaurant = { id: string; name: string };

type LoyaltyTransaction = {
  id: string;
  memberId: string;
  orderId: string | null;
  type: string;
  points: number;
  note: string | null;
  createdAt: string;
};

type LoyaltyMember = {
  id: string;
  restaurantId: string;
  phone: string;
  name: string;
  email: string | null;
  birthDate: string | null;
  memberNumber: string;
  points: number;
  totalSpent: number;
  createdAt: string;
  updatedAt: string;
  transactions: LoyaltyTransaction[];
};

type LoyaltySettings = {
  restaurantId: string;
  pointsPerShekel: number;
  shekelPerPoint: number;
  minRedeemPoints: number;
  welcomeBonus: number;
  birthdayBonus: number;
  isActive: boolean;
};

/* ─── Styles ─────────────────────────────────────────────────── */
const DARK_INPUT: React.CSSProperties = {
  background: T.raised,
  border: "1px solid #3a3f47",
  color: T.text,
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box" as const,
};

const BTN_PRIMARY: React.CSSProperties = {
  background: T.gold,
  color: "#000",
  border: "none",
  borderRadius: 8,
  padding: "8px 18px",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
  boxShadow: "0 2px 8px rgba(201,168,76,0.35)",
};

const BTN_SECONDARY: React.CSSProperties = {
  background: T.raised,
  color: T.sub,
  border: "1px solid #3a3f47",
  borderRadius: 8,
  padding: "8px 18px",
  fontWeight: 500,
  fontSize: 14,
  cursor: "pointer",
};

const CARD: React.CSSProperties = {
  background: T.panel,
  border: "1px solid #2d3239",
  borderRadius: 12,
  padding: "20px 24px",
  marginBottom: 20,
};

const TRANS_TYPE_LABEL: Record<string, string> = {
  EARN: "הרוויח",
  REDEEM: "מומש",
  BONUS: "בונוס",
  MANUAL: "ידני",
};

const TRANS_TYPE_COLOR: Record<string, string> = {
  EARN: T.green,
  REDEEM: T.red,
  BONUS: T.gold,
  MANUAL: T.blue,
};

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/* ─── Main Component ─────────────────────────────────────────── */
export default function LoyaltyClient({
  restaurants,
  isSuperAdmin,
}: {
  restaurants: Restaurant[];
  isSuperAdmin: boolean;
}) {
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>(restaurants[0]?.id ?? "");
  const [members, setMembers] = useState<LoyaltyMember[]>([]);
  const [settings, setSettings] = useState<LoyaltySettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Search
  const [search, setSearch] = useState("");

  // Selected member detail
  const [selectedMember, setSelectedMember] = useState<LoyaltyMember | null>(null);

  // Adjust points modal
  const [adjustModal, setAdjustModal] = useState(false);
  const [adjustPoints, setAdjustPoints] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustLoading, setAdjustLoading] = useState(false);

  // Issue coupon modal
  const [couponModal, setCouponModal] = useState(false);
  const [couponType, setCouponType] = useState("DISCOUNT_PERCENT");
  const [couponValue, setCouponValue] = useState("");
  const [couponDesc, setCouponDesc] = useState("");
  const [couponExpiry, setCouponExpiry] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);

  // Settings form
  const [settingsForm, setSettingsForm] = useState<Partial<LoyaltySettings>>({});
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"members" | "settings">("members");

  const fetchData = useCallback(async () => {
    if (!selectedRestaurantId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/loyalty?restaurantId=${selectedRestaurantId}`);
      if (!res.ok) throw new Error("שגיאה בטעינת הנתונים");
      const data = await res.json();
      setMembers(data.members ?? []);
      setSettings(data.settings ?? null);
      setSettingsForm(data.settings ?? {
        pointsPerShekel: 1,
        shekelPerPoint: 0.1,
        minRedeemPoints: 100,
        welcomeBonus: 50,
        birthdayBonus: 100,
        isActive: true,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setLoading(false);
    }
  }, [selectedRestaurantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredMembers = members.filter(m =>
    !search ||
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.phone.includes(search) ||
    m.memberNumber.includes(search) ||
    (m.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  async function handleSaveSettings() {
    setSettingsLoading(true);
    setSettingsSaved(false);
    try {
      await fetch("/api/admin/loyalty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateSettings", restaurantId: selectedRestaurantId, ...settingsForm }),
      });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
      fetchData();
    } finally {
      setSettingsLoading(false);
    }
  }

  async function handleAdjustPoints() {
    if (!selectedMember) return;
    const pts = parseInt(adjustPoints);
    if (isNaN(pts) || pts === 0) return;
    setAdjustLoading(true);
    try {
      const res = await fetch("/api/admin/loyalty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "adjustPoints", memberId: selectedMember.id, points: pts, note: adjustNote }),
      });
      if (res.ok) {
        setAdjustModal(false);
        setAdjustPoints("");
        setAdjustNote("");
        fetchData();
        // Refresh selected member
        const updated = await res.json();
        setSelectedMember(prev => prev ? { ...prev, points: updated.points, transactions: prev.transactions } : null);
        fetchData();
      }
    } finally {
      setAdjustLoading(false);
    }
  }

  async function handleIssueCoupon() {
    if (!selectedMember) return;
    const val = parseFloat(couponValue);
    if (isNaN(val) || val <= 0) return;
    setCouponLoading(true);
    try {
      await fetch("/api/admin/loyalty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "issueCoupon",
          memberId: selectedMember.id,
          restaurantId: selectedRestaurantId,
          type: couponType,
          value: val,
          description: couponDesc,
          expiresAt: couponExpiry || null,
        }),
      });
      setCouponModal(false);
      setCouponValue("");
      setCouponDesc("");
      setCouponExpiry("");
    } finally {
      setCouponLoading(false);
    }
  }

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1200, margin: "0 auto", direction: "rtl" }}>

      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <span>⭐</span> מועדון לקוחות
        </h1>
        <p style={{ color: T.muted, fontSize: 14, margin: "6px 0 0" }}>
          ניהול חברי מועדון, נקודות, קופונים והגדרות מועדון
        </p>
      </div>

      {/* Restaurant selector */}
      {(isSuperAdmin || restaurants.length > 1) && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            מסעדה
          </label>
          <select
            value={selectedRestaurantId}
            onChange={e => { setSelectedRestaurantId(e.target.value); setSelectedMember(null); }}
            style={{ ...DARK_INPUT, width: "auto", minWidth: 220 }}
          >
            {restaurants.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid #2d3239", paddingBottom: 0 }}>
        {(["members", "settings"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "10px 20px",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
              color: activeTab === tab ? T.gold : T.muted,
              borderBottom: activeTab === tab ? "2px solid #c9a84c" : "2px solid transparent",
              marginBottom: -1,
              transition: "color 150ms",
            }}
          >
            {tab === "members" ? `👥 חברים (${members.length})` : "⚙️ הגדרות"}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid #f87171", borderRadius: 8, padding: "10px 14px", color: T.red, marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ color: T.muted, fontSize: 14, padding: "20px 0" }}>טוען...</div>
      )}

      {/* ── MEMBERS TAB ── */}
      {activeTab === "members" && !loading && (
        <div style={{ display: "grid", gridTemplateColumns: selectedMember ? "1fr 380px" : "1fr", gap: 24 }}>

          {/* Members list */}
          <div>
            {/* Stats bar */}
            <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
              {[
                { label: "סה\"כ חברים", value: members.length, color: T.gold },
                { label: "סה\"כ נקודות", value: members.reduce((s, m) => s + m.points, 0).toLocaleString(), color: T.green },
                { label: "כספים שנוצלו", value: `₪${members.reduce((s, m) => s + m.totalSpent, 0).toFixed(0)}`, color: T.blue },
              ].map(stat => (
                <div key={stat.label} style={{ ...CARD, flex: 1, padding: "14px 18px", margin: 0 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                  <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Search */}
            <div style={{ marginBottom: 16 }}>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="חיפוש לפי שם, טלפון, מייל, מספר חבר..."
                style={DARK_INPUT}
              />
            </div>

            {/* Members table */}
            <div style={{ ...CARD, padding: 0, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: T.surface, borderBottom: "1px solid #2d3239" }}>
                    {["שם", "טלפון", "מס' חבר", "נקודות", "הצטרף", "פעולות"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "right", fontSize: 12, fontWeight: 600, color: T.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: "32px 16px", textAlign: "center", color: T.muted, fontSize: 14 }}>
                        {search ? "לא נמצאו חברים התואמים לחיפוש" : "אין חברי מועדון עדיין"}
                      </td>
                    </tr>
                  )}
                  {filteredMembers.map((m, i) => (
                    <tr
                      key={m.id}
                      style={{
                        borderBottom: "1px solid #2d3239",
                        background: selectedMember?.id === m.id ? "rgba(201,168,76,0.08)" : i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                        cursor: "pointer",
                        transition: "background 150ms",
                      }}
                      onClick={() => setSelectedMember(m)}
                    >
                      <td style={{ padding: "12px 16px", color: T.text, fontSize: 14, fontWeight: 500 }}>
                        {m.name}
                        {m.email && <div style={{ fontSize: 11, color: T.muted }}>{m.email}</div>}
                      </td>
                      <td style={{ padding: "12px 16px", color: T.sub, fontSize: 14, direction: "ltr" }}>{m.phone}</td>
                      <td style={{ padding: "12px 16px", fontFamily: "monospace", color: T.gold, fontSize: 13 }}>#{m.memberNumber}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          background: "rgba(74,222,128,0.1)", color: T.green,
                          padding: "2px 8px", borderRadius: 12, fontSize: 13, fontWeight: 600,
                        }}>
                          {m.points.toLocaleString()} ⭐
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", color: T.muted, fontSize: 13 }}>{formatDate(m.createdAt)}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <button
                          onClick={e => { e.stopPropagation(); setSelectedMember(m); setAdjustModal(true); }}
                          style={{ ...BTN_SECONDARY, padding: "4px 10px", fontSize: 12, marginLeft: 6 }}
                        >
                          נקודות
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setSelectedMember(m); setCouponModal(true); }}
                          style={{ ...BTN_PRIMARY, padding: "4px 10px", fontSize: 12 }}
                        >
                          קופון
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Member detail panel */}
          {selectedMember && (
            <div>
              <div style={CARD}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>{selectedMember.name}</div>
                    <div style={{ fontSize: 13, color: T.muted, marginTop: 2 }}>#{selectedMember.memberNumber}</div>
                  </div>
                  <button
                    onClick={() => setSelectedMember(null)}
                    style={{ background: "none", border: "none", color: T.muted, fontSize: 18, cursor: "pointer" }}
                  >✕</button>
                </div>

                {/* Points badge */}
                <div style={{
                  background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.25)",
                  borderRadius: 10, padding: "14px 18px", marginBottom: 16, textAlign: "center",
                }}>
                  <div style={{ fontSize: 32, fontWeight: 800, color: T.gold }}>{selectedMember.points.toLocaleString()}</div>
                  <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>נקודות</div>
                  {settings && (
                    <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>
                      שווי: ₪{(selectedMember.points * settings.shekelPerPoint).toFixed(2)}
                    </div>
                  )}
                </div>

                {/* Contact info */}
                <div style={{ fontSize: 13, color: T.sub, marginBottom: 12 }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                    <span style={{ color: T.muted, minWidth: 60 }}>טלפון:</span>
                    <span dir="ltr">{selectedMember.phone}</span>
                  </div>
                  {selectedMember.email && (
                    <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                      <span style={{ color: T.muted, minWidth: 60 }}>מייל:</span>
                      <span>{selectedMember.email}</span>
                    </div>
                  )}
                  {selectedMember.birthDate && (
                    <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                      <span style={{ color: T.muted, minWidth: 60 }}>יום הולדת:</span>
                      <span>{formatDate(selectedMember.birthDate)}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                    <span style={{ color: T.muted, minWidth: 60 }}>הצטרף:</span>
                    <span>{formatDate(selectedMember.createdAt)}</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                  <button onClick={() => setAdjustModal(true)} style={{ ...BTN_SECONDARY, flex: 1 }}>
                    ✏️ התאם נקודות
                  </button>
                  <button onClick={() => setCouponModal(true)} style={{ ...BTN_PRIMARY, flex: 1 }}>
                    🎟️ הנפק קופון
                  </button>
                </div>

                {/* Transaction history */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.muted, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    היסטוריית עסקאות
                  </div>
                  {selectedMember.transactions.length === 0 && (
                    <div style={{ color: T.muted, fontSize: 13, textAlign: "center", padding: "12px 0" }}>
                      אין עסקאות עדיין
                    </div>
                  )}
                  {selectedMember.transactions.map(tx => (
                    <div key={tx.id} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "8px 0", borderBottom: "1px solid #2d3239",
                    }}>
                      <div>
                        <span style={{
                          fontSize: 11, padding: "1px 6px", borderRadius: 8,
                          background: `${TRANS_TYPE_COLOR[tx.type] ?? T.muted}20`,
                          color: TRANS_TYPE_COLOR[tx.type] ?? T.muted,
                          fontWeight: 600, marginLeft: 6,
                        }}>
                          {TRANS_TYPE_LABEL[tx.type] ?? tx.type}
                        </span>
                        <span style={{ fontSize: 12, color: T.muted }}>{tx.note ?? ""}</span>
                      </div>
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: tx.points > 0 ? T.green : T.red }}>
                          {tx.points > 0 ? "+" : ""}{tx.points}
                        </div>
                        <div style={{ fontSize: 11, color: T.muted }}>{formatDate(tx.createdAt)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SETTINGS TAB ── */}
      {activeTab === "settings" && !loading && (
        <div style={{ maxWidth: 540 }}>
          <div style={CARD}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text, margin: "0 0 20px" }}>הגדרות מועדון לקוחות</h3>

            {/* Active toggle */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, padding: "12px 16px", background: T.surface, borderRadius: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>מועדון פעיל</div>
                <div style={{ fontSize: 12, color: T.muted }}>הפעל או כבה את מועדון הלקוחות</div>
              </div>
              <button
                onClick={() => setSettingsForm(f => ({ ...f, isActive: !f.isActive }))}
                style={{
                  width: 44, height: 24, borderRadius: 12,
                  background: settingsForm.isActive ? T.gold : T.overlay,
                  border: "none", cursor: "pointer", position: "relative",
                  transition: "background 200ms",
                }}
              >
                <span style={{
                  position: "absolute", top: 3,
                  right: settingsForm.isActive ? 22 : 3,
                  width: 18, height: 18, borderRadius: "50%",
                  background: "#fff", transition: "right 200ms",
                }} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[
                { key: "pointsPerShekel", label: "נקודות לכל ₪", desc: "כמה נקודות מרוויחים על כל שקל" },
                { key: "shekelPerPoint", label: "₪ לנקודה (מימוש)", desc: "שווי שקלי של כל נקודה" },
                { key: "minRedeemPoints", label: "מינימום מימוש", desc: "מינימום נקודות למימוש" },
                { key: "welcomeBonus", label: "בונוס הצטרפות", desc: "נקודות בונוס בהרשמה" },
                { key: "birthdayBonus", label: "בונוס יום הולדת", desc: "נקודות בונוס ביום ההולדת" },
              ].map(field => (
                <div key={field.key}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {field.label}
                  </label>
                  <input
                    type="number"
                    value={(settingsForm as Record<string, unknown>)[field.key] as number ?? ""}
                    onChange={e => setSettingsForm(f => ({ ...f, [field.key]: parseFloat(e.target.value) || 0 }))}
                    style={DARK_INPUT}
                    min={0}
                    step={field.key === "shekelPerPoint" ? 0.01 : 1}
                  />
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>{field.desc}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 24, display: "flex", gap: 12, alignItems: "center" }}>
              <button onClick={handleSaveSettings} disabled={settingsLoading} style={{ ...BTN_PRIMARY }}>
                {settingsLoading ? "שומר..." : "שמור הגדרות"}
              </button>
              {settingsSaved && (
                <span style={{ fontSize: 13, color: T.green }}>✓ נשמר בהצלחה</span>
              )}
            </div>
          </div>

          {/* Current settings summary */}
          {settings && (
            <div style={{ ...CARD, background: T.surface }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.muted, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                הגדרות נוכחיות
              </div>
              <div style={{ fontSize: 13, color: T.sub, lineHeight: 2 }}>
                <div>• {settings.pointsPerShekel} נקודות לכל שקל</div>
                <div>• ₪{settings.shekelPerPoint} לנקודה בעת מימוש</div>
                <div>• מינימום מימוש: {settings.minRedeemPoints} נקודות</div>
                <div>• בונוס הצטרפות: {settings.welcomeBonus} נקודות</div>
                <div>• בונוס יום הולדת: {settings.birthdayBonus} נקודות</div>
                <div>• סטטוס: {settings.isActive ? "✅ פעיל" : "❌ מושהה"}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Adjust Points Modal ── */}
      {adjustModal && selectedMember && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div style={{ background: T.panel, borderRadius: 14, padding: "24px", width: "min(420px, 94vw)", border: "1px solid #2d3239" }}>
            <h3 style={{ color: T.text, fontSize: 17, fontWeight: 700, margin: "0 0 16px" }}>
              התאמת נקודות — {selectedMember.name}
            </h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: T.muted, marginBottom: 4, fontWeight: 600 }}>
                נקודות (חיובי = הוסף, שלילי = הפחת)
              </label>
              <input
                type="number"
                value={adjustPoints}
                onChange={e => setAdjustPoints(e.target.value)}
                placeholder="לדוגמה: 50 או -20"
                style={DARK_INPUT}
                autoFocus
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, color: T.muted, marginBottom: 4, fontWeight: 600 }}>
                הערה (אופציונלי)
              </label>
              <input
                type="text"
                value={adjustNote}
                onChange={e => setAdjustNote(e.target.value)}
                placeholder="סיבת ההתאמה"
                style={DARK_INPUT}
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleAdjustPoints} disabled={adjustLoading || !adjustPoints} style={{ ...BTN_PRIMARY, flex: 1 }}>
                {adjustLoading ? "שומר..." : "אשר"}
              </button>
              <button onClick={() => { setAdjustModal(false); setAdjustPoints(""); setAdjustNote(""); }} style={{ ...BTN_SECONDARY, flex: 1 }}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Issue Coupon Modal ── */}
      {couponModal && selectedMember && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div style={{ background: T.panel, borderRadius: 14, padding: "24px", width: "min(420px, 94vw)", border: "1px solid #2d3239" }}>
            <h3 style={{ color: T.text, fontSize: 17, fontWeight: 700, margin: "0 0 16px" }}>
              הנפקת קופון — {selectedMember.name}
            </h3>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: T.muted, marginBottom: 4, fontWeight: 600 }}>סוג קופון</label>
              <select value={couponType} onChange={e => setCouponType(e.target.value)} style={DARK_INPUT}>
                <option value="DISCOUNT_PERCENT">הנחה באחוזים (%)</option>
                <option value="DISCOUNT_AMOUNT">הנחה בשקלים (₪)</option>
                <option value="FREE_ITEM">מנה חינם</option>
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: T.muted, marginBottom: 4, fontWeight: 600 }}>
                ערך ({couponType === "DISCOUNT_PERCENT" ? "%" : "₪"})
              </label>
              <input
                type="number"
                value={couponValue}
                onChange={e => setCouponValue(e.target.value)}
                placeholder={couponType === "DISCOUNT_PERCENT" ? "לדוגמה: 10" : "לדוגמה: 50"}
                style={DARK_INPUT}
                min={0}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: T.muted, marginBottom: 4, fontWeight: 600 }}>תיאור (אופציונלי)</label>
              <input
                type="text"
                value={couponDesc}
                onChange={e => setCouponDesc(e.target.value)}
                placeholder="תיאור הקופון"
                style={DARK_INPUT}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, color: T.muted, marginBottom: 4, fontWeight: 600 }}>תפוגה (אופציונלי)</label>
              <input
                type="date"
                value={couponExpiry}
                onChange={e => setCouponExpiry(e.target.value)}
                style={DARK_INPUT}
              />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleIssueCoupon} disabled={couponLoading || !couponValue} style={{ ...BTN_PRIMARY, flex: 1 }}>
                {couponLoading ? "יוצר..." : "הנפק קופון"}
              </button>
              <button onClick={() => { setCouponModal(false); setCouponValue(""); setCouponDesc(""); setCouponExpiry(""); }} style={{ ...BTN_SECONDARY, flex: 1 }}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
