// ── Attendance automations engine ────────────────────────────────────────────
// Evaluates per-restaurant notification rules and dispatches reminders over the
// configured channels (Push / Email / SMS). Designed to be driven by a cron
// (idempotent — a NotificationLog row dedupes each reminder per period) and also
// invokable on-demand from the manager UI ("שלח עכשיו").

import { prisma } from "@/lib/prisma";
import { notifyUser, isPushConfigured } from "@/lib/push";
import { sendNotificationEmail, isEmailConfigured } from "@/lib/email";
import { sendSms, isSmsConfigured } from "@/lib/sms";

export type Channel = "PUSH" | "EMAIL" | "SMS";
export type RuleType = "MISSING_CHECKOUT" | "LONG_SHIFT" | "LATE_CHECKIN" | "MONTH_SIGNOFF" | "PENDING_REQUESTS_DIGEST";

export type RuleConfig = { thresholdHours?: number; lateMinutes?: number; dayOfMonth?: number };
export type NotificationRule = { type: RuleType; channels: Channel[]; enabled: boolean; config: RuleConfig };

const MANAGER_ROLES = ["SUPER_ADMIN", "ADMIN", "OWNER", "SHIFT_MANAGER"];

export const RULE_META: Record<RuleType, { label: string; desc: string; defaults: RuleConfig }> = {
  MISSING_CHECKOUT:        { label: "תזכורת יציאה", desc: "עובד עם כניסה ללא יציאה מעבר לסף שעות — תזכורת להחתים יציאה", defaults: { thresholdHours: 10 } },
  LONG_SHIFT:              { label: "משמרת ארוכה",  desc: "עובד עבר סף שעות רצופות — התראה לעובד ולמנהלים", defaults: { thresholdHours: 11 } },
  LATE_CHECKIN:            { label: "איחור בהחתמה", desc: "משמרת מתוכננת התחילה ואין החתמת כניסה", defaults: { lateMinutes: 30 } },
  MONTH_SIGNOFF:           { label: "אישור דוח חודשי", desc: "תזכורת בתחילת החודש לאשר את דוח החודש הקודם", defaults: { dayOfMonth: 1 } },
  PENDING_REQUESTS_DIGEST: { label: "בקשות ממתינות", desc: "סיכום יומי למנהלים על בקשות הממתינות לאישור", defaults: {} },
};

export const DEFAULT_RULES: NotificationRule[] = (Object.keys(RULE_META) as RuleType[]).map(type => ({
  type, channels: ["PUSH"], enabled: false, config: RULE_META[type].defaults,
}));

export async function ensureNotifTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "NotificationRule" (
      "restaurantId" TEXT NOT NULL,
      "type"         TEXT NOT NULL,
      "channels"     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      "enabled"      BOOLEAN NOT NULL DEFAULT false,
      "configJson"   TEXT,
      CONSTRAINT "NotificationRule_pkey" PRIMARY KEY ("restaurantId","type")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "NotificationLog" (
      "restaurantId" TEXT NOT NULL,
      "ruleType"     TEXT NOT NULL,
      "userId"       TEXT NOT NULL,
      "dateKey"      TEXT NOT NULL,
      "sentAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("restaurantId","ruleType","userId","dateKey")
    )
  `);
}

export async function getRules(restaurantId: string): Promise<NotificationRule[]> {
  await ensureNotifTables();
  const rows = await prisma.$queryRawUnsafe<{ type: string; channels: string[]; enabled: boolean; configJson: string | null }[]>(
    `SELECT "type","channels","enabled","configJson" FROM "NotificationRule" WHERE "restaurantId"=$1`,
    restaurantId
  );
  const byType = new Map(rows.map(r => [r.type, r]));
  return DEFAULT_RULES.map(def => {
    const row = byType.get(def.type);
    if (!row) return def;
    let config = def.config;
    try { if (row.configJson) config = { ...def.config, ...JSON.parse(row.configJson) }; } catch { /* keep default */ }
    return { type: def.type, channels: (row.channels as Channel[]) ?? [], enabled: row.enabled, config };
  });
}

export async function saveRules(restaurantId: string, rules: NotificationRule[]) {
  await ensureNotifTables();
  for (const r of rules) {
    if (!RULE_META[r.type]) continue;
    const channels = (r.channels ?? []).filter(c => ["PUSH", "EMAIL", "SMS"].includes(c));
    await prisma.$executeRawUnsafe(
      `INSERT INTO "NotificationRule"("restaurantId","type","channels","enabled","configJson")
       VALUES($1,$2,$3::text[],$4,$5)
       ON CONFLICT ("restaurantId","type") DO UPDATE SET
         "channels"=EXCLUDED."channels", "enabled"=EXCLUDED."enabled", "configJson"=EXCLUDED."configJson"`,
      restaurantId, r.type, `{${channels.map(c => `"${c}"`).join(",")}}`, !!r.enabled, JSON.stringify(r.config ?? {})
    );
  }
}

export function channelStatus() {
  return { PUSH: isPushConfigured(), EMAIL: isEmailConfigured(), SMS: isSmsConfigured() };
}

// ── Dispatch ────────────────────────────────────────────────────────────────
type Recipient = { id: string; name: string | null; email: string | null; phone: string | null; role: string };

function appBase() {
  return process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "https://menu4u.co.il";
}

async function alreadySent(restaurantId: string, ruleType: string, userId: string, dateKey: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ userId: string }[]>(
    `SELECT "userId" FROM "NotificationLog" WHERE "restaurantId"=$1 AND "ruleType"=$2 AND "userId"=$3 AND "dateKey"=$4`,
    restaurantId, ruleType, userId, dateKey
  );
  return rows.length > 0;
}

async function markSent(restaurantId: string, ruleType: string, userId: string, dateKey: string) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "NotificationLog"("restaurantId","ruleType","userId","dateKey") VALUES($1,$2,$3,$4)
     ON CONFLICT DO NOTHING`,
    restaurantId, ruleType, userId, dateKey
  );
}

