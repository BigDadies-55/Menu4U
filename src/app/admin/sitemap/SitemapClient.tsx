"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface SitemapNode {
  icon: string;
  label: string;
  sub?: string;
  href: string;
}

interface SitemapSection {
  label: string;
  nodes: SitemapNode[];
  arrows?: boolean; // render → connectors between nodes
}

const SECTIONS: SitemapSection[] = [
  {
    label: "ניהול ראשי",
    arrows: true,
    nodes: [
      { icon: "🏪", label: "מסעדות",   sub: "יצירה · עריכה · מנוי",  href: "/admin/restaurants" },
      { icon: "📋", label: "תפריטים",  sub: "קטגוריות · פריטים",      href: "/admin/menus" },
      { icon: "👥", label: "משתמשים",  sub: "תפקידים · הרשאות",       href: "/admin/users" },
    ],
  },
  {
    label: "הזמנות ושירות",
    arrows: true,
    nodes: [
      { icon: "🛒", label: "הזמנות",     sub: "רשימה · סטטוס",  href: "/admin/orders" },
      { icon: "🧑‍🍳", label: "מלצר חכם", sub: "v1 / v2",         href: "/admin/waiter" },
      { icon: "💰", label: "קאשייר",     sub: "תשלום · סגירה",  href: "/admin/cashier" },
      { icon: "📅", label: "משמרות",     sub: "ניהול · מנהל",   href: "/admin/shifts" },
    ],
  },
  {
    label: "רצפה ושולחנות",
    arrows: true,
    nodes: [
      { icon: "🗺️", label: "רצפת שירות",     sub: "שולחנות חיים", href: "/admin/floor" },
      { icon: "📐", label: "פריסת שולחנות",   sub: "עורך Layout",  href: "/admin/table-layout" },
      { icon: "🕐", label: "ציר זמן",         sub: "Timeline",     href: "/admin/timeline" },
    ],
  },
  {
    label: "מטבח (KDS)",
    arrows: false,
    nodes: [
      { icon: "🍳", label: "Station Dark",  sub: "תצוגה מודרנית", href: "/admin/kds" },
      { icon: "📋", label: "Kanban",        sub: "לפי סטטוס",      href: "/admin/kds/kanban" },
      { icon: "🎫", label: "Ticket Board",  sub: "כרטיסיות",       href: "/admin/kds/tickets" },
      { icon: "📺", label: "תצוגת שולחן",  sub: "קלאסי",          href: "/admin/kds/table" },
    ],
  },
  {
    label: "AI ואנליטיקה",
    arrows: false,
    nodes: [
      { icon: "📈", label: "סטטיסטיקות",   sub: "מכירות · מגמות", href: "/admin/stats" },
      { icon: "🤖", label: "כללי תובנות",  sub: "AI Insights",     href: "/admin/insights" },
      { icon: "💬", label: "עוזר אישי",    sub: "AI Chat",          href: "/admin/assistant" },
    ],
  },
  {
    label: "לקוחות",
    arrows: false,
    nodes: [
      { icon: "🏆", label: "מועדון לקוחות", sub: "נקודות · הטבות", href: "/admin/loyalty" },
      { icon: "📞", label: "קשרי לקוחות",   sub: "CRM",             href: "/admin/crm" },
    ],
  },
  {
    label: "מערכת",
    arrows: false,
    nodes: [
      { icon: "⚙️", label: "הגדרות", sub: "כללי · מראה · אבטחה", href: "/admin/settings" },
      { icon: "📜", label: "לוגים",  sub: "Audit Log",              href: "/admin/logs" },
    ],
  },
];

export default function SitemapClient() {
  const pathname = usePathname();

  return (
    <div dir="rtl" style={{ padding: "24px 0", maxWidth: 900 }}>
      {/* Page title */}
      <h1 style={{ fontSize: 20, fontWeight: 900, color: "#F59E0B", marginBottom: 28, display: "flex", alignItems: "center", gap: 10 }}>
        🗺 מפת ניווט
      </h1>

      {/* Root node */}
      <Link href="/admin" style={{ textDecoration: "none" }}>
        <div
          style={{
            display: "flex", alignItems: "center", gap: 14,
            background: "linear-gradient(135deg,#D97706,#F59E0B)",
            borderRadius: 16, padding: "14px 20px", marginBottom: 8,
            boxShadow: "0 8px 24px rgba(217,119,6,0.35)",
            cursor: "pointer",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
        >
          <span style={{ fontSize: 28 }}>📊</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#000" }}>דשבורד ראשי</div>
            <div style={{ fontSize: 11, color: "rgba(0,0,0,0.6)", marginTop: 2 }}>/admin — KPIs · הזמנות אחרונות · גרפים</div>
          </div>
        </div>
      </Link>

      {/* Branch line */}
      <div style={{ width: 2, background: "rgba(255,255,255,0.1)", margin: "0 auto", height: 16 }} />

      {/* Sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {SECTIONS.map((section, si) => (
          <div key={section.label}>
            {si > 0 && (
              <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "8px 0" }} />
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "6px 0" }}>
              {/* Section label */}
              <div
                style={{
                  width: 120, flexShrink: 0,
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10, padding: "10px 12px",
                  fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: 1,
                  textAlign: "center",
                }}
              >
                {section.label}
              </div>

              {/* Nodes */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                {section.nodes.map((node, ni) => {
                  const isActive = pathname === node.href;
                  return (
                    <div key={node.href} style={{ display: "flex", alignItems: "center", gap: 0 }}>
                      {section.arrows && ni > 0 && (
                        <span style={{ fontSize: 18, color: "rgba(255,255,255,0.2)", margin: "0 6px", flexShrink: 0 }}>→</span>
                      )}
                      <Link href={node.href} style={{ textDecoration: "none" }}>
                        <div
                          style={{
                            display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                            background: isActive
                              ? "rgba(217,119,6,0.22)"
                              : "rgba(255,255,255,0.07)",
                            border: isActive
                              ? "1px solid rgba(245,158,11,0.6)"
                              : "1px solid rgba(255,255,255,0.12)",
                            borderRadius: 12, padding: "10px 14px",
                            minWidth: 90, textAlign: "center",
                            cursor: "pointer",
                            transition: "all 0.15s",
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = isActive
                              ? "rgba(217,119,6,0.3)"
                              : "rgba(255,255,255,0.13)";
                            e.currentTarget.style.transform = "translateY(-2px)";
                            e.currentTarget.style.borderColor = isActive
                              ? "rgba(245,158,11,0.8)"
                              : "rgba(255,255,255,0.25)";
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = isActive
                              ? "rgba(217,119,6,0.22)"
                              : "rgba(255,255,255,0.07)";
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.borderColor = isActive
                              ? "rgba(245,158,11,0.6)"
                              : "rgba(255,255,255,0.12)";
                          }}
                        >
                          <span style={{ fontSize: 20 }}>{node.icon}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: isActive ? "#F59E0B" : "rgba(255,255,255,0.85)" }}>
                            {node.label}
                          </span>
                          {node.sub && (
                            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{node.sub}</span>
                          )}
                        </div>
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
