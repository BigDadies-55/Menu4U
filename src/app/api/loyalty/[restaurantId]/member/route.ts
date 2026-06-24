import { prisma } from "@/lib/prisma";
import { checkRateLimit, getIpKey } from "@/lib/rateLimit";
import { NextResponse } from "next/server";

async function ensureTables() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "LoyaltyMember" (
        "id" TEXT PRIMARY KEY,
        "restaurantId" TEXT NOT NULL,
        "phone" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "email" TEXT,
        "birthDate" TIMESTAMP,
        "memberNumber" TEXT NOT NULL,
        "points" INTEGER NOT NULL DEFAULT 0,
        "totalSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE("restaurantId", "phone"),
        UNIQUE("restaurantId", "memberNumber")
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "LoyaltyTransaction" (
        "id" TEXT PRIMARY KEY,
        "memberId" TEXT NOT NULL,
        "orderId" TEXT,
        "type" TEXT NOT NULL,
        "points" INTEGER NOT NULL,
        "note" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "LoyaltyCoupon" (
        "id" TEXT PRIMARY KEY,
        "memberId" TEXT NOT NULL,
        "restaurantId" TEXT NOT NULL,
        "code" TEXT NOT NULL UNIQUE,
        "type" TEXT NOT NULL,
        "value" DOUBLE PRECISION NOT NULL,
        "description" TEXT,
        "usedAt" TIMESTAMP,
        "expiresAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "LoyaltySettings" (
        "restaurantId" TEXT PRIMARY KEY,
        "pointsPerShekel" DOUBLE PRECISION NOT NULL DEFAULT 1,
        "shekelPerPoint" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
        "minRedeemPoints" INTEGER NOT NULL DEFAULT 100,
        "welcomeBonus" INTEGER NOT NULL DEFAULT 50,
        "birthdayBonus" INTEGER NOT NULL DEFAULT 100,
        "isActive" BOOLEAN NOT NULL DEFAULT true
      )
    `);
  } catch { /* tables already exist */ }

  // Group support columns (best-effort)
  await Promise.allSettled([
    prisma.$executeRawUnsafe(`ALTER TABLE "LoyaltyMember" ADD COLUMN IF NOT EXISTS "groupId" TEXT`),
    prisma.$executeRawUnsafe(`ALTER TABLE "LoyaltyCoupon" ADD COLUMN IF NOT EXISTS "validForGroupId" TEXT`),
    prisma.$executeRawUnsafe(`ALTER TABLE "LoyaltyCoupon" ADD COLUMN IF NOT EXISTS "usedAtRestaurantId" TEXT`),
  ]);
}

async function getRestaurantGroupId(restaurantId: string): Promise<string | null> {
  try {
    type Row = { groupId: string | null };
    const rows = await prisma.$queryRawUnsafe<Row[]>(
      `SELECT "groupId" FROM "Restaurant" WHERE "id" = $1 LIMIT 1`,
      restaurantId
    );
    return rows[0]?.groupId ?? null;
  } catch { return null; }
}

type MemberRow = {
  id: string; restaurantId: string; groupId: string | null;
  phone: string; name: string; email: string | null;
  birthDate: Date | null; memberNumber: string;
  points: number; totalSpent: number;
  createdAt: Date; updatedAt: Date;
};
type TxRow = { id: string; memberId: string; orderId: string | null; type: string; points: number; note: string | null; createdAt: Date };
type CouponRow = { id: string; memberId: string; restaurantId: string; validForGroupId: string | null; usedAtRestaurantId: string | null; code: string; type: string; value: number; description: string | null; usedAt: Date | null; expiresAt: Date | null; createdAt: Date };

async function getMemberWithRelations(where: string, ...args: unknown[]) {
  const members = await prisma.$queryRawUnsafe<MemberRow[]>(
    `SELECT * FROM "LoyaltyMember" WHERE ${where} LIMIT 1`,
    ...args
  );
  const member = members[0];
  if (!member) return null;

  const [transactions, coupons] = await Promise.all([
    prisma.$queryRawUnsafe<TxRow[]>(
      `SELECT * FROM "LoyaltyTransaction" WHERE "memberId" = $1 ORDER BY "createdAt" DESC LIMIT 20`,
      member.id
    ),
    prisma.$queryRawUnsafe<CouponRow[]>(
      `SELECT * FROM "LoyaltyCoupon" WHERE "memberId" = $1 AND "usedAt" IS NULL ORDER BY "createdAt" DESC`,
      member.id
    ),
  ]);

  return { ...member, transactions, coupons };
}

export async function GET(req: Request, { params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params;
  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone");
  if (!phone) return NextResponse.json({ error: "phone required" }, { status: 400 });

  // Rate limit: 5 per IP per 5 min + 30 global per restaurant per 5 min
  const ip = getIpKey(req);
  const [perIp, perRestaurant] = await Promise.all([
    checkRateLimit(`member-get:${ip}:${restaurantId}`, 5, 5 * 60 * 1000),
    checkRateLimit(`member-get-global:${restaurantId}`, 30, 5 * 60 * 1000),
  ]);
  if (!perIp || !perRestaurant) return NextResponse.json({ error: "too_many_requests" }, { status: 429 });

  await ensureTables();

  // Try restaurant-specific lookup first (backward compat)
  let member = await getMemberWithRelations(`"restaurantId" = $1 AND "phone" = $2`, restaurantId, phone);

  // If not found and restaurant belongs to a group, search across the group
  if (!member) {
    const groupId = await getRestaurantGroupId(restaurantId);
    if (groupId) {
      member = await getMemberWithRelations(`"groupId" = $1 AND "phone" = $2`, groupId, phone);
    }
  }

  if (!member) return NextResponse.json(null);

  // Redact sensitive fields from public response
  const { email: _email, birthDate: _bd, ...safeFields } = member;
  void _email; void _bd;
  return NextResponse.json(safeFields);
}

export async function POST(req: Request, { params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params;

  // Rate limit: 5 registrations per IP per 10 min
  const ip = getIpKey(req);
  const allowed = await checkRateLimit(`member-post:${ip}`, 5, 10 * 60 * 1000);
  if (!allowed) return NextResponse.json({ error: "too_many_requests" }, { status: 429 });

  await ensureTables();

  const body = await req.json();
  const { name, phone, email, birthDate } = body;
  if (!name || !phone) return NextResponse.json({ error: "name and phone required" }, { status: 400 });

  const groupId = await getRestaurantGroupId(restaurantId);

  // Check if already exists (by restaurant or by group)
  const existingRows = groupId
    ? await prisma.$queryRawUnsafe<MemberRow[]>(
        `SELECT * FROM "LoyaltyMember" WHERE ("restaurantId" = $1 OR "groupId" = $2) AND "phone" = $3 LIMIT 1`,
        restaurantId, groupId, phone
      )
    : await prisma.$queryRawUnsafe<MemberRow[]>(
        `SELECT * FROM "LoyaltyMember" WHERE "restaurantId" = $1 AND "phone" = $2 LIMIT 1`,
        restaurantId, phone
      );

  if (existingRows.length > 0) {
    return NextResponse.json({ error: "already_member", member: existingRows[0] }, { status: 409 });
  }

  // Generate unique 6-digit member number — unique across the chain when grouped
  let memberNumber = "";
  for (let i = 0; i < 10; i++) {
    const candidate = String(Math.floor(100000 + Math.random() * 900000));
    const taken = groupId
      ? await prisma.$queryRawUnsafe<MemberRow[]>(
          `SELECT id FROM "LoyaltyMember" WHERE ("restaurantId" = $1 OR "groupId" = $2) AND "memberNumber" = $3 LIMIT 1`,
          restaurantId, groupId, candidate
        )
      : await prisma.$queryRawUnsafe<MemberRow[]>(
          `SELECT id FROM "LoyaltyMember" WHERE "restaurantId" = $1 AND "memberNumber" = $2 LIMIT 1`,
          restaurantId, candidate
        );
    if (taken.length === 0) { memberNumber = candidate; break; }
  }

  // Get welcome bonus from settings
  const settings = await prisma.loyaltySettings.findUnique({ where: { restaurantId } });
  const welcomeBonus = settings?.welcomeBonus ?? 50;

  const memberId = `lm-${crypto.randomUUID()}`;
  await prisma.$executeRawUnsafe(
    `INSERT INTO "LoyaltyMember" ("id","restaurantId","groupId","phone","name","email","birthDate","memberNumber","points","totalSpent","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,NOW(),NOW())`,
    memberId, restaurantId, groupId ?? null, phone, name,
    email || null, birthDate ? new Date(birthDate) : null, memberNumber, welcomeBonus
  );

  const member = (await prisma.$queryRawUnsafe<MemberRow[]>(
    `SELECT * FROM "LoyaltyMember" WHERE "id" = $1 LIMIT 1`, memberId
  ))[0];

  // Record welcome transaction
  if (welcomeBonus > 0) {
    await prisma.loyaltyTransaction.create({
      data: {
        id: `lt-${crypto.randomUUID()}`,
        memberId,
        type: "BONUS",
        points: welcomeBonus,
        note: "בונוס הצטרפות",
      },
    });
  }

  return NextResponse.json(member, { status: 201 });
}
