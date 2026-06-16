"use client";

type Role = "SUPER_ADMIN" | "ADMIN" | "OWNER" | "SHIFT_MANAGER" | "EDITOR" | "WAITER" | "VIEWER" | "DISPLAY";

const ROLES: { key: Role; label: string; color: string; text: string }[] = [
  { key: "SUPER_ADMIN",   label: "Super Admin",      color: "rgba(239,68,68,0.18)",   text: "#F87171" },
  { key: "ADMIN",         label: "מנהל",             color: "rgba(168,85,247,0.18)",  text: "#C084FC" },
  { key: "OWNER",         label: "בעל מסעדה",        color: "rgba(245,158,11,0.18)",  text: "#FCD34D" },
  { key: "SHIFT_MANAGER", label: "מנהל משמרת",       color: "rgba(249,115,22,0.18)",  text: "#FB923C" },
  { key: "EDITOR",        label: "עורך תפריט",       color: "rgba(59,130,246,0.18)",  text: "#60A5FA" },
  { key: "WAITER",        label: "מלצר",             color: "rgba(16,185,129,0.18)",  text: "#34D399" },
  { key: "VIEWER",        label: "צופה",             color: "rgba(107,114,128,0.18)", text: "#9CA3AF" },
  { key: "DISPLAY",       label: "תצוגת מטבח",       color: "rgba(6,182,212,0.18)",   text: "#22D3EE" },
];

type Check = (role: Role) => boolean;

const ALL:   Check = () => true;
const SA:    Check = r => r === "SUPER_ADMIN";
const ADMIN: Check = r => ["SUPER_ADMIN","ADMIN"].includes(r);
const OWNER: Check = r => ["SUPER_ADMIN","ADMIN","OWNER"].includes(r);
const SM:    Check = r => ["SUPER_ADMIN","ADMIN","OWNER","SHIFT_MANAGER"].includes(r);
const ED:    Check = r => ["SUPER_ADMIN","ADMIN","OWNER","EDITOR"].includes(r);
const WTR:   Check = r => ["SUPER_ADMIN","ADMIN","OWNER","SHIFT_MANAGER","WAITER"].includes(r);
const KDS:   Check = r => ["SUPER_ADMIN","ADMIN","OWNER","SHIFT_MANAGER","DISPLAY"].includes(r);

type Feature = { label: string; sub?: string; check: Check };
type Group   = { group: string; icon: string; features: Feature[] };

const MATRIX: Group[] = [
  {
    group: "ניהול מערכת", icon: "⚙️",
    features: [
      { label: "דשבורד",             sub: "/admin",              check: ALL   },
      { label: "בתי עסק",            sub: "/admin/restaurants",  check: SA    },
      { label: "משתמשים",            sub: "/admin/users",        check: ADMIN },
      { label: "הגדרות",             sub: "/admin/settings",     check: OWNER },
      { label: "לוגים",              sub: "/admin/logs",         check: ADMIN },
      { label: "תובנות AI",          sub: "/admin/insight-rules",check: ADMIN },
      { label: "עוזר אישי",          sub: "/admin/assistant",    check: ADMIN },
      { label: "אימות דו-שלבי",      sub: "/admin/2fa-setup",    check: ALL   },
      { label: "מפת ניווט",          sub: "/admin/sitemap",      check: ALL   },
    ],
  },
  {
    group: "תפריטים ותוכן", icon: "🍽️",
    features: [
      { label: "תפריטים",            sub: "/admin/menus",        check: ED    },
      { label: "קטגוריות ופריטים",   sub: "/admin/menus → items",check: ED    },
    ],
  },
  {
    group: "תפעול יומי", icon: "🏃",
    features: [
      { label: "מלצר חכם (POS)",     sub: "/admin/waiter",       check: WTR   },
      { label: "הזמנות",             sub: "/admin/orders",       check: SM    },
      { label: "קאשייר",             sub: "/admin/cashier",      check: SM    },
      { label: "ציר זמן שולחנות",    sub: "/admin/table-timeline",check: SM   },
      { label: "מפת שולחנות חיה",    sub: "/admin/live-floor",   check: SM    },
    ],
  },
  {
    group: "מטבח (KDS)", icon: "👨‍🍳",
    features: [
      { label: "KDS — Kanban",        sub: "/admin/kitchen-kanban",  check: KDS },
      { label: "KDS — Ticket Board",  sub: "/admin/kitchen-tickets", check: KDS },
      { label: "KDS — תצוגת שולחן",  sub: "/admin/kitchen-table",   check: KDS },
    ],
  },
  {
    group: "משמרות", icon: "📅",
    features: [
      { label: "ניהול משמרות",        sub: "/admin/shifts",         check: SM  },
      { label: "מנהל משמרת",          sub: "/admin/shift-manager",  check: SM  },
    ],
  },
  {
    group: "עיצוב ופריסה", icon: "🗺️",
    features: [
      { label: "פריסת שולחנות",       sub: "/admin/layout-builder", check: OWNER },
    ],
  },
  {
    group: "לקוחות ואנליטיקה", icon: "📊",
    features: [
      { label: "סטטיסטיקות",         sub: "/admin/orders/stats",  check: OWNER },
      { label: "מועדון לקוחות",       sub: "/admin/loyalty",       check: OWNER },
      { label: "קשרי לקוחות (CRM)",   sub: "/admin/crm",           check: OWNER },
    ],
  },
];

