import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendSmsBulkPersonalized, SmsConfigError, isSmsConfigured } from "@/lib/sms";
import { NextResponse } from "next/server";

const MANAGER_ROLES = ["SUPER_ADMIN", "ADMIN", "OWNER", "SHIFT_MANAGER"];

const DAY_SHORT = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

function fmtDateShort(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function buildMessage(name: string, weekFrom: string, weekTo: string, shiftsForUser: {
  date: string; startTime: string; endTime: string;
}[]): string {
  const parts = shiftsForUser.map(s => {
    const d = new Date(s.date + "T00:00:00");
    return `${DAY_SHORT[d.getDay()]} ${fmtDateShort(s.date)} ${s.startTime.slice(0,5)}-${s.endTime.slice(0,5)}`;
  });
  return `${name} ${fmtDateShort(weekFrom)}-${fmtDateShort(weekTo)}: ${parts.join(", ")}`;
}

// GET /api/admin/shifts/sms?restaurantId=...&limit=50
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");
  const limit = parseInt(searchParams.get("limit") ?? "50");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  if (session.user.role !== "SUPER_ADMIN") {
    const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "RestaurantUser" WHERE "restaurantId"=$1 AND "userId"=$2 LIMIT 1`,
      restaurantId, session.user.id
    );
    if (!rows.length) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let logs: Record<string, unknown>[] = [];
  let stats: { week: string; total: number; failed: number }[] = [];
  try {
    logs = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM "ShiftSmsLog" WHERE "restaurantId"=$1 ORDER BY "sentAt" DESC LIMIT $2`,
      restaurantId, limit
    );
    const rawStats = await prisma.$queryRawUnsafe<{ week: string; total: bigint; failed: bigint }[]>(
      `SELECT "weekFrom" || ' – ' || "weekTo" AS week,
              COUNT(*) AS total,
              COUNT(*) FILTER (WHERE status='FAILED') AS failed
       FROM "ShiftSmsLog" WHERE "restaurantId"=$1
       GROUP BY "weekFrom","weekTo" ORDER BY MAX("sentAt") DESC LIMIT 10`,
      restaurantId
    );
    stats = rawStats.map(s => ({ ...s, total: Number(s.total), failed: Number(s.failed) }));
  } catch { /* table may not exist yet */ }

  return NextResponse.json({ logs, stats, smsConfigured: isSmsConfigured() });
}

// POST /api/admin/shifts/sms — send shifts SMS for a week
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!MANAGER_ROLES.includes(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { restaurantId, weekFrom, weekTo, targetUserId, shiftCfg } = await req.json() as {
    restaurantId: string;
    weekFrom: string;
    weekTo: string;
    targetUserId?: string; // undefined = all
    shiftCfg: { key: string; label: string }[];
  };

  if (!restaurantId || !weekFrom || !weekTo)
    return NextResponse.json({ error: "restaurantId, weekFrom, weekTo required" }, { status: 400 });

  // Fetch shifts for the week
  type ShiftRow = { id: string; userId: string; date: string; shiftType: string; startTime: string; endTime: string; userName: string; userEmail: string; phone: string | null };
  const shifts = await prisma.$queryRawUnsafe<ShiftRow[]>(
    `SELECT s.*, u.name AS "userName", u.email AS "userEmail", u.phone AS phone
     FROM "Shift" s
     LEFT JOIN "User" u ON u.id = s."userId"
     WHERE s."restaurantId"=$1 AND s.date >= $2 AND s.date <= $3
     ${targetUserId ? `AND s."userId"=$4` : ""}
     ORDER BY s.date, s."startTime"`,
    ...(targetUserId ? [restaurantId, weekFrom, weekTo, targetUserId] : [restaurantId, weekFrom, weekTo])
  );

  if (!shifts.length) return NextResponse.json({ sent: 0, failed: 0, skipped: 0 });

  // Group by user
  const byUser = new Map<string, ShiftRow[]>();
  for (const s of shifts) {
    if (!byUser.has(s.userId)) byUser.set(s.userId, []);
    byUser.get(s.userId)!.push(s);
  }

  const labelMap = Object.fromEntries(shiftCfg.map(c => [c.key, c.label]));

  let sent = 0, failed = 0, skipped = 0;
  const logEntries: { userId: string; name: string; phone: string; message: string; status: string }[] = [];

  for (const [userId, userShifts] of byUser) {
    const first = userShifts[0];
    const phone = first.phone;
    const name  = (first.userName || first.userEmail || "").trim().split(/\s+/)[0] || "שלום";

    if (!phone) { skipped++; continue; }

    const shiftsWithLabel = userShifts.map(s => ({
      ...s,
      label: labelMap[s.shiftType] ?? s.shiftType,
    }));

    const message = buildMessage(name, weekFrom, weekTo, shiftsWithLabel);
    logEntries.push({ userId, name: first.userName ?? first.userEmail ?? "", phone, message, status: "PENDING" });
  }

  // Send via Inforu — one by one (different message per person)
  if (!isSmsConfigured()) return NextResponse.json({ error: "SMS לא מוגדר — נדרש INFORU_USERNAME ו-INFORU_API_TOKEN" }, { status: 503 });

  for (const entry of logEntries) {
    try {
      const r = await sendSmsBulkPersonalized([{ phone: entry.phone }], entry.message);
      entry.status = r.sent > 0 ? "SENT" : "FAILED";
      if (r.sent > 0) sent++; else failed++;
    } catch {
      entry.status = "FAILED";
      failed++;
    }
  }

  // Log to DB (fail-safe — table may not exist yet)
  for (const e of logEntries) {
    try {
      const id = crypto.randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "ShiftSmsLog" (id,"restaurantId","sentByUserId","weekFrom","weekTo","recipientId","recipientName","phone","message","status")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        id, restaurantId, session.user.id, weekFrom, weekTo,
        e.userId, e.name, e.phone, e.message, e.status
      );
    } catch { /* log table may not exist yet — ignore */ }
  }

  return NextResponse.json({ sent, failed, skipped });
}
