export type InsightType = "alert" | "tip" | "info";

export interface Condition {
  field: "minutesSitting" | "orderStatus" | "availStatus" | "guests" | "seats";
  operator: "gt" | "lt" | "gte" | "lte" | "eq" | "neq";
  value: string | number;
}

export interface CustomRule {
  id: string;
  label: string;
  enabled: boolean;
  conditions: Condition[];
  type: InsightType;
  text: string;   // supports {tableNum} {minutesSitting} {guests} {seats} {orderStatus}
  priority: number;
}

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
  priority: number;
}

// ── Built-in rules ────────────────────────────────────────────────────────────

interface BuiltinRule {
  match: (t: TableInput) => boolean;
  type: InsightType;
  text: (t: TableInput) => string;
  priority: number;
}

const BUILTIN_RULES: BuiltinRule[] = [
  // alerts
  { priority: 100, type: "alert",
    match: t => t.availStatus === "occupied" && t.orderStatus === "READY",
    text:  t => `שולחן ${t.tableNum} — הזמנה מוכנה, יש להגיש` },

  { priority: 90, type: "alert",
    match: t => t.availStatus === "occupied" && t.minutesSitting >= 90,
    text:  t => `שולחן ${t.tableNum} — ${t.minutesSitting} דק׳ ישיבה, שקול להציע חשבון` },

  { priority: 85, type: "alert",
    match: t => t.availStatus === "occupied" && t.minutesSitting >= 30 && t.orderStatus === null,
    text:  t => `שולחן ${t.tableNum} — ${t.minutesSitting} דק׳ ללא הזמנה פתוחה` },

  // tips
  { priority: 70, type: "tip",
    match: t => t.availStatus === "occupied" && t.minutesSitting >= 45 && t.orderStatus === "DELIVERED",
    text:  t => `שולחן ${t.tableNum} — הוגש לפני זמן, הצע קינוח או קפה` },

  { priority: 65, type: "tip",
    match: t => t.availStatus === "occupied" && t.minutesSitting >= 20 && t.orderStatus === "CONFIRMED",
    text:  t => `שולחן ${t.tableNum} — מאושר לפני ${t.minutesSitting} דק׳, בדוק סטטוס במטבח` },

  { priority: 60, type: "tip",
    match: t => t.availStatus === "occupied" && t.minutesSitting >= 20 && t.orderStatus === "PREPARING",
    text:  t => `שולחן ${t.tableNum} — מתבשל ${t.minutesSitting} דק׳, עדכן סועדים` },

  { priority: 55, type: "tip",
    match: t => t.availStatus === "occupied" && t.minutesSitting < 5 && t.orderStatus === null,
    text:  t => `שולחן ${t.tableNum} — זה עתה ישב, קח הזמנה` },

  { priority: 50, type: "tip",
    match: t => t.availStatus === "occupied" && t.minutesSitting < 5 && t.orderStatus === "PENDING",
    text:  t => `שולחן ${t.tableNum} — הזמנה ממתינה לאישור` },

  // info
  { priority: 30, type: "info",
    match: t => t.availStatus === "occupied" && t.guests > 0 && t.seats > 0 && t.guests >= t.seats,
    text:  t => `שולחן ${t.tableNum} — שולחן מלא (${t.guests}/${t.seats})` },

  { priority: 20, type: "info",
    match: t => t.availStatus === "reserved",
    text:  t => `שולחן ${t.tableNum} — שמור, יש להכין` },
];

// ── Custom rule evaluation ────────────────────────────────────────────────────

function evalCondition(t: TableInput, c: Condition): boolean {
  const actual = t[c.field] as string | number | null;
  switch (c.operator) {
    case "gt":  return Number(actual) >  Number(c.value);
    case "lt":  return Number(actual) <  Number(c.value);
    case "gte": return Number(actual) >= Number(c.value);
    case "lte": return Number(actual) <= Number(c.value);
    case "eq":  return String(actual ?? "") === String(c.value);
    case "neq": return String(actual ?? "") !== String(c.value);
    default: return false;
  }
}

function renderText(tpl: string, t: TableInput): string {
  return tpl
    .replace(/\{tableNum\}/g,       t.tableNum)
    .replace(/\{minutesSitting\}/g, String(t.minutesSitting))
    .replace(/\{guests\}/g,         String(t.guests))
    .replace(/\{seats\}/g,          String(t.seats))
    .replace(/\{orderStatus\}/g,    t.orderStatus ?? "");
}

// ── Main export ───────────────────────────────────────────────────────────────

export function computeInsights(
  tables: TableInput[],
  customRules: CustomRule[] = [],
  maxResults = 3,
): Insight[] {
  // Per-table: highest-priority match wins
  const best = new Map<string, Insight>();

  function trySet(ins: Insight) {
    const cur = best.get(ins.tableNum);
    if (!cur || ins.priority > cur.priority) best.set(ins.tableNum, ins);
  }

  for (const table of tables) {
    // Built-in (first matching rule per table)
    for (const rule of BUILTIN_RULES) {
      if (rule.match(table)) {
        trySet({ tableNum: table.tableNum, type: rule.type, text: rule.text(table), priority: rule.priority });
        break;
      }
    }
    // Custom (enabled, all conditions must match, first wins)
    for (const rule of customRules.filter(r => r.enabled && r.conditions.length > 0)) {
      if (rule.conditions.every(c => evalCondition(table, c))) {
        trySet({ tableNum: table.tableNum, type: rule.type, text: renderText(rule.text, table), priority: rule.priority });
        break;
      }
    }
  }

  return [...best.values()]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxResults);
}

// ── Expose built-in rule definitions (for display in admin UI) ────────────────

export const DEFAULT_RULE_LABELS: { text: string; type: InsightType; priority: number }[] = [
  { priority: 100, type: "alert", text: "הזמנה בסטטוס READY — יש להגיש" },
  { priority: 90,  type: "alert", text: "ישיבה 90+ דקות — שקול חשבון" },
  { priority: 85,  type: "alert", text: "30+ דקות ללא הזמנה פתוחה" },
  { priority: 70,  type: "tip",   text: "45+ דקות + הוגש — הצע קינוח/קפה" },
  { priority: 65,  type: "tip",   text: "20+ דקות + מאושר — בדוק מטבח" },
  { priority: 60,  type: "tip",   text: "20+ דקות + מכין — עדכן סועדים" },
  { priority: 55,  type: "tip",   text: "זה עתה ישב + ללא הזמנה — קח הזמנה" },
  { priority: 50,  type: "tip",   text: "הזמנה PENDING — ממתינה לאישור" },
  { priority: 30,  type: "info",  text: "שולחן מלא (סועדים ≥ מושבים)" },
  { priority: 20,  type: "info",  text: "שולחן שמור — יש להכין" },
];
