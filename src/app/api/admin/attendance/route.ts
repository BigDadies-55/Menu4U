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
      CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Attendance_userId_date_idx" ON "Attendance"("userId","date")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Attendance_restaurantId_date_idx" ON "Attendance"("restaurantId","date")`);
}

type AttRow = { id: string; userId: string; restaurantId: string; type: string; date: string; timestamp: Date; note: string | null };

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId") ?? "";
  const from  = searchParams.get("from") ?? "";
  const to    = searchParams.get("to") ?? "";
  const userId = searchParams.get("userId") ?? "";

  await ensureTable();

  let rows: AttRow[] = [];
  if (userId && !from) {
    // Today for a specific user (waiter self-check)
    const today = new Date().toISOString().slice(0, 10);
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
  const { restaurantId, type, note } = body as { restaurantId: string; type: "IN" | "OUT"; note?: string };

  if (!restaurantId || !["IN","OUT"].includes(type)) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  await ensureTable();

  const userId = session.user.id;
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  const date = now.toISOString().slice(0, 10);
  const id = randomUUID();

  await prisma.$executeRawUnsafe(
    `INSERT INTO "Attendance"("id","userId","restaurantId","type","date","note") VALUES($1,$2,$3,$4,$5,$6)`,
    id, userId, restaurantId, type, date, note ?? null
  );

  return NextResponse.json({ id, type, timestamp: now.toISOString() });
}
