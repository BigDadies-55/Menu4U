import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const DEFAULT_SHIFT_TIMES: Record<string, { start: string; end: string }> = {
  MORNING:   { start: "07:00", end: "15:00" },
  AFTERNOON: { start: "12:00", end: "20:00" },
  EVENING:   { start: "17:00", end: "01:00" },
  NIGHT:     { start: "22:00", end: "06:00" },
};

async function getShiftTimes(restaurantId: string): Promise<Record<string, { start: string; end: string }>> {
  try {
    const rows = await prisma.$queryRawUnsafe<{ shiftConfig: string | null }[]>(
      `SELECT "shiftConfig" FROM "Restaurant" WHERE id = $1`, restaurantId
    );
    const raw = rows[0]?.shiftConfig;
    if (!raw) return DEFAULT_SHIFT_TIMES;
    const cfg: { key: string; startTime: string; endTime: string }[] = JSON.parse(raw);
    return Object.fromEntries(cfg.map(c => [c.key, { start: c.startTime, end: c.endTime }]));
  } catch {
    return DEFAULT_SHIFT_TIMES;
  }
}

const MANAGER_ROLES = ["SUPER_ADMIN", "ADMIN", "OWNER", "SHIFT_MANAGER"];

// GET /api/admin/shifts?restaurantId=...&from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!restaurantId || !from || !to) {
    return NextResponse.json(
      { error: "restaurantId, from, and to are required" },
      { status: 400 }
    );
  }

  // Verify user belongs to restaurant (or is SUPER_ADMIN)
  if (session.user.role !== "SUPER_ADMIN") {
    const membership = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "RestaurantUser" WHERE "restaurantId" = $1 AND "userId" = $2 LIMIT 1`,
      restaurantId,
      session.user.id
    );
    if (!membership || membership.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const shifts = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT s.*, u.name AS "userName", u.email AS "userEmail"
     FROM "Shift" s
     LEFT JOIN "User" u ON u.id = s."userId"
     WHERE s."restaurantId" = $1
       AND s.date >= $2::date
       AND s.date <= $3::date
     ORDER BY s.date ASC, s."startTime" ASC`,
    restaurantId,
    from,
    to
  );

  return NextResponse.json({ shifts });
}

// POST /api/admin/shifts
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!MANAGER_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { restaurantId, userId, date, shiftType } = body;

  if (!restaurantId || !userId || !date || !shiftType) {
    return NextResponse.json(
      { error: "restaurantId, userId, date, and shiftType are required" },
      { status: 400 }
    );
  }

  const shiftTimesMap = await getShiftTimes(restaurantId as string);
  const times = shiftTimesMap[shiftType as string];
  if (!times) {
    return NextResponse.json(
      { error: `Invalid shiftType` },
      { status: 400 }
    );
  }

  // Verify requester belongs to restaurant (or is SUPER_ADMIN)
  if (session.user.role !== "SUPER_ADMIN") {
    const membership = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "RestaurantUser" WHERE "restaurantId" = $1 AND "userId" = $2 LIMIT 1`,
      restaurantId,
      session.user.id
    );
    if (!membership || membership.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const id = crypto.randomUUID();

  await prisma.$executeRawUnsafe(
    `INSERT INTO "Shift" (id, "restaurantId", "userId", date, "shiftType", "startTime", "endTime", status, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4::date, $5, $6, $7, 'SCHEDULED', NOW(), NOW())`,
    id,
    restaurantId,
    userId,
    date,
    shiftType,
    times.start,
    times.end
  );

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT s.*, u.name AS "userName", u.email AS "userEmail"
     FROM "Shift" s
     LEFT JOIN "User" u ON u.id = s."userId"
     WHERE s.id = $1`,
    id
  );

  return NextResponse.json(rows[0], { status: 201 });
}
