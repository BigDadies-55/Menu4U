import { prisma } from "@/lib/prisma";
import { sendSmsBulkPersonalized, isSmsConfigured, type SmsRecipient } from "@/lib/sms";
import { NextResponse } from "next/server";

/** Map a loyalty member row to a personalized recipient. */
function toRecipient(m: { phone: string; name: string; points: number; memberNumber: string }): SmsRecipient {
  return {
    phone: m.phone,
    fields: {
      Name: m.name,
      FirstName: (m.name ?? "").trim().split(/\s+/)[0] ?? "",
      Points: m.points,
      MemberNumber: m.memberNumber,
    },
  };
}

// Called by cron-job.org every hour
// Authorization: Bearer <CRON_SECRET>
export async function GET(req: Request) {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const env = process.env.CRON_SECRET;
  if (!env || !bearer || bearer !== env) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  type CampaignRow = {
    id: string; restaurantId: string; name: string; type: string;
    message: string; scheduleConfig: string;
    lastRunAt: Date | null;
  };

  const campaigns = await prisma.$queryRawUnsafe<CampaignRow[]>(
    `SELECT * FROM "SmsCampaign" WHERE "isActive" = true`
  );

  if (!isSmsConfigured()) {
    return NextResponse.json(
      { error: "SMS gateway not configured (INFORU_USERNAME / INFORU_API_TOKEN missing)", ran: 0 },
      { status: 503 }
    );
  }

  const now = new Date();
  const results: { id: string; name: string; sent: number; skipped?: boolean }[] = [];

  for (const c of campaigns) {
    let config: Record<string, unknown> = {};
    try { config = JSON.parse(c.scheduleConfig); } catch { config = {}; }

    const shouldRun = checkShouldRun(c.type, config, now, c.lastRunAt);
    if (!shouldRun) { results.push({ id: c.id, name: c.name, sent: 0, skipped: true }); continue; }

    // Build member query based on type
    const recipients = await getTargetRecipients(c.restaurantId, c.type, config, now);
    if (recipients.length === 0) { results.push({ id: c.id, name: c.name, sent: 0 }); continue; }

    const { sent, failed } = await sendSmsBulkPersonalized(recipients, c.message);

    await prisma.$executeRawUnsafe(
      `UPDATE "SmsCampaign" SET "lastRunAt" = NOW(), "updatedAt" = NOW(),
       "isActive" = CASE WHEN "type" = 'SCHEDULED' THEN false ELSE "isActive" END
       WHERE "id" = $1`,
      c.id
    );

    await prisma.$executeRawUnsafe(
      `INSERT INTO "SmsLog" ("id","restaurantId","campaignId","campaignName","message","sentCount","failedCount","sentAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
      `log-${Date.now()}-${c.id}`, c.restaurantId, c.id, c.name, c.message, sent, failed
    );

    results.push({ id: c.id, name: c.name, sent });
  }

  return NextResponse.json({ ran: results.length, results });
}

function checkShouldRun(
  type: string,
  config: Record<string, unknown>,
  now: Date,
  lastRunAt: Date | null
): boolean {
  const hour = now.getHours();
  const minute = now.getMinutes();

  // Parse time from "HH:MM" string (saved by UI) or fallback to separate hour/minute fields
  let configHour = 10;
  let configMinute = 0;
  if (typeof config.time === "string" && config.time.includes(":")) {
    const [h, m] = config.time.split(":").map(Number);
    configHour = isNaN(h) ? 10 : h;
    configMinute = isNaN(m) ? 0 : m;
  } else {
    configHour = (config.hour as number) ?? 10;
    configMinute = (config.minute as number) ?? 0;
  }

  // cron runs every hour at :00 via GitHub Actions — match by hour, allow 10 min drift
  // configMinute is stored but only hour granularity is enforced (cron is hourly)
  void configMinute;
  const withinHour = hour === configHour && minute < 10;

  // Prevent double-run: skip if already ran within the last 50 minutes
  if (lastRunAt) {
    const minsSinceRun = (now.getTime() - new Date(lastRunAt).getTime()) / 60000;
    if (minsSinceRun < 50) return false;
  }

  switch (type) {
    case "SCHEDULED": {
      // UI saves date + time separately; combine into a timestamp
      let runAt: Date | null = null;
      if (config.runAt) {
        runAt = new Date(config.runAt as string);
      } else if (config.date && config.time) {
        runAt = new Date(`${config.date as string}T${config.time as string}:00`);
      }
      if (!runAt || isNaN(runAt.getTime())) return false;
      return Math.abs(now.getTime() - runAt.getTime()) < 3600000; // within 1h
    }
    case "WEEKLY":
      return now.getDay() === (config.dayOfWeek as number ?? 0) && withinHour;
    case "MONTHLY":
      return now.getDate() === (config.dayOfMonth as number ?? 1) && withinHour;
    case "BIRTHDAY":
    case "INACTIVE":
    case "POINTS_MILESTONE":
    case "COUPON_EXPIRY":
      return withinHour; // run daily at configured hour
    default:
      return false;
  }
}

async function getTargetRecipients(
  restaurantId: string,
  type: string,
  config: Record<string, unknown>,
  now: Date
): Promise<SmsRecipient[]> {
  type MemberRow = { phone: string; name: string; points: number; memberNumber: string };
  const COLS = `"phone", "name", "points", "memberNumber"`;

  // Single-member one-off (e.g. a scheduled coupon for one member)
  if (config.memberId) {
    const rows = await prisma.$queryRawUnsafe<MemberRow[]>(
      `SELECT ${COLS} FROM "LoyaltyMember" WHERE "restaurantId" = $1 AND "id" = $2`,
      restaurantId, config.memberId as string
    );
    return rows.map(toRecipient);
  }

  switch (type) {
    case "SCHEDULED":
    case "WEEKLY":
    case "MONTHLY":
      return (await prisma.$queryRawUnsafe<MemberRow[]>(
        `SELECT ${COLS} FROM "LoyaltyMember" WHERE "restaurantId" = $1`, restaurantId
      )).map(toRecipient);

    case "BIRTHDAY": {
      const month = now.getMonth() + 1;
      const day = now.getDate();
      return (await prisma.$queryRawUnsafe<MemberRow[]>(
        `SELECT ${COLS} FROM "LoyaltyMember"
         WHERE "restaurantId" = $1
           AND EXTRACT(MONTH FROM "birthDate") = $2
           AND EXTRACT(DAY FROM "birthDate") = $3`,
        restaurantId, month, day
      )).map(toRecipient);
    }

    case "INACTIVE": {
      const days = (config.inactiveDays as number) ?? 30;
      const cutoff = new Date(now.getTime() - days * 86400000).toISOString();
      return (await prisma.$queryRawUnsafe<MemberRow[]>(
        `SELECT lm."phone", lm."name", lm."points", lm."memberNumber" FROM "LoyaltyMember" lm
         WHERE lm."restaurantId" = $1
           AND NOT EXISTS (
             SELECT 1 FROM "Order" o
             WHERE o."restaurantId" = $1
               AND o."customerPhone" = lm."phone"
               AND o."createdAt" > $2
           )`,
        restaurantId, cutoff
      )).map(toRecipient);
    }

    case "POINTS_MILESTONE": {
      const threshold = (config.pointsThreshold as number) ?? 100;
      return (await prisma.$queryRawUnsafe<MemberRow[]>(
        `SELECT ${COLS} FROM "LoyaltyMember"
         WHERE "restaurantId" = $1 AND "points" >= $2`,
        restaurantId, threshold
      )).map(toRecipient);
    }

    case "COUPON_EXPIRY": {
      const days = (config.daysBeforeExpiry as number) ?? 3;
      const from = now.toISOString();
      const to = new Date(now.getTime() + days * 86400000).toISOString();
      return (await prisma.$queryRawUnsafe<MemberRow[]>(
        `SELECT DISTINCT lm."phone", lm."name", lm."points", lm."memberNumber"
         FROM "LoyaltyMember" lm
         JOIN "LoyaltyCoupon" lc ON lc."memberId" = lm."id"
         WHERE lm."restaurantId" = $1
           AND lc."usedAt" IS NULL
           AND lc."expiresAt" BETWEEN $2 AND $3`,
        restaurantId, from, to
      )).map(toRecipient);
    }

    default:
      return [];
  }
}
