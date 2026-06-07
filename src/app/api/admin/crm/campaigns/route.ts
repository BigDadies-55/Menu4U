import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

async function ensureTables() {
  await Promise.allSettled([
    prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SmsCampaign" (
        "id" TEXT PRIMARY KEY,
        "restaurantId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        "scheduleConfig" TEXT NOT NULL DEFAULT '{}',
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "lastRunAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `),
    prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SmsLog" (
        "id" TEXT PRIMARY KEY,
        "restaurantId" TEXT NOT NULL,
        "campaignId" TEXT,
        "campaignName" TEXT,
        "message" TEXT NOT NULL,
        "sentCount" INTEGER NOT NULL DEFAULT 0,
        "failedCount" INTEGER NOT NULL DEFAULT 0,
        "sentAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `),
  ]);
}

async function checkAccess(userId: string, role: string, restaurantId: string) {
  if (role === "SUPER_ADMIN") return true;
  const access = await prisma.restaurantUser.findUnique({
    where: { userId_restaurantId: { userId, restaurantId } },
  });
  return !!access;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureTables();

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });
  if (!await checkAccess(session.user.id, session.user.role, restaurantId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  type CampaignRow = {
    id: string; restaurantId: string; name: string; type: string;
    message: string; scheduleConfig: string; isActive: boolean;
    lastRunAt: Date | null; createdAt: Date;
  };
  const campaigns = await prisma.$queryRawUnsafe<CampaignRow[]>(
    `SELECT * FROM "SmsCampaign" WHERE "restaurantId" = $1 ORDER BY "createdAt" DESC`,
    restaurantId
  );

  return NextResponse.json(campaigns.map(c => ({
    ...c,
    scheduleConfig: (() => { try { return JSON.parse(c.scheduleConfig); } catch { return {}; } })(),
  })));
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureTables();

  const { restaurantId, name, type, message, scheduleConfig } = await req.json();
  if (!restaurantId || !name || !type || !message)
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  if (message.length > 160)
    return NextResponse.json({ error: "message too long" }, { status: 400 });
  if (!await checkAccess(session.user.id, session.user.role, restaurantId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = `sms-${Date.now()}`;
  await prisma.$executeRawUnsafe(
    `INSERT INTO "SmsCampaign" ("id","restaurantId","name","type","message","scheduleConfig","isActive","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,true,NOW(),NOW())`,
    id, restaurantId, name, type, message, JSON.stringify(scheduleConfig ?? {})
  );

  return NextResponse.json({ id }, { status: 201 });
}
