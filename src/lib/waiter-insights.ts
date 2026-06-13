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

// ── Built-in rules — sorted by priority DESC so first match = highest priority ─

interface BuiltinRule {
  match: (t: TableInput) => boolean;
  type: InsightType;
  text: (t: TableInput) => string;
  priority: number;
}

const BUILTIN_RULES: BuiltinRule[] = [
  // ── ALERTS ─────────────────────────────────────────────────────────────────

  // READY for too long — food going cold
  { priority: 105, type: "alert",
    match: t => t.orderStatus === "READY" && t.minutesSinceLastOrder >= 15,
    text:  t => `שולחן ${t.tableNum} — מוכן ${t.minutesSinceLastOrder} דק׳ ומתקרר, יש להגיש מיד!` },

  // READY — standard
  { priority: 100, type: "alert",
    match: t => t.availStatus === "occupied" && t.orderStatus === "READY",
    text:  t => `שולחן ${t.tableNum} — הזמנה מוכנה, יש להגיש` },

  // Cancellation — needs attention
  { priority: 97, type: "alert",
    match: t => t.orderStatus === "CANCELLED",
    text:  t => `שולחן ${t.tableNum} — הזמנה בוטלה, יש לבדוק ולטפל` },

  // Long sit — suggest bill
  { priority: 92, type: "alert",
    match: t => t.availStatus === "occupied" && t.minutesSitting >= 90,
    text:  t => `שולחן ${t.tableNum} — ${t.minutesSitting} דק׳ ישיבה, שקול להציע חשבון` },

  // CONFIRMED stuck in kitchen way too long
  { priority: 88, type: "alert",
    match: t => t.availStatus === "occupied" && t.minutesSitting >= 60 && t.orderStatus === "CONFIRMED",
    text:  t => `שולחן ${t.tableNum} — מאושר ${t.minutesSitting} דק׳ ועוד לא הגיע למטבח?` },

  // Long sit without any open order
  { priority: 85, type: "alert",
    match: t => t.availStatus === "occupied" && t.minutesSitting >= 30 && t.orderStatus === null,
    text:  t => `שולחן ${t.tableNum} — ${t.minutesSitting} דק׳ ללא הזמנה פתוחה` },

  // Reserved but nobody arrived
  { priority: 80, type: "alert",
    match: t => t.availStatus === "reserved" && t.minutesSitting >= 20,
    text:  t => `שולחן ${t.tableNum} — שמור ${t.minutesSitting} דק׳, האם הגיע?` },

  // Bill requested but not delivered after 10 min
  { priority: 90, type: "alert",
    match: t => t.billRequested && t.minutesSinceBillRequested >= 10,
    text:  t => `שולחן ${t.tableNum} — חשבון התבקש לפני ${t.minutesSinceBillRequested} דק׳, הבא חשבון!` },

  // Bill requested — any duration
  { priority: 83, type: "alert",
    match: t => t.billRequested,
    text:  t => `שולחן ${t.tableNum} — חשבון התבקש, יש להגיש` },

  // Allergen flag on active order
  { priority: 79, type: "alert",
    match: t => (t.availStatus === "occupied" || t.availStatus === "bill_requested") && t.hasAllergen,
    text:  t => `שולחן ${t.tableNum} — אלרגיה/הגבלה תזונתית מסומנת, שים לב במטבח!` },

  // ── TIPS ────────────────────────────────────────────────────────────────────

  // Delivered a while ago — upsell dessert/coffee
  { priority: 70, type: "tip",
    match: t => t.availStatus === "occupied" && t.minutesSitting >= 45 && t.orderStatus === "DELIVERED",
    text:  t => `שולחן ${t.tableNum} — הוגש לפני זמן, הצע קינוח או קפה` },

  // Delivered recently — upsell drinks
  { priority: 68, type: "tip",
    match: t => t.availStatus === "occupied" && t.minutesSitting >= 30 && t.orderStatus === "DELIVERED",
    text:  t => `שולחן ${t.tableNum} — הוגש, הצע משקאות נוספים` },

  // CONFIRMED in kitchen — follow up
  { priority: 65, type: "tip",
    match: t => t.availStatus === "occupied" && t.minutesSitting >= 20 && t.orderStatus === "CONFIRMED",
    text:  t => `שולחן ${t.tableNum} — מאושר לפני ${t.minutesSitting} דק׳, בדוק סטטוס במטבח` },

  // In prep long time — update guests
  { priority: 60, type: "tip",
    match: t => t.availStatus === "occupied" && t.minutesSitting >= 20 && t.orderStatus === "PREPARING",
    text:  t => `שולחן ${t.tableNum} — מתבשל ${t.minutesSitting} דק׳, עדכן סועדים` },

  // Just sat — take order
  { priority: 55, type: "tip",
    match: t => t.availStatus === "occupied" && t.minutesSitting < 5 && t.orderStatus === null,
    text:  t => `שולחן ${t.tableNum} — זה עתה ישב, קח הזמנה` },

  // Order pending approval
  { priority: 50, type: "tip",
    match: t => t.availStatus === "occupied" && t.minutesSitting < 5 && t.orderStatus === "PENDING",
    text:  t => `שולחן ${t.tableNum} — הזמנה ממתינה לאישור` },

  // High bill — VIP treatment
  { priority: 45, type: "tip",
    match: t => t.availStatus === "occupied" && t.totalAmount >= 300,
    text:  t => `שולחן ${t.tableNum} — חשבון ₪${Math.round(t.totalAmount)}, תן שירות VIP` },

  // Multiple orders — make sure everything was served
  { priority: 42, type: "tip",
    match: t => t.availStatus === "occupied" && t.orderCount >= 2,
    text:  t => `שולחן ${t.tableNum} — ${t.orderCount} הזמנות, ודא שהכל הוגש` },

  // Large group — offer sharing plates
  { priority: 40, type: "tip",
    match: t => t.availStatus === "occupied" && t.guests >= 6,
    text:  t => `שולחן ${t.tableNum} — קבוצה גדולה (${t.guests} סועדים), הצע מנות לשיתוף` },

  // No new order 30+ min after delivery — offer round/bill
  { priority: 63, type: "tip",
    match: t => t.availStatus === "occupied" && t.orderStatus === "DELIVERED" && t.minutesSinceLastOrder >= 30,
    text:  t => `שולחן ${t.tableNum} — ${t.minutesSinceLastOrder} דק׳ מאז ההגשה, הצע סבב נוסף או חשבון` },

  // Payment completed — clear table
  { priority: 49, type: "tip",
    match: t => t.orderStatus === "PAID",
    text:  t => `שולחן ${t.tableNum} — תשלום הושלם, נקה ואפס שולחן` },

  // Loyalty member — personal greeting
  { priority: 44, type: "tip",
    match: t => (t.availStatus === "occupied" || t.availStatus === "bill_requested") && t.isLoyaltyMember,
    text:  t => `שולחן ${t.tableNum} — לקוח נאמן, קבל בברכה אישית` },

  // ── INFO ────────────────────────────────────────────────────────────────────

  // Full table
  { priority: 30, type: "info",
    match: t => t.availStatus === "occupied" && t.guests > 0 && t.seats > 0 && t.guests >= t.seats,
    text:  t => `שולחן ${t.tableNum} — שולחן מלא (${t.guests}/${t.seats})` },

  // Empty seats — suggest joining
  { priority: 27, type: "info",
    match: t => t.availStatus === "occupied" && t.guests > 0 && t.seats > 0 && t.guests < t.seats - 2,
    text:  t => `שולחן ${t.tableNum} — ${t.guests}/${t.seats} מקומות תפוסים, ניתן להוסיף סועדים` },

  // Couple at large table
  { priority: 25, type: "info",
    match: t => t.availStatus === "occupied" && t.guests > 0 && t.guests <= 2 && t.seats >= 6,
    text:  t => `שולחן ${t.tableNum} — זוג בשולחן ל-${t.seats}, שקול שיבוץ נוח יותר` },

  // Order just confirmed — tracking start
  { priority: 22, type: "info",
    match: t => t.availStatus === "occupied" && t.minutesSitting < 3 && t.orderStatus === "CONFIRMED",
    text:  t => `שולחן ${t.tableNum} — הזמנה אושרה, בישול התחיל` },

  // Reserved — prepare the table
  { priority: 20, type: "info",
    match: t => t.availStatus === "reserved",
    text:  t => `שולחן ${t.tableNum} — שמור, יש להכין` },
];

