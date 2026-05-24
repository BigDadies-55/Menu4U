/**
 * Silent guest registration — called when a diner enters their name+phone
 * for table ordering. No OTP, no coupon. Inserts an unverified customer row.
 * If a customer (verified or not) with the same phone already exists, does nothing.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const { restaurantId } = await params;
  const { name, phone } = await req.json();

  const trimName  = name?.trim() ?? "";
  const trimPhone = phone?.trim().replace(/\s/g, "") ?? "";

  if (!trimName || !trimPhone) {
    return NextResponse.json({ ok: true }); // silent — no error
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId, isActive: true },
    select: { id: true },
  });
  if (!restaurant) return NextResponse.json({ ok: true });

  // Do nothing if phone already in table (verified or not)
  const existing = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Customer" WHERE "restaurantId" = ${restaurantId} AND phone = ${trimPhone} LIMIT 1
  `;
  if (existing.length > 0) return NextResponse.json({ ok: true });

  const id = `cust_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await prisma.$executeRawUnsafe(
    `INSERT INTO "Customer"
       ("id","restaurantId","name","phone","isVerified","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,false,NOW(),NOW())`,
    id, restaurantId, trimName, trimPhone
  );

  return NextResponse.json({ ok: true });
}