async function dispatch(channels: Channel[], to: Recipient, title: string, body: string): Promise<boolean> {
  const url = `${appBase()}/admin/attendance-manager`;
  let any = false;
  if (channels.includes("PUSH")) { if (await notifyUser(to.id, { title, body, url, tag: "attendance" })) any = true; }
  if (channels.includes("EMAIL") && to.email && isEmailConfigured()) {
    try { await sendNotificationEmail(to.email, title, title, body.replace(/\n/g, "<br>"), { url, label: "פתח ניהול נוכחות" }); any = true; } catch { /* ignore */ }
  }
  if (channels.includes("SMS") && to.phone && isSmsConfigured()) {
    try { if (await sendSms(to.phone, `${title}\n${body}`)) any = true; } catch { /* ignore */ }
  }
  return any;
}

type EvalResult = { sent: number; checked: number; byRule: Record<string, number> };

/** Evaluate + dispatch all enabled rules for one restaurant. */
export async function evaluateRestaurant(restaurantId: string, now = new Date()): Promise<EvalResult> {
  const result: EvalResult = { sent: 0, checked: 0, byRule: {} };
  const rules = (await getRules(restaurantId)).filter(r => r.enabled && r.channels.length > 0);
  if (rules.length === 0) return result;

  const il = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  const today = il.toISOString().slice(0, 10);
  const nowMin = il.getHours() * 60 + il.getMinutes();

  // Roster.
  const staff = await prisma.$queryRawUnsafe<Recipient[]>(
    `SELECT u.id, u.name, u.email, u.phone, ru.role
     FROM "RestaurantUser" ru JOIN "User" u ON u.id = ru."userId"
     WHERE ru."restaurantId" = $1`,
    restaurantId
  );
  const staffById = new Map(staff.map(s => [s.id, s]));
  const managers = staff.filter(s => MANAGER_ROLES.includes(s.role));

  const bump = (type: string, n: number) => { result.byRule[type] = (result.byRule[type] ?? 0) + n; result.sent += n; };

  // Today's punches grouped per user (chronological).
  type Punch = { userId: string; type: string; timestamp: Date };
  const punches = await prisma.$queryRawUnsafe<Punch[]>(
    `SELECT "userId","type","timestamp" FROM "Attendance" WHERE "restaurantId"=$1 AND "date"=$2 AND "type"<>'DELETED' ORDER BY "timestamp" ASC`,
    restaurantId, today
  );
  const punchesByUser = new Map<string, Punch[]>();
  for (const p of punches) { const a = punchesByUser.get(p.userId) ?? []; a.push(p); punchesByUser.set(p.userId, a); }

  for (const rule of rules) {
    result.checked++;
    const hoursThreshold = rule.config.thresholdHours ?? RULE_META[rule.type].defaults.thresholdHours ?? 10;

    if (rule.type === "MISSING_CHECKOUT" || rule.type === "LONG_SHIFT") {
      for (const [userId, list] of punchesByUser) {
        const last = list[list.length - 1];
        if (last.type !== "IN") continue; // currently checked out
        const lastIn = [...list].reverse().find(p => p.type === "IN")!;
        const elapsedH = (il.getTime() - new Date(lastIn.timestamp).getTime()) / 3_600_000;
        if (elapsedH < hoursThreshold) continue;
        const user = staffById.get(userId);
        if (!user) continue;
        const dateKey = today;
        if (await alreadySent(restaurantId, rule.type, userId, dateKey)) continue;
        const title = rule.type === "MISSING_CHECKOUT" ? "🕐 תזכורת: שכחת להחתים יציאה?" : "⏰ משמרת ארוכה";
        const body = rule.type === "MISSING_CHECKOUT"
          ? `רשומה כניסה לפני ${elapsedH.toFixed(1)} שעות ללא יציאה. נא להחתים יציאה אם סיימת.`
          : `${user.name ?? ""} נמצא/ת ${elapsedH.toFixed(1)} שעות עבודה ברציפות היום.`;
        if (rule.type === "LONG_SHIFT") {
          // Notify the employee and managers.
          if (await dispatch(rule.channels, user, title, body)) bump(rule.type, 1);
          for (const mgr of managers) { if (mgr.id !== userId && await dispatch(rule.channels, mgr, title, body)) bump(rule.type, 1); }
        } else if (await dispatch(rule.channels, user, title, body)) {
          bump(rule.type, 1);
        }
        await markSent(restaurantId, rule.type, userId, dateKey);
      }
    }

    else if (rule.type === "LATE_CHECKIN") {
      const lateMin = rule.config.lateMinutes ?? 30;
      const shifts = await prisma.$queryRawUnsafe<{ userId: string; startTime: string }[]>(
        `SELECT "userId","startTime" FROM "Shift" WHERE "restaurantId"=$1 AND date=$2 AND status<>'CANCELLED'`,
        restaurantId, today
      );
      for (const sh of shifts) {
        const [h, m] = sh.startTime.slice(0, 5).split(":").map(Number);
        const startMin = h * 60 + (m || 0);
        if (nowMin < startMin + lateMin) continue; // not late yet
        const hasIn = (punchesByUser.get(sh.userId) ?? []).some(p => p.type === "IN");
        if (hasIn) continue;
        const user = staffById.get(sh.userId);
        if (!user) continue;
        if (await alreadySent(restaurantId, rule.type, sh.userId, today)) continue;
        const title = "⏱️ תזכורת החתמת כניסה";
        const body = `המשמרת שלך התחילה ב-${sh.startTime.slice(0, 5)} ועדיין לא נרשמה כניסה.`;
        if (await dispatch(rule.channels, user, title, body)) bump(rule.type, 1);
        await markSent(restaurantId, rule.type, sh.userId, today);
      }
    }

    else if (rule.type === "MONTH_SIGNOFF") {
      const dayOfMonth = rule.config.dayOfMonth ?? 1;
      if (il.getDate() !== dayOfMonth) continue;
      // Previous month.
      const prev = new Date(il.getFullYear(), il.getMonth() - 1, 1);
      const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
      const signed = await prisma.$queryRawUnsafe<{ userId: string }[]>(
        `SELECT "userId" FROM "AttendanceSignoff" WHERE "restaurantId"=$1 AND "month"=$2`,
        restaurantId, prevMonth
      ).catch(() => []);
      const signedSet = new Set(signed.map(s => s.userId));
      // Anyone who actually worked the previous month.
      const worked = await prisma.$queryRawUnsafe<{ userId: string }[]>(
        `SELECT DISTINCT "userId" FROM "Attendance" WHERE "restaurantId"=$1 AND "date" LIKE $2 AND "type"<>'DELETED'`,
        restaurantId, `${prevMonth}-%`
      );
      for (const w of worked) {
        if (signedSet.has(w.userId)) continue;
        const user = staffById.get(w.userId);
        if (!user) continue;
        if (await alreadySent(restaurantId, rule.type, w.userId, prevMonth)) continue;
        const title = "📝 נא לאשר את דוח הנוכחות שלך";
        const body = `דוח הנוכחות לחודש ${prevMonth} ממתין לאישורך. נא להיכנס למסך "אישור דוח" ולחתום.`;
        if (await dispatch(rule.channels, user, title, body)) bump(rule.type, 1);
        await markSent(restaurantId, rule.type, w.userId, prevMonth);
      }
    }

    else if (rule.type === "PENDING_REQUESTS_DIGEST") {
      const pend = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
        `SELECT COUNT(*)::bigint AS n FROM "AttendanceRequest" WHERE "restaurantId"=$1 AND "status"='PENDING'`,
        restaurantId
      ).catch(() => [{ n: BigInt(0) }]);
      const count = Number(pend[0]?.n ?? 0);
      if (count === 0) continue;
      for (const mgr of managers) {
        if (await alreadySent(restaurantId, rule.type, mgr.id, today)) continue;
        const title = "📥 בקשות ממתינות לאישור";
        const body = `${count} בקשות (תיקוני שעות / חופשה) ממתינות לאישורך במסך ניהול הנוכחות.`;
        if (await dispatch(rule.channels, mgr, title, body)) bump(rule.type, 1);
        await markSent(restaurantId, rule.type, mgr.id, today);
      }
    }
  }

  return result;
}

/** Evaluate every restaurant that has at least one enabled rule (cron entry-point). */
export async function evaluateAll(now = new Date()): Promise<{ restaurants: number; sent: number }> {
  await ensureNotifTables();
  const rows = await prisma.$queryRawUnsafe<{ restaurantId: string }[]>(
    `SELECT DISTINCT "restaurantId" FROM "NotificationRule" WHERE "enabled"=true AND array_length("channels",1) > 0`
  );
  let sent = 0;
  for (const r of rows) {
    try { const res = await evaluateRestaurant(r.restaurantId, now); sent += res.sent; } catch { /* per-restaurant isolation */ }
  }
  return { restaurants: rows.length, sent };
}
