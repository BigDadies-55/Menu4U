export type InsightType = "alert" | "tip" | "info";

export interface Condition {
  field: "minutesSitting" | "orderStatus" | "availStatus" | "guests" | "seats"
       | "totalAmount" | "orderCount" | "minutesSinceLastOrder"
       | "billRequested" | "minutesSinceBillRequested" | "hasAllergen" | "isLoyaltyMember";
  operator: "gt" | "lt" | "gte" | "lte" | "eq" | "neq";
  value: string | number;
}

export interface CustomRule {
  id: string;
  label: string;
  enabled: boolean;
  conditions: Condition[];
  type: InsightType;
  text: string; // supports {tableNum} {minutesSitting} {guests} {seats} {orderStatus} {totalAmount} {orderCount} {minutesSinceLastOrder} {minutesSinceBillRequested}
  priority: number;
}

export interface TableInput {
  tableNum: string;
  seats: number;
  availStatus: "occupied" | "free" | "reserved" | "inactive" | "bill_requested" | "paid";
  minutesSitting: number;
  guests: number;
  orderStatus: string | null;
  totalAmount: number;
  orderCount: number;
  minutesSinceLastOrder: number;
  billRequested: boolean;
  minutesSinceBillRequested: number;
  hasAllergen: boolean;
  isLoyaltyMember: boolean;
}

export interface Insight {
  tableNum: string;
  type: InsightType;
  text: string;
  priority: number;
}

// ── Built-in rule override (per restaurant, stored in DB) ────────────────────

export interface BuiltinRuleOverride {
  enabled: boolean;
  text?: string;     // custom text template (same placeholders as CustomRule.text)
  priority?: number; // custom priority (overrides default)
}
export type BuiltinRuleOverrides = Record<string, BuiltinRuleOverride>; // key = rule id

// ── Built-in rules ────────────────────────────────────────────────────────────

interface BuiltinRule {
  id: string;          // stable key used for per-restaurant overrides
  match: (t: TableInput) => boolean;
  type: InsightType;
  text: (t: TableInput) => string;
  priority: number;
  defaultText: string; // shown in admin UI
}

