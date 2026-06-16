import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PushSubscription" (
      "id"        TEXT NOT NULL,
      "userId"    TEXT NOT NULL,
      "endpoint"  TEXT NOT NULL,
      "p256dh"    TEXT NOT NULL,
      "auth"      TEXT NOT NULL,
      "events"    TEXT[] NOT NULL DEFAULT ARRAY['ORDER_CREATED','COURSE_DONE','TABLE_PAYMENT','ITEM_VOID']::TEXT[],
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_userId_endpoint_key" ON "PushSubscription"("userId","endpoint")`
  );
}

// POST — save or update a push subscription
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { endpoint, p256dh, auth: authKey, events } = await req.json();
  if (!endpoint || !p256dh || !authKey) return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });

  await ensureTable();

  const eventsArr = Array.isArray(events) && events.length > 0
    ? events
    : ["ORDER_CREATED", "COURSE_DONE", "TABLE_PAYMENT", "ITEM_VOID"];

  // Upsert by userId + endpoint
  await prisma.$executeRawUnsafe(
    `INSERT INTO "PushSubscription" ("id","userId","endpoint","p256dh","auth","events","createdAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5::text[], NOW())
     ON CONFLICT ("userId","endpoint") DO UPDATE SET "p256dh"=$3, "auth"=$4, "events"=$5::text[]`,
    session.user.id, endpoint, p256dh, authKey, `{${eventsArr.map((e: string) => `"${e}"`).join(",")}}`
  );

  return NextResponse.json({ ok: true });
}

// DELETE — remove subscription
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { endpoint } = await req.json();
  await ensureTable();
  await prisma.$executeRawUnsafe(
    `DELETE FROM "PushSubscription" WHERE "userId"=$1 AND "endpoint"=$2`,
    session.user.id, endpoint
  );
  return NextResponse.json({ ok: true });
}

// GET — return current events preferences for this device
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const endpoint = searchParams.get("endpoint");
  if (!endpoint) return NextResponse.json({ subscribed: false, events: [] });

  await ensureTable();
  type Row = { events: string[] };
  const rows = await prisma.$queryRawUnsafe<Row[]>(
    `SELECT events FROM "PushSubscription" WHERE "userId"=$1 AND "endpoint"=$2 LIMIT 1`,
    session.user.id, endpoint
  );
  if (!rows[0]) return NextResponse.json({ subscribed: false, events: [] });
  return NextResponse.json({ subscribed: true, events: rows[0].events });
}
