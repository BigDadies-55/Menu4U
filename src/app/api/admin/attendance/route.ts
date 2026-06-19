import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Attendance" (
      "id"           TEXT NOT NULL,
      "userId"       TEXT NOT NULL,
      "restaurantId" TEXT NOT NULL,
      "type"         TEXT NOT NULL,
      "date"         TEXT NOT NULL,
      "timestamp"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "note"         TEXT,
      "editedBy"     TEXT,
      "editNote"     TEXT,
      CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
    )
  `);
  // Add audit columns if they don't exist (for existing tables)
  await prisma.$executeRawUnsafe(`ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "editedBy" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "editNote" TEXT`);
  // Role at check-in (task 4) + scheduling flags (task 5)
  await prisma.$executeRawUnsafe(`ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "roleCode" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "unscheduled" BOOLEAN NOT NULL DEFAULT false`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "outOfWindow" BOOLEAN NOT NULL DEFAULT false`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Attendance_userId_date_idx" ON "Attendance"("userId","date")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Attendance_restaurantId_date_idx" ON "Attendance"("restaurantId","date")`);
}

// Per-restaurant attendance config: grace window + role/pay-code list.
type AttRoleCfg = { code: string; label: string; payCode: string; color: string };
const DEFAULT_ATT_ROLES: AttRoleCfg[] = [
  { code: "WAITER",    label: "מלצר",   payCode: "100", color: "#3b82f6" },
  { code: "BARTENDER", label: "ברמן",   payCode: "200", color: "#a855f7" },
  { code: "SHIFT_MGR", label: "אחמ״ש", payCode: "300", color: "#f59e0b" },
];
const DEFAULT_GRACE_MINUTES = 10;

async function ensureConfigTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AttendanceConfig" (
      "restaurantId" TEXT NOT NULL,
      "graceMinutes" INTEGER NOT NULL DEFAULT ${DEFAULT_GRACE_MINUTES},
      "rolesJson"    TEXT,
      CONSTRAINT "AttendanceConfig_pkey" PRIMARY KEY ("restaurantId")
    )
  `);
}

async function getConfig(restaurantId: string): Promise<{ graceMinutes: number; roles: AttRoleCfg[] }> {
  await ensureConfigTable();
  const rows = await prisma.$queryRawUnsafe<{ graceMinutes: number; rolesJson: string | null }[]>(
    `SELECT "graceMinutes","rolesJson" FROM "AttendanceConfig" WHERE "restaurantId"=$1`, restaurantId
  );
  if (rows.length === 0) return { graceMinutes: DEFAULT_GRACE_MINUTES, roles: DEFAULT_ATT_ROLES };
  let roles = DEFAULT_ATT_ROLES;
  try { if (rows[0].rolesJson) roles = JSON.parse(rows[0].rolesJson); } catch { /* keep default */ }
  return { graceMinutes: rows[0].graceMinutes ?? DEFAULT_GRACE_MINUTES, roles };
}

const ATT_MANAGER_ROLES = ["SUPER_ADMIN", "ADMIN", "OWNER", "SHIFT_MANAGER"];

// Minutes since midnight from "HH:MM".
function hmToMinutes(hm: string): number {
  const [h, m] = hm.slice(0, 5).split(":").map(Number);
  return h * 60 + (m || 0);
}

/**
 * Decide whether a check-in at `nowMin` (minutes since midnight) is on-schedule.
 * A check-in is in-window from (shiftStart − grace) until shiftEnd. Overnight
 * shifts (end ≤ start) are treated as wrapping past midnight.
 */
function evaluateSchedule(
  shifts: { startTime: string; endTime: string }[],
  nowMin: number,
  graceMinutes: number,
): { unscheduled: boolean; outOfWindow: boolean } {
  if (shifts.length === 0) return { unscheduled: true, outOfWindow: false };
  const inAnyWindow = shifts.some(s => {
    const start = hmToMinutes(s.startTime);
    let end = hmToMinutes(s.endTime);
    if (end <= start) end += 24 * 60; // overnight
    const open = start - graceMinutes;
    const n = nowMin < open - 1 ? nowMin + 24 * 60 : nowMin; // allow wrap for late-night
    return n >= open && n <= end;
  });
  return { unscheduled: false, outOfWindow: !inAnyWindow };
}