const BUILTIN_RULES: BuiltinRule[] = [
  // ── ALERTS ──────────────────────────────────────────────────────────────────

  { id: "ready-cold",       priority: 105, type: "alert", defaultText: "מוכן 15+ דק׳ ומתקרר — הגש מיד!",
    match: t => t.orderStatus === "READY" && t.minutesSinceLastOrder >= 15,
    text:  t => `שולחן ${t.tableNum} — מוכן ${t.minutesSinceLastOrder} דק׳ ומתקרר, יש להגיש מיד!` },

  { id: "ready",            priority: 100, type: "alert", defaultText: "הזמנה בסטטוס READY — יש להגיש",
    match: t => t.availStatus === "occupied" && t.orderStatus === "READY",
    text:  t => `שולחן ${t.tableNum} — הזמנה מוכנה, יש להגיש` },

  { id: "cancelled",        priority: 97,  type: "alert", defaultText: "הזמנה בוטלה — יש לבדוק",
    match: t => t.orderStatus === "CANCELLED",
    text:  t => `שולחן ${t.tableNum} — הזמנה בוטלה, יש לבדוק ולטפל` },

  { id: "long-sit",         priority: 92,  type: "alert", defaultText: "ישיבה 90+ דקות — שקול חשבון",
    match: t => t.availStatus === "occupied" && t.minutesSitting >= 90,
    text:  t => `שולחן ${t.tableNum} — ${t.minutesSitting} דק׳ ישיבה, שקול להציע חשבון` },

  { id: "bill-overdue",     priority: 90,  type: "alert", defaultText: "חשבון התבקש 10+ דק׳ ולא הוגש",
    match: t => t.billRequested && t.minutesSinceBillRequested >= 10,
    text:  t => `שולחן ${t.tableNum} — חשבון התבקש לפני ${t.minutesSinceBillRequested} דק׳, הבא חשבון!` },

  { id: "confirmed-stuck",  priority: 88,  type: "alert", defaultText: "CONFIRMED 60+ דקות — תקוע במטבח?",
    match: t => t.availStatus === "occupied" && t.minutesSitting >= 60 && t.orderStatus === "CONFIRMED",
    text:  t => `שולחן ${t.tableNum} — מאושר ${t.minutesSitting} דק׳ ועוד לא הגיע למטבח?` },

  { id: "no-order",         priority: 85,  type: "alert", defaultText: "30+ דקות ללא הזמנה פתוחה",
    match: t => t.availStatus === "occupied" && t.minutesSitting >= 30 && t.orderStatus === null,
    text:  t => `שולחן ${t.tableNum} — ${t.minutesSitting} דק׳ ללא הזמנה פתוחה` },

  { id: "bill-requested",   priority: 83,  type: "alert", defaultText: "חשבון התבקש — יש להגיש",
    match: t => t.billRequested,
    text:  t => `שולחן ${t.tableNum} — חשבון התבקש, יש להגיש` },

  { id: "reserved-late",    priority: 80,  type: "alert", defaultText: "שמור 20+ דקות — האם הגיע?",
    match: t => t.availStatus === "reserved" && t.minutesSitting >= 20,
    text:  t => `שולחן ${t.tableNum} — שמור ${t.minutesSitting} דק׳, האם הגיע?` },

  { id: "allergen",         priority: 79,  type: "alert", defaultText: "אלרגיה/הגבלה תזונתית מסומנת",
    match: t => (t.availStatus === "occupied" || t.availStatus === "bill_requested") && t.hasAllergen,
    text:  t => `שולחן ${t.tableNum} — אלרגיה/הגבלה תזונתית מסומנת, שים לב במטבח!` },

  // ── TIPS ────────────────────────────────────────────────────────────────────

  { id: "upsell-dessert",   priority: 70,  type: "tip", defaultText: "45+ דקות + DELIVERED — הצע קינוח/קפה",
    match: t => t.availStatus === "occupied" && t.minutesSitting >= 45 && t.orderStatus === "DELIVERED",
    text:  t => `שולחן ${t.tableNum} — הוגש לפני זמן, הצע קינוח או קפה` },

  { id: "upsell-drinks",    priority: 68,  type: "tip", defaultText: "30+ דקות + DELIVERED — הצע משקאות",
    match: t => t.availStatus === "occupied" && t.minutesSitting >= 30 && t.orderStatus === "DELIVERED",
    text:  t => `שולחן ${t.tableNum} — הוגש, הצע משקאות נוספים` },

  { id: "check-kitchen",    priority: 65,  type: "tip", defaultText: "20+ דקות + CONFIRMED — בדוק מטבח",
    match: t => t.availStatus === "occupied" && t.minutesSitting >= 20 && t.orderStatus === "CONFIRMED",
    text:  t => `שולחן ${t.tableNum} — מאושר לפני ${t.minutesSitting} דק׳, בדוק סטטוס במטבח` },

  { id: "offer-round",      priority: 63,  type: "tip", defaultText: "30+ דק׳ ללא הזמנה חדשה אחרי DELIVERED — סבב/חשבון",
    match: t => t.availStatus === "occupied" && t.orderStatus === "DELIVERED" && t.minutesSinceLastOrder >= 30,
    text:  t => `שולחן ${t.tableNum} — ${t.minutesSinceLastOrder} דק׳ מאז ההגשה, הצע סבב נוסף או חשבון` },

  { id: "update-guests",    priority: 60,  type: "tip", defaultText: "20+ דקות + PREPARING — עדכן סועדים",
    match: t => t.availStatus === "occupied" && t.minutesSitting >= 20 && t.orderStatus === "PREPARING",
    text:  t => `שולחן ${t.tableNum} — מתבשל ${t.minutesSitting} דק׳, עדכן סועדים` },

  { id: "take-order",       priority: 55,  type: "tip", defaultText: "זה עתה ישב + ללא הזמנה — קח הזמנה",
    match: t => t.availStatus === "occupied" && t.minutesSitting < 5 && t.orderStatus === null,
    text:  t => `שולחן ${t.tableNum} — זה עתה ישב, קח הזמנה` },

  { id: "pending",          priority: 50,  type: "tip", defaultText: "הזמנה PENDING — ממתינה לאישור",
    match: t => t.availStatus === "occupied" && t.minutesSitting < 5 && t.orderStatus === "PENDING",
    text:  t => `שולחן ${t.tableNum} — הזמנה ממתינה לאישור` },

  { id: "paid-clear",       priority: 49,  type: "tip", defaultText: "תשלום הושלם — נקה ואפס שולחן",
    match: t => t.orderStatus === "PAID",
    text:  t => `שולחן ${t.tableNum} — תשלום הושלם, נקה ואפס שולחן` },

  { id: "vip",              priority: 45,  type: "tip", defaultText: "חשבון ₪300+ — שירות VIP",
    match: t => t.availStatus === "occupied" && t.totalAmount >= 300,
    text:  t => `שולחן ${t.tableNum} — חשבון ₪${Math.round(t.totalAmount)}, תן שירות VIP` },

  { id: "loyalty",          priority: 44,  type: "tip", defaultText: "לקוח נאמן — קבל בברכה אישית",
    match: t => (t.availStatus === "occupied" || t.availStatus === "bill_requested") && t.isLoyaltyMember,
    text:  t => `שולחן ${t.tableNum} — לקוח נאמן, קבל בברכה אישית` },

  { id: "multi-order",      priority: 42,  type: "tip", defaultText: "2+ הזמנות — ודא שהכל הוגש",
    match: t => t.availStatus === "occupied" && t.orderCount >= 2,
    text:  t => `שולחן ${t.tableNum} — ${t.orderCount} הזמנות, ודא שהכל הוגש` },

  { id: "large-group",      priority: 40,  type: "tip", defaultText: "6+ סועדים — הצע מנות לשיתוף",
    match: t => t.availStatus === "occupied" && t.guests >= 6,
    text:  t => `שולחן ${t.tableNum} — קבוצה גדולה (${t.guests} סועדים), הצע מנות לשיתוף` },

  // ── INFO ────────────────────────────────────────────────────────────────────

  { id: "full-table",       priority: 30,  type: "info", defaultText: "שולחן מלא (סועדים ≥ מושבים)",
    match: t => t.availStatus === "occupied" && t.guests > 0 && t.seats > 0 && t.guests >= t.seats,
    text:  t => `שולחן ${t.tableNum} — שולחן מלא (${t.guests}/${t.seats})` },

  { id: "empty-seats",      priority: 27,  type: "info", defaultText: "מקומות פנויים — ניתן להוסיף סועדים",
    match: t => t.availStatus === "occupied" && t.guests > 0 && t.seats > 0 && t.guests < t.seats - 2,
    text:  t => `שולחן ${t.tableNum} — ${t.guests}/${t.seats} מקומות תפוסים, ניתן להוסיף סועדים` },

  { id: "couple-big",       priority: 25,  type: "info", defaultText: "זוג בשולחן גדול — שקול שיבוץ",
    match: t => t.availStatus === "occupied" && t.guests > 0 && t.guests <= 2 && t.seats >= 6,
    text:  t => `שולחן ${t.tableNum} — זוג בשולחן ל-${t.seats}, שקול שיבוץ נוח יותר` },

  { id: "confirmed-new",    priority: 22,  type: "info", defaultText: "הזמנה אושרה — בישול התחיל",
    match: t => t.availStatus === "occupied" && t.minutesSitting < 3 && t.orderStatus === "CONFIRMED",
    text:  t => `שולחן ${t.tableNum} — הזמנה אושרה, בישול התחיל` },

  { id: "reserved",         priority: 20,  type: "info", defaultText: "שולחן שמור — יש להכין",
    match: t => t.availStatus === "reserved",
    text:  t => `שולחן ${t.tableNum} — שמור, יש להכין` },
];

