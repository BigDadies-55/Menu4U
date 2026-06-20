import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { logAudit, getIp } from "@/lib/audit";

// ── Employee requests: time corrections + leave ──────────────────────────────
// Employees submit a correction request (a missed/incorrect punch) or a leave
// request. Managers review them on the manager dashboard. Approving/rejecting is
// a decision log — it never silently mutates attendance.

const VIEW_ROLES    = ["SUPER_ADMIN", "ADMIN", "OWNER", "SHIFT_MANAGER"]; // can see everyone's
const APPROVE_ROLES = ["SUPER_ADMIN", "ADMIN", "OWNER"];                  // can decide (others = RO)

async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AttendanceRequest" (
      "id"             TEXT NOT NULL,
      "userId"         TEXT NOT NULL,
      "userName"       TEXT,
      "restaurantId"   TEXT NOT NULL,
      "kind"           TEXT NOT NULL,
      "fromDate"       TEXT NOT NULL,
      "toDate"         TEXT,
      "details"        TEXT,
      "reason"         TEXT NOT NULL,
      "status"         TEXT NOT NULL DEFAULT 'PENDING',
      "decidedByUserId" TEXT,
      "decidedByName"  TEXT,
      "decisionNote"   TEXT,
      "decidedAt"      TIMESTAMP(3),
      "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AttendanceRequest_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "AttendanceRequest_restaurantId_status_idx" ON "AttendanceRequest"("restaurantId","status")`
  );
}

type ReqRow = {
  id: string; userId: string; userName: string | null; restaurantId: string;
  kind: string; fromDate: string; toDate: string | null; details: string | null; reason: string;
  status: string; decidedByUserId: string | null; decidedByName: string | null;
  decisionNote: string | null; decidedAt: Date | null; createdAt: Date;
};

// GET ?restaurantId[&status] — managers see all, employees see only their own.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId") ?? "";
  if (!restaurantId) return NextResponse.json({ error: "Missing restaurantId" }, { status: 400 });

  await ensureTable();
  const isManager = VIEW_ROLES.includes(session.user.role ?? "");

  const rows = isManager
    ? await prisma.$queryRawUnsafe<ReqRow[]>(
        `SELECT * FROM "AttendanceRequest" WHERE "restaurantId"=$1 ORDER BY "createdAt" DESC LIMIT 500`,
        restaurantId
      )
    : await prisma.$queryRawUnsafe<ReqRow[]>(
        `SELECT * FROM "AttendanceRequest" WHERE "restaurantId"=$1 AND "userId"=$2 ORDER BY "createdAt" DESC LIMIT 200`,
        restaurantId, session.user.id
      );

  return NextResponse.json({ requests: rows, canApprove: APPROVE_ROLES.includes(session.user.role ?? "") });
}

// POST — the signed-in employee files a request.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { restaurantId, kind, fromDate, toDate, details, reason } = body as {
    restaurantId: string; kind: "CORRECTION" | "LEAVE"; fromDate: string; toDate?: string;
    details?: unknown; reason?: string;
  };

  if (!restaurantId || !["CORRECTION", "LEAVE"].includes(kind) || !fromDate) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }
  if (!reason || !reason.trim()) return NextResponse.json({ error: "סיבה היא שדה חובה" }, { status: 400 });

  await ensureTable();
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "AttendanceRequest"("id","userId","userName","restaurantId","kind","fromDate","toDate","details","reason")
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    id, session.user.id, session.user.name ?? session.user.email ?? null, restaurantId, kind,
    fromDate, toDate ?? null, details != null ? JSON.stringify(details) : null, reason.trim()
  );

  const [row] = await prisma.$queryRawUnsafe<ReqRow[]>(`SELECT * FROM "AttendanceRequest" WHERE "id"=$1`, id);

  await logAudit({
    userId: session.user.id, userEmail: session.user.email,
    action: kind === "LEAVE" ? "ATTENDANCE_LEAVE_REQUEST" : "ATTENDANCE_CORRECTION_REQUEST",
    entity: "attendanceRequest", entityId: id,
    entityName: `${session.user.name ?? session.user.email ?? ""} · ${fromDate}`,
    meta: { restaurantId, kind, fromDate, toDate: toDate ?? null, details: details ?? null, reason: reason.trim() },
    ip: getIp(req),
  });

  return NextResponse.json({ request: row });
}

// PATCH — a manager with approval permission decides a request.
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!APPROVE_ROLES.includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "אין הרשאה לאשר בקשות" }, { status: 403 });
  }

  const body = await req.json();
  const { id, status, decisionNote } = body as { id: string; status: "APPROVED" | "REJECTED"; decisionNote?: string };
  if (!id || !["APPROVED", "REJECTED"].includes(status)) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  await ensureTable();
  const existing = await prisma.$queryRawUnsafe<ReqRow[]>(`SELECT * FROM "AttendanceRequest" WHERE "id"=$1`, id);
  if (existing.length === 0) return NextResponse.json({ error: "Request not found" }, { status: 404 });

  await prisma.$executeRawUnsafe(
    `UPDATE "AttendanceRequest" SET "status"=$1, "decidedByUserId"=$2, "decidedByName"=$3, "decisionNote"=$4, "decidedAt"=CURRENT_TIMESTAMP WHERE "id"=$5`,
    status, session.user.id, session.user.name ?? session.user.email ?? null, (decisionNote ?? "").trim() || null, id
  );

  // On approval of a time-correction, materialize the requested punch into the
  // attendance log, flagged as a correction so it renders in a distinct colour.
  const reqRow = existing[0];
  if (status === "APPROVED" && reqRow.kind === "CORRECTION" && reqRow.details) {
    try {
      const d = JSON.parse(reqRow.details) as { requestedType?: "IN" | "OUT"; requestedTime?: string };
      if (d.requestedType && d.requestedTime && /^\d{2}:\d{2}$/.test(d.requestedTime)) {
        // Same time-frame convention as live punches (wall-clock stored as UTC fields).
        const ts = new Date(`${reqRow.fromDate}T${d.requestedTime}:00.000Z`);
        if (!isNaN(ts.getTime())) {
          await prisma.$executeRawUnsafe(`ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "isCorrection" BOOLEAN NOT NULL DEFAULT false`);
          await prisma.$executeRawUnsafe(
            `INSERT INTO "Attendance"("id","userId","restaurantId","type","date","timestamp","note","isCorrection")
             VALUES($1,$2,$3,$4,$5,$6,$7,true)`,
            randomUUID(), reqRow.userId, reqRow.restaurantId, d.requestedType, reqRow.fromDate, ts,
            `תיקון מאושר: ${reqRow.reason}`.slice(0, 240)
          );
        }
      }
    } catch { /* malformed details — approval still recorded */ }
  }

  await logAudit({
    userId: session.user.id, userEmail: session.user.email,
    action: status === "APPROVED" ? "ATTENDANCE_REQUEST_APPROVE" : "ATTENDANCE_REQUEST_REJECT",
    entity: "attendanceRequest", entityId: id,
    entityName: `${reqRow.userName ?? reqRow.userId} · ${reqRow.kind === "LEAVE" ? "חופשה" : "תיקון שעות"} · ${reqRow.fromDate}`,
    meta: { restaurantId: reqRow.restaurantId, kind: reqRow.kind, status, decisionNote: (decisionNote ?? "").trim() || null, details: reqRow.details },
    ip: getIp(req),
  });

  return NextResponse.json({ ok: true });
}