// Hard audit trail — one immutable row per manual change to an attendance record.
async function ensureAuditTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AttendanceAudit" (
      "id"              TEXT NOT NULL,
      "recordId"        TEXT NOT NULL,
      "restaurantId"    TEXT NOT NULL,
      "changedByUserId" TEXT NOT NULL,
      "changedByName"   TEXT,
      "action"          TEXT NOT NULL,
      "oldValue"        TEXT,
      "newValue"        TEXT,
      "reason"          TEXT NOT NULL,
      "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AttendanceAudit_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AttendanceAudit_recordId_idx" ON "AttendanceAudit"("recordId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AttendanceAudit_restaurantId_createdAt_idx" ON "AttendanceAudit"("restaurantId","createdAt")`);
}

type AttRow = { id: string; userId: string; restaurantId: string; type: string; date: string; timestamp: Date; note: string | null; editedBy: string | null; editNote: string | null; roleCode: string | null; unscheduled: boolean; outOfWindow: boolean };
type AuditRow = { id: string; recordId: string; restaurantId: string; changedByUserId: string; changedByName: string | null; action: string; oldValue: string | null; newValue: string | null; reason: string; createdAt: Date };

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId") ?? "";
  const from  = searchParams.get("from") ?? "";
  const to    = searchParams.get("to") ?? "";
  const userId = searchParams.get("userId") ?? "";

  // Config feed (grace window + roles). Available to any authenticated user so the
  // time-clock widget can render the role picker.
  if (searchParams.get("config")) {
    if (!restaurantId) return NextResponse.json({ error: "Missing restaurantId" }, { status: 400 });
    return NextResponse.json(await getConfig(restaurantId));
  }

  // Audit log feed (manager-only)
  if (searchParams.get("audit")) {
    const role = session.user.role ?? "";
    const isManager = ["SUPER_ADMIN", "ADMIN", "OWNER", "SHIFT_MANAGER"].includes(role);
    if (!isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!restaurantId) return NextResponse.json({ error: "Missing restaurantId" }, { status: 400 });
    await ensureAuditTable();
    const audit = await prisma.$queryRawUnsafe<AuditRow[]>(
      `SELECT * FROM "AttendanceAudit" WHERE "restaurantId"=$1 ORDER BY "createdAt" DESC LIMIT 500`,
      restaurantId
    );
    return NextResponse.json({ audit });
  }

  await ensureTable();

  let rows: AttRow[] = [];
  if (userId && !from) {
    const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" })).toISOString().slice(0, 10);
    rows = await prisma.$queryRawUnsafe<AttRow[]>(
      `SELECT * FROM "Attendance" WHERE "userId"=$1 AND "date"=$2 ORDER BY "timestamp" ASC`,
      userId, today
    );
  } else if (restaurantId && from && to) {
    rows = await prisma.$queryRawUnsafe<AttRow[]>(
      `SELECT * FROM "Attendance" WHERE "restaurantId"=$1 AND "date">=$2 AND "date"<=$3 ORDER BY "timestamp" ASC`,
      restaurantId, from, to
    );
  }

  return NextResponse.json({ records: rows });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { restaurantId, type, note, roleCode } = body as { restaurantId: string; type: "IN" | "OUT"; note?: string; roleCode?: string };

  if (!restaurantId || !["IN","OUT"].includes(type)) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  await ensureTable();

  const userId = session.user.id;
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  const date = now.toISOString().slice(0, 10);
  const id = randomUUID();

  // Task 5: on check-in, flag (but never block) entries that fall outside the
  // employee's scheduled shift window. Managers review flagged rows afterwards.
  let unscheduled = false, outOfWindow = false;
  if (type === "IN") {
    const { graceMinutes } = await getConfig(restaurantId);
    const shifts = await prisma.$queryRawUnsafe<{ startTime: string; endTime: string }[]>(
      `SELECT "startTime","endTime" FROM "Shift" WHERE "restaurantId"=$1 AND "userId"=$2 AND date=$3 AND status<>'CANCELLED'`,
      restaurantId, userId, date
    );
    const nowMin = now.getHours() * 60 + now.getMinutes();
    ({ unscheduled, outOfWindow } = evaluateSchedule(shifts, nowMin, graceMinutes));
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO "Attendance"("id","userId","restaurantId","type","date","note","roleCode","unscheduled","outOfWindow")
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    id, userId, restaurantId, type, date, note ?? null, roleCode ?? null, unscheduled, outOfWindow
  );

  return NextResponse.json({ id, type, timestamp: now.toISOString(), roleCode: roleCode ?? null, unscheduled, outOfWindow });
}

// Manager correction: manually edit a record's time. Requires a reason — every
// change is written to the immutable AttendanceAudit trail.
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role ?? "";
  const isManager = ATT_MANAGER_ROLES.includes(role);
  if (!isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();

  // Config update: grace window + roles (no record id, carries `config: true`).
  if (body.config) {
    const { restaurantId, graceMinutes, roles } = body as { restaurantId: string; graceMinutes?: number; roles?: AttRoleCfg[] };
    if (!restaurantId) return NextResponse.json({ error: "Missing restaurantId" }, { status: 400 });
    await ensureConfigTable();
    const grace = Math.max(0, Math.min(120, Math.round(Number(graceMinutes ?? DEFAULT_GRACE_MINUTES))));
    const rolesJson = JSON.stringify(Array.isArray(roles) ? roles : DEFAULT_ATT_ROLES);
    await prisma.$executeRawUnsafe(
      `INSERT INTO "AttendanceConfig"("restaurantId","graceMinutes","rolesJson") VALUES($1,$2,$3)
       ON CONFLICT ("restaurantId") DO UPDATE SET "graceMinutes"=EXCLUDED."graceMinutes", "rolesJson"=EXCLUDED."rolesJson"`,
      restaurantId, grace, rolesJson
    );
    return NextResponse.json({ ok: true });
  }

  const { id, newTimestamp, reason, oldValue, newValue } = body as {
    id: string; newTimestamp: string; reason: string; oldValue: string; newValue: string;
  };

  if (!id || !newTimestamp) return NextResponse.json({ error: "Missing params" }, { status: 400 });
  if (!reason || !reason.trim()) return NextResponse.json({ error: "סיבת השינוי היא שדה חובה" }, { status: 400 });

  const ts = new Date(newTimestamp);
  if (isNaN(ts.getTime())) return NextResponse.json({ error: "Invalid timestamp" }, { status: 400 });

  await ensureTable();
  await ensureAuditTable();

  const existing = await prisma.$queryRawUnsafe<AttRow[]>(`SELECT * FROM "Attendance" WHERE "id"=$1`, id);
  if (existing.length === 0) return NextResponse.json({ error: "Record not found" }, { status: 404 });

  await prisma.$executeRawUnsafe(
    `UPDATE "Attendance" SET "timestamp"=$1, "editedBy"=$2, "editNote"=$3 WHERE "id"=$4`,
    ts, session.user.id, reason.trim(), id
  );

  await prisma.$executeRawUnsafe(
    `INSERT INTO "AttendanceAudit"("id","recordId","restaurantId","changedByUserId","changedByName","action","oldValue","newValue","reason")
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    randomUUID(), id, existing[0].restaurantId, session.user.id,
    session.user.name ?? session.user.email ?? session.user.id,
    "EDIT", oldValue ?? null, newValue ?? null, reason.trim()
  );

  return NextResponse.json({ ok: true });
}

