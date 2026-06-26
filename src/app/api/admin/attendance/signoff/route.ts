import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { logAudit, getIp } from "@/lib/audit";
import { isPastPeriod, type PeriodType } from "@/lib/attendancePeriod";

// ── Employee period sign-off ─────────────────────────────────────────────────
// One immutable declaration per (employee, restaurant, period) attesting that the
// attendance figures are accurate. "period" is a month ("2026-05") or a week
// (Sunday date "2026-05-17"); periodType distinguishes them. Once signed it is
// locked (a re-sign attempt returns the existing row).

const MANAGER_ROLES = ["SUPER_ADMIN", "ADMIN", "OWNER", "SHIFT_MANAGER"];

async function isPeriodReleased(restaurantId: string, period: string, periodType: PeriodType): Promise<boolean> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AttendanceMonthRelease" (
      "id" TEXT NOT NULL, "restaurantId" TEXT NOT NULL, "month" TEXT NOT NULL,
      "releasedByUserId" TEXT NOT NULL, "releasedByName" TEXT,
      "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AttendanceMonthRelease_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`ALTER TABLE "AttendanceMonthRelease" ADD COLUMN IF NOT EXISTS "periodType" TEXT NOT NULL DEFAULT 'month'`);
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT "id" FROM "AttendanceMonthRelease" WHERE "restaurantId"=$1 AND "month"=$2 AND "periodType"=$3`,
    restaurantId, period, periodType
  );
  return rows.length > 0;
}

async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AttendanceSignoff" (
      "id"            TEXT NOT NULL,
      "userId"        TEXT NOT NULL,
      "userName"      TEXT,
      "restaurantId"  TEXT NOT NULL,
      "month"         TEXT NOT NULL,
      "netHours"      DOUBLE PRECISION NOT NULL DEFAULT 0,
      "regularHours"  DOUBLE PRECISION NOT NULL DEFAULT 0,
      "ot125Hours"    DOUBLE PRECISION NOT NULL DEFAULT 0,
      "ot150Hours"    DOUBLE PRECISION NOT NULL DEFAULT 0,
      "payableHours"  DOUBLE PRECISION NOT NULL DEFAULT 0,
      "signatureName" TEXT NOT NULL,
      "signedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AttendanceSignoff_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`ALTER TABLE "AttendanceSignoff" ADD COLUMN IF NOT EXISTS "periodType" TEXT NOT NULL DEFAULT 'month'`);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "AttendanceSignoff_user_rest_month_idx" ON "AttendanceSignoff"("userId","restaurantId","month")`
  );
}

type SignoffRow = {
  id: string; userId: string; userName: string | null; restaurantId: string; month: string;
  netHours: number; regularHours: number; ot125Hours: number; ot150Hours: number; payableHours: number;
  signatureName: string; signedAt: Date;
};

// GET ?restaurantId&month — managers see every sign-off for the month, employees
// see only their own.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId") ?? "";
  const month = searchParams.get("month") ?? "";
  if (!restaurantId || !month) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  await ensureTable();
  const isManager = MANAGER_ROLES.includes(session.user.role ?? "");

  const rows = isManager
    ? await prisma.$queryRawUnsafe<SignoffRow[]>(
        `SELECT * FROM "AttendanceSignoff" WHERE "restaurantId"=$1 AND "month"=$2 ORDER BY "signedAt" DESC`,
        restaurantId, month
      )
    : await prisma.$queryRawUnsafe<SignoffRow[]>(
        `SELECT * FROM "AttendanceSignoff" WHERE "restaurantId"=$1 AND "month"=$2 AND "userId"=$3`,
        restaurantId, month, session.user.id
      );

  return NextResponse.json({ signoffs: rows });
}

// POST — the signed-in employee signs off their own month. Idempotent and locked:
// if a sign-off already exists it is returned unchanged.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { restaurantId, month, periodType: rawType, netHours, regularHours, ot125Hours, ot150Hours, payableHours, signatureName } = body as {
    restaurantId: string; month: string; periodType?: string;
    netHours?: number; regularHours?: number; ot125Hours?: number; ot150Hours?: number; payableHours?: number;
    signatureName?: string;
  };
  const periodType: PeriodType = rawType === "week" ? "week" : "month";

  if (!restaurantId || !month) return NextResponse.json({ error: "Missing params" }, { status: 400 });
  const sig = (signatureName ?? session.user.name ?? session.user.email ?? "").trim();
  if (!sig) return NextResponse.json({ error: "חתימה היא שדה חובה" }, { status: 400 });

  // A report may be signed only for a period that has fully ended...
  if (!isPastPeriod(periodType, month)) {
    return NextResponse.json({ error: periodType === "week" ? "ניתן לאשר רק שבוע שהסתיים" : "ניתן לאשר רק חודש שהסתיים" }, { status: 400 });
  }
  // ...and only after the manager has released (finalised) that period.
  if (!(await isPeriodReleased(restaurantId, month, periodType))) {
    return NextResponse.json({ error: "הדוח טרם אושר ע\"י המנהל" }, { status: 400 });
  }

  await ensureTable();

  const existing = await prisma.$queryRawUnsafe<SignoffRow[]>(
    `SELECT * FROM "AttendanceSignoff" WHERE "userId"=$1 AND "restaurantId"=$2 AND "month"=$3`,
    session.user.id, restaurantId, month
  );
  if (existing.length > 0) return NextResponse.json({ signoff: existing[0], alreadySigned: true });

  const id = randomUUID();
  const num = (n: unknown) => (typeof n === "number" && isFinite(n) ? n : 0);
  await prisma.$executeRawUnsafe(
    `INSERT INTO "AttendanceSignoff"("id","userId","userName","restaurantId","month","periodType","netHours","regularHours","ot125Hours","ot150Hours","payableHours","signatureName")
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    id, session.user.id, session.user.name ?? session.user.email ?? null, restaurantId, month, periodType,
    num(netHours), num(regularHours), num(ot125Hours), num(ot150Hours), num(payableHours), sig
  );

  const [row] = await prisma.$queryRawUnsafe<SignoffRow[]>(`SELECT * FROM "AttendanceSignoff" WHERE "id"=$1`, id);

  await logAudit({
    userId: session.user.id, userEmail: session.user.email,
    action: "ATTENDANCE_SIGNOFF", entity: "attendanceSignoff", entityId: id,
    entityName: `${sig} · ${month}`,
    meta: { restaurantId, month, signatureName: sig, netHours: num(netHours), payableHours: num(payableHours) },
    ip: getIp(req),
  });

  return NextResponse.json({ signoff: row });
}