// ── Custom rule evaluation ────────────────────────────────────────────────────

function evalCondition(t: TableInput, c: Condition): boolean {
  const actual = t[c.field as keyof TableInput] as string | number | null;
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
  maxResults = 3,
): Insight[] {
  const best = new Map<string, Insight>();

  function trySet(ins: Insight) {
    const cur = best.get(ins.tableNum);
    if (!cur || ins.priority > cur.priority) best.set(ins.tableNum, ins);
  }

  for (const table of tables) {
    // Built-in rules — sorted highest priority first; first match wins
    for (const rule of BUILTIN_RULES) {
      if (rule.match(table)) {
        trySet({ tableNum: table.tableNum, type: rule.type, text: rule.text(table), priority: rule.priority });
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

// ── Built-in rule labels (for admin UI display) ───────────────────────────────

export const DEFAULT_RULE_LABELS: { text: string; type: InsightType; priority: number }[] = [
  { priority: 105, type: "alert", text: "מוכן 15+ דק׳ ומתקרר — הגש מיד!" },
  { priority: 100, type: "alert", text: "הזמנה בסטטוס READY — יש להגיש" },
  { priority: 97,  type: "alert", text: "הזמנה בוטלה — יש לבדוק" },
  { priority: 92,  type: "alert", text: "ישיבה 90+ דקות — שקול חשבון" },
  { priority: 90,  type: "alert", text: "חשבון התבקש 10+ דק׳ ולא הוגש — הבא חשבון" },
  { priority: 88,  type: "alert", text: "CONFIRMED 60+ דקות — תקוע במטבח?" },
  { priority: 85,  type: "alert", text: "30+ דקות ללא הזמנה פתוחה" },
  { priority: 83,  type: "alert", text: "חשבון התבקש — יש להגיש" },
  { priority: 80,  type: "alert", text: "שמור 20+ דקות — האם הגיע?" },
  { priority: 79,  type: "alert", text: "אלרגיה/הגבלה תזונתית מסומנת — שים לב במטבח!" },
  { priority: 70,  type: "tip",   text: "45+ דקות + DELIVERED — הצע קינוח/קפה" },
  { priority: 68,  type: "tip",   text: "30+ דקות + DELIVERED — הצע משקאות" },
  { priority: 65,  type: "tip",   text: "20+ דקות + CONFIRMED — בדוק מטבח" },
  { priority: 63,  type: "tip",   text: "30+ דק׳ ללא הזמנה חדשה אחרי DELIVERED — סבב/חשבון" },
  { priority: 60,  type: "tip",   text: "20+ דקות + PREPARING — עדכן סועדים" },
  { priority: 55,  type: "tip",   text: "זה עתה ישב + ללא הזמנה — קח הזמנה" },
  { priority: 50,  type: "tip",   text: "הזמנה PENDING — ממתינה לאישור" },
  { priority: 49,  type: "tip",   text: "תשלום הושלם — נקה ואפס שולחן" },
  { priority: 45,  type: "tip",   text: "חשבון ₪300+ — שירות VIP" },
  { priority: 44,  type: "tip",   text: "לקוח נאמן — קבל בברכה אישית" },
  { priority: 42,  type: "tip",   text: "2+ הזמנות — ודא שהכל הוגש" },
  { priority: 40,  type: "tip",   text: "6+ סועדים — הצע מנות לשיתוף" },
  { priority: 30,  type: "info",  text: "שולחן מלא (סועדים ≥ מושבים)" },
  { priority: 27,  type: "info",  text: "מקומות פנויים — ניתן להוסיף סועדים" },
  { priority: 25,  type: "info",  text: "זוג בשולחן גדול — שקול שיבוץ" },
  { priority: 22,  type: "info",  text: "הזמנה אושרה — בישול התחיל" },
  { priority: 20,  type: "info",  text: "שולחן שמור — יש להכין" },
];