export default function PermissionsClient() {
  return (
    <div style={{ padding: "28px 28px 60px", minHeight: "100vh", direction: "rtl" }}>

      {/* Header */}
      <div style={{
        background: "rgba(255,255,255,0.04)", backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 20, padding: "18px 26px", marginBottom: 24,
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <span style={{ fontSize: 28 }}>🔐</span>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>עץ הרשאות</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
            תצוגה בלבד — לשינוי הרשאות יש לעדכן קוד
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12, padding: "12px 20px", marginBottom: 20,
        display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center",
      }}>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontWeight: 600, letterSpacing: 1 }}>מקרא:</span>
        <span style={{ fontSize: 13, color: "#4ade80", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 16 }}>✓</span> גישה מלאה
        </span>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 16 }}>✗</span> ללא גישה
        </span>
      </div>

      {/* Matrix */}
      <div style={{
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 18, overflow: "hidden",
      }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>

            {/* Role header */}
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                <th style={{ padding: "14px 20px", textAlign: "right", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: 1, width: 220 }}>
                  תכונה / מסך
                </th>
                {ROLES.map(r => (
                  <th key={r.key} style={{ padding: "10px 8px", textAlign: "center", minWidth: 86 }}>
                    <div style={{
                      display: "inline-block", padding: "4px 10px", borderRadius: 8,
                      background: r.color, color: r.text,
                      fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
                    }}>
                      {r.label}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {MATRIX.map((group, gi) => (
                <>
                  {/* Group header row */}
                  <tr key={`g-${gi}`} style={{ background: "rgba(255,255,255,0.025)", borderTop: gi > 0 ? "1px solid rgba(255,255,255,0.08)" : undefined }}>
                    <td colSpan={ROLES.length + 1} style={{
                      padding: "8px 20px",
                      fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.35)",
                      letterSpacing: 1.5, textTransform: "uppercase",
                    }}>
                      {group.icon} &nbsp;{group.group}
                    </td>
                  </tr>

                  {/* Feature rows */}
                  {group.features.map((feat, fi) => (
                    <tr key={`f-${gi}-${fi}`} style={{
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      transition: "background 0.12s",
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "11px 20px" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{feat.label}</div>
                        {feat.sub && (
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", marginTop: 2, fontFamily: "monospace" }}>{feat.sub}</div>
                        )}
                      </td>
                      {ROLES.map(r => {
                        const has = feat.check(r.key);
                        return (
                          <td key={r.key} style={{ textAlign: "center", padding: "11px 8px" }}>
                            {has ? (
                              <span style={{
                                display: "inline-flex", alignItems: "center", justifyContent: "center",
                                width: 26, height: 26, borderRadius: "50%",
                                background: "rgba(74,222,128,0.12)", color: "#4ade80",
                                fontSize: 14, fontWeight: 700,
                              }}>✓</span>
                            ) : (
                              <span style={{
                                display: "inline-flex", alignItems: "center", justifyContent: "center",
                                width: 26, height: 26, borderRadius: "50%",
                                color: "rgba(255,255,255,0.15)", fontSize: 14,
                              }}>✗</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ marginTop: 16, fontSize: 11, color: "rgba(255,255,255,0.2)", textAlign: "center" }}>
        הרשאות מוגדרות בקוד · <code style={{ fontFamily: "monospace" }}>src/lib/permissions.ts</code>
      </p>
    </div>
  );
}
