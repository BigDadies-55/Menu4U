import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { logAudit, getIp } from "@/lib/audit";

// ── Manager monthly release ───────────────────────────────────────────────────
// A manager finalises a month's attendance report and "releases" it. Only after a
// month is released can employees sign off on it. One row per (restaurant, month).

const MANAGER_ROLES = ["SUPER_ADMIN", "ADMIN", "OWNER", "SHIFT_MANAGER"];

async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AttendanceMonthRelease" (
      "id"             TEXT NOT NULL,
      "restaurantId"   TEXT NOT NULL,
      "month"          TEXT NOT NULL,
      "releasedByUserId" TEXT NOT NULL,
      "releasedByName" TEXT,
      "releasedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AttendanceMonthRelease_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`ALTER TABLE "AttendanceMonthRelease" ADD COLUMN IF NOT EXISTS "periodType" TEXT NOT NULL DEFAULT 'month'`);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "AttendanceMonthRelease_rest_month_idx" ON "AttendanceMonthRelease"("restaurantId","month")`
  );
}

type ReleaseRow = { id: string; restaurantId: string; month: string; periodType: string; releasedByUserId: string; releasedByName: string | null; releasedAt: Date };

// GET ?restaurantId&month — returns whether the month has been released.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId") ?? "";
  const month = searchParams.get("month") ?? "";
  const periodType = searchParams.get("periodType") === "week" ? "week" : "month";
  if (!restaurantId || !month) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  await ensureTable();
  const [row] = await prisma.$queryRawUnsafe<ReleaseRow[]>(
    `SELECT * FROM "AttendanceMonthRelease" WHERE "restaurantId"=$1 AND "month"=$2 AND "periodType"=$3`,
    restaurantId, month, periodType
  );
  return NextResponse.json({ released: !!row, release: row ?? null });
}

// POST { restaurantId, month } — manager releases the month for employee sign-off.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!MANAGER_ROLES.includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "רק מנהל יכול לאשר דוח חודשי" }, { status: 403 });
  }

  const { restaurantId, month, periodType: rawType } = (await req.json()) as { restaurantId?: string; month?: string; periodType?: string };
  const periodType = rawType === "week" ? "week" : "month";
  if (!restaurantId || !month) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  await ensureTable();
  const existing = await prisma.$queryRawUnsafe<ReleaseRow[]>(
    `SELECT * FROM "AttendanceMonthRelease" WHERE "restaurantId"=$1 AND "month"=$2 AND "periodType"=$3`,
    restaurantId, month, periodType
  );
  if (existing.length > 0) return NextResponse.json({ release: existing[0], alreadyReleased: true });

  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "AttendanceMonthRelease"("id","restaurantId","month","periodType","releasedByUserId","releasedByName") VALUES($1,$2,$3,$4,$5,$6)`,
    id, restaurantId, month, periodType, session.user.id, session.user.name ?? session.user.email ?? null
  );
  const [row] = await prisma.$queryRawUnsafe<ReleaseRow[]>(`SELECT * FROM "AttendanceMonthRelease" WHERE "id"=$1`, id);

  await logAudit({
    userId: session.user.id, userEmail: session.user.email,
    action: "ATTENDANCE_MONTH_RELEASE", entity: "attendanceMonthRelease", entityId: id,
    entityName: month, meta: { restaurantId, month }, ip: getIp(req),
  });

  return NextResponse.json({ release: row });
}

// DELETE ?restaurantId&month — manager reopens the month (undo release) for corrections.
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!MANAGER_ROLES.includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "רק מנהל יכול לפתוח דוח חודשי מחדש" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId") ?? "";
  const month = searchParams.get("month") ?? "";
  const periodType = searchParams.get("periodType") === "week" ? "week" : "month";
  if (!restaurantId || !month) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  await ensureTable();
  await prisma.$executeRawUnsafe(
    `DELETE FROM "AttendanceMonthRelease" WHERE "restaurantId"=$1 AND "month"=$2 AND "periodType"=$3`,
    restaurantId, month, periodType
  );
  await logAudit({
    userId: session.user.id, userEmail: session.user.email,
    action: "ATTENDANCE_MONTH_REOPEN", entity: "attendanceMonthRelease", entityId: `${restaurantId}:${month}`,
    entityName: month, meta: { restaurantId, month }, ip: getIp(req),
  });
  return NextResponse.json({ released: false });
}
