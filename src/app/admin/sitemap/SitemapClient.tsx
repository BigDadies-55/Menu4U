"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TREE = [
  {
    label: "ניהול בתי עסק",
    icon: "🏪",
    color: "#F59E0B",
    href: "/admin/restaurants",
    children: [
      { icon: "📋", label: "תפריטים", href: "/admin/menus", sub: "קטגוריות · פריטים · אלרגנים" },
      { icon: "👥", label: "משתמשים", href: "/admin/users", sub: "תפקידים · הרשאות" },
    ],
  },
  {
    label: "שירות ותפעול",
    icon: "🧑‍🍳",
    color: "#60A5FA",
    href: "/admin/waiter",
    children: [
      { icon: "🛒", label: "הזמנות",         href: "/admin/orders",       sub: "רשימה · סטטוס" },
      { icon: "💰", label: "קאשייר",          href: "/admin/cashier",      sub: "תשלום · סגירה" },
      { icon: "📅", label: "משמרות",          href: "/admin/shifts",       sub: "לוח שבועי" },
      { icon: "🗺️", label: "רצפת שירות",     href: "/admin/floor",        sub: "שולחנות חיים" },
      { icon: "📐", label: "פריסת שולחנות",  href: "/admin/table-layout", sub: "עורך Layout" },
      { icon: "🕐", label: "ציר זמן",         href: "/admin/timeline",     sub: "Timeline" },
    ],
  },
  {
    label: "מטבח (KDS)",
    icon: "🍳",
    color: "#34D399",
    href: "/admin/kds",
    children: [
      { icon: "📋", label: "Kanban",        href: "/admin/kds/kanban",  sub: "לפי סטטוס" },
      { icon: "🎫", label: "Ticket Board",  href: "/admin/kds/tickets", sub: "כרטיסיות" },
      { icon: "📺", label: "תצוגת שולחן",  href: "/admin/kds/table",   sub: "קלאסי" },
    ],
  },
  {
    label: "לקוחות",
    icon: "🏆",
    color: "#A78BFA",
    href: "/admin/loyalty",
    children: [
      { icon: "📞", label: "CRM",             href: "/admin/crm",      sub: "קשרי לקוחות" },
    ],
  },
  {
    label: "AI ואנליטיקה",
    icon: "📈",
    color: "#FB7185",
    href: "/admin/stats",
    children: [
      { icon: "🤖", label: "תובנות AI",  href: "/admin/insights",  sub: "Insights" },
      { icon: "💬", label: "עוזר אישי",  href: "/admin/assistant", sub: "AI Chat" },
    ],
  },
  {
    label: "מערכת",
    icon: "⚙️",
    color: "#94A3B8",
    href: "/admin/settings",
    children: [
      { icon: "📜", label: "לוגים",    href: "/admin/logs",    sub: "Audit Log" },
      { icon: "🗺",  label: "מפת ניווט", href: "/admin/sitemap", sub: "Sitemap" },
    ],
  },
];

export default function SitemapClient() {
  const pathname = usePathname();

  return (
    <div dir="rtl" style={{ padding: "20px 0", maxWidth: 860 }}>
      <h1 style={{ fontSize: 18, fontWeight: 900, color: "#F59E0B", marginBottom: 24, display: "flex", alignItems: "center", gap: 8 }}>
        🗺 מפת האתר
      </h1>

      {/* Root */}
      <Link href="/admin" style={{ textDecoration: "none" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 12,
          background: "linear-gradient(135deg,#D97706,#F59E0B)",
          borderRadius: 14, padding: "12px 20px", marginBottom: 20,
          boxShadow: "0 6px 20px rgba(217,119,6,0.3)",
          cursor: "pointer", transition: "opacity 0.15s",
        }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
          <span style={{ fontSize: 22 }}>📊</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#000" }}>דשבורד ראשי</div>
            <div style={{ fontSize: 10, color: "rgba(0,0,0,0.55)", marginTop: 1 }}>/admin</div>
          </div>
        </div>
      </Link>

      {/* Tree grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        {TREE.map(section => (
          <div key={section.href} style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 16, overflow: "hidden",
          }}>
            {/* Section header */}
            <Link href={section.href} style={{ textDecoration: "none" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "12px 16px",
                background: `${section.color}14`,
                borderBottom: `1px solid ${section.color}22`,
                cursor: "pointer", transition: "background 0.15s",
              }}
                onMouseEnter={e => (e.currentTarget.style.background = `${section.color}28`)}
                onMouseLeave={e => (e.currentTarget.style.background = `${section.color}14`)}>
                <span style={{ fontSize: 18 }}>{section.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: section.color }}>{section.label}</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginRight: "auto", direction: "ltr" }}>{section.href}</span>
              </div>
            </Link>

            {/* Children */}
            <div style={{ padding: "6px 0" }}>
              {section.children.map((child, ci) => {
                const isActive = pathname === child.href;
                return (
                  <Link key={child.href} href={child.href} style={{ textDecoration: "none" }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 16px",
                      background: isActive ? "rgba(245,158,11,0.12)" : "transparent",
                      borderRight: isActive ? "3px solid #F59E0B" : "3px solid transparent",
                      transition: "background 0.12s",
                      cursor: "pointer",
                    }}
                      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.06)"; }}
                      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}>
                      {ci < section.children.length - 1
                        ? <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", flexShrink: 0 }}>├</span>
                        : <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", flexShrink: 0 }}>└</span>
                      }
                      <span style={{ fontSize: 14 }}>{child.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? "#F59E0B" : "rgba(255,255,255,0.8)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{child.label}</div>
                        {child.sub && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{child.sub}</div>}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Total count */}
      <div style={{ marginTop: 20, fontSize: 11, color: "rgba(255,255,255,0.25)", textAlign: "center" }}>
        {TREE.reduce((s, t) => s + 1 + t.children.length, 0) + 1} עמודים במערכת
      </div>
    </div>
  );
}
