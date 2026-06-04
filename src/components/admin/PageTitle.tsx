"use client";
import { usePathname } from "next/navigation";
import { Frank_Ruhl_Libre } from "next/font/google";

const frankRuhl = Frank_Ruhl_Libre({
  subsets: ["hebrew", "latin"],
  weight: ["700", "900"],
  display: "swap",
});

const PAGE_MAP: Array<{ pattern: RegExp; name: string; group?: string }> = [
  { pattern: /^\/admin\/restaurants/,     name: "מסעדות",         group: "ניהול"  },
  { pattern: /^\/admin\/groups/,          name: "רשתות",           group: "ניהול"  },
  { pattern: /^\/admin\/menus/,           name: "תפריטים",         group: "ניהול"  },
  { pattern: /^\/admin\/users/,           name: "משתמשים",         group: "ניהול"  },
  { pattern: /^\/admin\/logs/,            name: "לוגים",           group: "ניהול"  },
  { pattern: /^\/admin\/settings/,        name: "הגדרות",          group: "ניהול"  },
  { pattern: /^\/admin\/orders\/stats/,   name: "סטטיסטיקות",     group: "שירות"  },
  { pattern: /^\/admin\/orders/,          name: "הזמנות",          group: "שירות"  },
  { pattern: /^\/admin\/cashier/,         name: "קאשייר",          group: "שירות"  },
  { pattern: /^\/admin\/waiter-floor/,    name: "רצפת שירות",     group: "שירות"  },
  { pattern: /^\/admin\/shift-manager/,   name: "מנהל משמרת",     group: "שירות"  },
  { pattern: /^\/admin\/waiter/,          name: "הזמנת מלצר",     group: "שירות"  },
  { pattern: /^\/admin\/layout-builder/,  name: "פריסת שולחנות",  group: "שירות"  },
  { pattern: /^\/admin\/loyalty/,         name: "מועדון לקוחות",  group: "שירות"  },
  { pattern: /^\/admin\/crm/,             name: "קשרי לקוחות",    group: "שירות"  },
  { pattern: /^\/admin\/kitchen-table/,   name: "תצוגת שולחן",    group: "KDS"    },
  { pattern: /^\/admin\/kitchen-kanban/,  name: "Kanban",          group: "KDS"    },
  { pattern: /^\/admin\/kitchen-tickets/, name: "Ticket Board",    group: "KDS"    },
  { pattern: /^\/admin\/kitchen/,         name: "Station Dark",    group: "KDS"    },
  { pattern: /^\/admin\/?$/,              name: "דשבורד"                           },
];

function getPage(pathname: string) {
  for (const e of PAGE_MAP) {
    if (e.pattern.test(pathname)) return e;
  }
  return { name: "ניהול", group: undefined };
}

export default function PageTitle() {
  const pathname = usePathname();
  const page = getPage(pathname);

  return (
    <div style={{
      padding: "18px 32px 14px",
      borderBottom: "1px solid rgba(180,140,60,0.15)",
      background: "linear-gradient(135deg,#f0ece3,#e8dcc8)",
      direction: "rtl",
    }}>
      {/* Title row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3 }}>
        {/* Decorative bars */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, justifyContent: "center", marginLeft: 6, flexShrink: 0 }}>
          <span style={{
            display: "block", width: 28, height: 2, borderRadius: 2,
            background: "linear-gradient(to left, transparent, #e8b84b)",
          }} />
          <span style={{
            display: "block", width: 18, height: 2, borderRadius: 2,
            background: "linear-gradient(to left, transparent, #c9890a)",
          }} />
        </div>

        {/* Page name */}
        <h1 className={frankRuhl.className} style={{
          fontSize: 28, fontWeight: 900, lineHeight: 1, margin: 0,
          background: "linear-gradient(110deg,#7a4e04 0%,#c9890a 45%,#e8b84b 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}>
          {page.name}
        </h1>
      </div>

      {/* Subtitle / breadcrumb */}
      {page.group && (
        <p style={{ fontSize: 12, color: "#9a8060", margin: 0, paddingRight: 44 }}>
          {page.group}
        </p>
      )}
    </div>
  );
}
