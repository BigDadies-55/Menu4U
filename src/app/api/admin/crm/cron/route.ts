import { prisma } from "@/lib/prisma";
import { sendSmsBulk } from "@/lib/sms";
import { NextResponse } from "next/server";

// Called by cron-job.org every hour
// URL: /api/admin/crm/cron?secret=CRON_SECRET
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const provided = searchParams.get("secret") ?? "";
  const expected = process.env.CRON_SECRET ?? "";
  if (provided !== expected) {
    return NextResponse.json({
      error: "Forbidden",
      debug: {
        envSet: !!process.env.CRON_SECRET,
        providedLength: provided.length,
        expectedLength: expected.length,
        match: provided === expected,
      }
    }, { status: 403 });
  }

  type CampaignRow = {
    id: string; restaurantId: string; name: string; type: string;
    message: string; scheduleConfig: string;
    lastRunAt: Date | null;
  };

  const campaigns = await prisma.$queryRawUnsafe<CampaignRow[]>(
    `SELECT * FROM "SmsCampaign" WHERE "isActive" = true`
  );

  const now = new Date();
  const results: { id: string; name: string; sent: number; skipped?: boolean }[] = [];

  for (const c of campaigns) {
    let config: Record<string, unknown> = {};
    try { config = JSON.parse(c.scheduleConfig); } catch { config = {}; }

    const shouldRun = checkShouldRun(c.type, config, now, c.lastRunAt);
    if (!shouldRun) { results.push({ id: c.id, name: c.name, sent: 0, skipped: true }); continue; }

    // Build member query based on type
    const phones = await getTargetPhones(c.restaurantId, c.type, config, now);
    if (phones.length === 0) { results.push({ id: c.id, name: c.name, sent: 0 }); continue; }

    const { sent, failed } = await sendSmsBulk(phones, c.message);

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

async function getTargetPhones(
  restaurantId: string,
  type: string,
  config: Record<string, unknown>,
  now: Date
): Promise<string[]> {
  type PhoneRow = { phone: string };

  switch (type) {
    case "SCHEDULED":
    case "WEEKLY":
    case "MONTHLY":
      return (await prisma.$queryRawUnsafe<PhoneRow[]>(
        `SELECT "phone" FROM "LoyaltyMember" WHERE "restaurantId" = $1`, restaurantId
      )).map(r => r.phone);

    case "BIRTHDAY": {
      const month = now.getMonth() + 1;
      const day = now.getDate();
      return (await prisma.$queryRawUnsafe<PhoneRow[]>(
        `SELECT "phone" FROM "LoyaltyMember"
         WHERE "restaurantId" = $1
           AND EXTRACT(MONTH FROM "birthDate") = $2
           AND EXTRACT(DAY FROM "birthDate") = $3`,
        restaurantId, month, day
      )).map(r => r.phone);
    }

    case "INACTIVE": {
      const days = (config.inactiveDays as number) ?? 30;
      const cutoff = new Date(now.getTime() - days * 86400000).toISOString();
      return (await prisma.$queryRawUnsafe<PhoneRow[]>(
        `SELECT lm."phone" FROM "LoyaltyMember" lm
         WHERE lm."restaurantId" = $1
           AND NOT EXISTS (
             SELECT 1 FROM "Order" o
             WHERE o."restaurantId" = $1
               AND o."customerPhone" = lm."phone"
               AND o."createdAt" > $2
           )`,
        restaurantId, cutoff
      )).map(r => r.phone);
    }

    case "POINTS_MILESTONE": {
      const threshold = (config.pointsThreshold as number) ?? 100;
      return (await prisma.$queryRawUnsafe<PhoneRow[]>(
        `SELECT "phone" FROM "LoyaltyMember"
         WHERE "restaurantId" = $1 AND "points" >= $2`,
        restaurantId, threshold
      )).map(r => r.phone);
    }

    case "COUPON_EXPIRY": {
      const days = (config.daysBeforeExpiry as number) ?? 3;
      const from = now.toISOString();
      const to = new Date(now.getTime() + days * 86400000).toISOString();
      type CouponPhoneRow = { phone: string };
      return (await prisma.$queryRawUnsafe<CouponPhoneRow[]>(
        `SELECT DISTINCT lm."phone"
         FROM "LoyaltyMember" lm
         JOIN "LoyaltyCoupon" lc ON lc."memberId" = lm."id"
         WHERE lm."restaurantId" = $1
           AND lc."usedAt" IS NULL
           AND lc."expiresAt" BETWEEN $2 AND $3`,
        restaurantId, from, to
      )).map(r => r.phone);
    }

    default:
      return [];
  }
}
