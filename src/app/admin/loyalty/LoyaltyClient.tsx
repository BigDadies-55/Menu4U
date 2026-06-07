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

type MemberAnalytics = {
  lastVisitAt: string | null;
  visitCount: number;
  avgSpend: number;
  orderSpent: number;
  favoriteItem: string | null;
  couponsIssued: number;
  couponsUsed: number;
  status: "new" | "active" | "at_risk" | "inactive";
};

type LoyaltyCoupon = {
  id: string;
  code: string;
  type: string;
  value: number;
  description: string | null;
  usedAt: string | null;
  expiresAt: string | null;
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
  lastVisitAt: string | null;
  createdAt: string;
  updatedAt: string;
  transactions: LoyaltyTransaction[];
  coupons?: LoyaltyCoupon[];
  analytics?: MemberAnalytics;
};

const COUPON_TYPE_LABEL: Record<string, string> = {
  DISCOUNT_PERCENT: "% הנחה",
  DISCOUNT_AMOUNT: "₪ הנחה",
  FREE_ITEM: "מנה חינם",
};

function couponValueLabel(c: LoyaltyCoupon): string {
  if (c.type === "DISCOUNT_PERCENT") return `${c.value}%`;
  if (c.type === "DISCOUNT_AMOUNT") return `₪${c.value}`;
  return COUPON_TYPE_LABEL[c.type] ?? "";
}

const STATUS_META: Record<MemberAnalytics["status"], { label: string; color: string }> = {
  active:   { label: "פעיל",   color: T.green },
  at_risk:  { label: "בסיכון", color: T.gold },
  inactive: { label: "רדום",   color: T.red },
  new:      { label: "חדש",    color: T.blue },
};

