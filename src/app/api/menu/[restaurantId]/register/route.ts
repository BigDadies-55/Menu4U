import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const { restaurantId } = await params;
  const { name, phone, email } = await req.json();

  if (!name?.trim()) return NextResponse.json({ error: "שם נדרש" }, { status: 400 });

  // Check restaurant exists and is active
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId, isActive: true },
    select: { id: true },
  });
  if (!restaurant) return NextResponse.json({ error: "מסעדה לא נמצאה" }, { status: 404 });

  // Check for duplicate phone in this restaurant
  if (phone?.trim()) {
    const existing = await prisma.$queryRaw<{id:string}[]>`
      SELECT id FROM "Customer" WHERE "restaurantId" = ${restaurantId} AND phone = ${phone.trim()} LIMIT 1
    `;
    if (existing.length > 0) {
      return NextResponse.json({ error: "מספר טלפון כבר רשום" }, { status: 409 });
    }
  }

  const id = `cust_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  await prisma.$executeRawUnsafe(
    `INSERT INTO "Customer" ("id","restaurantId","name","phone","email","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,NOW(),NOW())`,
    id, restaurantId, name.trim(), phone?.trim() || null, email?.trim() || null
  );

  return NextResponse.json({ success: true });
}