// Manager correction: DELETE (soft) a record. Requires a reason — written to the audit trail.
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role ?? "";
  const isManager = ["SUPER_ADMIN", "ADMIN", "OWNER", "SHIFT_MANAGER"].includes(role);
  if (!isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") ?? "";
  const reason = (searchParams.get("note") ?? "").trim();
  const oldValue = searchParams.get("oldValue") ?? "";

  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  if (!reason) return NextResponse.json({ error: "סיבת השינוי היא שדה חובה" }, { status: 400 });

  await ensureTable();
  await ensureAuditTable();

  const existing = await prisma.$queryRawUnsafe<AttRow[]>(`SELECT * FROM "Attendance" WHERE "id"=$1`, id);
  if (existing.length === 0) return NextResponse.json({ error: "Record not found" }, { status: 404 });

  // Soft-delete: mark with editedBy instead of hard delete, preserving the row.
  await prisma.$executeRawUnsafe(
    `UPDATE "Attendance" SET "type"='DELETED', "editedBy"=$1, "editNote"=$2 WHERE "id"=$3`,
    session.user.id, reason, id
  );

  await prisma.$executeRawUnsafe(
    `INSERT INTO "AttendanceAudit"("id","recordId","restaurantId","changedByUserId","changedByName","action","oldValue","newValue","reason")
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    randomUUID(), id, existing[0].restaurantId, session.user.id,
    session.user.name ?? session.user.email ?? session.user.id,
    "DELETE", oldValue || null, "(נמחק)", reason
  );

  return NextResponse.json({ ok: true });
}
