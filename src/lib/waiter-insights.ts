export type InsightType = "alert" | "tip" | "info";

export interface TableInput {
  tableNum: string;
  seats: number;
  availStatus: "occupied" | "free" | "reserved" | "inactive";
  minutesSitting: number;
  guests: number;
  orderStatus: string | null;
}

export interface Insight {
  tableNum: string;
  type: InsightType;
  text: string;
  priority: number; // higher = more urgent
}

interface Rule {
  match: (t: TableInput) => boolean;
  type: InsightType;
  text: (t: TableInput) => string;
  priority: number;
}

const RULES: Rule[] = [
  // ── Alerts (urgent actions) ──────────────────────────────────────────
  {
    priority: 100,
    type: "alert",
    match: t => t.availStatus === "occupied" && t.orderStatus === "READY",
    text: t => `שולחן ${t.tableNum} — הזמנה מוכנה, יש להגיש`,
  },
  {
    priority: 90,
    type: "alert",
    match: t => t.availStatus === "occupied" && t.minutesSitting >= 90,
    text: t => `שולחן ${t.tableNum} — ${t.minutesSitting} דק׳ ישיבה, שקול להציע חשבון`,
  },
  {
    priority: 85,
    type: "alert",
    match: t => t.availStatus === "occupied" && t.minutesSitting >= 30 && t.orderStatus === null,
    text: t => `שולחן ${t.tableNum} — ${t.minutesSitting} דק׳ ללא הזמנה פתוחה`,
  },

  // ── Tips (proactive suggestions) ────────────────────────────────────
  {
    priority: 70,
    type: "tip",
    match: t => t.availStatus === "occupied" && t.minutesSitting >= 45 && t.orderStatus === "DELIVERED",
    text: t => `שולחן ${t.tableNum} — הוגש לפני זמן, הצע קינוח או קפה`,
  },
  {
    priority: 65,
    type: "tip",
    match: t => t.availStatus === "occupied" && t.minutesSitting >= 20 && t.orderStatus === "CONFIRMED",
    text: t => `שולחן ${t.tableNum} — מאושר לפני ${t.minutesSitting} דק׳, בדוק סטטוס במטבח`,
  },
  {
    priority: 60,
    type: "tip",
    match: t => t.availStatus === "occupied" && t.minutesSitting >= 20 && t.orderStatus === "PREPARING",
    text: t => `שולחן ${t.tableNum} — מתבשל ${t.minutesSitting} דק׳, עדכן סועדים`,
  },
  {
    priority: 55,
    type: "tip",
    match: t => t.availStatus === "occupied" && t.minutesSitting < 5 && t.orderStatus === null,
    text: t => `שולחן ${t.tableNum} — זה עתה ישב, קח הזמנה`,
  },
  {
    priority: 50,
    type: "tip",
    match: t => t.availStatus === "occupied" && t.minutesSitting < 5 && t.orderStatus === "PENDING",
    text: t => `שולחן ${t.tableNum} — הזמנה ממתינה לאישור`,
  },

  // ── Info (situational awareness) ────────────────────────────────────
  {
    priority: 30,
    type: "info",
    match: t => t.availStatus === "occupied" && t.guests > 0 && t.seats > 0 && t.guests >= t.seats,
    text: t => `שולחן ${t.tableNum} — שולחן מלא (${t.guests}/${t.seats} מקומות)`,
  },
  {
    priority: 20,
    type: "info",
    match: t => t.availStatus === "reserved",
    text: t => `שולחן ${t.tableNum} — שמור, יש להכין`,
  },
];

export function computeInsights(tables: TableInput[], maxResults = 3): Insight[] {
  const results: Insight[] = [];

  for (const table of tables) {
    for (const rule of RULES) {
      if (rule.match(table)) {
        results.push({
          tableNum: table.tableNum,
          type: rule.type,
          text: rule.text(table),
          priority: rule.priority,
        });
        break; // one insight per table — highest-priority rule wins
      }
    }
  }

  return results
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxResults);
}
