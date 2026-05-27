import { prisma } from "@/lib/prisma";
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
}

export async function GET(req: Request, { params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params;
  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone");
  if (!phone) return NextResponse.json({ error: "phone required" }, { status: 400 });

  await ensureTables();

  const member = await prisma.loyaltyMember.findUnique({
    where: { restaurantId_phone: { restaurantId, phone } },
    include: {
      transactions: { orderBy: { createdAt: "desc" }, take: 20 },
      coupons: { where: { usedAt: null }, orderBy: { createdAt: "desc" } },
    },
  });

  return NextResponse.json(member);
}

export async function POST(req: Request, { params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params;
  await ensureTables();

  const body = await req.json();
  const { name, phone, email, birthDate } = body;
  if (!name || !phone) return NextResponse.json({ error: "name and phone required" }, { status: 400 });

  // Check if already exists
  const existing = await prisma.loyaltyMember.findUnique({
    where: { restaurantId_phone: { restaurantId, phone } },
  });
  if (existing) return NextResponse.json({ error: "already_member", member: existing }, { status: 409 });

  // Generate unique 6-digit member number
  let memberNumber = "";
  for (let i = 0; i < 10; i++) {
    const candidate = String(Math.floor(100000 + Math.random() * 900000));
    const taken = await prisma.loyaltyMember.findUnique({
      where: { restaurantId_memberNumber: { restaurantId, memberNumber: candidate } },
    });
    if (!taken) { memberNumber = candidate; break; }
  }

  // Get welcome bonus from settings
  const settings = await prisma.loyaltySettings.findUnique({ where: { restaurantId } });
  const welcomeBonus = settings?.welcomeBonus ?? 50;

  const member = await prisma.loyaltyMember.create({
    data: {
      id: `lm-${Date.now()}`,
      restaurantId,
      phone,
      name,
      email: email || null,
      birthDate: birthDate ? new Date(birthDate) : null,
      memberNumber,
      points: welcomeBonus,
    },
  });

  // Record welcome transaction
  if (welcomeBonus > 0) {
    await prisma.loyaltyTransaction.create({
      data: {
        id: `lt-${Date.now()}`,
        memberId: member.id,
        type: "BONUS",
        points: welcomeBonus,
        note: "בונוס הצטרפות",
      },
    });
  }

  return NextResponse.json(member, { status: 201 });
}