// ── Export built-in rule metadata for admin UI ────────────────────────────────

export const BUILTIN_RULE_META: { id: string; defaultText: string; type: InsightType; priority: number }[] =
  BUILTIN_RULES.map(r => ({ id: r.id, defaultText: r.defaultText, type: r.type, priority: r.priority }));

// ── Custom rule evaluation ────────────────────────────────────────────────────

function evalCondition(t: TableInput, c: Condition): boolean {
  const actual = t[c.field as keyof TableInput] as string | number | boolean | null;
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
    .replace(/\{tableNum\}/g,                    t.tableNum)
    .replace(/\{minutesSitting\}/g,              String(t.minutesSitting))
    .replace(/\{guests\}/g,                      String(t.guests))
    .replace(/\{seats\}/g,                       String(t.seats))
    .replace(/\{orderStatus\}/g,                 t.orderStatus ?? "")
    .replace(/\{totalAmount\}/g,                 String(Math.round(t.totalAmount)))
    .replace(/\{orderCount\}/g,                  String(t.orderCount))
    .replace(/\{minutesSinceLastOrder\}/g,        String(t.minutesSinceLastOrder))
    .replace(/\{minutesSinceBillRequested\}/g,    String(t.minutesSinceBillRequested));
}

// ── Main export ───────────────────────────────────────────────────────────────

export function computeInsights(
  tables: TableInput[],
  customRules: CustomRule[] = [],
  builtinOverrides: BuiltinRuleOverrides = {},
  maxResults = 3,
): Insight[] {
  const best = new Map<string, Insight>();

  // Sort built-in rules by effective priority (override may change it)
  const sortedBuiltins = [...BUILTIN_RULES]
    .map(r => ({ ...r, effectivePriority: builtinOverrides[r.id]?.priority ?? r.priority }))
    .sort((a, b) => b.effectivePriority - a.effectivePriority);

  function trySet(ins: Insight) {
    const cur = best.get(ins.tableNum);
    if (!cur || ins.priority > cur.priority) best.set(ins.tableNum, ins);
  }

  for (const table of tables) {
    // Built-in rules — first match wins (highest effective priority first)
    for (const rule of sortedBuiltins) {
      const ov = builtinOverrides[rule.id];
      if (ov && ov.enabled === false) continue; // disabled for this restaurant
      if (rule.match(table)) {
        const text = ov?.text ? renderText(ov.text, table) : rule.text(table);
        trySet({ tableNum: table.tableNum, type: rule.type, text, priority: rule.effectivePriority });
        break;
      }
    }
    // Custom rules — all enabled rules compete via trySet
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

// kept for backwards compatibility — some pages import this
export const DEFAULT_RULE_LABELS = BUILTIN_RULE_META.map(r => ({ text: r.defaultText, type: r.type, priority: r.priority }));