function relativeDays(s: string | null): string {
  if (!s) return "—";
  const days = Math.floor((Date.now() - new Date(s).getTime()) / 86400000);
  if (days <= 0) return "היום";
  if (days === 1) return "אתמול";
  if (days < 30) return `לפני ${days} ימים`;
  if (days < 60) return "לפני חודש";
  if (days < 365) return `לפני ${Math.floor(days / 30)} חודשים`;
  return `לפני ${Math.floor(days / 365)} שנים`;
}

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

  // Search + activity filter
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | MemberAnalytics["status"]>("all");

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
  // Coupon SMS delivery: none / now / schedule
  const [couponDelivery, setCouponDelivery] = useState<"none" | "now" | "schedule">("none");
  const [couponSmsText, setCouponSmsText] = useState("שלום [#FirstName#]! קיבלת קופון מתנה 🎁");
  const [couponSchedule, setCouponSchedule] = useState(""); // datetime-local string
  const [couponDeliveryNote, setCouponDeliveryNote] = useState("");

  // Per-coupon SMS send / manual redeem
  const [couponSendingId, setCouponSendingId] = useState<string | null>(null);
  const [couponSentId, setCouponSentId] = useState<string | null>(null);
  const [couponRedeemingId, setCouponRedeemingId] = useState<string | null>(null);

  // Edit member modal
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", phone: "", email: "", birthDate: "" });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  // Create member modal
  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", phone: "", email: "", birthDate: "" });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

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
      const nextMembers: LoyaltyMember[] = data.members ?? [];
      setMembers(nextMembers);
      // Keep the open detail panel in sync (e.g. after issuing a coupon)
      setSelectedMember(prev => prev ? (nextMembers.find(m => m.id === prev.id) ?? prev) : prev);
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

  const filteredMembers = members.filter(m => {
    const matchesSearch = !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.phone.includes(search) ||
      m.memberNumber.includes(search) ||
      (m.email ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || m.analytics?.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = members.reduce((acc, m) => {
    const s = m.analytics?.status ?? "new";
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

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

  async function handleCreateMember() {
    if (!createForm.name.trim() || !createForm.phone.trim()) return;
    setCreateLoading(true);
    setCreateError("");
    try {
      const res = await fetch("/api/admin/loyalty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createMember",
          restaurantId: selectedRestaurantId,
          name: createForm.name.trim(),
          phone: createForm.phone.trim(),
          email: createForm.email.trim() || null,
          birthDate: createForm.birthDate || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setCreateError(data.error ?? "שגיאה");
        return;
      }
      setCreateModal(false);
      setCreateForm({ name: "", phone: "", email: "", birthDate: "" });
      fetchData();
    } finally {
      setCreateLoading(false);
    }
  }

  function openEditModal(m: LoyaltyMember) {
    setEditForm({
      name: m.name,
      phone: m.phone,
      email: m.email ?? "",
      birthDate: m.birthDate ? m.birthDate.slice(0, 10) : "",
    });
    setEditError("");
    setEditModal(true);
  }

  async function handleEditMember() {
    if (!selectedMember) return;
    if (!editForm.name.trim() || !editForm.phone.trim()) return;
    setEditLoading(true);
    setEditError("");
    try {
      const res = await fetch("/api/admin/loyalty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateMember",
          memberId: selectedMember.id,
          name: editForm.name.trim(),
          phone: editForm.phone.trim(),
          email: editForm.email.trim() || null,
          birthDate: editForm.birthDate || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setEditError(d.error ?? "שגיאה");
        return;
      }
      setEditModal(false);
      fetchData();
    } finally {
      setEditLoading(false);
    }
  }

  async function handleSendCoupon(c: LoyaltyCoupon) {
    if (!selectedMember) return;
    setCouponSendingId(c.id);
    setCouponSentId(null);
    try {
      const message = `שלום ${selectedMember.name.split(/\s+/)[0]}! קיבלת קופון ${couponValueLabel(c)} 🎁 קוד: ${c.code}`.slice(0, 160);
      const res = await fetch("/api/admin/loyalty/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: selectedRestaurantId, message, memberIds: [selectedMember.id] }),
      });
      const d = await res.json();
      if (!res.ok || (d.sent ?? 0) === 0) {
        alert(d.error ?? "שליחת ה-SMS נכשלה");
        return;
      }
      setCouponSentId(c.id);
      setTimeout(() => setCouponSentId(null), 3000);
    } finally {
      setCouponSendingId(null);
    }
  }

  async function handleRedeemCoupon(c: LoyaltyCoupon) {
    if (!confirm(`לסמן את קופון ${c.code} כמומש? פעולה זו אינה הפיכה.`)) return;
    setCouponRedeemingId(c.id);
    try {
      const res = await fetch("/api/admin/loyalty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "redeemCoupon", couponId: c.id }),
      });
      const d = await res.json();
      if (!res.ok) { alert(d.error ?? "שגיאה"); return; }
      fetchData();
    } finally {
      setCouponRedeemingId(null);
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
    if (couponDelivery === "schedule" && !couponSchedule) {
      setCouponDeliveryNote("יש לבחור תאריך ושעה לתזמון");
      return;
    }
    setCouponLoading(true);
    setCouponDeliveryNote("");
    try {
      // 1. Create the coupon — response contains the generated code
      const res = await fetch("/api/admin/loyalty", {
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
      const coupon = await res.json();
      const code: string = coupon?.code ?? "";

      // 2. Optionally deliver the coupon by SMS
      if (couponDelivery !== "none" && code) {
        const smsMessage = `${couponSmsText} קוד: ${code}`.slice(0, 160);

        if (couponDelivery === "now") {
          const smsRes = await fetch("/api/admin/loyalty/sms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              restaurantId: selectedRestaurantId,
              message: smsMessage,
              memberIds: [selectedMember.id],
            }),
          });
          if (!smsRes.ok) {
            const d = await smsRes.json();
            setCouponDeliveryNote(d.error ?? "הקופון נוצר אך שליחת ה-SMS נכשלה");
            setCouponLoading(false);
            return;
          }
        } else if (couponDelivery === "schedule") {
          await fetch("/api/admin/crm/campaigns", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              restaurantId: selectedRestaurantId,
              name: `קופון ל${selectedMember.name}`,
              type: "SCHEDULED",
              message: smsMessage,
              scheduleConfig: {
                memberId: selectedMember.id,
                runAt: new Date(couponSchedule).toISOString(),
              },
            }),
          });
        }
      }

      // 3. Refresh so the new coupon shows in the member's coupon list
      fetchData();

      // 4. Reset
      setCouponModal(false);
      setCouponValue("");
      setCouponDesc("");
      setCouponExpiry("");
      setCouponDelivery("none");
      setCouponSchedule("");
      setCouponDeliveryNote("");
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

            {/* Search + Add */}
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="חיפוש לפי שם, טלפון, מייל, מספר חבר..."
                style={{ ...DARK_INPUT, flex: 1 }}
              />
              <button
                onClick={() => { setCreateError(""); setCreateModal(true); }}
                style={{ ...BTN_PRIMARY, whiteSpace: "nowrap" }}
              >
                + הוסף חבר
              </button>
            </div>

            {/* Activity status filter */}
            <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
              {([
                { v: "all", label: `הכל (${members.length})`, color: T.sub },
                ...(["active", "at_risk", "inactive", "new"] as const).map(s => ({
                  v: s, label: `${STATUS_META[s].label} (${statusCounts[s] ?? 0})`, color: STATUS_META[s].color,
                })),
              ] as const).map(opt => {
                const active = statusFilter === opt.v;
                return (
                  <button
                    key={opt.v}
                    onClick={() => setStatusFilter(opt.v as typeof statusFilter)}
                    style={{
                      padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      border: `1px solid ${active ? opt.color : "#3a3f47"}`,
                      background: active ? `${opt.color}22` : "transparent",
                      color: active ? opt.color : T.muted,
                      transition: "all 150ms",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Members table */}
            <div style={{ ...CARD, padding: 0, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: T.surface, borderBottom: "1px solid #2d3239" }}>
                    {["שם", "טלפון", "מס' חבר", "נקודות", "ביקור אחרון", "סטטוס", "פעולות"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "right", fontSize: 12, fontWeight: 600, color: T.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: "32px 16px", textAlign: "center", color: T.muted, fontSize: 14 }}>
                        {search || statusFilter !== "all" ? "לא נמצאו חברים התואמים לסינון" : "אין חברי מועדון עדיין"}
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
                      <td style={{ padding: "12px 16px", color: T.muted, fontSize: 13 }}>{relativeDays(m.analytics?.lastVisitAt ?? m.lastVisitAt)}</td>
                      <td style={{ padding: "12px 16px" }}>
                        {(() => {
                          const meta = STATUS_META[m.analytics?.status ?? "new"];
                          return (
                            <span style={{
                              background: `${meta.color}1a`, color: meta.color,
                              padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600,
                            }}>
                              {meta.label}
                            </span>
                          );
                        })()}
                      </td>
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

                {/* Analytics */}
                {selectedMember.analytics && (() => {
                  const a = selectedMember.analytics;
                  const meta = STATUS_META[a.status];
                  return (
                    <div style={{ background: T.surface, borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          סטטיסטיקה
                        </span>
                        <span style={{ background: `${meta.color}1a`, color: meta.color, padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
                          {meta.label}
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 12px", fontSize: 13 }}>
                        {[
                          { label: "ביקור אחרון", value: relativeDays(a.lastVisitAt) },
                          { label: "מספר ביקורים", value: a.visitCount.toLocaleString() },
                          { label: "ממוצע הוצאה", value: `₪${a.avgSpend.toFixed(0)}` },
                          { label: "סך הוצאות", value: `₪${(a.orderSpent || selectedMember.totalSpent).toFixed(0)}` },
                          { label: "פריט מועדף", value: a.favoriteItem ?? "—" },
                          { label: "קופונים", value: `${a.couponsUsed}/${a.couponsIssued} מומשו` },
                        ].map(stat => (
                          <div key={stat.label}>
                            <div style={{ color: T.muted, fontSize: 11, marginBottom: 2 }}>{stat.label}</div>
                            <div style={{ color: T.text, fontWeight: 600 }}>{stat.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                  <button onClick={() => openEditModal(selectedMember)} style={{ ...BTN_SECONDARY, flex: 1, minWidth: 110 }}>
                    ✏️ עריכת פרופיל
                  </button>
                  <button onClick={() => setAdjustModal(true)} style={{ ...BTN_SECONDARY, flex: 1, minWidth: 110 }}>
                    🔢 התאם נקודות
                  </button>
                  <button onClick={() => setCouponModal(true)} style={{ ...BTN_PRIMARY, flex: 1, minWidth: 110 }}>
                    🎟️ הנפק קופון
                  </button>
                </div>

                {/* Coupons */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.muted, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    קופונים ({selectedMember.coupons?.length ?? 0})
                  </div>
                  {(!selectedMember.coupons || selectedMember.coupons.length === 0) ? (
                    <div style={{ color: T.muted, fontSize: 13, textAlign: "center", padding: "12px 0" }}>
                      לא הונפקו קופונים
                    </div>
                  ) : (
                    selectedMember.coupons.map(c => {
                      const used = !!c.usedAt;
                      const expired = !used && c.expiresAt && new Date(c.expiresAt) < new Date();
                      const statusColor = used ? T.muted : expired ? T.red : T.green;
                      const statusLabel = used ? "מומש" : expired ? "פג תוקף" : "פעיל";
                      return (
                        <div key={c.id} style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: "8px 10px", marginBottom: 6, borderRadius: 8,
                          background: T.surface, border: "1px solid #2d3239",
                          opacity: used || expired ? 0.6 : 1,
                        }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: T.gold }}>{c.code}</span>
                              <span style={{ fontSize: 11, color: statusColor, fontWeight: 600 }}>● {statusLabel}</span>
                            </div>
                            <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>
                              {couponValueLabel(c)}{c.description ? ` · ${c.description}` : ""}
                            </div>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0, marginRight: 8 }}>
                            <div style={{ fontSize: 11, color: used ? T.green : T.muted }}>
                              {used ? `✓ מומש ${formatDate(c.usedAt!)}` : c.expiresAt ? `עד ${formatDate(c.expiresAt)}` : "ללא תפוגה"}
                            </div>
                            {!used && !expired && (
                              <div style={{ display: "flex", gap: 5 }}>
                                {couponSentId === c.id ? (
                                  <span style={{ fontSize: 11, color: T.green, fontWeight: 600 }}>✓ נשלח</span>
                                ) : (
                                  <button
                                    onClick={() => handleSendCoupon(c)}
                                    disabled={!!couponSendingId || !!couponRedeemingId}
                                    style={{
                                      ...BTN_SECONDARY, padding: "3px 9px", fontSize: 11,
                                      opacity: couponSendingId === c.id ? 0.6 : 1, whiteSpace: "nowrap",
                                    }}
                                  >
                                    {couponSendingId === c.id ? "שולח..." : "📤 SMS"}
                                  </button>
                                )}
                                <button
                                  onClick={() => handleRedeemCoupon(c)}
                                  disabled={!!couponRedeemingId || !!couponSendingId}
                                  style={{
                                    ...BTN_SECONDARY, padding: "3px 9px", fontSize: 11,
                                    opacity: couponRedeemingId === c.id ? 0.6 : 1, whiteSpace: "nowrap",
                                    borderColor: "rgba(74,222,128,0.35)", color: T.green,
                                  }}
                                >
                                  {couponRedeemingId === c.id ? "מממש..." : "✓ מימוש"}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
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

      {/* ── Edit Member Modal ── */}
      {editModal && selectedMember && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div style={{ background: T.panel, borderRadius: 14, padding: 24, width: "min(460px, 94vw)", border: "1px solid #2d3239" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ color: T.text, fontSize: 17, fontWeight: 700, margin: 0 }}>✏️ עריכת פרופיל — {selectedMember.name}</h3>
              <button onClick={() => setEditModal(false)} style={{ background: "none", border: "none", color: T.muted, fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: T.muted, marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  שם מלא *
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="ישראל ישראלי"
                  style={DARK_INPUT}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, color: T.muted, marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  טלפון *
                </label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="050-0000000"
                  style={{ ...DARK_INPUT, direction: "ltr", textAlign: "right" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, color: T.muted, marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  אימייל (אופציונלי)
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="example@email.com"
                  style={{ ...DARK_INPUT, direction: "ltr", textAlign: "right" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, color: T.muted, marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  תאריך לידה (אופציונלי)
                </label>
                <input
                  type="date"
                  value={editForm.birthDate}
                  onChange={e => setEditForm(f => ({ ...f, birthDate: e.target.value }))}
                  style={{ ...DARK_INPUT, direction: "ltr" }}
                />
              </div>

              {editError && (
                <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid #f87171", borderRadius: 8, padding: "8px 12px", color: T.red, fontSize: 13 }}>
                  {editError}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button
                onClick={handleEditMember}
                disabled={editLoading || !editForm.name.trim() || !editForm.phone.trim()}
                style={{ ...BTN_PRIMARY, flex: 1, opacity: editLoading || !editForm.name.trim() || !editForm.phone.trim() ? 0.55 : 1 }}
              >
                {editLoading ? "שומר..." : "שמור שינויים"}
              </button>
              <button onClick={() => setEditModal(false)} style={{ ...BTN_SECONDARY, flex: 1 }}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Member Modal ── */}
      {createModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div style={{ background: T.panel, borderRadius: 14, padding: 24, width: "min(460px, 94vw)", border: "1px solid #2d3239" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ color: T.text, fontSize: 17, fontWeight: 700, margin: 0 }}>➕ הוספת חבר מועדון</h3>
              <button onClick={() => setCreateModal(false)} style={{ background: "none", border: "none", color: T.muted, fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Name */}
              <div>
                <label style={{ display: "block", fontSize: 12, color: T.muted, marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  שם מלא *
                </label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="ישראל ישראלי"
                  style={DARK_INPUT}
                  autoFocus
                />
              </div>

              {/* Phone */}
              <div>
                <label style={{ display: "block", fontSize: 12, color: T.muted, marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  טלפון *
                </label>
                <input
                  type="tel"
                  value={createForm.phone}
                  onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="050-0000000"
                  style={{ ...DARK_INPUT, direction: "ltr", textAlign: "right" }}
                />
              </div>

              {/* Email */}
              <div>
                <label style={{ display: "block", fontSize: 12, color: T.muted, marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  אימייל (אופציונלי)
                </label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="example@email.com"
                  style={{ ...DARK_INPUT, direction: "ltr", textAlign: "right" }}
                />
              </div>

              {/* Birth date */}
              <div>
                <label style={{ display: "block", fontSize: 12, color: T.muted, marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  תאריך לידה (אופציונלי)
                </label>
                <input
                  type="date"
                  value={createForm.birthDate}
                  onChange={e => setCreateForm(f => ({ ...f, birthDate: e.target.value }))}
                  style={{ ...DARK_INPUT, direction: "ltr" }}
                />
              </div>

              {createError && (
                <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid #f87171", borderRadius: 8, padding: "8px 12px", color: T.red, fontSize: 13 }}>
                  {createError}
                </div>
              )}

              {settings?.welcomeBonus ? (
                <div style={{ fontSize: 12, color: T.muted, background: T.surface, borderRadius: 8, padding: "8px 12px" }}>
                  ⭐ החבר יקבל {settings.welcomeBonus} נקודות בונוס הצטרפות
                </div>
              ) : null}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button
                onClick={handleCreateMember}
                disabled={createLoading || !createForm.name.trim() || !createForm.phone.trim()}
                style={{ ...BTN_PRIMARY, flex: 1, opacity: createLoading || !createForm.name.trim() || !createForm.phone.trim() ? 0.55 : 1 }}
              >
                {createLoading ? "מוסיף..." : "הוסף חבר"}
              </button>
              <button onClick={() => setCreateModal(false)} style={{ ...BTN_SECONDARY, flex: 1 }}>
                ביטול
              </button>
            </div>
          </div>
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
          <div style={{ background: T.panel, borderRadius: 14, padding: "24px", width: "min(420px, 94vw)", maxHeight: "92vh", overflowY: "auto", border: "1px solid #2d3239" }}>
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

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, color: T.muted, marginBottom: 4, fontWeight: 600 }}>תפוגה (אופציונלי)</label>
              <input
                type="date"
                value={couponExpiry}
                onChange={e => setCouponExpiry(e.target.value)}
                style={DARK_INPUT}
              />
            </div>

            {/* ── SMS delivery ── */}
            <div style={{ borderTop: "1px solid #2d3239", paddingTop: 16, marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, color: T.muted, marginBottom: 8, fontWeight: 600 }}>שליחת הקופון ב-SMS</label>
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                {([
                  { v: "none", label: "אל תשלח" },
                  { v: "now", label: "📤 שלח עכשיו" },
                  { v: "schedule", label: "⏰ תזמן" },
                ] as const).map(opt => (
                  <button
                    key={opt.v}
                    onClick={() => setCouponDelivery(opt.v)}
                    style={{
                      flex: 1, padding: "7px 4px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      border: `1px solid ${couponDelivery === opt.v ? T.gold : "#3a3f47"}`,
                      background: couponDelivery === opt.v ? "rgba(201,137,10,0.12)" : "transparent",
                      color: couponDelivery === opt.v ? T.gold : T.sub,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {couponDelivery !== "none" && (
                <>
                  <label style={{ display: "block", fontSize: 12, color: T.muted, marginBottom: 4, fontWeight: 600 }}>תוכן ההודעה</label>
                  <textarea
                    value={couponSmsText}
                    onChange={e => setCouponSmsText(e.target.value)}
                    rows={2}
                    style={{ ...DARK_INPUT, resize: "none", fontFamily: "inherit", lineHeight: 1.5 }}
                  />
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>
                    ניתן להשתמש ב-<code style={{ color: T.gold }}>[#FirstName#]</code> · קוד הקופון יתווסף אוטומטית בסוף ההודעה.
                  </div>

                  {couponDelivery === "schedule" && (
                    <div style={{ marginTop: 12 }}>
                      <label style={{ display: "block", fontSize: 12, color: T.muted, marginBottom: 4, fontWeight: 600 }}>מתי לשלוח</label>
                      <input
                        type="datetime-local"
                        value={couponSchedule}
                        onChange={e => setCouponSchedule(e.target.value)}
                        style={{ ...DARK_INPUT, direction: "ltr" }}
                      />
                    </div>
                  )}
                </>
              )}

              {couponDeliveryNote && (
                <div style={{ marginTop: 10, fontSize: 12, color: T.red }}>{couponDeliveryNote}</div>
              )}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleIssueCoupon} disabled={couponLoading || !couponValue} style={{ ...BTN_PRIMARY, flex: 1 }}>
                {couponLoading
                  ? "יוצר..."
                  : couponDelivery === "now" ? "הנפק ושלח"
                  : couponDelivery === "schedule" ? "הנפק ותזמן"
                  : "הנפק קופון"}
              </button>
              <button onClick={() => { setCouponModal(false); setCouponValue(""); setCouponDesc(""); setCouponExpiry(""); setCouponDelivery("none"); setCouponSchedule(""); setCouponDeliveryNote(""); }} style={{ ...BTN_SECONDARY, flex: 1 }}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
